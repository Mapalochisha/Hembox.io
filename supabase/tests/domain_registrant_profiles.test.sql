begin;
do $$
declare
  v_owner uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  v_other uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
begin
  insert into auth.users (id) values (v_owner),(v_other) on conflict (id) do nothing;
  insert into public.customer_domain_registrant_profiles (
    customer_id,registrant_type,first_name,last_name,email,phone,address_line1,city,region,country_code
  ) values (
    v_owner,'individual','Profile','Owner','profile-owner@example.test','+260970000000',
    '10 Great East Road','Lusaka','Lusaka','ZM'
  ) on conflict (customer_id) do update set first_name=excluded.first_name;
end $$;

select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-ccccccccccc1',true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.customer_domain_registrant_profiles) <> 1 then
    raise exception 'A customer must be able to read their own reusable registrant profile';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-ccccccccccc2',true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.customer_domain_registrant_profiles) <> 0 then
    raise exception 'A customer must not read another account registrant profile';
  end if;
end $$;
reset role;

do $$
begin
  if has_table_privilege('anon','public.customer_domain_registrant_profiles','SELECT') then
    raise exception 'Anonymous users must not read registrant profiles';
  end if;
  if has_table_privilege('authenticated','public.customer_domain_registrant_profiles','DELETE') then
    raise exception 'Customers must not delete reusable registrant profiles through the Data API';
  end if;
end $$;
rollback;
