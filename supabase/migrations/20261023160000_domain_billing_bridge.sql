-- Bridge new domain quotes to the unified billing ledger.
-- Feature branch only. No production migration without explicit approval.
alter table public.domain_orders
  add column if not exists billing_invoice_id uuid references public.billing_invoices(id) on delete restrict;
create unique index if not exists domain_orders_billing_invoice_uidx on public.domain_orders(billing_invoice_id) where billing_invoice_id is not null;

create or replace function public.create_domain_billing_invoice(p_order_id uuid,p_customer_id uuid)
returns table(invoice_id uuid,invoice_number text,created boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.domain_orders%rowtype;
  v_quote public.domain_order_quotes%rowtype;
  v_invoice public.billing_invoices%rowtype;
  v_invoice_id uuid;
  v_number text;
  v_key text;
begin
  select * into v_order from public.domain_orders o where o.id=p_order_id and o.customer_id=p_customer_id for update;
  if not found then raise exception 'Domain order not found' using errcode='P0002'; end if;
  if v_order.billing_invoice_id is not null then
    select * into v_invoice from public.billing_invoices i where i.id=v_order.billing_invoice_id;
    if found then return query select v_invoice.id,v_invoice.invoice_number,false; return; end if;
    raise exception 'Domain invoice link is inconsistent' using errcode='23514';
  end if;
  select * into v_quote from public.domain_order_quotes q where q.order_id=v_order.id order by q.sequence desc limit 1;
  if not found then raise exception 'Saved domain quote not found' using errcode='P0002'; end if;
  if v_quote.currency <> 'ZMW' or v_quote.total_due_minor <= 0 then raise exception 'Unsupported domain quote currency or amount' using errcode='22023'; end if;
  select * into v_invoice from public.billing_invoices i where i.source_type='domain_registration' and i.source_id=v_order.id and i.status<>'void';
  if found then
    update public.domain_orders set billing_invoice_id=v_invoice.id where id=v_order.id;
    return query select v_invoice.id,v_invoice.invoice_number,false; return;
  end if;
  v_number := 'DOM-' || upper(substr(replace(v_order.id::text,'-',''),1,12));
  v_key := 'domain-order:' || v_order.id::text;
  insert into public.billing_invoices(invoice_number,creation_key,customer_id,status,currency,subtotal_minor,tax_minor,total_minor,issued_at,due_at,source_type,source_id,customer_note,commercial_snapshot)
  values(v_number,v_key,p_customer_id,'draft',v_quote.currency,0,0,0,null,v_quote.expires_at,'domain_registration',v_order.id,
    'Domain quote expires ' || v_quote.expires_at::text,
    jsonb_build_object('domain_name',v_order.domain_name,'quote_id',v_quote.id,'quote_sequence',v_quote.sequence,'pricing_source',v_quote.pricing_source,'pricing_captured_at',v_quote.pricing_captured_at,'quote_expires_at',v_quote.expires_at))
  returning id into v_invoice_id;
  insert into public.billing_invoice_items(invoice_id,description,quantity,unit_amount_minor,source_type,source_id,item_snapshot)
  values(v_invoice_id,'Domain registration — ' || v_order.domain_name,1,v_quote.total_due_minor,'domain_registration',v_order.id,
    jsonb_build_object('domain_name',v_order.domain_name,'term_years',v_quote.term_years,'quote_id',v_quote.id,'quote_sequence',v_quote.sequence));
  update public.billing_invoices set subtotal_minor=v_quote.total_due_minor,total_minor=v_quote.total_due_minor,status='unpaid',issued_at=now() where id=v_invoice_id;
  update public.domain_orders set billing_invoice_id=v_invoice_id where id=v_order.id;
  insert into public.billing_events(invoice_id,actor_user_id,event_type,idempotency_key,details)
  values(v_invoice_id,p_customer_id,'invoice.issued','billing-domain-invoice-issued:'||v_invoice_id::text,
    jsonb_build_object('domain_order_id',v_order.id,'domain_name',v_order.domain_name,'quote_id',v_quote.id,'currency',v_quote.currency,'total_minor',v_quote.total_due_minor));
  return query select v_invoice_id,v_number,true;
end;
$$;
revoke all on function public.create_domain_billing_invoice(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_domain_billing_invoice(uuid,uuid) to service_role;

-- Keep legacy domain manual claims working while reflecting verified funds in the shared ledger.
create or replace function public.sync_domain_verified_claim_to_billing()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_order public.domain_orders%rowtype;
  v_invoice public.billing_invoices%rowtype;
  v_payment_id uuid;
  v_allocated bigint;
begin
  if old.status is not distinct from new.status or new.status <> 'verified' then return new; end if;
  select * into v_order from public.domain_orders o where o.id=new.order_id;
  if not found or v_order.billing_invoice_id is null then return new; end if;
  select * into v_invoice from public.billing_invoices i where i.id=v_order.billing_invoice_id for update;
  if not found then raise exception 'Linked domain billing invoice is missing' using errcode='23514'; end if;
  if new.currency <> v_invoice.currency then raise exception 'Domain payment currency does not match billing invoice' using errcode='23514'; end if;
  select coalesce(sum(case when a.allocation_type='allocate' then a.amount_minor else -a.amount_minor end),0)::bigint into v_allocated
    from public.billing_payment_allocations a where a.invoice_id=v_invoice.id;
  if new.amount_minor > v_invoice.total_minor-v_allocated then
    raise exception 'Domain claim exceeds the remaining billing invoice balance; use the unified Bills workflow for partial payments' using errcode='23514';
  end if;
  insert into public.billing_payments(customer_id,currency,amount_minor,status,source_type,source_reference,verified_by,verified_at,idempotency_key,metadata)
  values(new.customer_id,new.currency,new.amount_minor,'verified','manual_claim','domain-claim:'||new.id::text,new.reviewed_by,coalesce(new.reviewed_at,now()),'domain-billing-claim:'||new.id::text,jsonb_build_object('domain_claim_id',new.id,'domain_order_id',new.order_id))
  on conflict(idempotency_key) do update set idempotency_key=excluded.idempotency_key returning id into v_payment_id;
  insert into public.billing_payment_allocations(payment_id,invoice_id,amount_minor,currency,allocation_type,actor_user_id,idempotency_key,reason)
  values(v_payment_id,v_invoice.id,new.amount_minor,new.currency,'allocate',new.reviewed_by,'domain-billing-allocation:'||new.id::text,'Verified domain manual payment claim')
  on conflict(idempotency_key) do nothing;
  select coalesce(sum(case when a.allocation_type='allocate' then a.amount_minor else -a.amount_minor end),0)::bigint into v_allocated
    from public.billing_payment_allocations a where a.invoice_id=v_invoice.id;
  update public.billing_invoices set status=case when v_allocated>=total_minor then 'paid' when v_allocated>0 then 'partially_paid' else 'unpaid' end,
    paid_at=case when v_allocated>=total_minor then now() else null end,updated_at=now() where id=v_invoice.id;
  insert into public.billing_events(invoice_id,payment_id,actor_user_id,event_type,idempotency_key,details)
  values(v_invoice.id,v_payment_id,new.reviewed_by,'domain_payment.verified','billing-domain-payment-verified:'||new.id::text,
    jsonb_build_object('domain_claim_id',new.id,'domain_order_id',new.order_id,'amount_minor',new.amount_minor,'currency',new.currency))
  on conflict(idempotency_key) do nothing;
  return new;
end;
$$;
revoke all on function public.sync_domain_verified_claim_to_billing() from public,anon,authenticated;
drop trigger if exists sync_domain_verified_claim_to_billing on public.domain_manual_payment_claims;
create trigger sync_domain_verified_claim_to_billing after update of status on public.domain_manual_payment_claims
for each row when (old.status is distinct from new.status and new.status='verified')
execute function public.sync_domain_verified_claim_to_billing();

-- A fully allocated domain invoice advances the linked order, but never performs registration.
create or replace function public.sync_paid_domain_invoice_to_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_order public.domain_orders%rowtype;
begin
  if new.status <> 'paid' or old.status='paid' or new.source_type<>'domain_registration' or new.source_id is null then return new; end if;
  select * into v_order from public.domain_orders o where o.id=new.source_id for update;
  if not found then return new; end if;
  if v_order.status='quoted' then update public.domain_orders set status='awaiting_payment' where id=v_order.id; v_order.status:='awaiting_payment'; end if;
  if v_order.status='awaiting_payment' then update public.domain_orders set status='payment_confirmed' where id=v_order.id; end if;
  return new;
end;
$$;
revoke all on function public.sync_paid_domain_invoice_to_order() from public,anon,authenticated;
drop trigger if exists sync_paid_domain_invoice_to_order on public.billing_invoices;
create trigger sync_paid_domain_invoice_to_order after update of status on public.billing_invoices
for each row when (old.status is distinct from new.status)
execute function public.sync_paid_domain_invoice_to_order();
