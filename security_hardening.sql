-- HEMBOX.io production security hardening
-- Run this once in the Supabase SQL Editor.

-- New accounts must never receive admin privileges based on an email address.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'user'
  );
  return new;
end;
$$;

-- Keep role checks server-safe and independent of profiles RLS policies.
create or replace function public.get_user_role(user_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = user_id limit 1;
$$;

revoke all on function public.get_user_role(uuid) from public;
grant execute on function public.get_user_role(uuid) to authenticated;

-- Keep the profile trigger from inheriting caller privileges.
revoke all on function public.handle_new_user() from public;

-- Ensure inquiries remain admin-only when read or updated from the browser.
alter table if exists public.inquiries enable row level security;

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
