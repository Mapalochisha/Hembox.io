# Hembox.io — Production Setup Guide

## Prerequisites

- Node.js 22+
- npm
- Supabase account
- Cloudinary account
- Google Cloud Console account if Google OAuth is enabled

## 1. Install Dependencies

```bash
cd Hembox.io
npm ci
```

## 2. Supabase Setup

### 2.1 Create Project

1. Create a Supabase project.
2. Copy the Project URL and anon key from Project Settings → API.
3. Copy the Service Role Key for server-side operations only.

### 2.2 Configure Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_API_KEY`, or `CLOUDINARY_API_SECRET` to the browser.

### 2.3 Database Schema

Run your existing base schema/migrations first, then run the current project migrations from the repository as needed:

- `create_inquiries.sql` — lead/inquiry inbox and Realtime configuration.
- `add_portfolio_details.sql` — portfolio fields.
- `add_social_links.sql` — social profile settings.
- `add_whatsapp.sql` — WhatsApp contact settings.
- `security_hardening.sql` — removes email-based admin escalation and hardens role checks.

Do not use the older `rls_*.sql` or `supabase_rebuild.sql` files as a blanket production reset unless you have reviewed them against your current database. They are historical repair/rebuild scripts.

### 2.4 Admin Role

New accounts are created with the `user` role. Promote an account to admin explicitly from the Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'your-email@example.com';
```

Then sign out and sign back in so the new role is reflected in the session.

### 2.5 Lead Inbox

The public website sends quote/mockup/contact requests to `/api/inquiries`. The API validates the request server-side and writes using the Supabase Service Role Key. The admin Messages page reads and updates inquiries through authenticated Supabase access with RLS.

## 3. Auth Providers

In Supabase Dashboard → Authentication → Providers, enable only the providers you intend to use.

**Email/password:** enable Email provider and configure confirmation/reset templates as required.

**Phone OTP:** enable Phone provider and configure a supported SMS provider such as Twilio if phone login is needed.

**Google OAuth:** create OAuth credentials in Google Cloud Console and configure the Supabase callback URL and allowed site URL in Supabase.

## 4. Cloudinary

The application uses Cloudinary for admin media uploads. The upload API is admin-only and accepts JPEG, PNG, WebP, and GIF images up to 5 MB.

Do not make the Cloudinary API secret or upload endpoint credentials available to client-side code.

## 5. Run the App

```bash
npm run dev
```

Open `http://localhost:3000`.

## 6. Production Checks

Before launch, verify:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm run build`
4. Public inquiry submission creates an entry in `inquiries`.
5. A non-admin cannot access `/admin/*` or `/api/admin/*`.
6. A non-admin cannot upload through `/api/upload`.
7. Admin inquiry updates work and appear in Realtime.
8. Privacy Policy and Terms content are populated in Agency Settings.
9. Contact email, phone, WhatsApp, and social URLs are production values.

## Project Structure

```text
Hembox.io/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login and registration
│   │   ├── (public)/        # Public pages
│   │   ├── admin/            # Admin dashboard
│   │   ├── api/              # Server API routes
│   │   └── auth/callback/    # OAuth callback
│   ├── components/
│   │   ├── auth/
│   │   ├── landing/
│   │   ├── admin/
│   │   └── providers/
│   ├── hooks/
│   └── lib/
│       ├── supabase/
│       ├── cloudinary.ts
│       └── database.types.ts
├── .env.example
├── .github/workflows/ci.yml
├── next.config.js
└── package.json
```

## Deployment

### Vercel

Add all production environment variables in the Vercel project settings. Keep server-only secrets out of `NEXT_PUBLIC_*` variables.

## Security Notes

1. Never commit `.env.local` or production secrets.
2. Keep RLS enabled on all tables containing private data.
3. Use the Service Role Key only in server-side code.
4. Keep admin authorization checks on API routes; middleware alone is not sufficient.
5. Restrict file uploads by authenticated role, type, and size.
6. Review Supabase Auth redirect URLs before production.
7. Run dependency/security updates regularly and review `npm audit` output.
