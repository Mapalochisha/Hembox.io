create table if not exists public.customer_domain_registrant_profiles (
 customer_id uuid primary key references auth.users(id) on delete cascade,
 registrant_type text not null default 'individual' check (registrant_type in ('individual','organisation')),
 first_name text not null check (length(trim(first_name)) between 1 and 60),
 last_name text not null check (length(trim(last_name)) between 1 and 60),
 organisation_name text check (organisation_name is null or length(trim(organisation_name)) between 1 and 120),
 email text not null check (length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 phone text not null check (phone ~ '^[+][0-9]{7,15}$'),
 address_line1 text not null check (length(trim(address_line1)) between 3 and 120),
 address_line2 text check (address_line2 is null or length(trim(address_line2)) between 1 and 120),
 city text not null check (length(trim(city)) between 2 and 80),
 region text not null check (length(trim(region)) between 2 and 80),
 postal_code text check (postal_code is null or length(trim(postal_code)) between 2 and 20),
 country_code text not null default 'ZM' check (country_code ~ '^[A-Z]{2}$'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (registrant_type <> 'organisation' or organisation_name is not null)
);
alter table public.customer_domain_registrant_profiles enable row level security;
revoke all on public.customer_domain_registrant_profiles from anon, authenticated;
grant select, insert, update on public.customer_domain_registrant_profiles to authenticated;
grant all on public.customer_domain_registrant_profiles to service_role;
drop policy if exists "Customers manage their own reusable domain registrant profile" on public.customer_domain_registrant_profiles;
create policy "Customers manage their own reusable domain registrant profile"
 on public.customer_domain_registrant_profiles for all to authenticated
 using (customer_id = (select auth.uid()))
 with check (customer_id = (select auth.uid()));
drop trigger if exists set_customer_domain_registrant_profile_updated_at on public.customer_domain_registrant_profiles;
create trigger set_customer_domain_registrant_profile_updated_at
 before update on public.customer_domain_registrant_profiles
 for each row execute function public.set_domain_updated_at();
comment on table public.customer_domain_registrant_profiles is
 'Reusable customer-owned domain registrant defaults. Every order still requires its own consented snapshot in domain_order_registrant_details.';