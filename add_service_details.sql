-- Hembox service detail pages
alter table public.services
  add column if not exists slug text,
  add column if not exists hero_image_url text,
  add column if not exists long_description text,
  add column if not exists benefits text[] default '{}',
  add column if not exists deliverables text[] default '{}',
  add column if not exists process_steps jsonb default '[]'::jsonb,
  add column if not exists gallery_images jsonb default '[]'::jsonb,
  add column if not exists faqs jsonb default '[]'::jsonb;

update public.services
set slug = trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'))
where slug is null or slug = '';

create index if not exists services_slug_idx on public.services(slug);

alter table public.services enable row level security;
