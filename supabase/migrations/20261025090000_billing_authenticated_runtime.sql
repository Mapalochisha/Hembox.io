-- Allow the billing Preview to use the authenticated user's Supabase session rather than
-- requiring a service-role secret in Preview. Privileged operations remain guarded by
-- server-side SECURITY DEFINER wrappers that derive identity from auth.uid().

create or replace function public.authenticated_review_billing_payment_claim(
  p_claim_id uuid, p_decision text, p_review_note text default null
) returns table(claim_status text, invoice_status text, payment_id uuid, allocated_minor bigint)
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not exists (
    select 1 from public.profiles p where p.id = v_user_id and p.role = 'admin'
  ) then raise exception 'Administrator required' using errcode = '42501'; end if;
  return query select * from public.review_billing_payment_claim(p_claim_id, v_user_id, p_decision, p_review_note);
end;
$$;
revoke all on function public.authenticated_review_billing_payment_claim(uuid,text,text) from public, anon;
grant execute on function public.authenticated_review_billing_payment_claim(uuid,text,text) to authenticated;

create or replace function public.authenticated_create_billing_invoice(
  p_customer_id uuid, p_invoice_number text, p_currency text,
  p_due_at timestamptz, p_source_type text, p_source_id uuid, p_customer_note text,
  p_commercial_snapshot jsonb, p_items jsonb, p_creation_key text, p_tax_minor bigint default 0
) returns table(invoice_id uuid, invoice_number text, created boolean)
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not exists (
    select 1 from public.profiles p where p.id = v_user_id and p.role = 'admin'
  ) then raise exception 'Administrator required' using errcode = '42501'; end if;
  return query select * from public.create_billing_invoice(
    v_user_id, p_customer_id, p_invoice_number, p_currency, p_due_at, p_source_type,
    p_source_id, p_customer_note, p_commercial_snapshot, p_items, p_creation_key, p_tax_minor
  );
end;
$$;
revoke all on function public.authenticated_create_billing_invoice(uuid,text,text,timestamptz,text,uuid,text,jsonb,jsonb,text,bigint) from public, anon;
grant execute on function public.authenticated_create_billing_invoice(uuid,text,text,timestamptz,text,uuid,text,jsonb,jsonb,text,bigint) to authenticated;

create or replace function public.authenticated_void_billing_invoice(
  p_invoice_id uuid, p_reason text
) returns table(invoice_id uuid, status text)
language plpgsql security definer set search_path = '' as $
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not exists (
    select 1 from public.profiles p where p.id = v_user_id and p.role = 'admin'
  ) then raise exception 'Administrator required' using errcode = '42501'; end if;
  return query select * from public.void_billing_invoice(p_invoice_id, v_user_id, p_reason);
end;
$$;
revoke all on function public.authenticated_void_billing_invoice(uuid,text) from public, anon;
grant execute on function public.authenticated_void_billing_invoice(uuid,text) to authenticated;

create or replace function public.authenticated_review_billing_arrangement(
  p_arrangement_id uuid, p_decision text, p_decision_note text default null, p_agreed_terms text default null
) returns table(arrangement_id uuid, status text)
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not exists (
    select 1 from public.profiles p where p.id = v_user_id and p.role = 'admin'
  ) then raise exception 'Administrator required' using errcode = '42501'; end if;
  return query select * from public.review_billing_arrangement(
    p_arrangement_id, v_user_id, p_decision, p_decision_note, p_agreed_terms
  );
end;
$$;
revoke all on function public.authenticated_review_billing_arrangement(uuid,text,text,text) from public, anon;
grant execute on function public.authenticated_review_billing_arrangement(uuid,text,text,text) to authenticated;

create or replace function public.authenticated_request_billing_arrangement(
  p_invoice_id uuid, p_conversation_id uuid, p_requested_terms text,
  p_requested_amount_minor bigint default null, p_requested_method_key text default null
) returns table(arrangement_id uuid, created boolean)
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return query select * from public.request_billing_arrangement(
    v_user_id, p_invoice_id, p_conversation_id, p_requested_terms,
    p_requested_amount_minor, p_requested_method_key
  );
end;
$$;
revoke all on function public.authenticated_request_billing_arrangement(uuid,uuid,text,bigint,text) from public, anon;
grant execute on function public.authenticated_request_billing_arrangement(uuid,uuid,text,bigint,text) to authenticated;

create or replace function public.authenticated_accept_billing_arrangement(p_arrangement_id uuid)
returns table(arrangement_id uuid, status text)
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return query select * from public.accept_billing_arrangement(p_arrangement_id, v_user_id);
end;
$$;
revoke all on function public.authenticated_accept_billing_arrangement(uuid) from public, anon;
grant execute on function public.authenticated_accept_billing_arrangement(uuid) to authenticated;

-- Customer payment claims remain unverified submissions; only the guarded admin RPC can
-- create verified payments or allocations.
grant insert, update on public.billing_payment_claims to authenticated;
drop policy if exists billing_claim_customer_insert on public.billing_payment_claims;
create policy billing_claim_customer_insert on public.billing_payment_claims
  for insert to authenticated with check (
    customer_id = (select auth.uid()) and status = 'submitted'
    and reviewed_by is null and reviewed_at is null and verified_payment_id is null
    and exists (
      select 1 from public.billing_invoices i
      where i.id = invoice_id and i.customer_id = (select auth.uid())
        and i.status in ('unpaid','partially_paid','overdue') and i.currency = billing_payment_claims.currency
    )
  );
drop policy if exists billing_claim_customer_resubmit on public.billing_payment_claims;
create policy billing_claim_customer_resubmit on public.billing_payment_claims
  for update to authenticated
  using (customer_id = (select auth.uid()) and status = 'needs_info')
  with check (customer_id = (select auth.uid()) and status = 'submitted'
    and reviewed_by is null and reviewed_at is null and verified_payment_id is null);

create or replace function public.guard_customer_billing_claim_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_invoice public.billing_invoices%rowtype; v_method public.billing_payment_methods%rowtype; v_allocated bigint;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    if new.customer_id is distinct from auth.uid() or new.status <> 'submitted'
      or new.reviewed_by is not null or new.reviewed_at is not null or new.verified_payment_id is not null then
      raise exception 'Customers may only submit unreviewed claims for themselves' using errcode = '42501';
    end if;
    select * into v_invoice from public.billing_invoices where id = new.invoice_id for update;
    if not found or v_invoice.customer_id <> auth.uid() or v_invoice.status not in ('unpaid','partially_paid','overdue') then
      raise exception 'Invoice is not accepting payment claims' using errcode = '23514';
    end if;
    if new.currency <> v_invoice.currency then raise exception 'Claim currency must match invoice currency' using errcode = '23514'; end if;
    select * into v_method from public.billing_payment_methods where id = new.payment_method_id and active for share;
    if not found or not (v_invoice.currency = any(v_method.supported_currencies)) then
      raise exception 'Payment method is not available for this invoice currency' using errcode = '23514';
    end if;
    select coalesce(sum(case when a.allocation_type = 'allocate' then a.amount_minor else -a.amount_minor end),0)::bigint
      into v_allocated from public.billing_payment_allocations a where a.invoice_id = v_invoice.id;
    if new.claimed_amount_minor <= 0 or new.claimed_amount_minor > v_invoice.total_minor - v_allocated then
      raise exception 'Claim exceeds invoice outstanding balance' using errcode = '23514';
    end if;
  else
    if old.customer_id is distinct from auth.uid() or old.status <> 'needs_info' or new.status <> 'submitted'
      or new.id is distinct from old.id or new.invoice_id is distinct from old.invoice_id
      or new.customer_id is distinct from old.customer_id or new.idempotency_key is distinct from old.idempotency_key
      or new.currency is distinct from old.currency or new.created_at is distinct from old.created_at
      or new.reviewed_by is not null or new.reviewed_at is not null or new.verified_payment_id is not null then
      raise exception 'Only a claim needing information may be safely resubmitted' using errcode = '42501';
    end if;
    select * into v_invoice from public.billing_invoices where id = new.invoice_id for update;
    if not found or v_invoice.customer_id <> auth.uid() or v_invoice.status not in ('unpaid','partially_paid','overdue')
      or v_invoice.currency <> new.currency then raise exception 'Invoice is not accepting this claim' using errcode = '23514'; end if;
    select * into v_method from public.billing_payment_methods where id = new.payment_method_id and active for share;
    if not found or not (v_invoice.currency = any(v_method.supported_currencies)) then
      raise exception 'Payment method is not available for this invoice currency' using errcode = '23514';
    end if;
    select coalesce(sum(case when a.allocation_type = 'allocate' then a.amount_minor else -a.amount_minor end),0)::bigint
      into v_allocated from public.billing_payment_allocations a where a.invoice_id = v_invoice.id;
    if new.claimed_amount_minor <= 0 or new.claimed_amount_minor > v_invoice.total_minor - v_allocated then
      raise exception 'Claim exceeds invoice outstanding balance' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_customer_billing_claim_mutation() from public, anon, authenticated;
drop trigger if exists guard_customer_billing_claim_mutation on public.billing_payment_claims;
create trigger guard_customer_billing_claim_mutation before insert or update on public.billing_payment_claims
  for each row execute function public.guard_customer_billing_claim_mutation();

grant insert on public.billing_events to authenticated;
drop policy if exists billing_event_authenticated_insert on public.billing_events;
create policy billing_event_authenticated_insert on public.billing_events
  for insert to authenticated with check (
    actor_user_id = (select auth.uid()) and (
      (event_type in ('payment_claim.submitted','payment_claim.resubmitted')
        and exists (select 1 from public.billing_payment_claims c
          where c.id = claim_id and c.customer_id = (select auth.uid()) and c.invoice_id = billing_events.invoice_id))
      or (event_type = 'payment_method.saved'
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
    )
  );

-- Payment-method writes are admin-only and the audit event is separately constrained above.
grant insert, update on public.billing_payment_methods to authenticated;
drop policy if exists billing_payment_methods_admin_insert on public.billing_payment_methods;
create policy billing_payment_methods_admin_insert on public.billing_payment_methods
  for insert to authenticated with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
    and updated_by = (select auth.uid())
  );
drop policy if exists billing_payment_methods_admin_update on public.billing_payment_methods;
create policy billing_payment_methods_admin_update on public.billing_payment_methods
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  ) with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
    and updated_by = (select auth.uid())
  );

-- In-app billing arrangements can be created and viewed by the owning customer.
alter table public.inquiries add column if not exists customer_id uuid references auth.users(id) on delete set null;
grant select, insert on public.inquiries to authenticated;
drop policy if exists billing_customer_inquiry_read on public.inquiries;
create policy billing_customer_inquiry_read on public.inquiries for select to authenticated
  using (customer_id = (select auth.uid()));
drop policy if exists billing_customer_inquiry_insert on public.inquiries;
create policy billing_customer_inquiry_insert on public.inquiries for insert to authenticated
  with check (customer_id = (select auth.uid()) and source = 'billing' and status = 'new');
grant select, insert on public.inquiry_messages to authenticated;
drop policy if exists billing_customer_message_read on public.inquiry_messages;
create policy billing_customer_message_read on public.inquiry_messages for select to authenticated
  using (exists (select 1 from public.inquiries i where i.id = inquiry_id and i.customer_id = (select auth.uid())));
drop policy if exists billing_customer_message_insert on public.inquiry_messages;
create policy billing_customer_message_insert on public.inquiry_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and sender_role = 'customer'
    and exists (select 1 from public.inquiries i where i.id = inquiry_id and i.customer_id = (select auth.uid())));

-- Private receipt uploads and signed downloads are scoped to the invoice owner or an admin.
alter table storage.objects enable row level security;
grant select, insert on storage.objects to authenticated;
drop policy if exists billing_receipts_customer_upload on storage.objects;
create policy billing_receipts_customer_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'billing-receipts'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.billing_invoices i
      where i.id::text = split_part(name, '/', 2) and i.customer_id = (select auth.uid())
        and i.status in ('unpaid','partially_paid','overdue')));
drop policy if exists billing_receipts_customer_read on storage.objects;
create policy billing_receipts_customer_read on storage.objects for select to authenticated
  using (bucket_id = 'billing-receipts' and (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
    or ((storage.foldername(name))[1] = (select auth.uid())::text
      and exists (select 1 from public.billing_invoices i
        where i.id::text = (storage.foldername(name))[2] and i.customer_id = (select auth.uid()))
    )
  ));
