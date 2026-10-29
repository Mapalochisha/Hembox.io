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

## Repository baseline and architecture

The repository is `Mapalochisha/Hembox.io`, a Next.js 14 / TypeScript application using Supabase, Tailwind CSS, and Vercel. The default branch at the start of this task was `main`, at baseline commit `dcbeac0b4c149a37e677b6a38d5c515b85c2a45e`.

The homepage composition is `src/app/(public)/page.tsx`, which assembles the shared navbar, hero, services, process, portfolio, contact CTA, footer, and mockup modal. The shared logo asset is `public/hembox-logo.svg`; the favicon is `public/favicon.svg`. The current wordmark SVG itself identifies the old `HEM BOX.io` logo, and the favicon has a separate square mark treatment. This will be reviewed as part of the visual update rather than changed through blind text replacement.

## Initial audit inventory

### Customer-facing and brand presentation

- [x] `src/app/layout.tsx`: global title and description use the old brand and website-only positioning.
- [x] `src/components/landing/navbar.tsx`: old-brand accessible label; logo rendered from `/hembox-logo.svg`; hover styling uses the existing navy-to-teal/coral treatment.
- [x] `src/components/landing/hero-section.tsx`: hero implementation needs review for new broad positioning and tagline.
- [x] `src/components/landing/services-section.tsx`: public service cards are loaded dynamically from Supabase `services`, filtered to active records and ordered by `sort_order`.
- [x] `src/app/(public)/services/[slug]/page.tsx`: individual service details also load from the existing `services` table.
- [x] `src/components/landing/footer.tsx`: displays the `agency_name` setting from the shared agency provider.
- [x] `src/components/landing/mockup-modal.tsx`: old-brand accessible labels.
- [x] `src/app/(public)/domains/page.tsx`: visible “Domains by HEMBOX.io” copy.
- [x] `src/app/(auth)/login/page.tsx` and `src/app/(auth)/register/page.tsx`: old-brand text and a separate inline mark rather than the shared full wordmark.
- [x] `src/components/admin/sidebar.tsx`: old-brand label in admin navigation.
- [x] `src/components/providers/agency-provider.tsx`: fallback agency name and website-only default “about” content use the old positioning.
- [x] Public About, Terms, and Privacy pages consume `agency_name` and editable content from agency settings.

### Dynamic content and production-data consideration

- [x] `src/app/admin/services/page.tsx` reads/writes the existing Supabase `services` table and supports service creation, editing, active/inactive status, icon selection, ordering, and deletion. **Preserve this functionality and data model; no replacement or schema change is planned.**
- [x] `src/app/admin/settings/page.tsx` manages the existing `agency_settings` row. The shared provider uses that row when available, so visible business name and “about” content may come from production database values rather than code defaults.
- [x] Owner decision: the company name is code-defined, not editable in admin settings. The existing `agency_name` database column is left unused to avoid a production schema change; other settings remain database-managed.

### Other old-brand references requiring classification

- [x] `src/lib/cloudinary.ts`, `src/app/api/upload/route.ts`, `src/components/admin/image-upload.tsx`, and `src/app/admin/media/page.tsx` contain `Hembox.io` Cloudinary folder names. These may be existing asset organization paths; do not rename folders or break existing assets as a side effect of rebranding.
- [x] `README.md`, `SETUP.md`, `package.json`, and current planning/operational documentation contain old-brand labels.
- [x] SQL scripts, Supabase migration comments, `.env.example`, and tests contain old-brand strings. Classify each before editing. Historical migration/setup records, test fixtures, configured admin email values, and database logic must not be mass-replaced.
- [x] `supabase_rebuild.sql` includes a legacy email-based role condition using `admin@hembox.io`. This is security-sensitive historical/setup logic and must not be changed as a brand-copy edit. Authentication and authorization must not be made dependent on the new domain by this rebrand.
- [x] Existing app URL examples and tests may include the old domain. Preserve operational URLs in this phase; review canonical/public URLs during the later domain migration.
- [x] Current CI workflow runs lint, TypeScript checks, domain/provider tests, disposable PostgreSQL schema tests, and production build. The push trigger currently lists `main`, `develop`, and selected feature branches, but not `rebrand/hembox-tech`; pull requests targeting `main` do trigger CI. Verification must account for that rather than assuming a push to this branch automatically starts CI.

## Classification rule for references

1. **Customer-visible brand copy:** update to Hembox Tech.
2. **Brand presentation assets and accessible labels:** update consistently; retain the current hover behaviour and responsive sizing where practical.
3. **Website positioning:** replace website-only messaging with a broader digital-solutions position that can cover websites, applications, branding, and future services.
4. **Technical hostnames and URLs:** preserve during the branding phase. Change only in the later domain-migration phase after explicit inventory and validation.
5. **Authentication identifiers, admin email values, secrets, database policies, SQL migration history, API contracts, Cloudinary folders, and stored data:** do not mass-replace. Evaluate each separately and change only where necessary and safe.
6. **Repository name and GitHub/Vercel project identifiers:** not part of this first milestone.
7. **Dynamic content:** preserve existing admin-managed service records and rendering. Treat the `agency_settings` database row as a separate, explicitly reviewed content update, not a code-level replacement.

## Milestones

### M0 — Audit and plan
- [x] Confirm brand decisions and non-negotiable constraints.
- [x] Inspect repository metadata, global metadata, landing navigation, logo/favicon assets, authentication branding, homepage composition, and admin services management.
- [x] Trace public services cards and service-detail pages to the existing Supabase `services` table.
- [x] Identify agency settings that dynamically control visible business name and editable public content.
- [x] Create this tracked plan on a dedicated feature branch.
- [x] Record known customer-visible references and sensitive technical references that require careful handling.
- [x] Record the CI workflow's current branch-trigger limitation.
- [x] During implementation, checked the main public, authentication, client workspace, billing, and admin brand surfaces; classified technical/historical exceptions rather than blindly replacing them.

### M1 — Brand foundations
- [x] Update global metadata and homepage hero brand copy to Hembox Tech and the new tagline.
- [x] Establish a consistent brand-name/asset approach without requiring a final user-provided logo file; retain the recognizable HEM mark and update the wordmark to HEMBOX TECH.
- [x] Define a shared code-level `BRAND_NAME` constant and remove the agency-name field from the admin settings UI, provider interface, and save payload. Other settings remain database-managed.
- [x] Keep domain URLs and runtime configuration unchanged.

### M2 — Public website positioning
- [x] Refresh homepage messaging to position Hembox Tech as a broader digital solutions company.
- [x] Preserve the dynamic service retrieval/rendering flow.
- [x] Ensure the services page continues to reflect services entered and published through the admin dashboard; the existing Supabase query and admin CRUD workflow were left intact.
- [x] Review pricing, contact, portfolio, and social preview copy for brand consistency; update global, Open Graph, and Twitter metadata without setting a new canonical host.

### M3 — Authenticated application surfaces
- [x] Update customer portal, admin dashboard, authentication pages, billing/invoices, messaging, and notifications where the old brand was visible.
- [x] Preserve existing routes, permissions, database records, and workflows.
- [x] Avoid production database changes for branding-only code work; `agency_name` is no longer selected or saved by the app, while the existing column/value remain untouched.

### M4 — Repository documentation and reference cleanup
- [x] Update relevant current documentation and setup instructions, including README, setup guide, client-portal blueprint, billing blueprint, and domain-reselling plan headings/current sections.
- [x] Keep historical progress entries, repository paths, deployment URLs, SQL history, and operational records accurate; add notes where current brand differs.
- [x] Classify retained references: repository/project IDs, current domain/runtime URLs pending M6, Cloudinary asset folders, auth identifiers, admin email rules, historical SQL/migrations, and test fixtures.

### M5 — Verification on the existing deployment
- [x] Run CI checks: lint, TypeScript, relevant tests, and production build; GitHub Actions passed on the merged main commit.
- [x] Fix regressions introduced by this branch; corrected the missing `BRAND_NAME` import caught by CI before final verification.
- [x] Verify a Vercel Preview (`READY`) for the final feature-branch commit and a Vercel Production deployment (`READY`) for the merged main commit.
- [x] Smoke-test route responses and branding for homepage, pricing, domains, login/register, About/Terms/Privacy, portal, bills, messages, admin dashboard, admin services, favicon, and wordmark on the production Vercel alias. All returned HTTP 200; no old visible brand string was found in the tested HTML/assets. Dynamic service retrieval/admin CRUD code was preserved and not structurally changed; no authenticated transaction was submitted.
- [x] Confirm no DNS or Vercel custom-domain settings were changed; no project domain assignments or DNS records were edited.
- [x] Pre-domain rebrand implementation and route-level smoke verification complete. Domain connection is the next separate phase and is intentionally not started here.

### M6 — Separate domain migration (not started; do not begin during M0–M5 without a deliberate handoff)
- [ ] Inventory current Vercel project/domain configuration and DNS provider instructions.
- [ ] Connect `hembox.tech` to the intended Vercel project only after the branding phase is accepted.
- [ ] Configure and verify DNS, HTTPS, canonical URLs, redirects, sitemap, and metadata.
- [ ] Review Supabase authentication redirect allowlists, OAuth callback URLs if used, email links, and `NEXT_PUBLIC_APP_URL` only after inventory.
- [ ] Test customer and admin journeys on the new domain before considering the migration complete.
- [ ] Retain the existing Vercel subdomain as a safe fallback/redirect until verification is complete.

## Current status

- **M1 Brand foundations:** implementation complete; verification pending.
- **M2 Public website positioning:** implementation complete; existing dynamic services and pricing data remain database-driven.
- **M3 Authenticated application surfaces:** implementation complete; no route, permission, or production-data changes.
- **M4 Documentation/reference cleanup:** implementation complete; historical/technical references retained where required.
- **M5 Verification:** complete — CI passed and the production Vercel deployment is READY; route-level smoke checks passed.
- **M6 Domain migration:** next phase, not started; requires owner input before any domain, DNS, canonical URL, or auth redirect changes.

## Progress log

### 2026-10-29 — M0 complete; M1 in progress
- Confirmed `main` baseline: `dcbeac0b4c149a37e677b6a38d5c515b85c2a45e`.
- Created feature branch `rebrand/hembox-tech` from `main`.
- Added this tracked plan before modifying application code.
- Inspected global metadata, public homepage composition, navbar, logo SVG, favicon SVG, login/register pages, agency provider, admin sidebar, admin services page, public service cards and service-detail route, admin agency settings, and CI workflow.
- Confirmed that the current dynamic services workflow already fits the requirement. No replacement, schema change, or service-data migration is planned.
- Identified the database-backed `agency_settings` row as a separate source of brand copy; it needs deliberate review later so existing production content is not silently overwritten.
- No application code, production data, DNS, Vercel domain settings, or environment variables have been changed in this milestone.
- Next: begin M1 brand foundations on this branch, leaving all domain configuration untouched.


### 2026-10-29 — Code-defined company name decision
- Owner chose to remove the editable agency/company name field and use the code-defined brand.
- Implementation removes `agency_name` from the shared settings contract, provider data mapping, admin settings form/state/save payload, footer, contact CTA, and About/Terms/Privacy fallback copy.
- The shared `BRAND_NAME` constant is set to `Hembox Tech`.
- Existing Supabase `agency_settings.agency_name` column/value is intentionally left untouched and unused; no production database mutation or schema migration is needed for this UI change.
- Other agency settings and the dynamic `services` table remain intact.

- Updated the global page title/description, homepage hero, navigation accessible label, domain page copy, admin sidebar brand, mockup contact accessible labels, and login/register brand text.
- Admin settings and shared provider now select only explicit non-brand settings columns; the old `agency_name` column is not fetched by the app. Existing database schema and stored values remain unchanged.


### 2026-10-29 — M1–M4 implementation complete; M5 verification in progress
- Added `src/lib/brand.ts` as the shared source for `BRAND_NAME` and `BRAND_TAGLINE`.
- Updated the shared wordmark SVG to read HEMBOX TECH while retaining the existing HEM mark and navbar hover-gradient behavior; refreshed favicon accessible metadata.
- Updated global metadata, Open Graph/Twitter preview copy, homepage hero/tagline, public domain copy, login/register, About/Terms/Privacy, footer, admin navigation, client portal, messaging, notifications, billing statements, user-facing API messages, and other visible application labels.
- Removed the agency-name field from admin settings and excluded `agency_name` from the app's settings query, provider type, and save payload. The Supabase column/value were not changed.
- Updated current README/setup and product blueprint wording. Historical progress logs, repository paths, Cloudinary folder paths, technical hostnames, auth identifiers, SQL history, and existing configuration remain intentionally unchanged until their appropriate migration/maintenance task.
- Dynamic service retrieval, service admin CRUD, pricing retrieval, customer/admin routes, billing, messaging, and domain operations were not structurally changed.
- No production data, DNS, Vercel domain assignments, environment variables, or authentication redirect settings were modified.
- Next: complete final CI, deploy a preview for the latest commit, and smoke-test public routes plus expected unauthenticated behavior for protected customer/admin routes. Stop before connecting `hembox.tech`.


### 2026-10-29 — M5 verification complete; ready for domain-phase handoff
- Merged PR #11 to `main` as `326b6761d010cef1b36437254d761055b50b3f41` after the final feature-branch CI run passed.
- Main-branch GitHub Actions passed (lint/type check, domain schema integration tests, and production build): run `40910700275`.
- Vercel Preview is READY for final feature-branch commit `d2c28987eeb13d2b144e8520dc5eb8a5f0ea3090`; Vercel Production deployment is READY for merged main commit `326b6761d010cef1b36437254d761055b50b3f41` at the project's production alias `https://hembox-io.vercel.app`.
- Route-level smoke tests on the production alias returned HTTP 200 for homepage, pricing, domains, login, registration, About, Terms, Privacy, portal, bills, messages, admin dashboard, admin services, favicon, and logo asset. Tested HTML/assets showed the new brand and no obvious old visible brand strings.
- The preview environment has no Supabase variables scoped to `rebrand/hembox-tech`, so protected admin routes returned a configuration error on that preview. No preview or production environment variables were changed. Verification was completed against the production Vercel alias, where the tested routes returned HTTP 200.
- No interactive sign-in/payment transaction was performed. No production data, Supabase schema, DNS records, custom-domain assignments, or authentication redirect settings were changed.
- M0–M5 are complete. Stop here before M6; the next task is the separate domain-connection phase for `hembox.tech`.
