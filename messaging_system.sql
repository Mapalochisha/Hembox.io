-- HEMBOX.io messaging layer
-- Keeps the existing inquiries table intact and adds a reply thread around each inquiry.

create table if not exists public.inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer', 'admin')),
  sender_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists inquiry_messages_inquiry_created_idx
  on public.inquiry_messages(inquiry_id, created_at asc);

alter table public.inquiry_messages enable row level security;

drop policy if exists "Admins can view inquiry messages" on public.inquiry_messages;
drop policy if exists "Admins can send inquiry messages" on public.inquiry_messages;

create policy "Admins can view inquiry messages"
  on public.inquiry_messages for select
  to authenticated
  using (public.get_user_role(auth.uid()) = 'admin');

create policy "Admins can send inquiry messages"
  on public.inquiry_messages for insert
  to authenticated
  with check (
    public.get_user_role(auth.uid()) = 'admin'
    and sender_role = 'admin'
    and sender_id = auth.uid()
  );

-- Enable realtime for replies. Duplicate publication membership is harmless.
do $$
begin
  alter publication supabase_realtime add table public.inquiry_messages;
exception
  when duplicate_object then null;
end $$;

-- Allow authenticated admins to continue using the existing inquiry update policies.
-- Existing anonymous inquiry submission remains unchanged.
