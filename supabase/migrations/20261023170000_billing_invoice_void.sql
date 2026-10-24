-- Audited invoice cancellation without deleting financial history.
create or replace function public.void_billing_invoice(p_invoice_id uuid,p_admin_id uuid,p_reason text)
returns table(invoice_id uuid,status text)
language plpgsql security definer set search_path = '' as $$
declare v_invoice public.billing_invoices%rowtype;
begin
  if p_admin_id is null or not exists(select 1 from public.profiles p where p.id=p_admin_id and p.role='admin') then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 5 and 1000 then
    raise exception 'A reason is required to void an invoice' using errcode='22023';
  end if;
  select * into v_invoice from public.billing_invoices i where i.id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
  if v_invoice.status='void' then return query select v_invoice.id,v_invoice.status; return; end if;
  if v_invoice.source_type='domain_registration' then
    raise exception 'Domain invoices must be cancelled through the domain-order workflow' using errcode='23514';
  end if;
  if v_invoice.status not in ('unpaid','overdue') then
    raise exception 'Only unpaid invoices with no recorded payments can be voided' using errcode='23514';
  end if;
  if exists(select 1 from public.billing_payment_allocations a where a.invoice_id=v_invoice.id) then
    raise exception 'Invoices with payment allocations require an audited reversal, not voiding' using errcode='23514';
  end if;
  update public.billing_invoices set status='void',paid_at=null where id=v_invoice.id;
  insert into public.billing_events(invoice_id,actor_user_id,event_type,idempotency_key,details)
  values(v_invoice.id,p_admin_id,'invoice.voided','billing-invoice-voided:'||v_invoice.id::text,
    jsonb_build_object('reason',trim(p_reason),'previous_status',v_invoice.status,'total_minor',v_invoice.total_minor,'currency',v_invoice.currency));
  return query select v_invoice.id,'void'::text;
end;
$$;
revoke all on function public.void_billing_invoice(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.void_billing_invoice(uuid,uuid,text) to service_role;
