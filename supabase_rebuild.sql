-- 1. CLEANUP (Wipe everything)
-- Drop the trigger and function first
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Drop public tables in reverse order (to handle foreign keys)
drop table if exists public.projects;
drop table if exists public.clients;
drop table if exists public.profiles;

-- Delete all users from the Auth system
delete from auth.users;

-- 2. REBUILD (Original Schema)
-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  phone text,
  full_name text,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Clients table
create table public.clients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  company_name text,
  industry text,
  website text,
  status text default 'pending' check (status in ('active', 'inactive', 'pending')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Projects table
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  name text not null,
  description text,
  status text default 'draft' check (status in ('draft', 'in_progress', 'review', 'completed', 'cancelled')),
  budget numeric,
  deadline timestamptz,
  images text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. ENABLE SECURITY
alter table profiles enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;

-- 4. RLS POLICIES
create policy "Users can view own profile" on profiles for select using (auth.uid() = id or (select role from profiles where id = auth.uid()) = 'admin');
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Admins have full access to clients" on clients for all using ((select role from profiles where id = auth.uid()) = 'admin');
create policy "Admins have full access to projects" on projects for all using ((select role from profiles where id = auth.uid()) = 'admin');

-- 5. AUTH TRIGGER FUNCTION
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    case 
      when new.email = 'admin@hembox.io' then 'admin'
      else 'user'
    end
  );
  return new;
end;
$$ language plpgsql security definer;

-- 6. ATTACH TRIGGER
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
