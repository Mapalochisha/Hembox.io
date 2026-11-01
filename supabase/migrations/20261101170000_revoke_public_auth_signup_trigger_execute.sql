-- Revoke direct API execution of the auth signup trigger function.
-- The function remains attached to auth.users; PostgreSQL invokes trigger
-- functions through the trigger mechanism, not through a caller RPC grant.
revoke all on function public.handle_new_user() from public, anon, authenticated;
