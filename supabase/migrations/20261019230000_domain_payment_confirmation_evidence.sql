-- Enforce consistency of payment confirmation evidence at the persistence boundary.
-- Feature branch only; payment initiation and gateway integration remain disabled.
create or replace function public.guard_domain_payment_confirmation_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- A payment attempt must begin before the provider outcome is known.
    if new.status not in ('pending', 'unknown') then
      raise exception 'Payment attempts must start pending or unknown'
        using errcode = '23514';
    end if;
    if new.confirmed_at is not null then
      raise exception 'New payment attempts cannot carry confirmation evidence'
        using errcode = '23514';
    end if;
  end if;

  if new.status in ('confirmed', 'refunded') then
    if new.confirmed_at is null then
      raise exception 'Confirmed/refunded attempts require immutable confirmation evidence'
        using errcode = '23514';
    end if;
    if new.confirmed_at > now() then
      raise exception 'Payment confirmation timestamp cannot be in the future'
        using errcode = '23514';
    end if;
  elsif new.confirmed_at is not null then
    raise exception 'Unconfirmed payment attempts cannot carry confirmation evidence'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.confirmed_at is not null
     and new.confirmed_at is distinct from old.confirmed_at then
    raise exception 'Payment confirmation timestamp is immutable once assigned'
      using errcode = '23514';
  end if;

  return new;
end;
$$;
revoke all on function public.guard_domain_payment_confirmation_evidence() from public, anon, authenticated;
drop trigger if exists guard_domain_payment_confirmation_evidence on public.domain_payment_attempts;
create trigger guard_domain_payment_confirmation_evidence
before insert or update on public.domain_payment_attempts
for each row execute function public.guard_domain_payment_confirmation_evidence();

comment on function public.guard_domain_payment_confirmation_evidence() is
  'Prevents payment attempts from carrying confirmation timestamps unless a confirmed/refunded state has valid, non-future evidence.';
