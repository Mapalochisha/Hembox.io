-- HEMBOX client workspace domain model.
-- Additive only: preserve the legacy client/project records and existing billing/domain workflows.
-- Do not apply to a live database without the separately approved migration/release process.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  company_name text,
  industry text,
  website text,
  status text not null default 'pending' check (status in ('active','inactive','pending')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','in_progress','review','completed','cancelled')),
  budget numeric,
  deadline timestamptz,
  images text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clients_id_user_id_unique on public.clients(id,user_id);

alter table public.clients enable row level security;
alter table public.projects enable row level security;

grant select, insert, update, delete on public.clients, public.projects to authenticated;

drop policy if exists "Client workspace users can view own client records" on public.clients;
create policy "Client workspace users can view own client records"
  on public.clients for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Client workspace admins manage client records" on public.clients;
create policy "Client workspace admins manage client records"
  on public.clients for all to authenticated
  using (public.get_user_role((select auth.uid())) = 'admin')
  with check (public.get_user_role((select auth.uid())) = 'admin');

drop policy if exists "Client workspace users can view own projects" on public.projects;
create policy "Client workspace users can view own projects"
  on public.projects for select to authenticated
  using (exists (
    select 1 from public.clients c
    where c.id = projects.client_id and c.user_id = (select auth.uid())
  ));

drop policy if exists "Client workspace admins manage projects" on public.projects;
create policy "Client workspace admins manage projects"
  on public.projects for all to authenticated
  using (public.get_user_role((select auth.uid())) = 'admin')
  with check (public.get_user_role((select auth.uid())) = 'admin');

create table if not exists public.client_services (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  project_id uuid references public.projects(id) on delete set null,
  service_type text not null check (length(trim(service_type)) between 2 and 80),
  name text not null check (length(trim(name)) between 2 and 160),
  description text,
  status text not null default 'pending' check (status in ('pending','active','paused','cancelled','expired')),
  starts_at timestamptz,
  renews_at timestamptz,
  currency text check (currency is null or currency in ('ZMW','USD')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_services_client_customer_fk foreign key (client_id,customer_id) references public.clients(id,user_id) on delete cascade
);
create index if not exists client_services_customer_status_idx on public.client_services(customer_id,status,created_at desc);
create index if not exists client_services_project_idx on public.client_services(project_id) where project_id is not null;
alter table public.client_services enable row level security;
grant select, insert, update, delete on public.client_services to authenticated;

drop policy if exists "Customers can view their own services" on public.client_services;
create policy "Customers can view their own services"
  on public.client_services for select to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists "Admins manage client services" on public.client_services;
create policy "Admins manage client services"
  on public.client_services for all to authenticated
  using (public.get_user_role((select auth.uid())) = 'admin')
  with check (public.get_user_role((select auth.uid())) = 'admin');

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 180),
  description text,
  status text not null default 'pending' check (status in ('pending','in_progress','ready_for_review','approved','blocked','completed')),
  due_at timestamptz,
  sort_order integer not null default 0,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((approved_at is null) = (approved_by is null))
);
create index if not exists project_milestones_project_order_idx on public.project_milestones(project_id,sort_order,created_at);
alter table public.project_milestones enable row level security;
grant select, insert, update, delete on public.project_milestones to authenticated;

drop policy if exists "Customers can view own project milestones" on public.project_milestones;
create policy "Customers can view own project milestones"
  on public.project_milestones for select to authenticated
  using (exists (select 1 from public.projects p join public.clients c on c.id=p.client_id where p.id=project_id and c.user_id=(select auth.uid())));

drop policy if exists "Admins manage project milestones" on public.project_milestones;
create policy "Admins manage project milestones"
  on public.project_milestones for all to authenticated
  using (public.get_user_role((select auth.uid())) = 'admin')
  with check (public.get_user_role((select auth.uid())) = 'admin');

create table if not exists public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid references public.project_milestones(id) on delete set null,
  title text not null check (length(trim(title)) between 2 and 180),
  description text,
  storage_bucket text not null default 'client-deliverables',
  storage_path text not null check (length(trim(storage_path)) between 1 and 700 and storage_path !~ '^https?://'),
  filename text not null check (length(trim(filename)) between 1 and 255),
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 1 and 20971520),
  version integer not null default 1 check (version > 0),
  status text not null default 'shared' check (status in ('draft','shared','changes_requested','approved','superseded')),
  feedback_note text check (feedback_note is null or length(feedback_note) <= 2000),
  shared_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(storage_bucket,storage_path),
  check ((approved_at is null) = (approved_by is null))
);
create index if not exists project_deliverables_project_created_idx on public.project_deliverables(project_id,created_at desc);
alter table public.project_deliverables enable row level security;
grant select, insert, update, delete on public.project_deliverables to authenticated;

drop policy if exists "Customers can view own project deliverables" on public.project_deliverables;
create policy "Customers can view own project deliverables"
  on public.project_deliverables for select to authenticated
  using (exists (select 1 from public.projects p join public.clients c on c.id=p.client_id where p.id=project_id and c.user_id=(select auth.uid())));

drop policy if exists "Admins manage project deliverables" on public.project_deliverables;
create policy "Admins manage project deliverables"
  on public.project_deliverables for all to authenticated
  using (public.get_user_role((select auth.uid())) = 'admin')
  with check (public.get_user_role((select auth.uid())) = 'admin');

create table if not exists public.project_change_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 3 and 180),
  description text not null check (length(trim(description)) between 10 and 4000),
  status text not null default 'submitted' check (status in ('submitted','under_review','approved','declined','completed')),
  decision_note text check (decision_note is null or length(decision_note) <= 2000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_change_requests_project_created_idx on public.project_change_requests(project_id,created_at desc);
alter table public.project_change_requests enable row level security;
grant select, insert, update, delete on public.project_change_requests to authenticated;

drop policy if exists "Customers can view own project change requests" on public.project_change_requests;
create policy "Customers can view own project change requests"
  on public.project_change_requests for select to authenticated
  using (customer_id=(select auth.uid()) and exists (select 1 from public.projects p join public.clients c on c.id=p.client_id where p.id=project_id and c.user_id=(select auth.uid())));

drop policy if exists "Admins manage project change requests" on public.project_change_requests;
create policy "Admins manage project change requests"
  on public.project_change_requests for all to authenticated
  using (public.get_user_role((select auth.uid())) = 'admin')
  with check (public.get_user_role((select auth.uid())) = 'admin');

create table if not exists public.project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('customer','admin','system')),
  event_type text not null check (length(trim(event_type)) between 2 and 80),
  title text not null check (length(trim(title)) between 2 and 180),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  created_at timestamptz not null default now()
);
create index if not exists project_activity_project_created_idx on public.project_activity(project_id,created_at desc);
alter table public.project_activity enable row level security;
grant select, insert, update, delete on public.project_activity to authenticated;

drop policy if exists "Customers can view own project activity" on public.project_activity;
create policy "Customers can view own project activity"
  on public.project_activity for select to authenticated
  using (exists (select 1 from public.projects p join public.clients c on c.id=p.client_id where p.id=project_id and c.user_id=(select auth.uid())));

drop policy if exists "Admins manage project activity" on public.project_activity;
create policy "Admins manage project activity"
  on public.project_activity for all to authenticated
  using (public.get_user_role((select auth.uid())) = 'admin')
  with check (public.get_user_role((select auth.uid())) = 'admin');

create table if not exists public.client_files (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  service_id uuid references public.client_services(id) on delete set null,
  storage_bucket text not null default 'client-deliverables',
  storage_path text not null check (length(trim(storage_path)) between 1 and 700 and storage_path !~ '^https?://'),
  filename text not null check (length(trim(filename)) between 1 and 255),
  mime_type text not null check (length(trim(mime_type)) between 1 and 160),
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  category text not null default 'reference' check (category in ('reference','deliverable','document','other')),
  description text check (description is null or length(description) <= 1000),
  visibility text not null default 'client' check (visibility in ('client','internal')),
  uploader_role text not null check (uploader_role in ('customer','admin','system')),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(storage_bucket,storage_path)
);
create index if not exists client_files_customer_created_idx on public.client_files(customer_id,created_at desc);
create index if not exists client_files_project_created_idx on public.client_files(project_id,created_at desc) where project_id is not null;
alter table public.client_files enable row level security;
grant select, insert, update, delete on public.client_files to authenticated;

drop policy if exists "Customers can view own client files" on public.client_files;
create policy "Customers can view own client files"
  on public.client_files for select to authenticated
  using (customer_id=(select auth.uid()) and visibility='client');

drop policy if exists "Admins manage client files" on public.client_files;
create policy "Admins manage client files"
  on public.client_files for all to authenticated
  using (public.get_user_role((select auth.uid())) = 'admin')
  with check (public.get_user_role((select auth.uid())) = 'admin');

create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('project','service','billing','domain','message','system')),
  title text not null check (length(trim(title)) between 2 and 180),
  body text not null check (length(trim(body)) between 1 and 1000),
  href text check (href is null or (href like '/portal/%' and href !~ '^//')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists client_notifications_customer_unread_idx on public.client_notifications(customer_id,created_at desc) where read_at is null;
alter table public.client_notifications enable row level security;
grant select, insert, update, delete on public.client_notifications to authenticated;

drop policy if exists "Customers can view own notifications" on public.client_notifications;
create policy "Customers can view own notifications"
  on public.client_notifications for select to authenticated
  using (customer_id=(select auth.uid()));

drop policy if exists "Admins manage client notifications" on public.client_notifications;
create policy "Admins manage client notifications"
  on public.client_notifications for all to authenticated
  using (public.get_user_role((select auth.uid())) = 'admin')
  with check (public.get_user_role((select auth.uid())) = 'admin');

create table if not exists public.client_notification_preferences (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  project_updates boolean not null default true,
  service_updates boolean not null default true,
  billing_updates boolean not null default true,
  domain_updates boolean not null default true,
  message_updates boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.client_notification_preferences enable row level security;
grant select, insert, update on public.client_notification_preferences to authenticated;

drop policy if exists "Customers manage own notification preferences" on public.client_notification_preferences;
create policy "Customers manage own notification preferences"
  on public.client_notification_preferences for all to authenticated
  using (customer_id=(select auth.uid()))
  with check (customer_id=(select auth.uid()));

-- General client assets are private. Server routes validate ownership before using
-- the service role to upload files or mint short-lived signed download URLs.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'client-deliverables','client-deliverables',false,20971520,
  array['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf','application/zip','text/plain','text/markdown','application/json','application/octet-stream']
)
on conflict (id) do update set public=false,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;
