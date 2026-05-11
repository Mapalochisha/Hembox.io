-- Check ALL existing policies on profiles
select * from pg_policies where tablename = 'profiles';
