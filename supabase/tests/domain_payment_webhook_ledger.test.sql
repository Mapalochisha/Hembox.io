-- Integration checks for durable payment webhook event idempotency.
\set ON_ERROR_STOP on
begin;
do $$
declare
  order_key uuid;
  payment_key uuid;
  event_key uuid;
  caught boolean;
begin
  insert into public.domain_orders (customer_email, domain_name)
  values ('webhook-ledger@example.com', 'webhook-ledger.example')
  returning id into order_key;
  insert into public.domain_payment_attempts (
    order_id, provider_id, idempotency_key, amount_minor, currency, status
  ) values (
    order_key, 'test-gateway', 'webhook-ledger-payment-001', 15000, 'ZMW', 'pending'
  ) returning id into payment_key;
  insert into public.domain_payment_webhook_events (
    provider_id, event_id, payment_attempt_id, provider_payment_id,
    event_type, signature_verified, processing_status
  ) values (
    'test-gateway', 'event-ledger-unique-001', payment_key, 'provider-payment-1',
    'payment.updated', true, 'received'
  ) returning id into event_key;
  update public.domain_payment_webhook_events set processing_status = 'failed', safe_error_code = 'TEMPORARY_FAILURE'
    where id = event_key;
  update public.domain_payment_webhook_events set processing_status = 'processed', processed_at = now()
    where id = event_key;
  caught := false;
  begin
    insert into public.domain_payment_webhook_events (provider_id, event_id, event_type)
    values ('test-gateway', 'event-ledger-unique-001', 'payment.updated');
  exception when unique_violation then caught := true;
  end;
  if not caught then raise exception 'duplicate webhook event id was accepted'; end if;
  caught := false;
  begin
    update public.domain_payment_webhook_events set signature_verified = false where id = event_key;
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'webhook verification evidence was mutable'; end if;
  caught := false;
  begin
    delete from public.domain_payment_webhook_events where id = event_key;
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'webhook event ledger row was deletable'; end if;
end $$;
rollback;
