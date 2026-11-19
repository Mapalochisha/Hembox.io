-- Product-led service catalogue and product-owned pricing.
alter table public.services
  add column if not exists parent_service_id uuid references public.services(id) on delete set null,
  add column if not exists page_type text not null default 'product',
  add column if not exists pricing_model text not null default 'quote',
  add column if not exists price_amount numeric(12,2),
  add column if not exists price_currency text not null default 'ZMW',
  add column if not exists price_suffix text,
  add column if not exists pricing_note text;

alter table public.services
  drop constraint if exists services_page_type_check,
  add constraint services_page_type_check check (page_type in ('family','product')),
  drop constraint if exists services_pricing_model_check,
  add constraint services_pricing_model_check check (pricing_model in ('fixed','starting_from','quote','packages')),
  drop constraint if exists services_price_amount_check,
  add constraint services_price_amount_check check (price_amount is null or price_amount >= 0),
  drop constraint if exists services_no_self_parent_check,
  add constraint services_no_self_parent_check check (parent_service_id is null or parent_service_id <> id);

create index if not exists services_parent_service_id_idx on public.services(parent_service_id);
create index if not exists services_public_catalogue_idx on public.services(status, page_type, sort_order);

alter table public.pricing_packages
  add column if not exists service_id uuid references public.services(id) on delete cascade,
  add column if not exists slug text,
  add column if not exists price_currency text not null default 'ZMW';

create index if not exists pricing_packages_service_idx
  on public.pricing_packages(service_id, status, sort_order);

alter table public.inquiries
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists pricing_package_id uuid references public.pricing_packages(id) on delete set null,
  add column if not exists product_snapshot jsonb;

create index if not exists inquiries_service_id_idx on public.inquiries(service_id);
create index if not exists inquiries_pricing_package_id_idx on public.inquiries(pricing_package_id);

-- Create the Website Design family without disturbing existing service records.
insert into public.services
  (title, description, icon_name, status, sort_order, slug, long_description, benefits, deliverables, page_type, pricing_model)
select
  'Website Design & Development',
  'Websites built around your business goals, from focused landing pages to complete business websites and online stores.',
  'Globe',
  'active',
  0,
  'websites',
  'Choose a website solution that fits your business today and gives you room to grow. HEMBOX plans, designs and builds responsive digital experiences with clear information architecture, purposeful calls to action and a practical handover. Explore the individual solutions below to compare scope and pricing.',
  array['A clear solution for your current business stage','Responsive experiences designed for real customers','A defined scope, transparent pricing and a guided delivery process'],
  array['Discovery and requirements alignment','Responsive design and development','Quality assurance and launch support'],
  'family',
  'quote'
where not exists (select 1 from public.services where slug = 'websites');

-- Create the SME Website product. Starter and Professional are packages of this product.
insert into public.services
  (title, description, icon_name, status, sort_order, slug, hero_image_url, long_description,
   benefits, deliverables, process_steps, faqs, page_type, pricing_model, parent_service_id)
select
  'SME Website',
  'A professional multi-page website for small and growing businesses, with Starter and Professional packages.',
  'Globe',
  'active',
  2,
  'sme-website',
  (select hero_image_url from public.services where slug = 'sme-website-starter' limit 1),
  'A professional online presence for a small business, with a package that matches the depth of your content and functionality. Choose Starter for a focused business website or Professional for a more comprehensive presence with expanded service and portfolio sections. Domain, hosting and paid third-party services are quoted separately.',
  array['A credible business presence online','A package matched to your business requirements','Responsive design and clear enquiry paths'],
  array['Website planning and information architecture','Custom responsive website design and development','Contact and enquiry functionality','Testing, launch and handover'],
  '[{"title":"Discovery","description":"Confirm business goals, audience, pages and content requirements."},{"title":"Structure and design","description":"Plan the site navigation and approve the visual direction."},{"title":"Development","description":"Build the responsive pages and agreed functionality."},{"title":"Testing and handover","description":"Test key journeys, launch and hand over agreed access and documentation."}]'::jsonb,
  '[{"question":"Which package should I choose?","answer":"Starter suits businesses that need a focused website of up to five pages. Professional is designed for businesses needing up to eight pages and richer service or portfolio sections."},{"question":"Are domain and hosting included?","answer":"No. Domain, hosting and paid third-party services are quoted separately unless included in your written proposal."}]'::jsonb,
  'product',
  'packages',
  (select id from public.services where slug = 'websites' limit 1)
where not exists (select 1 from public.services where slug = 'sme-website');

-- Assign the existing website solutions to the Website Design family.
update public.services
set parent_service_id = (select id from public.services where slug = 'websites' limit 1)
where slug in ('landing-page','ecommerce-online-ordering');

update public.services set title = 'Landing Pages' where slug = 'landing-page';

-- Keep the previous SME detail records for reference, but remove them from the public catalogue.
update public.services
set status = 'inactive'
where slug in ('sme-website-starter','sme-website-professional');

-- Move the current Starter and Professional tiers onto the SME Website product.
update public.pricing_packages
set service_id = (select id from public.services where slug = 'sme-website' limit 1),
    slug = 'starter',
    description = 'A professional small-business website of up to five pages, built to establish credibility and generate enquiries.',
    price_amount = 7500,
    price_suffix = '/project',
    price_currency = 'ZMW',
    features = array[
      'Up to five pages',
      'Responsive design',
      'Contact form and WhatsApp link',
      'Basic SEO metadata',
      'Social links',
      'Analytics integration where client accounts are supplied',
      'Two revision rounds'
    ],
    sort_order = 0
where lower(name) = 'starter';

update public.pricing_packages
set service_id = (select id from public.services where slug = 'sme-website' limit 1),
    slug = 'professional',
    description = 'A custom business website of up to eight pages for established SMEs seeking stronger presentation and lead generation.',
    price_amount = 12000,
    price_suffix = '/project',
    price_currency = 'ZMW',
    features = array[
      'Up to eight pages',
      'Custom visual design and responsive build',
      'Contact and enquiry form',
      'WhatsApp integration',
      'Service and portfolio sections',
      'Basic technical and on-page SEO',
      'Analytics setup where client accounts are supplied',
      'Two revision rounds'
    ],
    sort_order = 1
where lower(name) = 'professional';

-- Product-owned prices. Quotation-based services intentionally have no public amount.
update public.services set pricing_model='fixed', price_amount=4500, price_currency='ZMW', price_suffix='/project',
  pricing_note='Domain, hosting and paid third-party services are quoted separately.'
where slug='landing-page';

update public.services set pricing_model='starting_from', price_amount=20000, price_currency='ZMW', price_suffix='/project',
  pricing_note='Final scope and price depend on catalogue size, order workflow, integrations and payment-provider requirements.'
where slug='ecommerce-online-ordering';

update public.services set pricing_model='fixed', price_amount=2500, price_currency='ZMW', price_suffix='/project'
where slug='logo-design';

update public.services set pricing_model='fixed', price_amount=8000, price_currency='ZMW', price_suffix='/project'
where slug='brand-identity';

update public.services set pricing_model='quote', price_amount=null, price_suffix=null,
  pricing_note='Monthly pricing is confirmed after assessing the technology, complexity and agreed support scope.'
where slug='website-care-maintenance';

update public.services set pricing_model='starting_from', price_amount=10000, price_currency='ZMW', price_suffix='/project',
  pricing_note='Final pricing follows discovery and depends on workflow complexity, systems, API access and testing requirements.'
where slug='workflow-automation';

update public.services set pricing_model='starting_from', price_amount=15000, price_currency='ZMW', price_suffix='/project',
  pricing_note='Paid discovery and milestone-based implementation quotation. Infrastructure and third-party licences are separate.'
where slug='custom-software-business-systems';
