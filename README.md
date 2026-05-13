# Hembox.io

A modern, fully-modular Next.js 14 application with TypeScript, featuring:

- **Landing Page** with animated hero section
- **Multi-method Authentication** (Email, Phone OTP, Google OAuth)
- **Admin Dashboard** for client & project management
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
