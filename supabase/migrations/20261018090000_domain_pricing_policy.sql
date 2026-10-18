-- Provider-independent pricing policy and immutable price calculation history.
-- Feature branch only: do not apply to production without explicit authorization.

alter table public.domain_tld_catalog
  add column if not exists wholesale_fx_rate_micros bigint,
  add column if not exists margin_basis_points integer,
  add column if not exists pricing_source text,
  add column if not exists price_updated_at timestamptz;

alter table public.domain_tld_catalog
  add constraint domain_tld_catalog_fx_rate_positive
    check (wholesale_fx_rate_micros is null or wholesale_fx_rate_micros > 0),
  add constraint domain_tld_catalog_margin_nonnegative
    check (margin_basis_points is null or margin_basis_points between 0 and 100000),
  add constraint domain_tld_catalog_pricing_source_length
    check (pricing_source is null or length(trim(pricing_source)) between 1 and 160),
  add constraint domain_tld_catalog_enabled_pricing_complete
    check (not enabled or (
      registration_wholesale_minor is not null
      and renewal_wholesale_minor is not null
      and wholesale_fx_rate_micros is not null
      and margin_basis_points is not null
      and pricing_source is not null
      and price_updated_at is not null
      and registration_retail_minor is not null
      and renewal_retail_minor is not null
    ));

create table if not exists public.domain_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  tld text not null references public.domain_tld_catalog(tld) on update cascade on delete restrict,
  provider_id text not null,
  wholesale_currency text not null check (wholesale_currency ~ '^[A-Z]{3}$'),
  registration_wholesale_minor bigint not null check (registration_wholesale_minor >= 0),
  renewal_wholesale_minor bigint not null check (renewal_wholesale_minor >= 0),
  fx_rate_micros bigint not null check (fx_rate_micros > 0),
  margin_basis_points integer not null check (margin_basis_points between 0 and 100000),
  retail_currency text not null default 'ZMW' check (retail_currency = 'ZMW'),
  registration_retail_minor bigint not null check (registration_retail_minor >= 0),
  renewal_retail_minor bigint not null check (renewal_retail_minor >= 0),
  pricing_source text not null check (length(trim(pricing_source)) between 1 and 160),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists domain_price_snapshots_tld_created_idx
  on public.domain_price_snapshots (tld, created_at desc);

alter table public.domain_price_snapshots enable row level security;
revoke all on public.domain_price_snapshots from anon, authenticated;
revoke update, delete, truncate on public.domain_price_snapshots from service_role;
grant select, insert on public.domain_price_snapshots to service_role;

comment on table public.domain_price_snapshots is
  'Append-only server-written history of domain wholesale cost, FX, margin and retail price assumptions.';
comment on column public.domain_tld_catalog.wholesale_fx_rate_micros is
  'ZMW minor units per wholesale-currency minor unit, scaled by 1,000,000.';
comment on column public.domain_tld_catalog.margin_basis_points is
  'Retail markup in basis points; 10000 = 100 percent markup.';
comment on column public.domain_tld_catalog.price_updated_at is
  'Timestamp when a human-verified cost/FX pricing snapshot was saved; not proof of live availability.';
