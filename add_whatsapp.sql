-- Add WhatsApp columns to agency_settings
alter table public.agency_settings 
add column if not exists whatsapp_number text,
add column if not exists whatsapp_message text;
