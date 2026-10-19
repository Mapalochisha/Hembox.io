-- Integration checks for the domain order transition guard.
\set ON_ERROR_STOP on
begin;
do $$
declare
  oid uuid;
  n integer;
  caught boolean;
begin
  insert into public.domain_orders(customer_email,domain_name,status)
  values ('transition-test@example.com','transition-test.example','enquiry')
  returning id into oid;
  update public.domain_orders set registration_retail_minor=15000, renewal_retail_minor=18000, status='quoted' where id=oid;
  update public.domain_orders set status='awaiting_payment' where id=oid;
  select count(*) into n from public.domain_audit_events where order_id=oid and event_type='domain_order.status_changed';
  if n <> 2 then raise exception 'wrong transition audit count'; end if;
  update public.domain_orders set status='awaiting_payment' where id=oid;
  select count(*) into n from public.domain_audit_events where order_id=oid and event_type='domain_order.status_changed';
  if n <> 2 then raise exception 'no-op transition emitted an event'; end if;
  caught := false;
  begin
    update public.domain_orders set status='registered' where id=oid;
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'transition guard did not reject invalid jump'; end if;
  update public.domain_orders set status='cancelled' where id=oid;
  caught := false;
  begin
    update public.domain_orders set status='quoted' where id=oid;
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'transition guard did not protect terminal state'; end if;
  select count(*) into n from public.domain_audit_events where order_id=oid and event_type='domain_order.status_changed';
  if n <> 3 then raise exception 'wrong final transition audit count'; end if;
end $$;
rollback;
