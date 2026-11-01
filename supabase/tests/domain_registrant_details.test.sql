-- Registrant detail capture: ownership, immutability after registration,
-- personal-data-minimised audit, owner-scoped RLS, and the fulfilment guard.
\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_customer uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  v_other uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  v_admin uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  v_order uuid;
  v_quote uuid;
  v_invoice uuid;
  v_method uuid;
  v_claim uuid;
  v_result record;
  v_rejected boolean;
  v_saved_at timestamptz;
  v_status text;
  v_count integer;
  v_details jsonb;
  v_registered_at timestamptz := clock_timestamp() - interval '1 minute';
  v_expires_at timestamptz := clock_timestamp() + interval '364 days';
begin
  insert into auth.users (id) values (v_customer), (v_other), (v_admin) on conflict (id) do nothing;
  insert into public.profiles (id, role) values (v_customer, 'user'), (v_other, 'user'), (v_admin, 'admin')
    on conflict (id) do update set role = excluded.role;

  select q.order_id, q.quote_id into v_order, v_quote
  from public.create_domain_quote_order(
    p_customer_id => v_customer,
    p_customer_email => 'registrant-test@example.test',
    p_customer_contact => 'registrant-test@example.test',
    p_domain_name => 'registrant-details-check.com',
    p_provider_id => 'namesilo',
    p_availability_checked_at => clock_timestamp(),
    p_idempotency_key => 'registrant-details-quote-001',
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

  -- Another customer must not be able to attach details to this order.
  v_rejected := false;
  begin
    perform * from public.save_domain_order_registrant_details(
      v_order, v_other, 'individual', 'Wrong', 'Owner', null, 'wrong@example.test', '+260970000000',
      '10 Wrong Street', null, 'Lusaka', 'Lusaka', '10101', 'ZM', 'domain-registrant-v1'
    );
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'A customer must not save registrant details for another customer''s order'; end if;

  -- Invalid registrant data is rejected by the database, not only the UI.
  v_rejected := false;
  begin
    perform * from public.save_domain_order_registrant_details(
      v_order, v_customer, 'individual', 'Test', 'Registrant', null, 'not-an-email', '+260970000000',
      '10 Great East Road', null, 'Lusaka', 'Lusaka', '10101', 'ZM', 'domain-registrant-v1'
    );
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'An invalid registrant email must be rejected'; end if;

  v_rejected := false;
  begin
    perform * from public.save_domain_order_registrant_details(
      v_order, v_customer, 'organisation', 'Test', 'Registrant', null, 'billing@example.test', '+260970000000',
      '10 Great East Road', null, 'Lusaka', 'Lusaka', '10101', 'ZM', 'domain-registrant-v1'
    );
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'An organisation registrant requires an organisation name'; end if;

  -- First save creates the record and normalises the values.
  select * into v_result from public.save_domain_order_registrant_details(
    v_order, v_customer, 'organisation', '  Test  ', 'Registrant', '  Hembox Test Ltd  ',
    '  Billing@Example.Test ', '+260970000000', '10 Great East Road', null, 'Lusaka', 'Lusaka', '10101', 'zm',
    'domain-registrant-v1'
  );
  if not v_result.created then raise exception 'First registrant save must report created'; end if;
  v_saved_at := v_result.saved_at;
  if (select email from public.domain_order_registrant_details where order_id = v_order) <> 'billing@example.test' then
    raise exception 'Registrant email should be normalised to lower case';
  end if;
  if (select organisation_name from public.domain_order_registrant_details where order_id = v_order) <> 'Hembox Test Ltd' then
    raise exception 'Organisation name should be trimmed';
  end if;
  if (select country_code from public.domain_order_registrant_details where order_id = v_order) <> 'ZM' then
    raise exception 'Country code should be upper case';
  end if;
  if not exists (
    select 1 from public.domain_audit_events
    where order_id = v_order and event_type = 'domain_order.registrant_details_added'
      and details ->> 'consent_version' = 'domain-registrant-v1'
  ) then
    raise exception 'Registrant capture must write an audit event with the consent version';
  end if;
  select details into v_details from public.domain_audit_events
    where order_id = v_order and event_type = 'domain_order.registrant_details_added'
    order by created_at desc limit 1;
  if v_details::text like '%Great East Road%' or v_details::text like '%billing@example.test%' then
    raise exception 'Audit events must not copy registrant personal data';
  end if;

  -- Re-saving updates in place; the customer can correct details before registration.
  select * into v_result from public.save_domain_order_registrant_details(
    v_order, v_customer, 'individual', 'Test', 'Registrant', null, 'billing@example.test', '+260970000001',
    '11 Great East Road', 'Plot 5', 'Lusaka', 'Lusaka', null, 'ZM', 'domain-registrant-v2'
  );
  if v_result.created then raise exception 'Second registrant save must report an update, not a create'; end if;
  if (select count(*) from public.domain_order_registrant_details where order_id = v_order) <> 1 then
    raise exception 'Registrant details must be one row per order';
  end if;
  if (select consent_version from public.domain_order_registrant_details where order_id = v_order) <> 'domain-registrant-v2' then
    raise exception 'Registrant consent version should be updated';
  end if;
  if not exists (
    select 1 from public.domain_audit_events
    where order_id = v_order and event_type = 'domain_order.registrant_details_updated'
  ) then
    raise exception 'Registrant update must write an audit event';
  end if;

  -- Pay the order through the real unified billing path so fulfilment is eligible.
  select * into v_result from public.create_domain_billing_invoice(v_order, v_customer);
  v_invoice := v_result.invoice_id;
  insert into public.billing_payment_methods(method_key, display_name, supported_currencies, instructions, active)
  values ('registrant-test-transfer', 'Registrant test transfer', array['ZMW'], 'Test instructions', true)
  returning id into v_method;
  insert into public.billing_payment_claims(
    invoice_id, customer_id, payment_method_id, method_key_snapshot, method_name_snapshot,
    method_instructions_snapshot, method_version_snapshot, idempotency_key, transaction_reference,
    claimed_amount_minor, currency
  ) values (
    v_invoice, v_customer, v_method, 'registrant-test-transfer', 'Registrant test transfer',
    'Test instructions', 1, 'registrant-test-claim-001', 'TXN-REGISTRANT-1', 30000, 'ZMW'
  ) returning id into v_claim;
  perform * from public.review_billing_payment_claim(v_claim, v_admin, 'verified', 'Funds confirmed');
  select status into v_status from public.domain_orders where id = v_order;
  if v_status <> 'payment_confirmed' then raise exception 'Order should be payment_confirmed, got %', v_status; end if;

  -- Once registration has started the registrant record is the legal record.
  update public.domain_orders set status = 'registration_pending' where id = v_order;
  v_rejected := false;
  begin
    perform * from public.save_domain_order_registrant_details(
      v_order, v_customer, 'individual', 'Changed', 'Name', null, 'billing@example.test', '+260970000001',
      '12 Great East Road', null, 'Lusaka', 'Lusaka', null, 'ZM', 'domain-registrant-v2'
    );
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Registrant details must not change after registration starts'; end if;
  update public.domain_orders set status = 'manual_review' where id = v_order;
  update public.domain_orders set status = 'payment_confirmed' where id = v_order;

  -- A fulfilment attempt without registrant details is refused. Use a second
  -- order that is paid but has no registrant record.
  insert into public.domain_orders(id,customer_id,customer_email,customer_contact,domain_name,status,retail_currency,registration_retail_minor,renewal_retail_minor,quote_expires_at,provider_id)
  values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',v_customer,'registrant-test@example.test','registrant-test@example.test','no-registrant-check.com','payment_confirmed','ZMW',30000,35000,clock_timestamp()+interval '1 day','namesilo');
  if not exists (select 1 from public.domain_orders where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') then
    raise exception 'Fixture order was not created';
  end if;
  insert into public.billing_payments(customer_id,currency,amount_minor,status,source_type,source_reference,verified_by,idempotency_key)
  values(v_customer,'ZMW',30000,'verified','admin_adjustment','no-registrant-check',v_admin,'no-registrant-payment-001')
  returning id into v_claim;
  insert into public.billing_invoices(invoice_number,creation_key,customer_id,status,currency,subtotal_minor,tax_minor,total_minor,issued_at,paid_at,source_type,source_id)
  values('DOM-NOREGISTRANT','domain-order:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',v_customer,'paid','ZMW',30000,0,30000,clock_timestamp(),clock_timestamp(),'domain_registration','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1')
  returning id into v_invoice;
  insert into public.billing_payment_allocations(payment_id,invoice_id,amount_minor,currency,allocation_type,actor_user_id,idempotency_key)
  values(v_claim,v_invoice,30000,'ZMW','allocate',v_admin,'no-registrant-allocation-001');
  update public.domain_orders set billing_invoice_id = v_invoice where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

  v_rejected := false;
  begin
    perform * from public.record_domain_manual_registration(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', v_admin, 'namesilo', 'NO-REG-1', 'no-registrant-check.com',
      v_registered_at, v_expires_at, true, true, 'no registrant details'
    );
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Fulfilment without registrant details must be rejected'; end if;

  perform * from public.save_domain_order_registrant_details(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', v_customer, 'individual', 'Second', 'Registrant', null,
    'second@example.test', '+260970000002', '20 Great East Road', null, 'Lusaka', 'Lusaka', null, 'ZM', 'domain-registrant-v1'
  );
  select * into v_result from public.record_domain_manual_registration(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', v_admin, 'namesilo', 'NO-REG-1', 'no-registrant-check.com',
    v_registered_at, v_expires_at, true, true, 'registrant details supplied'
  );
  if v_result.order_status <> 'registered' then raise exception 'Fulfilment should succeed once registrant details exist'; end if;
  select details into v_details from public.domain_audit_events
    where order_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' and event_type = 'domain_registration.manually_recorded'
    order by created_at desc limit 1;
  if coalesce(v_details ->> 'registrant_details_present', '') <> 'true' then
    raise exception 'Registration audit event must record that registrant details were present';
  end if;

  -- Also prove the first paid order still fulfils normally with its details.
  select * into v_result from public.record_domain_manual_registration(
    v_order, v_admin, 'namesilo', 'REG-DETAILS-1', 'registrant-details-check.com',
    v_registered_at, v_expires_at, true, true, 'registered in console'
  );
  if v_result.order_status <> 'registered' or v_result.payment_evidence <> 'unified_billing_invoice' then
    raise exception 'Order with registrant details and settled invoice should fulfil, got %/%', v_result.order_status, v_result.payment_evidence;
  end if;
end
$test$;

-- Owner-scoped RLS: the owning customer can read, another customer cannot.
-- The test bootstrap creates public.profiles without Supabase's default grants;
-- grant the read access a real project has so the admin policy can be evaluated.
grant select on public.profiles to authenticated;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
set local role authenticated;
do $rls$
begin
  if (select count(*) from public.domain_order_registrant_details) <> 2 then
    raise exception 'Owning customer should read both of their registrant records, found %',
      (select count(*) from public.domain_order_registrant_details);
  end if;
end
$rls$;
reset role;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', true);
set local role authenticated;
do $rls$
begin
  if (select count(*) from public.domain_order_registrant_details) <> 0 then
    raise exception 'Another customer must not read registrant details';
  end if;
end
$rls$;
reset role;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', true);
set local role authenticated;
do $rls$
begin
  if (select count(*) from public.domain_order_registrant_details) <> 2 then
    raise exception 'Administrator should read both registrant records, found %',
      (select count(*) from public.domain_order_registrant_details);
  end if;
end
$rls$;
reset role;

rollback;
