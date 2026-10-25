-- Payment-attempt lifecycle invariants and transactional audit.
-- Feature branch only. Do not apply to production without explicit authorization.

create or replace function public.guard_domain_payment_attempt_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- An attempt is a durable snapshot of one amount/order/provider request.
  if new.order_id is distinct from old.order_id
     or new.provider_id is distinct from old.provider_id
     or new.idempotency_key is distinct from old.idempotency_key
     or new.amount_minor is distinct from old.amount_minor
     or new.currency is distinct from old.currency then
    raise exception 'Payment attempt identity and amount are immutable'
      using errcode = '23514';
  end if;

  -- Once assigned, a provider reference and the first confirmed timestamp
  -- are evidence and must not be silently replaced.
  if old.provider_payment_id is not null
     and new.provider_payment_id is distinct from old.provider_payment_id then
    raise exception 'Provider payment reference is immutable once assigned'
      using errcode = '23514';
  end if;

  if old.confirmed_at is not null
     and new.confirmed_at is distinct from old.confirmed_at then
    raise exception 'Payment confirmation timestamp is immutable'
      using errcode = '23514';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'pending' and new.status = any(array['unknown', 'confirmed', 'failed', 'cancelled']))
    or (old.status = 'unknown' and new.status = any(array['pending', 'confirmed', 'failed', 'cancelled']))
    or (old.status = 'confirmed' and new.status = 'refunded')
  ) then
    raise exception 'Invalid payment attempt status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  if new.status = 'confirmed' and new.confirmed_at is null then
    raise exception 'Confirmed payment attempts require confirmed_at'
      using errcode = '23514';
  end if;

  return new;
end;
$$;
revoke all on function public.guard_domain_payment_attempt_update() from public, anon, authenticated;
drop trigger if exists guard_domain_payment_attempt_update on public.domain_payment_attempts;
create trigger guard_domain_payment_attempt_update
before update on public.domain_payment_attempts
for each row execute function public.guard_domain_payment_attempt_update();

create or replace function public.audit_domain_payment_attempt_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.domain_audit_events (order_id, actor_user_id, event_type, details)
  values (
    new.order_id,
    null,
    'domain_payment_attempt.created',
    jsonb_build_object(
      'payment_attempt_id', new.id,
      'provider_id', new.provider_id,
      'status', new.status,
      'amount_minor', new.amount_minor,
      'currency', new.currency
    )
  );
  return new;
end;
$$;
revoke all on function public.audit_domain_payment_attempt_insert() from public, anon, authenticated;
drop trigger if exists audit_domain_payment_attempt_insert on public.domain_payment_attempts;
create trigger audit_domain_payment_attempt_insert
after insert on public.domain_payment_attempts
for each row execute function public.audit_domain_payment_attempt_insert();

create or replace function public.audit_domain_payment_attempt_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.domain_audit_events (order_id, actor_user_id, event_type, details)
    values (
      new.order_id,
      null,
      'domain_payment_attempt.status_changed',
      jsonb_build_object(
        'payment_attempt_id', new.id,
        'provider_id', new.provider_id,
        'from_status', old.status,
        'to_status', new.status
      )
    );
  end if;
  return new;
end;
$$;
revoke all on function public.audit_domain_payment_attempt_status() from public, anon, authenticated;
drop trigger if exists audit_domain_payment_attempt_status on public.domain_payment_attempts;
create trigger audit_domain_payment_attempt_status
after update of status on public.domain_payment_attempts
for each row when (old.status is distinct from new.status)
execute function public.audit_domain_payment_attempt_status();

comment on function public.guard_domain_payment_attempt_update() is
  'Protects payment attempt identity and prevents confirmed/refunded payment states from silently regressing.';
comment on function public.audit_domain_payment_attempt_status() is
  'Audits payment attempt status changes in the same transaction as the update.';
