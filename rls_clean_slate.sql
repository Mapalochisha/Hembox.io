-- 1. DROP ALL EXISTING POLICIES
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Allow all authenticated users to read profiles" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;

-- 2. RE-CREATE CLEAN POLICIES
alter table public.profiles enable row level security;

create policy "Users can view own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Admins can view all profiles" 
  on public.profiles for select 
  using (exists (
    select 1 from public.profiles 
    where id = auth.uid() and role = 'admin'
  ));

create policy "Users can update own profile" 
  on public.profiles for update 
  using (auth.uid() = id);
