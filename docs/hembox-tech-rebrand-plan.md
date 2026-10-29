# Hembox Tech Rebrand — Plan & Progress

> **Brand:** HEMBOX TECH  
> **Primary domain (purchased, not yet connected):** `hembox.tech`  
> **Tagline:** **Build Beyond Boundaries.**  
> **Working branch:** `rebrand/hembox-tech`  
> **Base branch:** `main`  
> **Baseline commit:** `dcbeac0b4c149a37e677b6a38d5c515b85c2a45e`  
> **Scope guard:** This plan covers the brand and application rebrand first. Do not change DNS, Vercel domain assignments, production environment variables, authentication callback settings, or production database data during this phase.

## Decisions confirmed

- [x] Use **HEMBOX TECH** as the full company name; do not treat “Hembox” alone as the complete brand.
- [x] Use `hembox.tech` as the intended primary domain after the rebrand is ready.
- [x] Adopt the tagline **Build Beyond Boundaries.**
- [x] Modernize the existing visual identity rather than discard it by default. Keep the logo implementation flexible because the owner may provide a revised logo.
- [x] Preserve the existing admin-managed dynamic services system.
- [x] Preserve customer, admin, authentication, billing, messaging, domain-management, and other existing workflows.
- [x] Work one milestone at a time. Keep current domain/DNS configuration unchanged until a later, separately verified migration phase.

## Initial repository audit

The repository is `Mapalochisha/Hembox.io`, a Next.js 14 / TypeScript application using Supabase, Tailwind CSS, and Vercel. The default branch at the start of this task was `main`, at baseline commit `dcbeac0b4c149a37e677b6a38d5c515b85c2a45e`.

### Confirmed areas requiring review

- [x] Root metadata in `src/app/layout.tsx` contains the old brand and website-only positioning.
- [x] Landing navigation in `src/components/landing/navbar.tsx` has an old-brand accessible label and references `/hembox-logo.svg`.
- [x] Login and registration screens include old-brand text and/or a separate inline logo treatment.
- [x] `src/components/providers/agency-provider.tsx` has a default agency name using the old brand.
- [x] `src/components/landing/mockup-modal.tsx` uses the old brand in accessible labels.
- [x] Cloudinary upload paths/defaults include `Hembox.io`; changing these may affect asset organization and should not be done as a blind replacement.
- [x] Repository docs and setup files use the old brand in titles and explanatory text.
- [x] SQL scripts and environment examples contain old-brand references. These need classification before editing; historical migration/setup scripts, configured admin email values, and database logic must not be altered casually.
- [x] The public service management UI is implemented at `src/app/admin/services/page.tsx`. It reads and writes the existing Supabase `services` table, including service title, description, icon, active/inactive status, and sort order. Preserve this dynamic workflow and its data model.

### Classification rule for references

1. **Customer-visible brand copy:** update to Hembox Tech.
2. **Brand presentation assets and accessible labels:** update consistently; retain the current hover behaviour and responsive sizing where practical.
3. **Website positioning:** replace website-only messaging with a broader digital-solutions position that can cover websites, applications, branding, and future services.
4. **Technical hostnames and URLs:** preserve during the branding phase. Change only in the later domain-migration phase after explicit inventory and validation.
5. **Authentication identifiers, admin email values, secrets, database policies, SQL migration history, API contracts, Cloudinary folders, and stored data:** do not mass-replace. Evaluate each separately and change only where necessary and safe.
6. **Repository name and GitHub/Vercel project identifiers:** not part of this first milestone.

## Milestones

### M0 — Audit and plan
- [x] Confirm brand decisions and non-negotiable constraints.
- [x] Inspect repository metadata, global metadata, landing navigation, authentication branding, and admin services management.
- [x] Create this tracked plan on a dedicated feature branch.
- [ ] Complete a broader search for all user-facing old-brand references and current logo/hero/service-page implementations.
- [ ] Record the final audit inventory and implementation sequence.

### M1 — Brand foundations
- [ ] Update global metadata and brand copy to Hembox Tech and the new tagline where appropriate.
- [ ] Establish a consistent brand-name/asset approach without requiring a final user-provided logo file.
- [ ] Update shared brand defaults and accessible labels.
- [ ] Keep domain URLs and runtime configuration unchanged.

### M2 — Public website positioning
- [ ] Refresh homepage messaging to position Hembox Tech as a broader digital solutions company.
- [ ] Preserve the dynamic service retrieval/rendering flow.
- [ ] Ensure the services page continues to reflect services entered and published through the admin dashboard.
- [ ] Review pricing, contact, portfolio, SEO metadata, and social preview copy for brand consistency.

### M3 — Authenticated application surfaces
- [ ] Update customer portal, admin dashboard, authentication pages, billing/invoices, messaging, and notifications where the old brand is visible.
- [ ] Preserve existing routes, permissions, database records, and workflows.
- [ ] Avoid production database changes for branding-only work.

### M4 — Repository documentation and reference cleanup
- [ ] Update relevant current documentation and setup instructions.
- [ ] Keep historical migration notes and immutable operational records accurate; annotate rather than rewrite historical facts where necessary.
- [ ] Classify remaining technical references and record any intentionally retained occurrences.

### M5 — Verification on the existing deployment
- [ ] Run CI checks: lint, TypeScript, relevant tests, and production build.
- [ ] Fix regressions introduced by this branch.
- [ ] Verify the Vercel deployment for the rebrand branch if the configured workflow provides a preview.
- [ ] Smoke-test homepage, dynamic services, pricing, login/register, customer portal, admin services management, billing, and messaging.
- [ ] Confirm no DNS or Vercel custom-domain settings were changed.
- [ ] Review the finished rebrand before proceeding to domain connection.

### M6 — Separate domain migration (not started; do not begin during M0–M5 without a deliberate handoff)
- [ ] Inventory current Vercel project/domain configuration and DNS provider instructions.
- [ ] Connect `hembox.tech` to the intended Vercel project only after the branding phase is accepted.
- [ ] Configure and verify DNS, HTTPS, canonical URLs, redirects, sitemap, and metadata.
- [ ] Review Supabase authentication redirect allowlists, OAuth callback URLs if used, email links, and `NEXT_PUBLIC_APP_URL` only after inventory.
- [ ] Test customer and admin journeys on the new domain before considering the migration complete.
- [ ] Retain the existing Vercel subdomain as a safe fallback/redirect until verification is complete.

## Progress log

### 2026-10-29 — M0 started
- Confirmed `main` baseline: `dcbeac0b4c149a37e677b6a38d5c515b85c2a45e`.
- Created feature branch `rebrand/hembox-tech` from `main`.
- Initial code search found old-brand references in root metadata, landing navigation, login/register pages, agency defaults, mockup modal accessible labels, Cloudinary upload folders, SQL/setup material, and docs.
- Inspected `src/app/admin/services/page.tsx`: the current admin-managed services flow reads/writes Supabase `services` records and supports create/edit, active status, icon selection, and deletion. It is explicitly in preservation scope.
- No application code, production data, DNS, Vercel domain settings, or environment variables have been changed in this milestone.
- Next: complete the broader audit and record the implementation inventory before modifying application code.
