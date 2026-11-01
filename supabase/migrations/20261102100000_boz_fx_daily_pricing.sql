-- Bank of Zambia USD/ZMW reference history and automated domain repricing inputs.
-- This migration adds history and margin-floor metadata only. It never enables a TLD.

alter table public.domain_tld_catalog
  add column if not exists minimum_margin_zmw_minor bigint not null default 2500
    check (minimum_margin_zmw_minor >= 0);

alter table public.domain_price_snapshots
  add column if not exists minimum_margin_zmw_minor bigint not null default 2500
    check (minimum_margin_zmw_minor >= 0);

create table if not exists public.domain_fx_rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source = 'bank-of-zambia'),
  base_currency text not null check (base_currency = 'USD'),
  quote_currency text not null check (quote_currency = 'ZMW'),
  published_rate numeric(18,8) not null check (published_rate > 0),
  buffer_zmw numeric(12,4) not null default 1.0000 check (buffer_zmw >= 0),
  effective_rate numeric(18,8) not null check (effective_rate > 0),
  rate_date date not null,
  official_source_url text not null,
  retrieval_source_url text not null,
  retrieved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source, base_currency, quote_currency, rate_date),
  check (effective_rate = published_rate + buffer_zmw)
);

create index if not exists domain_fx_rate_snapshots_latest_idx
  on public.domain_fx_rate_snapshots (source, rate_date desc);

alter table public.domain_fx_rate_snapshots enable row level security;
revoke all on public.domain_fx_rate_snapshots from anon, authenticated;
grant select, insert, update on public.domain_fx_rate_snapshots to service_role;

comment on table public.domain_fx_rate_snapshots is
  'Auditable daily Bank of Zambia USD/ZMW middle-rate snapshots plus the HEMBOX pricing buffer.';
comment on column public.domain_tld_catalog.minimum_margin_zmw_minor is
  'Minimum gross margin in ZMW minor units, applied after FX conversion and percentage markup.';
