-- Integration tests for the additive client portal workspace schema.
\set ON_ERROR_STOP on
begin;

insert into auth.users(id,email) values
  ('77777777-7777-4777-8777-777777777771','portal-customer-one@example.test'),
  ('77777777-7777-4777-8777-777777777772','portal-customer-two@example.test'),
  ('77777777-7777-4777-8777-777777777773','portal-admin@example.test')
on conflict (id) do update set email=excluded.email;
insert into public.profiles(id,email,role) values
  ('77777777-7777-4777-8777-777777777771','portal-customer-one@example.test','user'),
  ('77777777-7777-4777-8777-777777777772','portal-customer-two@example.test','user'),
  ('77777777-7777-4777-8777-777777777773','portal-admin@example.test','admin')
on conflict (id) do update set email=excluded.email,role=excluded.role;

insert into public.clients(id,user_id,company_name,status) values
  ('77777777-7777-4777-8777-777777777781','77777777-7777-4777-8777-777777777771','Client One Ltd','active'),
  ('77777777-7777-4777-8777-777777777782','77777777-7777-4777-8777-777777777772','Client Two Ltd','active');

insert into public.projects(id,client_id,name,status) values
  ('77777777-7777-4777-8777-777777777791','77777777-7777-4777-8777-777777777781','Client One brand identity','in_progress'),
  ('77777777-7777-4777-8777-777777777792','77777777-7777-4777-8777-777777777782','Client Two mobile app','review');

insert into public.client_services(id,customer_id,client_id,project_id,service_type,name,status,currency) values
  ('77777777-7777-4777-8777-777777777801','77777777-7777-4777-8777-777777777771','77777777-7777-4777-8777-777777777781','77777777-7777-4777-8777-777777777791','maintenance','Managed brand website','active','ZMW'),
  ('77777777-7777-4777-8777-777777777802','77777777-7777-4777-8777-777777777772','77777777-7777-4777-8777-777777777782','77777777-7777-4777-8777-777777777792','application_support','Application support','active','USD');

insert into public.project_milestones(id,project_id,title,status,sort_order) values
  ('77777777-7777-4777-8777-777777777811','77777777-7777-4777-8777-777777777791','Brand direction','ready_for_review',1),
  ('77777777-7777-4777-8777-777777777812','77777777-7777-4777-8777-777777777792','Beta test','in_progress',1);

insert into public.project_deliverables(id,project_id,milestone_id,title,storage_path,filename,mime_type,size_bytes,status,shared_at) values
  ('77777777-7777-4777-8777-777777777821','77777777-7777-4777-8777-777777777791','77777777-7777-4777-8777-777777777811','Brand concept','77777777-7777-4777-8777-777777777771/deliverables/brand.pdf','brand.pdf','application/pdf',100,'shared',now());

insert into public.project_change_requests(id,project_id,customer_id,title,description) values
  ('77777777-7777-4777-8777-777777777831','77777777-7777-4777-8777-777777777791','77777777-7777-4777-8777-777777777771','Alternative colour option','Please provide a second colour option for review.');

insert into public.project_activity(project_id,actor_role,event_type,title) values
  ('77777777-7777-4777-8777-777777777791','system','milestone_created','Brand direction milestone created');

insert into public.client_files(id,customer_id,project_id,storage_path,filename,mime_type,size_bytes,category,visibility,uploader_role,uploaded_by) values
  ('77777777-7777-4777-8777-777777777841','77777777-7777-4777-8777-777777777771','77777777-7777-4777-8777-777777777791','77777777-7777-4777-8777-777777777771/uploads/reference.pdf','reference.pdf','application/pdf',100,'reference','client','customer','77777777-7777-4777-8777-777777777771'),
  ('77777777-7777-4777-8777-777777777842','77777777-7777-4777-8777-777777777772','77777777-7777-4777-8777-777777777792','77777777-7777-4777-8777-777777777772/uploads/app.pdf','app.pdf','application/pdf',100,'reference','client','customer','77777777-7777-4777-8777-777777777772');

insert into public.client_notifications(customer_id,category,title,body,href) values
  ('77777777-7777-4777-8777-777777777771','project','Review brand direction','A milestone is ready for review.','/portal/projects/77777777-7777-4777-8777-777777777791'),
  ('77777777-7777-4777-8777-777777777772','project','Review beta test','A beta milestone is in progress.','/portal/projects/77777777-7777-4777-8777-777777777792');

insert into public.client_notification_preferences(customer_id) values
  ('77777777-7777-4777-8777-777777777771'),
  ('77777777-7777-4777-8777-777777777772');

do $ownership$
begin
  begin
    insert into public.client_services(customer_id,client_id,service_type,name,status)
    values ('77777777-7777-4777-8777-777777777771','77777777-7777-4777-8777-777777777782','hosting','Mismatched service','active');
    raise exception 'A service linked to a different customer account was unexpectedly accepted';
  exception when foreign_key_violation then
    null;
  end;
end
$ownership$;

do $test$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clients','projects','client_services','project_milestones','project_deliverables',
    'project_change_requests','project_activity','client_files','client_notifications','client_notification_preferences'
  ] loop
    if to_regclass(format('public.%I',table_name)) is null then
      raise exception 'Expected portal table public.% is missing',table_name;
    end if;
    if not (select relrowsecurity from pg_class where oid=to_regclass(format('public.%I',table_name))) then
      raise exception 'RLS is not enabled for public.%',table_name;
    end if;
  end loop;
  if not exists(select 1 from storage.buckets where id='client-deliverables' and public=false and file_size_limit=20971520) then
    raise exception 'Client deliverables bucket must exist, be private, and enforce the 20 MB limit';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='projects' and policyname='Client workspace users can view own projects' and cmd='SELECT') then
    raise exception 'Client-owned project read policy is missing';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='client_files' and policyname='Customers can view own client files' and cmd='SELECT') then
    raise exception 'Client-owned file read policy is missing';
  end if;
end
$test$;

select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777771',true);
set local role authenticated;
do $rls$
begin
  if (select count(*) from public.clients) <> 1 then raise exception 'Client can read another customer client record'; end if;
  if (select count(*) from public.projects) <> 1 then raise exception 'Client can read another customer project'; end if;
  if (select count(*) from public.client_services) <> 1 then raise exception 'Client can read another customer service'; end if;
  if (select count(*) from public.project_milestones) <> 1 then raise exception 'Client can read another customer milestone'; end if;
  if (select count(*) from public.project_deliverables) <> 1 then raise exception 'Client can read another customer deliverable'; end if;
  if (select count(*) from public.project_change_requests) <> 1 then raise exception 'Client can read another customer change request'; end if;
  if (select count(*) from public.project_activity) <> 1 then raise exception 'Client can read another customer project activity'; end if;
  if (select count(*) from public.client_files) <> 1 then raise exception 'Client can read another customer file'; end if;
  if (select count(*) from public.client_notifications) <> 1 then raise exception 'Client can read another customer notification'; end if;
  if (select count(*) from public.client_notification_preferences) <> 1 then raise exception 'Client can read another customer notification preference'; end if;
end
$rls$;
reset role;

select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777773',true);
set local role authenticated;
do $admin$
begin
  if (select count(*) from public.clients) <> 2 then raise exception 'Admin cannot view all client records'; end if;
  if (select count(*) from public.projects) <> 2 then raise exception 'Admin cannot view all projects'; end if;
end
$admin$;
reset role;

-- Message notification triggers must respect the customer's saved preferences.
update public.client_notification_preferences set message_updates=false where customer_id='77777777-7777-4777-8777-777777777771';
insert into public.inquiries(id,type,email,name,message,source,status,customer_id)
values ('77777777-7777-4777-8777-777777777851','contact','portal-customer-one@example.test','Client One','Test conversation','client-portal','new','77777777-7777-4777-8777-777777777771');
insert into public.inquiry_messages(inquiry_id,sender_role,sender_id,body)
values ('77777777-7777-4777-8777-777777777851','admin','77777777-7777-4777-8777-777777777773','Test admin reply');
do $preference_test$
begin
  if exists(select 1 from public.client_notifications where customer_id='77777777-7777-4777-8777-777777777771' and title='New reply from HEMBOX') then
    raise exception 'Message notifications ignored the customer preference';
  end if;
end
$preference_test$;
update public.client_notification_preferences set message_updates=true where customer_id='77777777-7777-4777-8777-777777777771';
insert into public.inquiry_messages(inquiry_id,sender_role,sender_id,body)
values ('77777777-7777-4777-8777-777777777851','admin','77777777-7777-4777-8777-777777777773','Second admin reply');
do $notification_test$
begin
  if (select count(*) from public.client_notifications where customer_id='77777777-7777-4777-8777-777777777771' and title='New reply from HEMBOX') <> 1 then
    raise exception 'Admin reply did not create a customer notification';
  end if;
end
$notification_test$;

rollback;
