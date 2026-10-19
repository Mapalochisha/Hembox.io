-- Feature branch only. This scaffolds quotes and payment tracking; it enables no gateway.
create table if not exists public.domain_order_quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.domain_orders(id) on delete restrict,
  sequence integer not null check (sequence > 0),
  idempotency_key text not null unique check (length(trim(idempotency_key)) between 8 and 200),
  domain_name text not null check (domain_name = lower(domain_name) and length(domain_name) between 3 and 253 and domain_name ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'),
  currency text not null default 'ZMW' check (currency = 'ZMW'),
  registration_price_minor bigint not null check (registration_price_minor > 0),
  renewal_price_minor bigint not null check (renewal_price_minor > 0),
  term_years integer not null default 1 check (term_years between 1 and 10),
  total_due_minor bigint not null check (total_due_minor > 0),
  pricing_source text not null check (length(trim(pricing_source)) between 1 and 160),
  pricing_captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at),
  check (total_due_minor = registration_price_minor * term_years),
  unique (order_id, sequence)
);
create index if not exists domain_order_quotes_order_created_idx on public.domain_order_quotes (order_id, created_at desc);
alter table public.domain_order_quotes enable row level security;
revoke all on public.domain_order_quotes from anon, authenticated;
grant select on public.domain_order_quotes to authenticated;
grant all on public.domain_order_quotes to service_role;
create policy "Admins can read domain order quotes" on public.domain_order_quotes for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create or replace function public.prevent_domain_quote_mutation()
returns trigger language plpgsql set search_path = ''
as $$ begin raise exception 'Quote snapshots are immutable; create a new quote'; end; $$;
revoke all on function public.prevent_domain_quote_mutation() from public, anon, authenticated;
create trigger domain_order_quotes_immutable before update or delete on public.domain_order_quotes
  for each row execute function public.prevent_domain_quote_mutation();

create table if not exists public.domain_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.domain_orders(id) on delete restrict,
  provider_id text not null check (length(trim(provider_id)) between 1 and 80),
  idempotency_key text not null unique check (length(trim(idempotency_key)) between 8 and 200),
  provider_payment_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'ZMW' check (currency = 'ZMW'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed', 'cancelled', 'refunded', 'unknown')),
  last_webhook_event_id text,
  last_checked_at timestamptz,
  confirmed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'confirmed' or confirmed_at is not null)
);
create unique index if not exists domain_payment_provider_payment_uidx on public.domain_payment_attempts (provider_id, provider_payment_id) where provider_payment_id is not null;
create unique index if not exists domain_payment_webhook_event_uidx on public.domain_payment_attempts (provider_id, last_webhook_event_id) where last_webhook_event_id is not null;
create index if not exists domain_payment_attempts_order_created_idx on public.domain_payment_attempts (order_id, created_at desc);
alter table public.domain_payment_attempts enable row level security;
revoke all on public.domain_payment_attempts from anon, authenticated;
grant select on public.domain_payment_attempts to authenticated;
grant all on public.domain_payment_attempts to service_role;
create policy "Admins can read domain payment attempts" on public.domain_payment_attempts for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop trigger if exists set_domain_payment_attempts_updated_at on public.domain_payment_attempts;
create trigger set_domain_payment_attempts_updated_at before update on public.domain_payment_attempts
  for each row execute function public.set_domain_updated_at();

comment on table public.domain_order_quotes is 'Immutable server-generated ZMW quote snapshots; expired quotes must be replaced, never edited.';
comment on table public.domain_payment_attempts is 'Payment integration scaffold only. No gateway is enabled; metadata must not contain secrets or raw webhook payloads.';
