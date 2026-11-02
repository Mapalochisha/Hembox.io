-- Isolated end-to-end NameSilo OTE rehearsal. These rows are deliberately
-- separate from production domain orders, invoices and payment claims.
-- No real payment is accepted or represented by this workflow.

create table if not exists public.domain_sandbox_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete restrict,
  domain_name text not null,
  term_years integer not null default 1 check (term_years between 1 and 10),
  status text not null default 'quoted'
    check (status in ('quoted','registration_pending','registration_unknown','registered','registration_failed')),
  payment_mode text not null default 'sandbox_simulated'
    check (payment_mode = 'sandbox_simulated'),
  payment_status text not null default 'not_started'
    check (payment_status in ('not_started','simulated')),
  registrant_details jsonb not null,
  provider_id text not null default 'namesilo',
  provider_environment text not null default 'test'
    check (provider_environment = 'test'),
  provider_code integer,
  provider_order_reference text,
  provider_order_amount text,
  registered_at timestamptz,
  expires_at timestamptz,
  nameservers text[] not null default '{}',
  last_provider_check_at timestamptz,
  last_provider_message text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint domain_sandbox_orders_domain_check
    check (domain_name = lower(domain_name) and domain_name ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'),
  constraint domain_sandbox_orders_idempotency_check
    check (length(idempotency_key) between 8 and 120)
);

create unique index if not exists domain_sandbox_orders_customer_idempotency_idx
  on public.domain_sandbox_orders(customer_id, idempotency_key);
create index if not exists domain_sandbox_orders_customer_created_idx
  on public.domain_sandbox_orders(customer_id, created_at desc);
create index if not exists domain_sandbox_orders_status_created_idx
  on public.domain_sandbox_orders(status, created_at desc);
create unique index if not exists domain_sandbox_orders_active_domain_idx
  on public.domain_sandbox_orders(domain_name)
  where status in ('registration_pending','registration_unknown','registered');

drop trigger if exists set_domain_sandbox_orders_updated_at on public.domain_sandbox_orders;
create trigger set_domain_sandbox_orders_updated_at
  before update on public.domain_sandbox_orders
  for each row execute function public.set_domain_updated_at();

create table if not exists public.domain_sandbox_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.domain_sandbox_orders(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint domain_sandbox_events_type_check
    check (event_type in ('order_created','payment_simulated','registration_started','registration_acknowledged','registration_reconciled','registration_failed','registration_ambiguous','domain_info_checked','renewal_applied','nameservers_changed'))
);

alter table public.domain_sandbox_orders enable row level security;
alter table public.domain_sandbox_events enable row level security;
revoke all on public.domain_sandbox_orders from anon, authenticated;
revoke all on public.domain_sandbox_events from anon, authenticated;
grant all on public.domain_sandbox_orders to service_role;
grant all on public.domain_sandbox_events to service_role;

comment on table public.domain_sandbox_orders is
  'Isolated NameSilo OTE test orders. Not production orders and never linked to billing invoices or real payment claims. Registrant details are server-only.';
comment on column public.domain_sandbox_orders.payment_mode is
  'Always sandbox_simulated. This is an explicit test acknowledgement, not a payment or payment claim.';
comment on column public.domain_sandbox_orders.provider_environment is
  'Always test. The application must reject all writes unless NameSilo OTE mode is configured.';
