-- HEMBOX.io lead / inquiry inbox
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('mockup', 'quote', 'pricing', 'contact')),
  email text not null,
  name text,
  phone text,
  website text,
  message text,
  source text,
  status text not null default 'new' check (status in ('new', 'contacted', 'in_progress', 'completed', 'archived')),
  is_read boolean not null default false,
  read_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inquiries_status_idx on public.inquiries(status);
create index if not exists inquiries_created_at_idx on public.inquiries(created_at desc);
create index if not exists inquiries_email_idx on public.inquiries(email);

create or replace function public.set_inquiries_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists inquiries_updated_at on public.inquiries;
create trigger inquiries_updated_at
before update on public.inquiries
for each row execute function public.set_inquiries_updated_at();

alter table public.inquiries enable row level security;

drop policy if exists "Admins can view inquiries" on public.inquiries;
drop policy if exists "Admins can update inquiries" on public.inquiries;

create policy "Admins can view inquiries"
  on public.inquiries for select
  to authenticated
  using (public.get_user_role(auth.uid()) = 'admin');

create policy "Admins can update inquiries"
  on public.inquiries for update
  to authenticated
  using (public.get_user_role(auth.uid()) = 'admin')
  with check (public.get_user_role(auth.uid()) = 'admin');

-- Realtime powers the admin inbox's live updates.
do $$
begin
  alter publication supabase_realtime add table public.inquiries;
exception
  when duplicate_object then null;
end $$;
