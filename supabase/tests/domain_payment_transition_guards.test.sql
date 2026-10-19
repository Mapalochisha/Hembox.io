-- Integration checks for payment attempt lifecycle guards and audit behavior.
\set ON_ERROR_STOP on
begin;
do $$
declare
  order_key uuid;
  payment_key uuid;
  unconfirmed_payment_key uuid;
  n integer;
  caught boolean;
begin
  insert into public.domain_orders (customer_email, domain_name)
  values ('payment-guard@example.com', 'payment-guard.example')
  returning id into order_key;

  insert into public.domain_payment_attempts (
    order_id, provider_id, idempotency_key, provider_payment_id,
    amount_minor, currency, status
  ) values (
    order_key, 'test-gateway', 'payment-guard-idem-001', 'payment-guard-ref-1',
    15000, 'ZMW', 'pending'
  ) returning id into payment_key;

  caught := false;
  begin
    insert into public.domain_payment_attempts (
      order_id, provider_id, idempotency_key, amount_minor, currency, status, confirmed_at
    ) values (
      order_key, 'test-gateway', 'payment-guard-idem-direct-confirmed', 15000, 'ZMW', 'confirmed', now()
    );
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'confirmed payment attempt could be inserted without verified lifecycle'; end if;

  insert into public.domain_payment_attempts (
    order_id, provider_id, idempotency_key, amount_minor, currency, status
  ) values (
    order_key, 'test-gateway', 'payment-guard-idem-002', 15000, 'ZMW', 'pending'
  ) returning id into unconfirmed_payment_key;

  caught := false;
  begin
    update public.domain_payment_attempts
      set status = 'failed', confirmed_at = now()
      where id = unconfirmed_payment_key;
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'failed payment attempt accepted confirmation timestamp'; end if;

  select count(*) into n
  from public.domain_audit_events
  where order_id = order_key and event_type = 'domain_payment_attempt.created';
  if n <> 2 then raise exception 'both valid payment attempt creations must be audited once; got %', n; end if;

  update public.domain_payment_attempts
    set status = 'unknown'
    where id = payment_key;
  update public.domain_payment_attempts
    set status = 'confirmed', confirmed_at = now()
    where id = payment_key;

  caught := false;
  begin
    update public.domain_payment_attempts set status = 'pending' where id = payment_key;
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'confirmed payment was allowed to regress to pending'; end if;

  caught := false;
  begin
    update public.domain_payment_attempts set amount_minor = 1 where id = payment_key;
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'payment attempt amount was mutable'; end if;

  caught := false;
  begin
    update public.domain_payment_attempts set provider_payment_id = 'replacement-ref' where id = payment_key;
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'provider payment reference was mutable'; end if;

  caught := false;
  begin
    update public.domain_payment_attempts set confirmed_at = now() + interval '1 hour' where id = payment_key;
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'payment confirmation timestamp was mutable'; end if;

  update public.domain_payment_attempts set status = 'refunded' where id = payment_key;
  caught := false;
  begin
    update public.domain_payment_attempts set status = 'confirmed' where id = payment_key;
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'refunded payment was allowed to return to confirmed'; end if;

  select count(*) into n
  from public.domain_audit_events
  where order_id = order_key and event_type = 'domain_payment_attempt.status_changed';
  if n <> 3 then raise exception 'expected exactly three payment status audit events, got %', n; end if;
end $$;
rollback;
