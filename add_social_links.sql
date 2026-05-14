-- Add social media columns to agency_settings
alter table public.agency_settings 
add column if not exists instagram_url text,
add column if not exists facebook_url text,
add column if not exists twitter_url text,
add column if not exists linkedin_url text;
