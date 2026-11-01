-- Guarded manual fulfilment must accept settled payment evidence from the
-- unified billing ledger (the real customer flow) as well as the legacy
-- verified domain claim, and must still refuse everything else.
\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_customer uuid := '88888888-8888-4888-8888-888888888888';
  v_admin uuid := '99999999-9999-4999-8999-999999999999';
  v_order_a uuid;
  v_quote_a uuid;
  v_order_b uuid;
  v_quote_b uuid;
  v_order_c uuid;
  v_quote_c uuid;
  v_invoice_a uuid;
  v_invoice_b uuid;
  v_method uuid;
  v_claim uuid;
  v_result record;
  v_rejected boolean;
  v_status text;
  v_registered_check timestamptz;
  v_details jsonb;
  v_registered_at timestamptz := clock_timestamp() - interval '1 minute';
  v_expires_at timestamptz := clock_timestamp() + interval '364 days';
begin
  insert into auth.users (id) values (v_customer), (v_admin) on conflict (id) do nothing;
  insert into public.profiles (id, role) values (v_customer, 'user'), (v_admin, 'admin')
    on conflict (id) do update set role = excluded.role;

  -- Order A: quoted, unpaid. A quote alone must never authorise registration.
  select q.order_id, q.quote_id into v_order_a, v_quote_a
  from public.create_domain_quote_order(
    p_customer_id => v_customer,
    p_customer_email => 'fulfilment-evidence@example.test',
    p_customer_contact => 'fulfilment-evidence@example.test',
    p_domain_name => 'fulfilment-evidence-a.com',
    p_provider_id => 'namesilo',
    p_availability_checked_at => clock_timestamp(),
    p_idempotency_key => 'fulfilment-evidence-quote-a-001',
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

  v_rejected := false;
  begin
    perform * from public.record_domain_manual_registration(
      v_order_a, v_admin, 'namesilo', 'EVIDENCE-ORDER-A', 'fulfilment-evidence-a.com',
      v_registered_at, v_expires_at, true, true, 'quoted but unpaid'
    );
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'An unpaid quoted order must not be registered'; end if;
  select status into v_status from public.domain_orders where id = v_order_a;
  if v_status <> 'quoted' then raise exception 'Rejected fulfilment changed the order state to %', v_status; end if;

  -- Pay order A through the real unified billing path (invoice + verified claim).
  select * into v_result from public.create_domain_billing_invoice(v_order_a, v_customer);
  v_invoice_a := v_result.invoice_id;
  if not v_result.created then raise exception 'Domain invoice should be created for order A'; end if;

  insert into public.billing_payment_methods(method_key, display_name, supported_currencies, instructions, active)
  values ('fulfilment-evidence-transfer', 'Fulfilment evidence transfer', array['ZMW'], 'Test instructions', true)
  returning id into v_method;

  insert into public.billing_payment_claims(
    invoice_id, customer_id, payment_method_id, method_key_snapshot, method_name_snapshot,
    method_instructions_snapshot, method_version_snapshot, idempotency_key, transaction_reference,
    claimed_amount_minor, currency
  ) values (
    v_invoice_a, v_customer, v_method, 'fulfilment-evidence-transfer', 'Fulfilment evidence transfer',
    'Test instructions', 1, 'fulfilment-evidence-claim-a-001', 'TXN-EVIDENCE-A-1', 30000, 'ZMW'
  ) returning id into v_claim;
  select * into v_result from public.review_billing_payment_claim(v_claim, v_admin, 'verified', 'Funds confirmed in receiving account');
  if v_result.invoice_status <> 'paid' then raise exception 'Order A invoice should be paid, got %', v_result.invoice_status; end if;
  select status into v_status from public.domain_orders where id = v_order_a;
  if v_status <> 'payment_confirmed' then raise exception 'Paid invoice should advance order A to payment_confirmed, got %', v_status; end if;
  if exists (select 1 from public.domain_manual_payment_claims c where c.order_id = v_order_a) then
    raise exception 'Unified billing flow must not fabricate a legacy domain payment claim';
  end if;

  -- Registrant details are a prerequisite for any registration record.
  perform * from public.save_domain_order_registrant_details(
    v_order_a, v_customer, 'individual', 'Evidence', 'Registrant', null,
    'fulfilment-evidence@example.test', '+260970000000', '10 Great East Road', null,
    'Lusaka', 'Lusaka', '10101', 'ZM', 'domain-registrant-v1'
  );

  -- Only administrators may record a registration, even with settled payment.
  v_rejected := false;
  begin
    perform * from public.record_domain_manual_registration(
      v_order_a, v_customer, 'namesilo', 'EVIDENCE-ORDER-A', 'fulfilment-evidence-a.com',
      v_registered_at, v_expires_at, true, true, 'customer attempt'
    );
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Non-admin must not record a manual registration'; end if;

  -- The settled, linked, fully allocated invoice is accepted as payment evidence.
  select * into v_result from public.record_domain_manual_registration(
    v_order_a, v_admin, 'namesilo', 'EVIDENCE-ORDER-A', 'fulfilment-evidence-a.com',
    v_registered_at, v_expires_at, true, true, 'Registered in registrar console'
  );
  if v_result.order_status <> 'registered' or v_result.already_recorded then
    raise exception 'Settled unified-billing order must be recorded as registered, got %/%', v_result.order_status, v_result.already_recorded;
  end if;
  if v_result.payment_evidence <> 'unified_billing_invoice' then
    raise exception 'Expected unified_billing_invoice evidence, got %', v_result.payment_evidence;
  end if;
  select details into v_details from public.domain_audit_events
    where order_id = v_order_a and event_type = 'domain_registration.manually_recorded'
    order by created_at desc limit 1;
  if v_details is null then raise exception 'Manual registration must write an audit event'; end if;
  if v_details ->> 'payment_evidence' <> 'unified_billing_invoice' then
    raise exception 'Audit event must record the payment evidence source';
  end if;
  if (v_details -> 'payment_evidence_details' ->> 'billing_invoice_id')::uuid <> v_invoice_a then
    raise exception 'Audit event must reference the settled billing invoice';
  end if;

  -- Replays are idempotent and never duplicate the registration record.
  select * into v_result from public.record_domain_manual_registration(
    v_order_a, v_admin, 'namesilo', 'EVIDENCE-ORDER-A', 'fulfilment-evidence-a.com',
    v_registered_at, v_expires_at, true, true, 'Registered in registrar console'
  );
  if not v_result.already_recorded then raise exception 'Repeated fulfilment must be idempotent'; end if;
  if (select count(*) from public.domain_audit_events
      where order_id = v_order_a and event_type = 'domain_registration.manually_recorded') <> 1 then
    raise exception 'Replay must not create a second registration audit event';
  end if;

  -- Order B: a partially paid invoice is not settlement, even if the order was
  -- moved to payment_confirmed by a manual review decision.
  select q.order_id, q.quote_id into v_order_b, v_quote_b
  from public.create_domain_quote_order(
    p_customer_id => v_customer,
    p_customer_email => 'fulfilment-evidence@example.test',
    p_customer_contact => 'fulfilment-evidence@example.test',
    p_domain_name => 'fulfilment-evidence-b.com',
    p_provider_id => 'namesilo',
    p_availability_checked_at => clock_timestamp(),
    p_idempotency_key => 'fulfilment-evidence-quote-b-001',
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
  select * into v_result from public.create_domain_billing_invoice(v_order_b, v_customer);
  v_invoice_b := v_result.invoice_id;
  insert into public.billing_payment_claims(
    invoice_id, customer_id, payment_method_id, method_key_snapshot, method_name_snapshot,
    method_instructions_snapshot, method_version_snapshot, idempotency_key, transaction_reference,
    claimed_amount_minor, currency
  ) values (
    v_invoice_b, v_customer, v_method, 'fulfilment-evidence-transfer', 'Fulfilment evidence transfer',
    'Test instructions', 1, 'fulfilment-evidence-claim-b-001', 'TXN-EVIDENCE-B-1', 1000, 'ZMW'
  ) returning id into v_claim;
  select * into v_result from public.review_billing_payment_claim(v_claim, v_admin, 'verified', 'Partial payment only');
  if v_result.invoice_status <> 'partially_paid' then raise exception 'Order B invoice should be partially paid'; end if;
  update public.domain_orders set status = 'manual_review' where id = v_order_b;
  update public.domain_orders set status = 'payment_confirmed' where id = v_order_b;

  v_rejected := false;
  begin
    perform * from public.record_domain_manual_registration(
      v_order_b, v_admin, 'namesilo', 'EVIDENCE-ORDER-B', 'fulfilment-evidence-b.com',
      v_registered_at, v_expires_at, true, true, 'partial payment'
    );
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'A partially paid invoice must not authorise registration'; end if;
  select status, registered_at into v_status, v_registered_check from public.domain_orders where id = v_order_b;
  if v_status <> 'payment_confirmed' or v_registered_check is not null then
    raise exception 'Rejected partial-payment fulfilment changed order B state';
  end if;

  -- Order C: no billing invoice at all. The legacy verified claim path keeps
  -- working, and the audit trail names that evidence source.
  select q.order_id, q.quote_id into v_order_c, v_quote_c
  from public.create_domain_quote_order(
    p_customer_id => v_customer,
    p_customer_email => 'fulfilment-evidence@example.test',
    p_customer_contact => 'fulfilment-evidence@example.test',
    p_domain_name => 'fulfilment-evidence-c.com',
    p_provider_id => 'namesilo',
    p_availability_checked_at => clock_timestamp(),
    p_idempotency_key => 'fulfilment-evidence-quote-c-001',
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
  update public.domain_orders set status = 'awaiting_payment' where id = v_order_c;
  update public.domain_orders set status = 'payment_confirmed' where id = v_order_c;

  v_rejected := false;
  begin
    perform * from public.record_domain_manual_registration(
      v_order_c, v_admin, 'namesilo', 'EVIDENCE-ORDER-C', 'fulfilment-evidence-c.com',
      v_registered_at, v_expires_at, true, true, 'no payment evidence'
    );
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Fulfilment without payment evidence must be rejected'; end if;

  update public.domain_orders set status = 'manual_review' where id = v_order_c;
  update public.domain_orders set status = 'awaiting_payment' where id = v_order_c;
  insert into public.domain_manual_payment_claims (
    order_id, customer_id, payment_reference, idempotency_key, transaction_reference, amount_minor
  ) values (
    v_order_c, v_customer, 'HEM-DOM-EVIDENCE-C', 'fulfilment-evidence-legacy-claim-001', 'BANK-TXN-C-001', 30000
  ) returning id into v_claim;
  perform * from public.review_domain_manual_payment_claim(v_claim, v_admin, 'verified', 'Legacy funds confirmed');
  select status into v_status from public.domain_orders where id = v_order_c;
  if v_status <> 'payment_confirmed' then raise exception 'Verified legacy claim should confirm payment, got %', v_status; end if;

  perform * from public.save_domain_order_registrant_details(
    v_order_c, v_customer, 'individual', 'Legacy', 'Registrant', null,
    'fulfilment-evidence@example.test', '+260970000000', '11 Great East Road', null,
    'Lusaka', 'Lusaka', '10101', 'ZM', 'domain-registrant-v1'
  );
  select * into v_result from public.record_domain_manual_registration(
    v_order_c, v_admin, 'namesilo', 'EVIDENCE-ORDER-C', 'fulfilment-evidence-c.com',
    v_registered_at, v_expires_at, true, true, 'Registered in registrar console'
  );
  if v_result.order_status <> 'registered' then raise exception 'Legacy verified claim must still authorise fulfilment'; end if;
  if v_result.payment_evidence <> 'domain_manual_claim' then
    raise exception 'Expected domain_manual_claim evidence, got %', v_result.payment_evidence;
  end if;
end
$test$;

rollback;
