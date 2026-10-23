-- Manual payment claims for the initial launch while gateway integration is deferred.
-- Feature branch only. Do not apply to production without explicit release authorization.
create table if not exists public.domain_manual_payment_claims (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.domain_orders(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  payment_reference text not null unique check (length(trim(payment_reference)) between 8 and 80),
  idempotency_key text not null unique check (length(trim(idempotency_key)) between 8 and 120),
  transaction_reference text not null check (length(trim(transaction_reference)) between 3 and 120),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'ZMW' check (currency = 'ZMW'),
  customer_note text check (customer_note is null or length(customer_note) <= 500),
  status text not null default 'submitted'
    check (status in ('submitted', 'needs_info', 'verified', 'rejected')),
  review_note text check (review_note is null or length(review_note) <= 500),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('verified', 'rejected', 'needs_info')) = (reviewed_at is not null)),
  check ((status in ('verified', 'rejected', 'needs_info')) = (reviewed_by is not null))
);
create index if not exists domain_manual_payment_claims_order_created_idx
  on public.domain_manual_payment_claims (order_id, created_at desc);
create index if not exists domain_manual_payment_claims_review_queue_idx
  on public.domain_manual_payment_claims (status, created_at asc)
  where status in ('submitted', 'needs_info');
create unique index if not exists domain_manual_payment_claims_one_verified_order_idx
  on public.domain_manual_payment_claims (order_id) where status = 'verified';

alter table public.domain_manual_payment_claims enable row level security;
revoke all on public.domain_manual_payment_claims from anon, authenticated;
grant all on public.domain_manual_payment_claims to service_role;

create or replace function public.guard_domain_manual_payment_claim_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.order_id is distinct from old.order_id
     or new.customer_id is distinct from old.customer_id
     or new.payment_reference is distinct from old.payment_reference
     or new.idempotency_key is distinct from old.idempotency_key
     or new.transaction_reference is distinct from old.transaction_reference
     or new.amount_minor is distinct from old.amount_minor
     or new.currency is distinct from old.currency
     or new.customer_note is distinct from old.customer_note
     or new.created_at is distinct from old.created_at then
    raise exception 'Manual payment claim submission is immutable'
      using errcode = '23514';
  end if;
  if new.status is distinct from old.status and not (
    (old.status = 'submitted' and new.status = any(array['needs_info', 'verified', 'rejected']))
    or (old.status = 'needs_info' and new.status = any(array['submitted', 'verified', 'rejected']))
  ) then
    raise exception 'Invalid manual payment claim transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;
  if new.status in ('verified', 'rejected', 'needs_info') then
    if new.reviewed_at is null or new.reviewed_by is null then
      raise exception 'Reviewed claims require reviewer and timestamp'
        using errcode = '23514';
    end if;
  elsif new.reviewed_at is not null or new.reviewed_by is not null then
    raise exception 'Unreviewed claims cannot carry review evidence'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_domain_manual_payment_claim_update() from public, anon, authenticated;
create trigger guard_domain_manual_payment_claim_update
before update on public.domain_manual_payment_claims
for each row execute function public.guard_domain_manual_payment_claim_update();

create or replace function public.audit_domain_manual_payment_claim_insert()
returns trigger language plpgsql set search_path = ''
as $$
begin
  insert into public.domain_audit_events (order_id, actor_user_id, event_type, details)
  values (new.order_id, new.customer_id, 'domain_manual_payment.claim_submitted',
    jsonb_build_object('claim_id', new.id, 'payment_reference', new.payment_reference,
      'amount_minor', new.amount_minor, 'currency', new.currency));
  return new;
end;
$$;
revoke all on function public.audit_domain_manual_payment_claim_insert() from public, anon, authenticated;
create trigger audit_domain_manual_payment_claim_insert
after insert on public.domain_manual_payment_claims
for each row execute function public.audit_domain_manual_payment_claim_insert();

create or replace function public.review_domain_manual_payment_claim(
  p_claim_id uuid,
  p_admin_user_id uuid,
  p_decision text,
  p_review_note text default null
)
returns table (claim_id uuid, order_id uuid, claim_status text, order_status text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_claim public.domain_manual_payment_claims%rowtype;
  v_order public.domain_orders%rowtype;
  v_expected_amount bigint;
  v_now timestamptz := clock_timestamp();
begin
  if p_decision not in ('verified', 'rejected', 'needs_info') then
    raise exception 'Unsupported manual payment review decision' using errcode = '22023';
  end if;
  if p_review_note is not null and length(p_review_note) > 500 then
    raise exception 'Review note is too long' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_admin_user_id and p.role = 'admin'
  ) then
    raise exception 'Administrator required' using errcode = '42501';
  end if;

  select * into v_claim from public.domain_manual_payment_claims
  where id = p_claim_id for update;
  if not found then raise exception 'Manual payment claim not found' using errcode = 'P0002'; end if;
  if v_claim.status not in ('submitted', 'needs_info') then
    raise exception 'Manual payment claim is already resolved' using errcode = '23514';
  end if;

  select * into v_order from public.domain_orders
  where id = v_claim.order_id for update;
  if not found then raise exception 'Domain order not found' using errcode = 'P0002'; end if;

  if p_decision = 'verified' then
    if v_order.status <> 'awaiting_payment' then
      raise exception 'Order is not awaiting payment verification' using errcode = '23514';
    end if;
    select q.total_due_minor into v_expected_amount
    from public.domain_order_quotes q
    where q.order_id = v_order.id
    order by q.sequence desc limit 1;
    if v_expected_amount is null or v_claim.amount_minor <> v_expected_amount then
      raise exception 'Claimed amount does not match the saved quote' using errcode = '23514';
    end if;
    if exists (select 1 from public.domain_manual_payment_claims c
      where c.order_id = v_order.id and c.status = 'verified' and c.id <> v_claim.id) then
      raise exception 'Another payment claim is already verified for this order' using errcode = '23514';
    end if;
    update public.domain_orders set status = 'payment_confirmed' where id = v_order.id;
  end if;

  update public.domain_manual_payment_claims c
    set status = p_decision, review_note = nullif(trim(p_review_note), ''),
        reviewed_by = p_admin_user_id, reviewed_at = v_now, updated_at = v_now
    where c.id = p_claim_id;

  insert into public.domain_audit_events (order_id, actor_user_id, event_type, details)
  values (v_order.id, p_admin_user_id, 'domain_manual_payment.claim_reviewed',
    jsonb_build_object('claim_id', p_claim_id, 'decision', p_decision,
      'review_note', nullif(trim(p_review_note), ''), 'payment_reference', v_claim.payment_reference));

  return query select p_claim_id, v_order.id, p_decision,
    case when p_decision = 'verified' then 'payment_confirmed' else v_order.status end;
end;
$$;
revoke all on function public.review_domain_manual_payment_claim(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_domain_manual_payment_claim(uuid, uuid, text, text) to service_role;

comment on table public.domain_manual_payment_claims is
  'Customer-submitted manual-payment claims. A claim or transaction screenshot is not proof of settlement; only an admin verification action can confirm payment.';
comment on function public.review_domain_manual_payment_claim(uuid, uuid, text, text) is
  'Atomically reviews a manual-payment claim; verifying requires an admin and an exact match to the saved quote amount and advances the order to payment_confirmed.';
