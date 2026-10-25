\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_customer uuid := '33333333-3333-4333-8333-333333333333';
  v_admin uuid := '44444444-4444-4444-8444-444444444444';
  v_order uuid;
  v_quote uuid;
  v_claim uuid;
  v_result record;
  v_status text;
  v_count integer;
  v_rejected boolean := false;
  v_registered_at timestamptz := clock_timestamp() - interval '1 minute';
  v_expires_at timestamptz := clock_timestamp() + interval '364 days';
begin
  insert into auth.users (id) values (v_customer), (v_admin) on conflict (id) do nothing;
  insert into public.profiles (id, role) values (v_customer, 'user'), (v_admin, 'admin')
    on conflict (id) do update set role = excluded.role;

  select q.order_id, q.quote_id into v_order, v_quote
  from public.create_domain_quote_order(
    p_customer_id => v_customer,
    p_customer_email => 'manual-registration@example.test',
    p_customer_contact => 'manual-registration@example.test',
    p_domain_name => 'manual-registration-check.com',
    p_provider_id => 'namesilo',
    p_availability_checked_at => clock_timestamp(),
    p_idempotency_key => 'manual-registration-quote-idem-001',
    p_registration_price_minor => 30000,
    p_renewal_price_minor => 35000,
    p_term_years => 1,
    p_total_due_minor => 30000,
    p_wholesale_currency => 'USD',
    p_registration_wholesale_minor => 1000,
    p_renewal_wholesale_minor => 1200,
    p_fx_rate_micros => 25000000,
    p_margin_basis_points => 2000,
    p_pricing_source => 'verified-test-fixture',
    p_pricing_captured_at => clock_timestamp(),
    p_created_at => clock_timestamp(),
    p_expires_at => clock_timestamp() + interval '15 minutes'
  ) q;

  update public.domain_orders set status = 'awaiting_payment' where id = v_order;
  insert into public.domain_manual_payment_claims (
    order_id, customer_id, payment_reference, idempotency_key, transaction_reference, amount_minor
  ) values (
    v_order, v_customer, 'HEM-DOM-REGISTRATION01', 'manual-reg-claim-idem-001', 'BANK-TXN-REG-001', 30000
  ) returning id into v_claim;
  perform * from public.review_domain_manual_payment_claim(v_claim, v_admin, 'verified', 'Test funds confirmed');

  v_rejected := false;
  begin
    perform * from public.record_domain_manual_registration(
      v_order, v_admin, 'namesilo', 'REG-ORDER-001', 'manual-registration-check.com',
      v_registered_at, v_expires_at, false, true, 'availability not checked'
    );
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Registration must be blocked if availability was not rechecked'; end if;

  select * into v_result
  from public.record_domain_manual_registration(
    v_order, v_admin, 'namesilo', 'REG-ORDER-001', 'manual-registration-check.com',
    v_registered_at, v_expires_at, true, true, 'Completed in registrar console'
  );
  if v_result.order_status <> 'registered' or v_result.already_recorded then
    raise exception 'Successful manual registration must set registered state';
  end if;

  select status into v_status from public.domain_orders where id = v_order;
  if v_status <> 'registered' then raise exception 'Order state was not registered'; end if;

  select count(*) into v_count from public.domain_audit_events
  where order_id = v_order and actor_user_id = v_admin
    and event_type = 'domain_registration.manually_recorded';
  if v_count <> 1 then raise exception 'Manual registration must be auditable exactly once'; end if;

  select * into v_result
  from public.record_domain_manual_registration(
    v_order, v_admin, 'namesilo', 'REG-ORDER-001', 'manual-registration-check.com',
    v_registered_at, v_expires_at, true, true, 'Completed in registrar console'
  );
  if not v_result.already_recorded then raise exception 'Exact replay must be idempotent'; end if;
end
$test$;

rollback;
