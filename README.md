# Hembox Tech

**Build Beyond Boundaries.** Hembox Tech provides branding, website development, applications, and digital systems. This repository contains the modular Next.js 14 application with TypeScript that powers its website and client/admin workspaces.

- **Public website** for branding, websites, applications, domains, and broader digital services
- **Multi-method Authentication** (Email, Phone OTP, Google OAuth)
- **Client workspace and admin dashboard** for projects, services, billing, domains, and messaging
- **Supabase** backend with PostgreSQL
- **Cloudinary** for media management
- **Tailwind CSS** with custom design system

## Quick Start

See [SETUP.md](./SETUP.md) for detailed setup instructions.

```bash
# Install dependencies
npm install

# Set up environment variables (see .env.example)
cp .env.example .env.local

# Run development server
npm run dev
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Radix UI primitives
- **Auth:** Supabase Auth (Email, Phone, Google)
- **Database:** Supabase PostgreSQL
- **Media:** Cloudinary
- **Icons:** Lucide React

## License

MIT
