-- 1. Create a "Security Definer" function to safely bypass RLS for role checks
-- This function runs with the privileges of the creator (you), allowing the middleware to see the role
create or replace function public.get_user_role(user_id uuid)
returns text as $$
  select role from public.profiles where id = user_id;
$$ language sql security definer;

-- 2. Grant access to the public/anon roles to execute this specific function
grant execute on function public.get_user_role(uuid) to anon, authenticated;
