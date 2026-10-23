-- HEMBOX.io unified billing ledger foundation.
-- Additive feature-branch migration. Do not apply to production without explicit approval.

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique check (length(trim(invoice_number)) between 4 and 40),
  customer_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','unpaid','partially_paid','paid','overdue','void')),
  currency text not null default 'ZMW' check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  source_type text check (source_type is null or source_type in ('website_plan','domain_registration','domain_renewal','addon','custom_work','adjustment','other')),
  source_id uuid,
  customer_note text check (customer_note is null or length(customer_note) <= 1000),
  commercial_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(commercial_snapshot) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_minor = subtotal_minor + tax_minor),
  check ((status = 'draft' and issued_at is null) or status <> 'draft'),
  check (status <> 'paid' or paid_at is not null)
);
create index if not exists billing_invoices_customer_created_idx on public.billing_invoices(customer_id, created_at desc);
create index if not exists billing_invoices_status_due_idx on public.billing_invoices(status, due_at) where status not in ('draft','paid','void');
create unique index if not exists billing_invoices_source_uidx on public.billing_invoices(source_type, source_id) where source_type is not null and source_id is not null and status <> 'void';

create table if not exists public.billing_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id) on delete restrict,
  description text not null check (length(trim(description)) between 1 and 240),
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  line_total_minor bigint generated always as (quantity::bigint * unit_amount_minor) stored,
  source_type text,
  source_id uuid,
  item_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(item_snapshot) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists billing_invoice_items_invoice_idx on public.billing_invoice_items(invoice_id);

create table if not exists public.billing_payment_methods (
  id uuid primary key default gen_random_uuid(),
  method_key text not null unique check (method_key ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  supported_currencies text[] not null default array['ZMW']::text[],
  instructions text not null check (length(trim(instructions)) between 1 and 4000),
  active boolean not null default false,
  version integer not null default 1 check (version > 0),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(supported_currencies) > 0),
  check (supported_currencies <@ array['ZMW','USD']::text[])
);

create table if not exists public.billing_payment_claims (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  payment_method_id uuid references public.billing_payment_methods(id) on delete restrict,
  method_key_snapshot text not null check (length(trim(method_key_snapshot)) between 1 and 40),
  method_name_snapshot text not null check (length(trim(method_name_snapshot)) between 1 and 100),
  method_instructions_snapshot text not null check (length(trim(method_instructions_snapshot)) between 1 and 4000),
  method_version_snapshot integer not null check (method_version_snapshot > 0),
  idempotency_key text not null unique check (length(trim(idempotency_key)) between 8 and 120),
  transaction_reference text not null check (length(trim(transaction_reference)) between 3 and 160),
  claimed_amount_minor bigint not null check (claimed_amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  customer_note text check (customer_note is null or length(customer_note) <= 1000),
  receipt_object_key text check (receipt_object_key is null or (length(receipt_object_key) between 1 and 500 and receipt_object_key !~ '^https?://')),
  receipt_mime_type text check (receipt_mime_type is null or receipt_mime_type in ('image/png','image/jpeg','application/pdf')),
  receipt_size_bytes bigint check (receipt_size_bytes is null or receipt_size_bytes between 1 and 10485760),
  status text not null default 'submitted' check (status in ('submitted','needs_info','verified','rejected','withdrawn')),
  review_note text check (review_note is null or length(review_note) <= 1000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  verified_payment_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((receipt_object_key is null) = (receipt_mime_type is null)),
  check ((status in ('needs_info','verified','rejected')) = (reviewed_at is not null)),
  check ((status in ('needs_info','verified','rejected')) = (reviewed_by is not null)),
  check ((status = 'verified') = (verified_payment_id is not null))
);
create index if not exists billing_payment_claims_invoice_created_idx on public.billing_payment_claims(invoice_id, created_at desc);
create index if not exists billing_payment_claims_review_queue_idx on public.billing_payment_claims(status, created_at asc) where status in ('submitted','needs_info');

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'verified' check (status in ('verified','reversed')),
  source_type text not null check (source_type in ('manual_claim','gateway','admin_adjustment','other')),
  source_reference text not null check (length(trim(source_reference)) between 1 and 200),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz not null default now(),
  idempotency_key text not null unique check (length(trim(idempotency_key)) between 8 and 160),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create unique index if not exists billing_payments_source_reference_uidx on public.billing_payments(source_type, source_reference);

do $constraints$
begin
  if not exists (select 1 from pg_constraint where conname = 'billing_payment_claims_verified_payment_fk' and conrelid = 'public.billing_payment_claims'::regclass) then
    alter table public.billing_payment_claims add constraint billing_payment_claims_verified_payment_fk
      foreign key (verified_payment_id) references public.billing_payments(id) on delete restrict;
  end if;
end;
$constraints$;

create table if not exists public.billing_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.billing_payments(id) on delete restrict,
  invoice_id uuid not null references public.billing_invoices(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  allocation_type text not null default 'allocate' check (allocation_type in ('allocate','reverse')),
  reverses_allocation_id uuid references public.billing_payment_allocations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  idempotency_key text not null unique check (length(trim(idempotency_key)) between 8 and 160),
  reason text check (reason is null or length(reason) <= 1000),
  created_at timestamptz not null default now(),
  check ((allocation_type = 'reverse') = (reverses_allocation_id is not null))
);
create index if not exists billing_allocations_invoice_idx on public.billing_payment_allocations(invoice_id, created_at);
create index if not exists billing_allocations_payment_idx on public.billing_payment_allocations(payment_id, created_at);
create unique index if not exists billing_allocations_one_reversal_idx on public.billing_payment_allocations(reverses_allocation_id) where reverses_allocation_id is not null;

create table if not exists public.billing_arrangement_requests (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  conversation_id uuid,
  requested_method_key text check (requested_method_key is null or length(requested_method_key) <= 40),
  requested_terms text not null check (length(trim(requested_terms)) between 5 and 3000),
  requested_currency text not null check (requested_currency ~ '^[A-Z]{3}$'),
  requested_amount_minor bigint check (requested_amount_minor is null or requested_amount_minor > 0),
  status text not null default 'pending' check (status in ('pending','approved','declined','cancelled','accepted','expired')),
  decision_note text check (decision_note is null or length(decision_note) <= 1000),
  agreed_terms text check (agreed_terms is null or length(agreed_terms) <= 3000),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  customer_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('approved','declined','accepted','expired')) = (decided_at is not null)),
  check ((status = 'accepted') = (customer_confirmed_at is not null))
);
create index if not exists billing_arrangements_invoice_idx on public.billing_arrangement_requests(invoice_id, created_at desc);
create index if not exists billing_arrangements_review_queue_idx on public.billing_arrangement_requests(status, created_at asc) where status = 'pending';

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.billing_invoices(id) on delete restrict,
  payment_id uuid references public.billing_payments(id) on delete restrict,
  claim_id uuid references public.billing_payment_claims(id) on delete restrict,
  arrangement_request_id uuid references public.billing_arrangement_requests(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (length(trim(event_type)) between 3 and 100),
  idempotency_key text unique check (idempotency_key is null or length(trim(idempotency_key)) between 8 and 160),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists billing_events_invoice_idx on public.billing_events(invoice_id, created_at desc);
create index if not exists billing_events_created_idx on public.billing_events(created_at desc);

-- Explicitly restrict browser writes. Mutations are performed through reviewed server routes/RPCs.
alter table public.billing_invoices enable row level security;
alter table public.billing_invoice_items enable row level security;
alter table public.billing_payment_methods enable row level security;
alter table public.billing_payment_claims enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_payment_allocations enable row level security;
alter table public.billing_arrangement_requests enable row level security;
alter table public.billing_events enable row level security;

revoke all on public.billing_invoices, public.billing_invoice_items, public.billing_payment_methods, public.billing_payment_claims, public.billing_payments, public.billing_payment_allocations, public.billing_arrangement_requests, public.billing_events from anon, authenticated;
grant select on public.billing_invoices, public.billing_invoice_items, public.billing_payment_claims, public.billing_payment_allocations, public.billing_arrangement_requests, public.billing_events to authenticated;
grant select on public.billing_payment_methods to authenticated;
grant all on public.billing_invoices, public.billing_invoice_items, public.billing_payment_methods, public.billing_payment_claims, public.billing_payments, public.billing_payment_allocations, public.billing_arrangement_requests, public.billing_events to service_role;

create policy billing_invoice_customer_read on public.billing_invoices for select to authenticated using (customer_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy billing_invoice_items_customer_read on public.billing_invoice_items for select to authenticated using (exists (select 1 from public.billing_invoices i where i.id = invoice_id and (i.customer_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))));
create policy billing_payment_methods_active_read on public.billing_payment_methods for select to authenticated using (active or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy billing_claim_customer_read on public.billing_payment_claims for select to authenticated using (customer_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy billing_payments_customer_read on public.billing_payments for select to authenticated using (customer_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy billing_allocations_customer_read on public.billing_payment_allocations for select to authenticated using (exists (select 1 from public.billing_invoices i where i.id = invoice_id and (i.customer_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))));
create policy billing_arrangements_customer_read on public.billing_arrangement_requests for select to authenticated using (customer_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy billing_events_customer_read on public.billing_events for select to authenticated using (exists (select 1 from public.billing_invoices i where i.id = invoice_id and (i.customer_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- Financial/audit rows are append-only through normal SQL access.
create or replace function public.prevent_billing_event_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Billing events are append-only' using errcode = '23514';
end;
$$;
revoke all on function public.prevent_billing_event_mutation() from public, anon, authenticated;
drop trigger if exists prevent_billing_event_update on public.billing_events;
create trigger prevent_billing_event_update before update or delete on public.billing_events for each row execute function public.prevent_billing_event_mutation();

-- Issued invoice commercial terms cannot be edited in place. Amend by issuing a new record/adjustment.
create or replace function public.guard_billing_invoice_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' and (new.currency is distinct from old.currency or new.subtotal_minor is distinct from old.subtotal_minor or new.tax_minor is distinct from old.tax_minor or new.total_minor is distinct from old.total_minor or new.customer_id is distinct from old.customer_id or new.invoice_number is distinct from old.invoice_number) then
    raise exception 'Issued invoice commercial terms are immutable' using errcode = '23514';
  end if;
  if old.status in ('paid','void') and new.status is distinct from old.status then
    raise exception 'Paid or void invoices cannot change status directly' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.guard_billing_invoice_update() from public, anon, authenticated;
drop trigger if exists guard_billing_invoice_update on public.billing_invoices;
create trigger guard_billing_invoice_update before update on public.billing_invoices for each row execute function public.guard_billing_invoice_update();

create or replace function public.guard_billing_invoice_item_mutation() returns trigger
language plpgsql set search_path = '' as $$
declare v_invoice_id uuid; v_status text;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);
  select status into v_status from public.billing_invoices where id = v_invoice_id for update;
  if v_status is distinct from 'draft' then raise exception 'Invoice items can only change while invoice is draft' using errcode = '23514'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.guard_billing_invoice_item_mutation() from public, anon, authenticated;
drop trigger if exists guard_billing_invoice_item_mutation on public.billing_invoice_items;
create trigger guard_billing_invoice_item_mutation before insert or update or delete on public.billing_invoice_items for each row execute function public.guard_billing_invoice_item_mutation();

-- Atomically verify a claim, create one verified payment, allocate it to the invoice, and update the invoice state.
create or replace function public.review_billing_payment_claim(p_claim_id uuid, p_admin_id uuid, p_decision text, p_review_note text default null)
returns table(claim_status text, invoice_status text, payment_id uuid, allocated_minor bigint)
language plpgsql security definer set search_path = '' as $$
declare v_claim public.billing_payment_claims%rowtype; v_invoice public.billing_invoices%rowtype; v_payment_id uuid; v_balance bigint; v_allocated bigint; v_new_status text;
begin
  if p_admin_id is null or not exists (select 1 from public.profiles p where p.id = p_admin_id and p.role = 'admin') then raise exception 'Administrator required' using errcode = '42501'; end if;
  if p_decision not in ('verified','rejected','needs_info') then raise exception 'Invalid claim decision' using errcode = '22023'; end if;
  select * into v_claim from public.billing_payment_claims where id = p_claim_id for update;
  if not found then raise exception 'Payment claim not found' using errcode = 'P0002'; end if;
  if v_claim.status = 'verified' then
    return query select v_claim.status, i.status, v_claim.verified_payment_id, v_claim.claimed_amount_minor from public.billing_invoices i where i.id = v_claim.invoice_id;
    return;
  end if;
  if v_claim.status not in ('submitted','needs_info') then raise exception 'Claim is not reviewable' using errcode = '23514'; end if;
  select * into v_invoice from public.billing_invoices where id = v_claim.invoice_id for update;
  if not found or v_invoice.customer_id <> v_claim.customer_id then raise exception 'Invoice/customer mismatch' using errcode = '23514'; end if;
  if p_decision = 'verified' then
    if v_invoice.status not in ('unpaid','partially_paid','overdue') then raise exception 'Invoice is not payable' using errcode = '23514'; end if;
    if v_invoice.currency <> v_claim.currency then raise exception 'Claim currency does not match invoice' using errcode = '23514'; end if;
    select coalesce(sum(case when a.allocation_type = 'allocate' then a.amount_minor else -a.amount_minor end), 0)::bigint into v_allocated from public.billing_payment_allocations a where a.invoice_id = v_invoice.id;
    v_balance := v_invoice.total_minor - v_allocated;
    if v_claim.claimed_amount_minor > v_balance then raise exception 'Claim exceeds invoice outstanding balance' using errcode = '23514'; end if;
    insert into public.billing_payments(customer_id,currency,amount_minor,status,source_type,source_reference,verified_by,verified_at,idempotency_key,metadata)
    values(v_claim.customer_id,v_claim.currency,v_claim.claimed_amount_minor,'verified','manual_claim',v_claim.id::text,p_admin_id,now(),'billing-claim:'||v_claim.id::text,jsonb_build_object('claim_id',v_claim.id))
    on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key returning id into v_payment_id;
    insert into public.billing_payment_allocations(payment_id,invoice_id,amount_minor,currency,allocation_type,actor_user_id,idempotency_key,reason)
    values(v_payment_id,v_invoice.id,v_claim.claimed_amount_minor,v_claim.currency,'allocate',p_admin_id,'billing-claim-allocation:'||v_claim.id::text,'Verified manual payment claim')
    on conflict (idempotency_key) do nothing;
    update public.billing_payment_claims set status='verified',review_note=nullif(trim(p_review_note),''),reviewed_by=p_admin_id,reviewed_at=now(),verified_payment_id=v_payment_id,updated_at=now() where id=p_claim_id;
    select coalesce(sum(case when a.allocation_type = 'allocate' then a.amount_minor else -a.amount_minor end),0)::bigint into v_allocated from public.billing_payment_allocations a where a.invoice_id=v_invoice.id;
    v_new_status := case when v_allocated >= v_invoice.total_minor then 'paid' when v_allocated > 0 then 'partially_paid' else 'unpaid' end;
    update public.billing_invoices set status=v_new_status,paid_at=case when v_new_status='paid' then now() else null end,updated_at=now() where id=v_invoice.id;
    insert into public.billing_events(invoice_id,payment_id,claim_id,actor_user_id,event_type,idempotency_key,details)
    values(v_invoice.id,v_payment_id,v_claim.id,p_admin_id,'payment_claim.verified','billing-claim-reviewed:'||v_claim.id::text,jsonb_build_object('amount_minor',v_claim.claimed_amount_minor,'currency',v_claim.currency)) on conflict(idempotency_key) do nothing;
    return query select 'verified'::text,v_new_status,v_payment_id,v_claim.claimed_amount_minor;
    return;
  end if;
  update public.billing_payment_claims set status=p_decision,review_note=nullif(trim(p_review_note),''),reviewed_by=p_admin_id,reviewed_at=now(),updated_at=now() where id=p_claim_id;
  insert into public.billing_events(invoice_id,claim_id,actor_user_id,event_type,idempotency_key,details)
  values(v_claim.invoice_id,v_claim.id,p_admin_id,'payment_claim.'||p_decision,'billing-claim-reviewed:'||v_claim.id::text||':'||p_decision||':'||clock_timestamp()::text,jsonb_build_object('review_note',nullif(trim(p_review_note),''))) on conflict(idempotency_key) do nothing;
  return query select p_decision,v_invoice.status,null::uuid,0::bigint;
end;
$$;
revoke all on function public.review_billing_payment_claim(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.review_billing_payment_claim(uuid,uuid,text,text) to service_role;
