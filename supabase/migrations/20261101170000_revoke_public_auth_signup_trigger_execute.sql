-- Harden the auth signup trigger function.
-- The function is invoked by auth.users' trigger and is not a public RPC.
-- Keep the trigger behavior while restricting direct API execution and pinning
-- an empty search_path; all application objects are schema-qualified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
