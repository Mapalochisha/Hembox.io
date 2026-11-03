-- Customer requests for isolated NameSilo OTE sandbox domains.
create table if not exists public.domain_sandbox_management_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.domain_sandbox_orders(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete restrict,
  request_type text not null check (request_type in ('renewal','nameservers')),
  requested_years integer check (requested_years between 1 and 10),
  requested_nameservers text[],
  previous_expires_at timestamptz,
  previous_nameservers text[] not null default '{}',
  customer_note text,
  status text not null default 'requested'
    check (status in ('requested','processing','applied','rejected','failed','unknown')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  applied_at timestamptz,
  provider_result jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint domain_sandbox_management_request_payload_check check (
    (request_type = 'renewal' and requested_years is not null and requested_nameservers is null)
    or (request_type = 'nameservers' and requested_years is null and cardinality(requested_nameservers) between 2 and 8)
  ),
  constraint domain_sandbox_management_idempotency_check check (length(idempotency_key) between 8 and 120)
);
create unique index if not exists domain_sandbox_management_customer_idempotency_idx
  on public.domain_sandbox_management_requests(customer_id,idempotency_key);
create index if not exists domain_sandbox_management_status_created_idx
  on public.domain_sandbox_management_requests(status,created_at desc);
create index if not exists domain_sandbox_management_order_created_idx
  on public.domain_sandbox_management_requests(order_id,created_at desc);
drop trigger if exists set_domain_sandbox_management_updated_at on public.domain_sandbox_management_requests;
create trigger set_domain_sandbox_management_updated_at
  before update on public.domain_sandbox_management_requests
  for each row execute function public.set_domain_updated_at();
alter table public.domain_sandbox_management_requests enable row level security;
revoke all on public.domain_sandbox_management_requests from anon,authenticated;
grant all on public.domain_sandbox_management_requests to service_role;
comment on table public.domain_sandbox_management_requests is
  'Customer-initiated renewal and nameserver requests for isolated NameSilo OTE sandbox domains. Registrar mutations require administrator approval.';
