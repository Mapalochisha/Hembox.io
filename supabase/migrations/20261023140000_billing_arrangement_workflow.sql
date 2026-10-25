-- Arrangement workflow hardening and invoice-linked messaging context.
-- Feature branch only; do not apply to production without approval.
alter table public.billing_arrangement_requests
  add constraint billing_arrangements_conversation_fk
  foreign key (conversation_id) references public.inquiries(id) on delete restrict;

create or replace function public.request_billing_arrangement(
  p_customer_id uuid,
  p_invoice_id uuid,
  p_conversation_id uuid,
  p_requested_terms text,
  p_requested_amount_minor bigint default null,
  p_requested_method_key text default null
) returns table(arrangement_id uuid, created boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_invoice public.billing_invoices%rowtype;
  v_existing public.billing_arrangement_requests%rowtype;
  v_id uuid;
  v_allocated bigint;
begin
  if p_customer_id is null or p_invoice_id is null or p_conversation_id is null then
    raise exception 'Customer, invoice, and conversation are required' using errcode = '22023';
  end if;
  select * into v_invoice from public.billing_invoices i where i.id=p_invoice_id and i.customer_id=p_customer_id for update;
  if not found then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  if v_invoice.status not in ('unpaid','partially_paid','overdue') then
    raise exception 'Invoice cannot accept an arrangement request' using errcode = '23514';
  end if;
  if not exists (select 1 from public.inquiries q where q.id=p_conversation_id and lower(trim(q.email))=lower(trim((select u.email from auth.users u where u.id=p_customer_id))) and q.source='billing') then
    raise exception 'Conversation does not belong to this billing customer' using errcode = '42501';
  end if;
  if p_requested_terms is null or length(trim(p_requested_terms)) not between 5 and 3000 then
    raise exception 'Valid requested terms are required' using errcode = '22023';
  end if;
  select coalesce(sum(case when a.allocation_type='reverse' then -a.amount_minor else a.amount_minor end),0)::bigint
    into v_allocated from public.billing_payment_allocations a where a.invoice_id=v_invoice.id;
  if p_requested_amount_minor is not null and (p_requested_amount_minor <= 0 or p_requested_amount_minor > v_invoice.total_minor-v_allocated) then
    raise exception 'Requested amount must be positive and no greater than the outstanding invoice balance' using errcode = '22023';
  end if;
  if p_requested_method_key is not null and length(trim(p_requested_method_key)) > 40 then
    raise exception 'Invalid requested method' using errcode = '22023';
  end if;
  select * into v_existing from public.billing_arrangement_requests r
   where r.invoice_id=p_invoice_id and r.customer_id=p_customer_id and r.status in ('pending','approved') order by r.created_at desc limit 1;
  if found then return query select v_existing.id,false; return; end if;
  insert into public.billing_arrangement_requests(invoice_id,customer_id,conversation_id,requested_method_key,requested_terms,requested_currency,requested_amount_minor,status)
  values(p_invoice_id,p_customer_id,p_conversation_id,nullif(trim(p_requested_method_key),''),trim(p_requested_terms),v_invoice.currency,p_requested_amount_minor,'pending')
  returning id into v_id;
  insert into public.billing_events(invoice_id,arrangement_request_id,actor_user_id,event_type,idempotency_key,details)
  values(p_invoice_id,v_id,p_customer_id,'arrangement.requested','billing-arrangement-requested:'||v_id::text,jsonb_build_object('currency',v_invoice.currency,'requested_amount_minor',p_requested_amount_minor,'conversation_id',p_conversation_id));
  return query select v_id,true;
end;
$$;

create or replace function public.review_billing_arrangement(
  p_arrangement_id uuid,
  p_admin_id uuid,
  p_decision text,
  p_decision_note text default null,
  p_agreed_terms text default null
) returns table(arrangement_id uuid,status text)
language plpgsql security definer set search_path = '' as $$
declare
  v_request public.billing_arrangement_requests%rowtype;
begin
  if p_admin_id is null or not exists(select 1 from public.profiles p where p.id=p_admin_id and p.role='admin') then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if p_decision not in ('approved','declined') then raise exception 'Invalid arrangement decision' using errcode='22023'; end if;
  if p_decision_note is not null and length(p_decision_note)>1000 then raise exception 'Decision note too long' using errcode='22023'; end if;
  if p_decision='approved' and (p_agreed_terms is null or length(trim(p_agreed_terms)) not between 5 and 3000) then
    raise exception 'Approved arrangements require explicit agreed terms' using errcode='22023';
  end if;
  select * into v_request from public.billing_arrangement_requests r where r.id=p_arrangement_id for update;
  if not found then raise exception 'Arrangement request not found' using errcode='P0002'; end if;
  if v_request.status <> 'pending' then
    if v_request.status=p_decision then return query select v_request.id,v_request.status; return; end if;
    raise exception 'Arrangement request has already been reviewed' using errcode='23514';
  end if;
  update public.billing_arrangement_requests set status=p_decision,decision_note=nullif(trim(p_decision_note),''),agreed_terms=case when p_decision='approved' then trim(p_agreed_terms) else null end,decided_by=p_admin_id,decided_at=now(),updated_at=now()
   where id=v_request.id;
  insert into public.billing_events(invoice_id,arrangement_request_id,actor_user_id,event_type,idempotency_key,details)
  values(v_request.invoice_id,v_request.id,p_admin_id,'arrangement.'||p_decision,'billing-arrangement-reviewed:'||v_request.id::text,jsonb_build_object('decision_note',nullif(trim(p_decision_note),''),'agreed_terms',case when p_decision='approved' then trim(p_agreed_terms) else null end));
  return query select v_request.id,p_decision;
end;
$$;

create or replace function public.accept_billing_arrangement(p_arrangement_id uuid,p_customer_id uuid)
returns table(arrangement_id uuid,status text)
language plpgsql security definer set search_path = '' as $$
declare v_request public.billing_arrangement_requests%rowtype;
begin
  select * into v_request from public.billing_arrangement_requests r where r.id=p_arrangement_id and r.customer_id=p_customer_id for update;
  if not found then raise exception 'Arrangement request not found' using errcode='P0002'; end if;
  if v_request.status='accepted' then return query select v_request.id,v_request.status; return; end if;
  if v_request.status<>'approved' then raise exception 'Only approved arrangements can be accepted' using errcode='23514'; end if;
  update public.billing_arrangement_requests set status='accepted',customer_confirmed_at=now(),updated_at=now() where id=v_request.id;
  insert into public.billing_events(invoice_id,arrangement_request_id,actor_user_id,event_type,idempotency_key,details)
  values(v_request.invoice_id,v_request.id,p_customer_id,'arrangement.accepted','billing-arrangement-accepted:'||v_request.id::text,'{}'::jsonb);
  return query select v_request.id,'accepted'::text;
end;
$$;

revoke all on function public.request_billing_arrangement(uuid,uuid,uuid,text,bigint,text) from public,anon,authenticated;
revoke all on function public.review_billing_arrangement(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.accept_billing_arrangement(uuid,uuid) from public,anon,authenticated;
grant execute on function public.request_billing_arrangement(uuid,uuid,uuid,text,bigint,text) to service_role;
grant execute on function public.review_billing_arrangement(uuid,uuid,text,text,text) to service_role;
grant execute on function public.accept_billing_arrangement(uuid,uuid) to service_role;
