-- Production migration 20261101142511: registrant details table and owner/admin read policies.
-- The corresponding migration is already present in the production history.

-- Domain registrant details and checkout review data.
-- Feature branch only. Do not apply to production without explicit authorization.
--
-- Why this exists:
--   A registrar registration legally requires registrant contact details
--   (name, organisation, address, phone, email, country). Before this migration
--   the customer flow captured none of them, so an administrator could not
--   complete a real registration at all, and there was no recorded consent to
--   pass the customer's details to the registrar.
--
-- Scope of this migration:
--   * one immutable-per-order snapshot of the registrant details and the
--     consent/terms version the customer accepted,
--   * owner-scoped reads only; writes go through a server-side function,
--   * minimal audit events that never copy the full address into the audit log,
--   * a hard guard so a registration cannot be recorded without registrant
--     details, independent of any UI.

create table if not exists public.domain_order_registrant_details (
  order_id uuid primary key references public.domain_orders(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete restrict,
  registrant_type text not null check (registrant_type in ('individual', 'organisation')),
  first_name text not null check (length(trim(first_name)) between 1 and 60),
  last_name text not null check (length(trim(last_name)) between 1 and 60),
  organisation_name text check (organisation_name is null or length(trim(organisation_name)) between 1 and 120),
  email text not null check (length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  phone text not null check (phone ~ '^[+][0-9]{7,15}$'),
  address_line1 text not null check (length(trim(address_line1)) between 3 and 120),
  address_line2 text check (address_line2 is null or length(trim(address_line2)) between 1 and 120),
  city text not null check (length(trim(city)) between 2 and 80),
  region text not null check (length(trim(region)) between 2 and 80),
  postal_code text check (postal_code is null or length(trim(postal_code)) between 2 and 20),
  country_code text not null default 'ZM' check (country_code ~ '^[A-Z]{2}$'),
  consent_version text not null check (length(trim(consent_version)) between 3 and 60),
  consent_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_by uuid references auth.users(id) on delete set null,
  check (registrant_type <> 'organisation' or organisation_name is not null)
);

alter table public.domain_order_registrant_details enable row level security;
revoke all on public.domain_order_registrant_details from anon, authenticated;
grant select on public.domain_order_registrant_details to authenticated;
grant all on public.domain_order_registrant_details to service_role;

drop policy if exists "Customers can read their own domain registrant details" on public.domain_order_registrant_details;
create policy "Customers can read their own domain registrant details"
  on public.domain_order_registrant_details for select to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists "Admins can read domain registrant details" on public.domain_order_registrant_details;
create policy "Admins can read domain registrant details"
  on public.domain_order_registrant_details for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

drop trigger if exists set_domain_order_registrant_details_updated_at on public.domain_order_registrant_details;
create trigger set_domain_order_registrant_details_updated_at
  before update on public.domain_order_registrant_details
  for each row execute function public.set_domain_updated_at();

comment on table public.domain_order_registrant_details is
  'Registrant contact details supplied by the customer for one domain order. Read-only for the owning customer; writes happen only through save_domain_order_registrant_details(). Treat as personal data.';
