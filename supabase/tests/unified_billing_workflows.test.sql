\set ON_ERROR_STOP on
begin;
do $test$
declare
  v_customer uuid := '55555555-5555-4555-8555-555555555555';
  v_admin uuid := '66666666-6666-4666-8666-666666666666';
  v_invoice uuid;
  v_arrangement uuid;
  v_order uuid;
  v_quote uuid;
  v_claim uuid;
  v_method uuid;
  v_result record;
  v_status text;
  v_amount bigint;
begin
  insert into auth.users(id,email) values(v_customer,'billing-customer@example.test'),(v_admin,'billing-admin@example.test') on conflict(id) do update set email=excluded.email;
  insert into public.profiles(id,role) values(v_customer,'user'),(v_admin,'admin') on conflict(id) do update set role=excluded.role;

  -- Arrangement request is linked to the authenticated customer's existing message thread.
  select invoice_id into v_invoice from public.create_billing_invoice(
    v_admin,v_customer,'INV-ARR-TEST','ZMW',now()+interval '10 days','custom_work',null,'{}','{}'::jsonb,
    '[{"description":"Website build","quantity":1,"unit_amount_minor":10000}]'::jsonb,'billing-arrangement-invoice-0001',0
  );
  insert into public.inquiries(type,email,name,message,source)
  values('contact','billing-customer@example.test','Test Customer','Arrangement discussion','billing')
  returning id into v_quote;
  select * into v_result from public.request_billing_arrangement(v_customer,v_invoice,v_quote,'Pay in two instalments over two weeks.',5000,'bank_transfer');
  v_arrangement := v_result.arrangement_id;
  if not v_result.created then raise exception 'Arrangement request should be created'; end if;
  select * into v_result from public.review_billing_arrangement(v_arrangement,v_admin,'approved',null,'Pay 5,000 ZMW now and the remaining 5,000 ZMW within 14 days.');
  if v_result.status <> 'approved' then raise exception 'Arrangement should be approved'; end if;
  select * into v_result from public.accept_billing_arrangement(v_arrangement,v_customer);
  if v_result.status <> 'accepted' then raise exception 'Customer confirmation should accept arrangement'; end if;
  if (select status from public.billing_invoices where id=v_invoice) <> 'unpaid' then raise exception 'Arrangement must not mark invoice paid'; end if;

  -- Domain quote creates a corresponding immutable billing invoice; fully allocated payment advances only the order state.
  insert into public.domain_orders(id,customer_id,customer_email,customer_contact,domain_name,status,retail_currency,registration_retail_minor,renewal_retail_minor,quote_expires_at)
  values('77777777-7777-4777-8777-777777777777',v_customer,'billing-customer@example.test','billing-customer@example.test','example-test.com','quoted','ZMW',5000,3000,now()+interval '1 day')
  returning id into v_order;
  insert into public.domain_order_quotes(order_id,sequence,idempotency_key,domain_name,currency,registration_price_minor,renewal_price_minor,term_years,total_due_minor,pricing_source,pricing_captured_at,created_at,expires_at)
  values(v_order,1,'domain-quote-billing-test-0001','example-test.com','ZMW',5000,3000,1,5000,'test-fixture',now(),now(),now()+interval '1 day')
  returning id into v_quote;
  select * into v_result from public.create_domain_billing_invoice(v_order,v_customer);
  v_invoice := v_result.invoice_id;
  if not v_result.created then raise exception 'First domain invoice should be created'; end if;
  if (select total_minor from public.billing_invoices where id=v_invoice) <> 5000 then raise exception 'Domain invoice total should match saved quote'; end if;
  select * into v_result from public.create_domain_billing_invoice(v_order,v_customer);
  if v_result.created then raise exception 'Domain invoice creation must be idempotent'; end if;
  if (select count(*) from public.billing_invoices where source_type='domain_registration' and source_id=v_order) <> 1 then raise exception 'Domain quote replay created duplicate invoice'; end if;

  insert into public.billing_payment_methods(method_key,display_name,supported_currencies,instructions,active)
  values('domain-test-transfer','Domain test transfer',array['ZMW'],'Test instructions',true) returning id into v_method;
  insert into public.billing_payment_claims(invoice_id,customer_id,payment_method_id,method_key_snapshot,method_name_snapshot,method_instructions_snapshot,method_version_snapshot,idempotency_key,transaction_reference,claimed_amount_minor,currency)
  values(v_invoice,v_customer,v_method,'domain-test-transfer','Domain test transfer','Test instructions',1,'domain-billing-claim-test-0001','DOMAIN-TXN-1',2000,'ZMW') returning id into v_claim;
  select * into v_result from public.review_billing_payment_claim(v_claim,v_admin,'verified','Partial test payment');
  if v_result.invoice_status <> 'partially_paid' then raise exception 'Domain invoice should support partial payment'; end if;
  if (select status from public.domain_orders where id=v_order) <> 'quoted' then raise exception 'Partial payment must not fulfil domain order'; end if;

  insert into public.billing_payment_claims(invoice_id,customer_id,payment_method_id,method_key_snapshot,method_name_snapshot,method_instructions_snapshot,method_version_snapshot,idempotency_key,transaction_reference,claimed_amount_minor,currency)
  values(v_invoice,v_customer,v_method,'domain-test-transfer','Domain test transfer','Test instructions',1,'domain-billing-claim-test-0002','DOMAIN-TXN-2',3000,'ZMW') returning id into v_claim;
  select * into v_result from public.review_billing_payment_claim(v_claim,v_admin,'verified','Complete test payment');
  if v_result.invoice_status <> 'paid' then raise exception 'Fully allocated domain invoice should be paid'; end if;
  select status into v_status from public.domain_orders where id=v_order;
  if v_status <> 'payment_confirmed' then raise exception 'Paid domain invoice should advance order to payment_confirmed, got %',v_status; end if;
  select coalesce(sum(case when allocation_type='allocate' then amount_minor else -amount_minor end),0)::bigint into v_amount
    from public.billing_payment_allocations where invoice_id=v_invoice;
  if v_amount <> 5000 then raise exception 'Domain invoice allocations should total 5000, got %',v_amount; end if;
end
$test$;
rollback;
