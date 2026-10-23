-- Ensure the existing inquiry/message framework is represented in Supabase migrations.
-- Existing installations are preserved through IF NOT EXISTS / additive column changes.
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'contact' check (type in ('mockup','quote','pricing','contact')),
  email text not null,
  name text,
  phone text,
  website text,
  message text,
  source text,
  status text not null default 'new' check (status in ('new','contacted','in_progress','completed','archived')),
  is_read boolean not null default false,
  read_at timestamptz,
  admin_notes text,
  contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.inquiries add column if not exists contact text;
create index if not exists inquiries_status_idx on public.inquiries(status);
create index if not exists inquiries_created_at_idx on public.inquiries(created_at desc);
create index if not exists inquiries_email_idx on public.inquiries(email);
alter table public.inquiries enable row level security;
drop policy if exists "Admins can view inquiries" on public.inquiries;
create policy "Admins can view inquiries" on public.inquiries for select to authenticated using (public.get_user_role(auth.uid())='admin');
drop policy if exists "Admins can update inquiries" on public.inquiries;
create policy "Admins can update inquiries" on public.inquiries for update to authenticated using (public.get_user_role(auth.uid())='admin') with check (public.get_user_role(auth.uid())='admin');

create or replace function public.set_inquiries_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin new.updated_at=now(); return new; end;
$$;
revoke all on function public.set_inquiries_updated_at() from public,anon,authenticated;
drop trigger if exists inquiries_updated_at on public.inquiries;
create trigger inquiries_updated_at before update on public.inquiries for each row execute function public.set_inquiries_updated_at();

create table if not exists public.inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer','admin')),
  sender_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists inquiry_messages_inquiry_created_idx on public.inquiry_messages(inquiry_id,created_at asc);
alter table public.inquiry_messages enable row level security;
drop policy if exists "Admins can view inquiry messages" on public.inquiry_messages;
create policy "Admins can view inquiry messages" on public.inquiry_messages for select to authenticated using (public.get_user_role(auth.uid())='admin');
drop policy if exists "Admins can send inquiry messages" on public.inquiry_messages;
create policy "Admins can send inquiry messages" on public.inquiry_messages for insert to authenticated with check (public.get_user_role(auth.uid())='admin' and sender_role='admin' and sender_id=auth.uid());

insert into public.inquiry_messages(inquiry_id,sender_role,sender_id,body,created_at)
select i.id,'customer',null,i.message,i.created_at from public.inquiries i
where i.message is not null and char_length(trim(i.message))>0
and not exists(select 1 from public.inquiry_messages m where m.inquiry_id=i.id);
do $$
begin
  alter publication supabase_realtime add table public.inquiries;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.inquiry_messages;
exception when duplicate_object then null; when undefined_object then null;
end $$;
