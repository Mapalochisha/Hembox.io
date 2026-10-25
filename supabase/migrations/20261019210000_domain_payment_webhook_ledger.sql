-- Durable webhook idempotency ledger. Store verification metadata, never raw payloads/secrets.
-- Feature branch only; no gateway or webhook endpoint is enabled by this migration.
create table if not exists public.domain_payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null check (length(trim(provider_id)) between 1 and 80),
  event_id text not null check (length(trim(event_id)) between 1 and 200),
  payment_attempt_id uuid references public.domain_payment_attempts(id) on delete restrict,
  provider_payment_id text,
  event_type text not null check (length(trim(event_type)) between 1 and 120),
  signature_verified boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  safe_error_code text check (safe_error_code is null or length(safe_error_code) between 1 and 80),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider_id, event_id),
  check ((processing_status = 'processed') = (processed_at is not null))
);
create index if not exists domain_payment_webhook_events_attempt_idx
  on public.domain_payment_webhook_events (payment_attempt_id, received_at desc)
  where payment_attempt_id is not null;
create index if not exists domain_payment_webhook_events_unprocessed_idx
  on public.domain_payment_webhook_events (received_at)
  where processing_status in ('received', 'failed');
alter table public.domain_payment_webhook_events enable row level security;
revoke all on public.domain_payment_webhook_events from anon, authenticated;
grant select on public.domain_payment_webhook_events to authenticated;
grant all on public.domain_payment_webhook_events to service_role;
create policy "Admins can read domain payment webhook events"
  on public.domain_payment_webhook_events for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ));

create or replace function public.guard_domain_payment_webhook_event_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.provider_id is distinct from old.provider_id
     or new.event_id is distinct from old.event_id
     or new.payment_attempt_id is distinct from old.payment_attempt_id
     or new.provider_payment_id is distinct from old.provider_payment_id
     or new.event_type is distinct from old.event_type
     or new.signature_verified is distinct from old.signature_verified
     or new.received_at is distinct from old.received_at then
    raise exception 'Webhook event identity and verification evidence are immutable'
      using errcode = '23514';
  end if;
  if new.processing_status is distinct from old.processing_status and not (
    (old.processing_status = 'received' and new.processing_status = any(array['processed', 'ignored', 'failed']))
    or (old.processing_status = 'failed' and new.processing_status = any(array['processed', 'ignored']))
  ) then
    raise exception 'Invalid webhook event processing transition: % -> %',
      old.processing_status, new.processing_status using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_domain_payment_webhook_event_update() from public, anon, authenticated;
drop trigger if exists guard_domain_payment_webhook_event_update on public.domain_payment_webhook_events;
create trigger guard_domain_payment_webhook_event_update before update on public.domain_payment_webhook_events
for each row execute function public.guard_domain_payment_webhook_event_update();

create or replace function public.prevent_domain_payment_webhook_event_delete()
returns trigger language plpgsql set search_path = ''
as $$ begin
  raise exception 'Webhook event ledger entries cannot be deleted' using errcode = '23514';
end; $$;
revoke all on function public.prevent_domain_payment_webhook_event_delete() from public, anon, authenticated;
drop trigger if exists prevent_domain_payment_webhook_event_delete on public.domain_payment_webhook_events;
create trigger prevent_domain_payment_webhook_event_delete before delete on public.domain_payment_webhook_events
for each row execute function public.prevent_domain_payment_webhook_event_delete();
comment on table public.domain_payment_webhook_events is
  'Idempotency ledger for future payment webhooks. Stores event identifiers and verification/outcome metadata only; never raw payloads, secrets, or cardholder data.';
