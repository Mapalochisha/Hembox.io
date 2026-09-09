-- Allow public inquiry forms to collect either an email address or a WhatsApp number.
-- Run this once in the Supabase SQL Editor after create_inquiries.sql.

alter table public.inquiries
  add column if not exists contact text;

alter table public.inquiries
  alter column email drop not null;

update public.inquiries
set contact = coalesce(nullif(email, ''), nullif(phone, ''))
where contact is null;

create index if not exists inquiries_contact_idx on public.inquiries(contact);
