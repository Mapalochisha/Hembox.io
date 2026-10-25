\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_customer uuid := '11111111-1111-4111-8111-111111111111';
  v_admin uuid := '22222222-2222-4222-8222-222222222222';
  v_order uuid;
  v_quote uuid;
  v_claim uuid;
  v_result record;
  v_status text;
  v_count integer;
  v_rejected boolean := false;
begin
  insert into auth.users (id) values (v_customer), (v_admin) on conflict (id) do nothing;
  insert into public.profiles (id, role) values (v_customer, 'user'), (v_admin, 'admin')
    on conflict (id) do update set role = excluded.role;

  select q.order_id, q.quote_id into v_order, v_quote
  from public.create_domain_quote_order(
    p_customer_id => v_customer,
    p_customer_email => 'manual-payment@example.test',
    p_customer_contact => 'manual-payment@example.test',
    p_domain_name => 'manual-payment-check.com',
    p_provider_id => 'namesilo',
    p_availability_checked_at => clock_timestamp(),
    p_idempotency_key => 'manual-payment-quote-idem-001',
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
    v_order, v_customer, 'HEM-DOM-MANUAL001', 'manual-claim-idem-001', 'BANK-TXN-001', 29999
  ) returning id into v_claim;

  v_rejected := false;
  begin
    perform * from public.review_domain_manual_payment_claim(v_claim, v_admin, 'verified', 'test');
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Mismatched amount must not confirm payment'; end if;
  select status into v_status from public.domain_orders where id = v_order;
  if v_status <> 'awaiting_payment' then raise exception 'Rejected amount mismatch changed order state'; end if;

  v_rejected := false;
  begin
    perform * from public.review_domain_manual_payment_claim(v_claim, v_customer, 'verified', 'not an admin');
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Non-admin must not verify a manual payment'; end if;

  perform * from public.review_domain_manual_payment_claim(v_claim, v_admin, 'rejected', 'Amount mismatch');

  insert into public.domain_manual_payment_claims (
    order_id, customer_id, payment_reference, idempotency_key, transaction_reference, amount_minor
  ) values (
    v_order, v_customer, 'HEM-DOM-MANUAL001', 'manual-claim-idem-002', 'BANK-TXN-002', 30000
  ) returning id into v_claim;

  select * into v_result
  from public.review_domain_manual_payment_claim(v_claim, v_admin, 'verified', 'Funds checked against receiving account');
  if v_result.claim_status <> 'verified' or v_result.order_status <> 'payment_confirmed' then
    raise exception 'Successful review must confirm the claim and order';
  end if;

  select status into v_status from public.domain_orders where id = v_order;
  if v_status <> 'payment_confirmed' then raise exception 'Verified claim did not update order status'; end if;

  select count(*) into v_count from public.domain_audit_events
  where order_id = v_order and event_type = 'domain_manual_payment.claim_reviewed'
    and actor_user_id = v_admin;
  if v_count <> 2 then raise exception 'Each admin review must be audited exactly once; got %', v_count; end if;
end
$test$;

rollback;
