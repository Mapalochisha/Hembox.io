-- 1. Drop existing policies if they exist
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;

-- 2. Re-enable security (just in case)
alter table public.profiles enable row level security;

-- 3. Create fresh policies
create policy "Users can view own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Admins can view all profiles" 
  on public.profiles for select 
  using (exists (
    select 1 from public.profiles 
    where id = auth.uid() and role = 'admin'
  ));
