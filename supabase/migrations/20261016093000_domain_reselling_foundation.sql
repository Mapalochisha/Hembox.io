-- HEMBOX.io domain-reselling foundation.
-- This migration is committed to the feature branch only; it has NOT been
-- applied to the production Supabase project.

create table if not exists public.domain_tld_catalog (
  tld text primary key check (tld ~ '^[.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])$'),
  provider_id text not null,
  wholesale_currency text not null check (wholesale_currency ~ '^[A-Z]{3}$'),
  registration_wholesale_minor bigint check (registration_wholesale_minor >= 0),
  renewal_wholesale_minor bigint check (renewal_wholesale_minor >= 0),
  retail_currency text not null default 'ZMW' check (retail_currency ~ '^[A-Z]{3}$'),
  registration_retail_minor bigint check (registration_retail_minor >= 0),
  renewal_retail_minor bigint check (renewal_retail_minor >= 0),
  enabled boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not enabled or (registration_retail_minor is not null and renewal_retail_minor is not null))
);

create table if not exists public.domain_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  customer_email text not null check (length(trim(customer_email)) between 3 and 254),
  customer_name text check (customer_name is null or length(customer_name) <= 120),
  domain_name text not null check (
    length(domain_name) between 3 and 253
    and domain_name = lower(domain_name)
    and domain_name ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
  ),
  status text not null default 'enquiry' check (status in (
    'enquiry',
    'quoted',
    'awaiting_payment',
    'payment_confirmed',
    'registration_pending',
    'registered',
    'registration_failed',
    'cancelled',
    'refunded',
    'manual_review'
  )),
  retail_currency text not null default 'ZMW' check (retail_currency ~ '^[A-Z]{3}$'),
  registration_retail_minor bigint check (registration_retail_minor is null or registration_retail_minor >= 0),
  renewal_retail_minor bigint check (renewal_retail_minor is null or renewal_retail_minor >= 0),
  wholesale_currency text check (wholesale_currency is null or wholesale_currency ~ '^[A-Z]{3}$'),
  registration_wholesale_minor bigint check (registration_wholesale_minor is null or registration_wholesale_minor >= 0),
  renewal_wholesale_minor bigint check (renewal_wholesale_minor is null or renewal_wholesale_minor >= 0),
  quote_expires_at timestamptz,
  provider_id text,
  provider_order_reference text,
  provider_domain_reference text,
  registered_at timestamptz,
  expires_at timestamptz,
  idempotency_key text unique,
  provider_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'registered' or (provider_id is not null and registered_at is not null))
);

create index if not exists domain_orders_customer_created_idx
  on public.domain_orders (customer_id, created_at desc)
  where customer_id is not null;
create index if not exists domain_orders_status_created_idx
  on public.domain_orders (status, created_at desc);
create index if not exists domain_orders_domain_name_idx
  on public.domain_orders (domain_name);

create table if not exists public.domain_audit_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.domain_orders(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (length(trim(event_type)) between 1 and 100),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists domain_audit_events_order_created_idx
  on public.domain_audit_events (order_id, created_at desc);
create index if not exists domain_audit_events_created_idx
  on public.domain_audit_events (created_at desc);

alter table public.domain_tld_catalog enable row level security;
alter table public.domain_orders enable row level security;
alter table public.domain_audit_events enable row level security;

-- Make table privileges explicit instead of relying on project default grants.
revoke all on public.domain_tld_catalog from anon, authenticated;
revoke all on public.domain_orders from anon, authenticated;
revoke all on public.domain_audit_events from anon, authenticated;
grant select on public.domain_orders to authenticated;
grant select on public.domain_audit_events to authenticated;
grant all on public.domain_tld_catalog to service_role;
grant all on public.domain_orders to service_role;
grant all on public.domain_audit_events to service_role;

-- Catalog and audit writes are server-only via the service-role client.
-- Customers can only read orders explicitly linked to their own account.
drop policy if exists "Customers can read their own domain orders" on public.domain_orders;
create policy "Customers can read their own domain orders"
  on public.domain_orders
  for select
  to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists "Admins can read domain orders" on public.domain_orders;
create policy "Admins can read domain orders"
  on public.domain_orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

drop policy if exists "Admins can read domain audit events" on public.domain_audit_events;
create policy "Admins can read domain audit events"
  on public.domain_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

create or replace function public.set_domain_updated_at()
returns trigger
language plpgsql
set search_path = ''
as 'BEGIN
  new.updated_at = now();
  return new;
END;';

revoke all on function public.set_domain_updated_at() from public, anon, authenticated;


drop trigger if exists set_domain_tld_catalog_updated_at on public.domain_tld_catalog;
create trigger set_domain_tld_catalog_updated_at
  before update on public.domain_tld_catalog
  for each row execute function public.set_domain_updated_at();

drop trigger if exists set_domain_orders_updated_at on public.domain_orders;
create trigger set_domain_orders_updated_at
  before update on public.domain_orders
  for each row execute function public.set_domain_updated_at();

comment on table public.domain_tld_catalog is
  'Server-managed TLD price catalogue. Do not expose wholesale costs through public APIs.';
comment on table public.domain_orders is
  'Domain order lifecycle and price snapshots. Live registration is not enabled by this schema alone.';
comment on table public.domain_audit_events is
  'Server-written operational audit events; redact secrets and unnecessary personal data from details.';

  ),
  status text not null default 'enquiry' check (status in (
    'enquiry',
    'quoted',
    'awaiting_payment',
    'payment_confirmed',
    'registration_pending',
    'registered',
    'registration_failed',
    'cancelled',
    'refunded',
    'manual_review'
  )),
  retail_currency text not null default 'ZMW' check (retail_currency ~ '^[A-Z]{3}$'),
  registration_retail_minor bigint check (registration_retail_minor is null or registration_retail_minor >= 0),
  renewal_retail_minor bigint check (renewal_retail_minor is null or renewal_retail_minor >= 0),
  wholesale_currency text check (wholesale_currency is null or wholesale_currency ~ '^[A-Z]{3}$'),
  registration_wholesale_minor bigint check (registration_wholesale_minor is null or registration_wholesale_minor >= 0),
  renewal_wholesale_minor bigint check (renewal_wholesale_minor is null or renewal_wholesale_minor >= 0),
  quote_expires_at timestamptz,
  provider_id text,
  provider_order_reference text,
  provider_domain_reference text,
  registered_at timestamptz,
  expires_at timestamptz,
  idempotency_key text unique,
  provider_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'registered' or (provider_id is not null and registered_at is not null))
);

create index if not exists domain_orders_customer_created_idx
  on public.domain_orders (customer_id, created_at desc)
  where customer_id is not null;
create index if not exists domain_orders_status_created_idx
  on public.domain_orders (status, created_at desc);
create index if not exists domain_orders_domain_name_idx
  on public.domain_orders (domain_name);

create table if not exists public.domain_audit_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.domain_orders(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (length(trim(event_type)) between 1 and 100),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists domain_audit_events_order_created_idx
  on public.domain_audit_events (order_id, created_at desc);
create index if not exists domain_audit_events_created_idx
  on public.domain_audit_events (created_at desc);

alter table public.domain_tld_catalog enable row level security;
alter table public.domain_orders enable row level security;
alter table public.domain_audit_events enable row level security;

-- Make table privileges explicit instead of relying on project default grants.
revoke all on public.domain_tld_catalog from anon, authenticated;
revoke all on public.domain_orders from anon, authenticated;
revoke all on public.domain_audit_events from anon, authenticated;
grant select on public.domain_orders to authenticated;
grant select on public.domain_audit_events to authenticated;
grant all on public.domain_tld_catalog to service_role;
grant all on public.domain_orders to service_role;
grant all on public.domain_audit_events to service_role;

-- Catalog and audit writes are server-only via the service-role client.
-- Customers can only read orders explicitly linked to their own account.
drop policy if exists "Customers can read their own domain orders" on public.domain_orders;
create policy "Customers can read their own domain orders"
  on public.domain_orders
  for select
  to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists "Admins can read domain orders" on public.domain_orders;
create policy "Admins can read domain orders"
  on public.domain_orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

drop policy if exists "Admins can read domain audit events" on public.domain_audit_events;
create policy "Admins can read domain audit events"
  on public.domain_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

create or replace function public.set_domain_updated_at()
returns trigger
language plpgsql
set search_path = ''
as 'BEGIN
  new.updated_at = now();
  return new;
END;';

revoke all on function public.set_domain_updated_at() from public, anon, authenticated;


drop trigger if exists set_domain_tld_catalog_updated_at on public.domain_tld_catalog;
create trigger set_domain_tld_catalog_updated_at
  before update on public.domain_tld_catalog
  for each row execute function public.set_domain_updated_at();

drop trigger if exists set_domain_orders_updated_at on public.domain_orders;
create trigger set_domain_orders_updated_at
  before update on public.domain_orders
  for each row execute function public.set_domain_updated_at();

comment on table public.domain_tld_catalog is
  'Server-managed TLD price catalogue. Do not expose wholesale costs through public APIs.';
comment on table public.domain_orders is
  'Domain order lifecycle and price snapshots. Live registration is not enabled by this schema alone.';
comment on table public.domain_audit_events is
  'Server-written operational audit events; redact secrets and unnecessary personal data from details.';
