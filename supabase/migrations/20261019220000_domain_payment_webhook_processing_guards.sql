-- Tighten webhook ledger processing invariants after security review.
-- Feature branch only; this does not add or enable a webhook endpoint.
create or replace function public.guard_domain_payment_webhook_event_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Provider event identity must be canonical to avoid whitespace-based
  -- duplicate keys that the provider would regard as the same event.
  if new.provider_id is distinct from trim(new.provider_id)
     or new.event_id is distinct from trim(new.event_id)
     or new.event_type is distinct from trim(new.event_type) then
    raise exception 'Webhook event identifiers must be trimmed'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if new.processing_status <> 'received' or new.processed_at is not null then
      raise exception 'Webhook events must be inserted in received state'
        using errcode = '23514';
    end if;
  else
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

    if old.processed_at is not null and new.processed_at is distinct from old.processed_at then
      raise exception 'Webhook processing timestamp is immutable once assigned'
        using errcode = '23514';
    end if;

    if new.processing_status is distinct from old.processing_status and not (
      (old.processing_status = 'received' and new.processing_status = any(array['processed', 'ignored', 'failed']))
      or (old.processing_status = 'failed' and new.processing_status = any(array['processed', 'ignored']))
    ) then
      raise exception 'Invalid webhook event processing transition: % -> %',
        old.processing_status, new.processing_status using errcode = '23514';
    end if;
  end if;

  -- A failed signature check can never be upgraded into accepted payment
  -- evidence. The application must verify signatures before processing.
  if new.processing_status = 'processed' and not new.signature_verified then
    raise exception 'Unverified webhook events cannot be processed'
      using errcode = '23514';
  end if;

  return new;
end;
$$;
revoke all on function public.guard_domain_payment_webhook_event_write() from public, anon, authenticated;
drop trigger if exists guard_domain_payment_webhook_event_update on public.domain_payment_webhook_events;
drop trigger if exists guard_domain_payment_webhook_event_write on public.domain_payment_webhook_events;
create trigger guard_domain_payment_webhook_event_write
before insert or update on public.domain_payment_webhook_events
for each row execute function public.guard_domain_payment_webhook_event_write();

comment on function public.guard_domain_payment_webhook_event_write() is
  'Enforces canonical event IDs, received-only inserts, immutable verification evidence and processed-only-if-signature-verified.';
