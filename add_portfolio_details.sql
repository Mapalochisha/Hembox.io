-- Add images array and description columns to portfolio_items if they don't exist
alter table public.portfolio_items 
add column if not exists images text[] default '{}',
add column if not exists description text,
add column if not exists project_url text;
