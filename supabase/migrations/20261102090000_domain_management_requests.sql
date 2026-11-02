-- Production migration 20261102090000: post-purchase management of owned domains.
--
-- A customer who owns a registered domain can request a renewal or a nameserver
-- change. An administrator applies the change at the registrar and records the
-- result; the OTE endpoint is only ever called from an admin-only route that is
-- itself restricted to sandbox mode. Nothing in this migration contacts a
-- registrar, invents an expiry date, or changes a domain by itself.

alter table public.domain_orders
  add column if not exists auto_renew boolean not null default false,
  add column if not exists nameservers text[],
  add column if not exists nameservers_updated_at timestamptz;

comment on column public.domain_orders.nameservers is
  'Nameservers last confirmed at the registrar. Null until a change is recorded.';
comment on column public.domain_orders.nameservers_updated_at is
  'When nameservers was last confirmed at the registrar.';

create table if not exists public.domain_management_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.domain_orders(id) on delete cascade,
  customer_id uuid not null,
  request_type text not null,
  requested_years integer,
  requested_nameservers text[],
  status text not null default 'requested',
  customer_note text,
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  applied_at timestamptz,
  provider_result jsonb,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint domain_management_requests_type_check
    check (request_type in ('renewal', 'nameservers')),
  constraint domain_management_requests_status_check
    check (status in ('requested', 'applied', 'rejected', 'cancelled')),
  constraint domain_management_requests_shape_check check (
    (request_type = 'renewal'
      and requested_years is not null and requested_years between 1 and 10
      and requested_nameservers is null)
    or (request_type = 'nameservers'
      and requested_years is null
      and requested_nameservers is not null
      and array_length(requested_nameservers, 1) between 2 and 8)
  ),
  constraint domain_management_requests_note_check
    check (customer_note is null or length(customer_note) <= 500),
  constraint domain_management_requests_admin_note_check
    check (admin_note is null or length(admin_note) <= 1000),
  constraint domain_management_requests_idempotency_check
    check (idempotency_key is null or length(idempotency_key) between 8 and 120)
);

create index if not exists domain_management_requests_order_created_idx
  on public.domain_management_requests (order_id, created_at desc);
create index if not exists domain_management_requests_status_created_idx
  on public.domain_management_requests (status, created_at);
create unique index if not exists domain_management_requests_idempotency_idx
  on public.domain_management_requests (customer_id, idempotency_key)
  where idempotency_key is not null;
-- At most one open request per order and request type.
create unique index if not exists domain_management_requests_open_idx
  on public.domain_management_requests (order_id, request_type)
  where status = 'requested';

drop trigger if exists set_domain_management_requests_updated_at on public.domain_management_requests;
create trigger set_domain_management_requests_updated_at
  before update on public.domain_management_requests
  for each row execute function public.set_domain_updated_at();

alter table public.domain_management_requests enable row level security;
revoke all on public.domain_management_requests from anon, authenticated;
grant select on public.domain_management_requests to authenticated;
grant all on public.domain_management_requests to service_role;

drop policy if exists "Customers can read their own domain management requests" on public.domain_management_requests;
create policy "Customers can read their own domain management requests"
  on public.domain_management_requests for select to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists "Admins can read domain management requests" on public.domain_management_requests;
create policy "Admins can read domain management requests"
  on public.domain_management_requests for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

comment on table public.domain_management_requests is
  'Customer requests to renew or re-delegate an owned domain. Server-managed; an administrator applies the change at the registrar and records the outcome.';

-- Customer-facing request creation. Only the owner of a registered order may
-- create a request, and only one request of each type may be open at a time.
create or replace function public.create_domain_management_request(
  p_order_id uuid,
  p_customer_id uuid,
  p_request_type text,
  p_requested_years integer default null,
  p_requested_nameservers text[] default null,
  p_customer_note text default null,
  p_idempotency_key text default null
)
returns table (request_id uuid, request_status text, request_type text, already_requested boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.domain_orders%rowtype;
  v_nameservers text[];
  v_existing public.domain_management_requests%rowtype;
begin
  if p_order_id is null or p_customer_id is null then
    raise exception 'Order and customer are required' using errcode = '22023';
  end if;
  if p_request_type is null or p_request_type not in ('renewal', 'nameservers') then
    raise exception 'Request type must be renewal or nameservers' using errcode = '22023';
  end if;
  if p_customer_note is not null and length(btrim(p_customer_note)) > 500 then
    raise exception 'Customer note is too long' using errcode = '22023';
  end if;
  if p_idempotency_key is not null
     and (length(p_idempotency_key) < 8 or length(p_idempotency_key) > 120) then
    raise exception 'Idempotency key length is invalid' using errcode = '22023';
  end if;

  select * into v_order from public.domain_orders where id = p_order_id;
  if not found then raise exception 'Domain order not found' using errcode = 'P0002'; end if;
  if v_order.customer_id is distinct from p_customer_id then
    raise exception 'Domain order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'registered' then
    raise exception 'Only registered domains can be managed' using errcode = '23514';
  end if;

  if p_request_type = 'renewal' then
    if p_requested_years is null or p_requested_years < 1 or p_requested_years > 10 then
      raise exception 'Renewal years must be an integer from 1 to 10' using errcode = '22023';
    end if;
    if p_requested_nameservers is not null then
      raise exception 'A renewal request cannot carry nameservers' using errcode = '22023';
    end if;
  else
    if p_requested_years is not null then
      raise exception 'A nameserver request cannot carry renewal years' using errcode = '22023';
    end if;
    if p_requested_nameservers is null
       or array_length(p_requested_nameservers, 1) is null
       or array_length(p_requested_nameservers, 1) < 2
       or array_length(p_requested_nameservers, 1) > 8 then
      raise exception 'Provide between 2 and 8 nameservers' using errcode = '22023';
    end if;
    select array_agg(lower(btrim(ns))) into v_nameservers
      from unnest(p_requested_nameservers) as ns;
    -- A label pattern alone accepts an IPv4 address, so require a letter too.
    if exists (select 1 from unnest(v_nameservers) as ns
               where length(ns) > 253
                  or ns !~ '[a-z]'
                  or ns !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$') then
      raise exception 'Nameservers must be valid hostnames' using errcode = '22023';
    end if;
    if (select count(distinct ns) from unnest(v_nameservers) as ns) <> array_length(v_nameservers, 1) then
      raise exception 'Nameserver entries must be unique' using errcode = '23505';
    end if;
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.domain_management_requests r
      where r.customer_id = p_customer_id and r.idempotency_key = p_idempotency_key;
    if found then
      if v_existing.order_id is distinct from p_order_id
         or v_existing.request_type is distinct from p_request_type then
        raise exception 'That request key is already in use' using errcode = '23505';
      end if;
      return query select v_existing.id, v_existing.status, v_existing.request_type, true;
      return;
    end if;
  end if;

  if exists (
    select 1 from public.domain_management_requests r
    where r.order_id = p_order_id and r.request_type = p_request_type and r.status = 'requested'
  ) then
    raise exception 'A request of this type is already open for this domain' using errcode = '23505';
  end if;

  insert into public.domain_management_requests (
    order_id, customer_id, request_type, requested_years,
    requested_nameservers, customer_note, idempotency_key
  ) values (
    p_order_id, p_customer_id, p_request_type, p_requested_years,
    case when p_request_type = 'nameservers' then v_nameservers else null end,
    nullif(btrim(p_customer_note), ''), p_idempotency_key
  )
  returning id, status into v_existing.id, v_existing.status;

  insert into public.domain_audit_events (order_id, actor_user_id, event_type, details)
  values (p_order_id, p_customer_id, 'domain_management.requested',
    jsonb_build_object(
      'request_id', v_existing.id,
      'request_type', p_request_type,
      'requested_years', p_requested_years,
      'requested_nameservers', case when p_request_type = 'nameservers' then to_jsonb(v_nameservers) else null end,
      'customer_note', nullif(btrim(p_customer_note), '')
    ));

  return query select v_existing.id, v_existing.status, p_request_type, false;
end;
$$;
revoke all on function public.create_domain_management_request(uuid, uuid, text, integer, text[], text, text) from public, anon, authenticated;
grant execute on function public.create_domain_management_request(uuid, uuid, text, integer, text[], text, text) to service_role;

comment on function public.create_domain_management_request(uuid, uuid, text, integer, text[], text, text) is
  'Owner-scoped creation of a renewal or nameserver request for a registered domain. It never contacts the registrar and never changes the order by itself.';

-- Administrator records the registrar outcome of a management request. For an
-- applied renewal the new expiry is written to the order; for an applied
-- nameserver change the confirmed nameservers are stored. Both paths are
-- audited with the provider result supplied by the admin route.
create or replace function public.record_domain_management_outcome(
  p_request_id uuid,
  p_admin_user_id uuid,
  p_status text,
  p_admin_note text default null,
  p_confirmed_nameservers text[] default null,
  p_new_expires_at timestamptz default null,
  p_provider_result jsonb default null
)
returns table (request_id uuid, request_status text, order_id uuid, order_expires_at timestamptz, order_nameservers text[])
language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.domain_management_requests%rowtype;
  v_order public.domain_orders%rowtype;
  v_nameservers text[];
  v_now timestamptz := clock_timestamp();
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_admin_user_id and p.role = 'admin'
  ) then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('applied', 'rejected', 'cancelled') then
    raise exception 'Outcome status must be applied, rejected or cancelled' using errcode = '22023';
  end if;
  if p_admin_note is not null and length(btrim(p_admin_note)) > 1000 then
    raise exception 'Admin note is too long' using errcode = '22023';
  end if;

  select * into v_request from public.domain_management_requests r
    where r.id = p_request_id for update;
  if not found then raise exception 'Management request not found' using errcode = 'P0002'; end if;
  if v_request.status <> 'requested' then
    raise exception 'Only open requests can be closed' using errcode = '23514';
  end if;

  select * into v_order from public.domain_orders o where o.id = v_request.order_id for update;
  if not found then raise exception 'Domain order not found' using errcode = 'P0002'; end if;
  if v_order.status <> 'registered' then
    raise exception 'Only registered domains can be managed' using errcode = '23514';
  end if;

  if p_status = 'applied' and v_request.request_type = 'renewal' then
    if p_new_expires_at is null
       or v_order.expires_at is null
       or p_new_expires_at <= v_order.expires_at
       or p_new_expires_at > v_now + interval '15 years' then
      raise exception 'A renewal must extend the current expiry date' using errcode = '22023';
    end if;
    update public.domain_orders
      set expires_at = p_new_expires_at
      where id = v_order.id;
  end if;

  if p_status = 'applied' and v_request.request_type = 'nameservers' then
    if p_confirmed_nameservers is null
       or array_length(p_confirmed_nameservers, 1) is null
       or array_length(p_confirmed_nameservers, 1) < 2
       or array_length(p_confirmed_nameservers, 1) > 8 then
      raise exception 'Record the nameservers confirmed by the registrar' using errcode = '22023';
    end if;
    select array_agg(lower(btrim(ns))) into v_nameservers
      from unnest(p_confirmed_nameservers) as ns;
    update public.domain_orders
      set nameservers = v_nameservers,
          nameservers_updated_at = v_now
      where id = v_order.id;
  end if;

  update public.domain_management_requests
    set status = p_status,
        admin_note = nullif(btrim(p_admin_note), ''),
        reviewed_by = p_admin_user_id,
        reviewed_at = v_now,
        applied_at = case when p_status = 'applied' then v_now else null end,
        provider_result = p_provider_result
    where id = v_request.id;

  insert into public.domain_audit_events (order_id, actor_user_id, event_type, details)
  values (v_order.id, p_admin_user_id, 'domain_management.' || p_status,
    jsonb_build_object(
      'request_id', v_request.id,
      'request_type', v_request.request_type,
      'requested_years', v_request.requested_years,
      'confirmed_nameservers', case when v_request.request_type = 'nameservers' and p_status = 'applied'
        then to_jsonb(v_nameservers) else null end,
      'new_expires_at', case when v_request.request_type = 'renewal' and p_status = 'applied'
        then p_new_expires_at else null end,
      'admin_note', nullif(btrim(p_admin_note), ''),
      'provider_result', p_provider_result
    ));

  return query select v_request.id, p_status, v_order.id,
    (select o.expires_at from public.domain_orders o where o.id = v_order.id),
    (select o.nameservers from public.domain_orders o where o.id = v_order.id);
end;
$$;
revoke all on function public.record_domain_management_outcome(uuid, uuid, text, text, text[], timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.record_domain_management_outcome(uuid, uuid, text, text, text[], timestamptz, jsonb) to service_role;

comment on function public.record_domain_management_outcome(uuid, uuid, text, text, text[], timestamptz, jsonb) is
  'Admin-only record of a registrar outcome for a management request. A renewal must extend the stored expiry; a nameserver change must record the nameservers confirmed at the registrar.';
