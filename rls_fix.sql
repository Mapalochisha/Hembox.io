-- 1. Re-enable security
alter table public.profiles enable row level security;

-- 2. Create a secure, explicit policy for admins and users
-- Rule: Users can view their own profile
create policy "Users can view own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

-- Rule: Admins can view all profiles
create policy "Admins can view all profiles" 
  on public.profiles for select 
  using (exists (
    select 1 from public.profiles 
    where id = auth.uid() and role = 'admin'
  ));
