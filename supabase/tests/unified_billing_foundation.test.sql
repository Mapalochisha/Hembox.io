\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_customer uuid := '33333333-3333-4333-8333-333333333333';
  v_admin uuid := '44444444-4444-4444-8444-444444444444';
  v_invoice uuid;
  v_method uuid;
  v_claim uuid;
  v_result record;
  v_status text;
  v_allocated bigint;
  v_rejected boolean;
begin
  insert into auth.users (id) values (v_customer),(v_admin) on conflict (id) do nothing;
  insert into public.profiles (id,role) values (v_customer,'user'),(v_admin,'admin') on conflict (id) do update set role=excluded.role;

  insert into public.billing_payment_methods(method_key,display_name,supported_currencies,instructions,active)
  values('test-transfer','Test bank transfer',array['ZMW','USD'],'Use test reference only.',true) returning id into v_method;

  insert into public.billing_invoices(invoice_number,customer_id,status,currency,subtotal_minor,tax_minor,total_minor,issued_at,due_at,source_type,commercial_snapshot)
  values('INV-TEST-0001',v_customer,'draft','ZMW',10000,0,10000,null,now()+interval '7 days','custom_work','{"fixture":true}'::jsonb) returning id into v_invoice;
  insert into public.billing_invoice_items(invoice_id,description,quantity,unit_amount_minor)
  values(v_invoice,'Test service',1,10000);
  update public.billing_invoices set status='unpaid',issued_at=now() where id=v_invoice;

  insert into public.billing_payment_claims(invoice_id,customer_id,payment_method_id,method_key_snapshot,method_name_snapshot,method_instructions_snapshot,method_version_snapshot,idempotency_key,transaction_reference,claimed_amount_minor,currency)
  values(v_invoice,v_customer,v_method,'test-transfer','Test bank transfer','Use test reference only.',1,'billing-test-claim-0001','BANK-TXN-TEST-1',4000,'ZMW') returning id into v_claim;

  v_rejected := false;
  begin
    perform * from public.review_billing_payment_claim(v_claim,v_customer,'verified','not admin');
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Non-admin must not verify claims'; end if;

  select * into v_result from public.review_billing_payment_claim(v_claim,v_admin,'verified','Funds checked in test fixture');
  if v_result.claim_status <> 'verified' or v_result.invoice_status <> 'partially_paid' then
    raise exception 'Partial payment must verify without marking invoice paid: %, %',v_result.claim_status,v_result.invoice_status;
  end if;
  select status into v_status from public.billing_invoices where id=v_invoice;
  if v_status <> 'partially_paid' then raise exception 'Invoice status after first allocation should be partially_paid'; end if;

  -- Repeating the same review must be idempotent and must not allocate twice.
  perform * from public.review_billing_payment_claim(v_claim,v_admin,'verified','repeat');
  select coalesce(sum(case when allocation_type='allocate' then amount_minor else -amount_minor end),0)::bigint
    into v_allocated from public.billing_payment_allocations where invoice_id=v_invoice;
  if v_allocated <> 4000 then raise exception 'Repeated review duplicated allocation: %',v_allocated; end if;

  -- A second, partial claim completes the invoice.
  insert into public.billing_payment_claims(invoice_id,customer_id,payment_method_id,method_key_snapshot,method_name_snapshot,method_instructions_snapshot,method_version_snapshot,idempotency_key,transaction_reference,claimed_amount_minor,currency)
  values(v_invoice,v_customer,v_method,'test-transfer','Test bank transfer','Use test reference only.',1,'billing-test-claim-0002','BANK-TXN-TEST-2',6000,'ZMW') returning id into v_claim;
  select * into v_result from public.review_billing_payment_claim(v_claim,v_admin,'verified','Second partial payment');
  if v_result.invoice_status <> 'paid' then raise exception 'Fully allocated invoice should be paid, got %',v_result.invoice_status; end if;
  select coalesce(sum(case when allocation_type='allocate' then amount_minor else -amount_minor end),0)::bigint
    into v_allocated from public.billing_payment_allocations where invoice_id=v_invoice;
  if v_allocated <> 10000 then raise exception 'Expected exactly 10000 allocated, got %',v_allocated; end if;

  -- Invoice currency and commercial terms cannot be changed after issue.
  v_rejected := false;
  begin
    update public.billing_invoices set currency='USD' where id=v_invoice;
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Issued invoice currency must be immutable'; end if;

  -- A different invoice cannot be over-allocated.
  insert into public.billing_invoices(invoice_number,customer_id,status,currency,subtotal_minor,tax_minor,total_minor,issued_at,due_at,source_type,commercial_snapshot)
  values('INV-TEST-0002',v_customer,'unpaid','ZMW',1000,0,1000,now(),now()+interval '7 days','addon','{"fixture":true}'::jsonb) returning id into v_invoice;
  insert into public.billing_payment_claims(invoice_id,customer_id,payment_method_id,method_key_snapshot,method_name_snapshot,method_instructions_snapshot,method_version_snapshot,idempotency_key,transaction_reference,claimed_amount_minor,currency)
  values(v_invoice,v_customer,v_method,'test-transfer','Test bank transfer','Use test reference only.',1,'billing-test-claim-0003','BANK-TXN-TEST-3',1001,'ZMW') returning id into v_claim;
  v_rejected := false;
  begin
    perform * from public.review_billing_payment_claim(v_claim,v_admin,'verified','Over allocation test');
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Over-allocation must be rejected'; end if;

  -- Invoice issuance calculates totals from line items and is idempotent.
  v_rejected := false;
  begin
    perform * from public.create_billing_invoice(
      v_customer,v_customer,'INV-TEST-0003','ZMW',now()+interval '7 days','custom_work',null,'Test note','{}'::jsonb,
      '[{"description":"Build","quantity":2,"unit_amount_minor":1250},{"description":"Setup","quantity":1,"unit_amount_minor":500}]'::jsonb,
      'billing-create-test-0001',200
    );
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Non-admin must not issue invoices'; end if;

  select * into v_result from public.create_billing_invoice(
    v_admin,v_customer,'INV-TEST-0003','ZMW',now()+interval '7 days','custom_work',null,'Test note','{}'::jsonb,
    '[{"description":"Build","quantity":2,"unit_amount_minor":1250},{"description":"Setup","quantity":1,"unit_amount_minor":500}]'::jsonb,
    'billing-create-test-0001',200
  );
  if not v_result.created then raise exception 'First invoice creation should report created=true'; end if;
  select status into v_status from public.billing_invoices where id=v_result.invoice_id;
  if v_status <> 'unpaid' then raise exception 'New invoice should be issued as unpaid'; end if;
  select total_minor into v_allocated from public.billing_invoices where id=v_result.invoice_id;
  if v_allocated <> 3200 then raise exception 'Invoice total should be item subtotal plus explicit tax, got %',v_allocated; end if;

  select * into v_result from public.create_billing_invoice(
    v_admin,v_customer,'INV-TEST-0003','ZMW',now()+interval '7 days','custom_work',null,'Test note','{}'::jsonb,
    '[{"description":"Build","quantity":2,"unit_amount_minor":1250},{"description":"Setup","quantity":1,"unit_amount_minor":500}]'::jsonb,
    'billing-create-test-0001',200
  );
  if v_result.created then raise exception 'Replay of invoice creation must be idempotent'; end if;
  if (select count(*) from public.billing_invoices where creation_key='billing-create-test-0001') <> 1 then
    raise exception 'Invoice replay created a duplicate invoice';
  end if;
end
$test$;

rollback;
