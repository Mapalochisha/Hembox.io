# Pixel Forge - Next.js Setup Guide

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Cloudinary account
- Google Cloud Console account (for OAuth)

## 1. Install Dependencies

```bash
cd Hembox.io
npm install
# or
yarn install
```

## 2. Supabase Setup

### 2.1 Create Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your Project URL and Anon Key from Project Settings > API
3. Get your Service Role Key (for admin operations)

### 2.2 Configure Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2.3 Database Schema

Run this SQL in Supabase SQL Editor:

```sql
-- Enable RLS
alter table if exists profiles enable row level security;
alter table if exists clients enable row level security;
alter table if exists projects enable row level security;

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  phone text,
  full_name text,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Clients table
create table if not exists public.clients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  company_name text,
  industry text,
  website text,
  status text default 'pending' check (status in ('active', 'inactive', 'pending')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Projects table
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  name text not null,
  description text,
  status text default 'draft' check (status in ('draft', 'in_progress', 'review', 'completed', 'cancelled')),
  budget numeric,
  deadline timestamptz,
  images text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS Policies

-- Profiles: Users can read their own profile, admins can read all
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id or (select role from profiles where id = auth.uid()) = 'admin');

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Clients: Admins have full access
create policy "Admins have full access to clients"
  on clients for all
  using ((select role from profiles where id = auth.uid()) = 'admin');

-- Projects: Admins have full access
create policy "Admins have full access to projects"
  on projects for all
  using ((select role from profiles where id = auth.uid()) = 'admin');

-- Functions
-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    case 
      when new.email = 'admin@Hembox.io' then 'admin'
      else 'user'
    end
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### 2.4 Enable Auth Providers

In Supabase Dashboard > Authentication > Providers:

**Email Auth:**
- Enable Email provider (default on)
- Configure email templates if desired

**Phone Auth:**
- Enable Phone provider
- Configure Twilio or MessageBird for SMS
- Set up OTP settings

**Google OAuth:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase Google provider settings
5. Add your site URL to authorized origins

## 3. Cloudinary Setup

1. Create account at [cloudinary.com](https://cloudinary.com)
2. Get your Cloud Name, API Key, and API Secret from Dashboard
3. Add to `.env.local`:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## 4. Run the App

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000)

## 5. Admin Setup

1. Sign up with your email
2. Run in Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'your-email@example.com';
```

3. Log out and log back in
4. Access admin at `/admin/dashboard`

## Project Structure

```
Hembox.io/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Auth pages (login, register)
│   │   ├── (public)/        # Public pages (landing)
│   │   ├── admin/           # Admin dashboard
│   │   ├── api/             # API routes
│   │   ├── auth/callback/   # OAuth callback
│   │   ├── layout.tsx       # Root layout
│   │   └── globals.css      # Global styles
│   ├── components/
│   │   ├── ui/              # Reusable UI components
│   │   ├── auth/            # Auth forms
│   │   ├── landing/         # Landing page sections
│   │   ├── admin/           # Admin components
│   │   └── providers/       # Context providers
│   ├── hooks/               # Custom hooks
│   ├── lib/
│   │   ├── supabase/        # Supabase clients
│   │   ├── cloudinary.ts    # Cloudinary config
│   │   ├── utils.ts         # Utilities
│   │   └── database.types.ts # DB types
│   └── types/               # TypeScript types
├── .env.local               # Environment variables
├── next.config.js
├── tailwind.config.ts
└── package.json
```

## Features

- **Authentication:** Email/password, Phone OTP, Google OAuth
- **Admin Dashboard:** Client management, project tracking, analytics
- **Database:** Supabase PostgreSQL with RLS policies
- **Media:** Cloudinary image uploads
- **Styling:** Tailwind CSS with custom design system
- **Animations:** Framer Motion + CSS animations
- **Type Safety:** Full TypeScript support

## Deployment

### Vercel (Recommended)

```bash
npm i -g vercel
vercel
```

Add environment variables in Vercel Dashboard > Settings > Environment Variables.

## Security Notes

1. Never commit `.env.local` to git
2. Use Row Level Security (RLS) policies
3. Service Role Key should only be used server-side
4. Enable HTTPS in production
5. Set up proper CORS policies in Supabase
