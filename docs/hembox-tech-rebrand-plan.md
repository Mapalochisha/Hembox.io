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
- [ ] During implementation, continue checking for remaining old-brand references and document intentional exceptions; repository search is not a substitute for reviewing all UI surfaces.

### M1 — Brand foundations
- [ ] Update global metadata and brand copy to Hembox Tech and the new tagline where appropriate.
- [ ] Establish a consistent brand-name/asset approach without requiring a final user-provided logo file.
- [x] Define a shared code-level `BRAND_NAME` constant and remove the agency-name field from the admin settings UI, provider interface, and save payload. Other settings remain database-managed.
- [ ] Keep domain URLs and runtime configuration unchanged.

### M2 — Public website positioning
- [ ] Refresh homepage messaging to position Hembox Tech as a broader digital solutions company.
- [ ] Preserve the dynamic service retrieval/rendering flow.
- [ ] Ensure the services page continues to reflect services entered and published through the admin dashboard.
- [ ] Review pricing, contact, portfolio, SEO metadata, and social preview copy for brand consistency.

### M3 — Authenticated application surfaces
- [ ] Update customer portal, admin dashboard, authentication pages, billing/invoices, messaging, and notifications where the old brand is visible.
- [ ] Preserve existing routes, permissions, database records, and workflows.
- [ ] Avoid production database changes for branding-only code work; any required agency-settings content update must be separately reviewed and performed deliberately.

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
