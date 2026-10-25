-- Assert seeded manual-payment methods use approved receiving details and safe bank placeholders.
begin;

do $$
declare
  method_count integer;
  active_mobile_count integer;
  bank_active boolean;
  bank_instructions text;
begin
  select count(*) into method_count
  from public.billing_payment_methods
  where method_key in ('mtn_mobile_money', 'airtel_money', 'zamtel_money', 'bank_transfer');

  if method_count <> 4 then
    raise exception 'Expected all four initial payment methods, found %', method_count;
  end if;

  select count(*) into active_mobile_count
  from public.billing_payment_methods
  where method_key in ('mtn_mobile_money', 'airtel_money', 'zamtel_money')
    and active
    and supported_currencies = array['ZMW']::text[]
    and instructions ilike '%Mapalo Chisha%'
    and instructions ilike '%invoice%'
    and instructions ilike '%verify%';

  if active_mobile_count <> 3 then
    raise exception 'Expected three active ZMW mobile-money methods with recipient and verification instructions, found %', active_mobile_count;
  end if;

  if not exists (
    select 1 from public.billing_payment_methods
    where method_key = 'mtn_mobile_money'
      and instructions like '%+260969868508%'
  ) or not exists (
    select 1 from public.billing_payment_methods
    where method_key = 'airtel_money'
      and instructions like '%+260772448274%'
  ) or not exists (
    select 1 from public.billing_payment_methods
    where method_key = 'zamtel_money'
      and instructions like '%+260953780272%'
  ) then
    raise exception 'A configured mobile-money receiving number does not match the requested value';
  end if;

  select active, instructions into bank_active, bank_instructions
  from public.billing_payment_methods
  where method_key = 'bank_transfer';

  if bank_active then
    raise exception 'Bank transfer must remain inactive while account details are placeholders';
  end if;

  if bank_instructions not ilike '%[ACCOUNT NUMBER TO BE ADDED]%'
     or bank_instructions not ilike '%Mapalo Chisha%'
     or bank_instructions not ilike '%do not send money%' then
    raise exception 'Bank transfer placeholder must be explicit and must not invite payment';
  end if;
end;
$$;

rollback;
