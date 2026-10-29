# Hembox Tech Client Portal — Product Blueprint

> Design and implementation handoff. This is a planning document only: no application code, schema, production data, environment variables, payment configuration, or registrar settings are changed by this blueprint.
>
> **Date:** 2026-10-26  
> **Repository:** Mapalochisha/Hembox.io  
> **Implementation branch:** `feature/client-portal-workspace` (branched from `main`)  
> **Design source branch:** `docs/client-portal-blueprint`  
> **Status:** Initial portal shell, overview, project views, service catalogue/request flow, customer messaging, and initial services/files/settings pages implemented on the feature branch. CI and preview verification pending.

## 1. Product goal

Build a unified, premium client workspace for the full range of Hembox Tech services—not a website-only dashboard. It must support creative, digital, and technical engagements, including branding and graphic design, websites, mobile and web applications, software development, domains, hosting/maintenance, and future services.

The client should be able to answer four questions quickly:

1. What work is Hembox Tech doing for me?
2. What services/assets do I currently have?
3. Is there anything I need to pay, review, approve, or provide?
4. Where do I find my files and communicate with Hembox Tech?

**Design direction agreed with the user:** a blend of modern SaaS, premium agency, and technical clarity; a balanced overview that is useful without being overwhelming; a full client portal; a service catalogue plus guided service requests; a central Files area plus project-level access; collaborative project management; and context-sensitive technical information.

## 2. Repository reconnaissance (before implementation)

### Existing architecture observed

- Next.js 14 with React 18 and TypeScript; Tailwind CSS, Radix UI components, Lucide icons, and Framer Motion are already dependencies.
- Supabase is used for authentication and data access. The existing `useAuth` provider exposes the authenticated user, admin role, loading state, and sign-out/refresh operations.
- Existing profile route: `src/app/(public)/profile/page.tsx`. It is primarily an account/profile screen and links to the domain area; it is not a full client workspace.
- Existing domain customer route: `src/app/(public)/profile/domains/page.tsx`, with authenticated domain-order and quote workflows. The domain registration/payment state must remain distinct from successful registration/fulfilment.
- Existing customer billing route: `src/app/portal/bills/page.tsx`, with invoice lists, currency-aware totals, payment claims/evidence, payment arrangements, and invoice-linked messaging. Preserve and integrate this flow rather than building a second billing system.
- Existing admin messaging route: `src/app/admin/messages/page.tsx`; messaging is based on `inquiries` and `inquiry_messages`, with customer/admin roles.
- Existing project model in `supabase_rebuild.sql`: `clients` and `projects`; projects currently reference `client_id`, with a simple name, description, status, budget, deadline, images, and timestamps.
- Existing admin dashboard reads client/project records. That admin interface is not the client dashboard and should remain a separate staff workspace.
- Existing billing blueprint and migrations define a unified invoice/payment ledger. Billing migrations and deployment status must be verified against the exact target branch and environment before any migration is applied.

### Important architecture gaps to resolve during implementation planning

- There is no full customer workspace landing page under `/portal` in the inspected source; `/profile` is currently the closest general signed-in customer page.
- The legacy project schema is staff-oriented and currently has restrictive admin policies. Do not simply expose it to clients or assume the authenticated user can safely query projects through the browser.
- The relationship between an authenticated profile, a `clients` record, projects, and future service records needs a reliable ownership model. A client must only see data explicitly associated with their authorized account or organization.
- The existing `inquiries` messaging model began as a lead/contact inbox. The new portal should reuse it only where its ownership and lifecycle semantics fit; project conversations and approvals may require additive, carefully designed relationships rather than overloading unrelated lead records.
- A central Files library is approved as a product feature, but the storage provider, object ownership model, retention, and signed-download approach must be verified against the existing project before selecting an implementation.
- The repository contains an existing unified billing implementation and a separate billing blueprint with release gates. Do not assume a migration is production-applied merely because a route or SQL migration exists in Git.

These findings are architectural constraints, not permission to change the schema now.

## 3. Information architecture

### Primary navigation

**Workspace**
- Overview
- My Projects
- My Services

**Manage**
- Domains
- Files
- Bills & Payments
- Messages & Support

**Account**
- Account Settings

A persistent desktop sidebar and a deliberately designed mobile navigation are preferred. The top bar should provide the page context, notifications, and account menu. Avoid duplicate navigation patterns and excessive global buttons.

### Global actions

- **Request a service** — opens the service catalogue and guided request flow.
- **Contact Hembox Tech** — opens the existing communication entry point or starts an appropriately categorized conversation.
- Search may be added when it can search meaningful portal entities (projects, files, invoices, domains) with ownership enforced server-side.

### Visual system

- Light content canvas with a deep navy navigation surface.
- Restrained Hembox Tech brand accent; neutral borders and subtle depth.
- Premium typography and spacing; no excessive gradients, shadows, nested cards, or decorative charts.
- Status colour is semantic and consistently labelled; colour is never the only status indicator.
- Monospaced styling only for technical identifiers and values where it improves legibility.
- Motion is subtle and respects reduced-motion preferences.
- All pages require loading, empty, error, success, and permission-denied states as appropriate.

## 4. Page-by-page product specification

### 4.1 Overview — proposed route: `/portal`

**Purpose:** a concise summary of the client relationship with Hembox Tech.

**Top area**
- Greeting and short workspace context.
- Primary action: Request a service.
- Optional secondary action: Contact Hembox Tech.

**Four summary cards**
1. Active Projects.
2. Active Services.
3. Outstanding Balance, displayed separately per currency when multiple currencies exist.
4. Unread Messages / items needing a reply (define counting rules before implementation).

Cards link to their corresponding filtered destination. Counts and balances must be derived from real, authorized records—not demo constants.

**Main content**
- **Your Projects:** a small, useful selection of recently updated or next-action projects. Each item shows project name, service category, stage, last update, and next milestone/client action when available.
- **Needs Your Attention:** only actionable items, such as a requested project approval, information request, invoice due/overdue, payment claim requiring more information, or an approaching domain expiry.
- **Recent Activity:** a compact chronological feed of meaningful project, file, message, billing, and domain events.

**Rules**
- Keep the default view balanced; do not show every project, invoice, and event on the landing page.
- If no action is required, show a calm positive empty state rather than invented alerts.
- New clients get guided first steps (browse services, request work, or contact Hembox Tech).
- Do not imply that a payment claim is a verified payment or that a paid domain order is already registered.

### 4.2 My Projects — proposed route: `/portal/projects`

**Purpose:** manage all commissioned work across service categories.

**List view**
- Search and filters by status, category, and recent activity.
- Card and compact-table views; cards are the friendly default, table view supports larger portfolios.
- Categories may include branding/identity, graphic design, website, mobile app, web application/software, UI/UX, custom development, and other.
- Project item shows title, category, stage, last update, and a meaningful next step when applicable.

**Project detail — proposed route: `/portal/projects/[projectId]`**
- Overview: scope summary, stage, owner/contact, next action, and key dates.
- Deliverables: approved previews, downloadable handover items, and feedback state.
- Milestones: milestones, due dates, progress, and client-visible completion state.
- Messages: project-specific conversation and relevant context.
- Activity: important status changes, uploads, approvals, and decisions.

Tabs are conditional: do not show empty or irrelevant tabs. Shared layout and interaction patterns remain consistent, while details vary by project type.

**Examples of context-specific content**
- Branding: concepts, logo files, brand guidelines, and approval/feedback when relevant.
- Website: preview/live URL, review state, handover, and deployment information only when supported.
- Application: test/release builds, release notes, documentation, and technical state only when actually available.

**Collaboration**
- Client feedback, requested information, approvals, milestone sign-offs, and change requests are structured actions where relevant.
- Each consequential decision records actor, timestamp, item/version, and outcome.
- Scope changes must not silently rewrite the original quote, invoice, or agreed project scope.
- Project status must not be inferred from payment status or vice versa.

### 4.3 My Services — proposed route: `/portal/services`

**Purpose:** inventory of services the client owns, subscribes to, or uses—not a second project list.

**Service list**
- Service name/category, status, start/renewal dates where relevant, related project/domain, and next action.
- Filters by category and state.
- Detail page: service summary, what is included, associated assets, billing references, service-specific controls, and support entry point.

**Initial service types to accommodate**
- Hosting/maintenance and other ongoing website services.
- Managed application or technical support services where offered.
- Recurring plans and future services.
- Domains may appear as linked assets here but retain their dedicated management area.

A completed project can result in one or more active services, but that transition must be explicit. Not every project creates an ongoing service.

### 4.4 Service catalogue and request flow — proposed routes: `/portal/services/catalogue`, `/portal/services/request`

**Purpose:** allow clients to explore Hembox Tech capabilities and submit a request that captures the right context.

**Catalogue**
- Group services by outcome/category, not by an assumption that Hembox Tech only builds websites.
- Initial groups: Brand & Creative; Websites & Digital Experiences; Apps & Software; Domains & Infrastructure; Ongoing Support; Custom Work.
- Each service explains what it is, likely deliverables, what information is needed, and whether pricing is fixed, indicative, or quote-based.
- Catalogue entries should be data/configuration driven where practical so adding a service does not require redesigning the portal.

**Guided request**
- Select a service/category.
- Ask relevant conditional questions (brief, target audience, platform, existing assets, desired timing, references/attachments).
- Capture requested currency only where a quote/payment flow supports it; default new commercial quotes to ZMW and never silently convert or switch currency.
- Confirm submission and show a trackable request/reference.
- A request is not automatically a confirmed project, accepted quote, invoice, or service activation. Staff triage and acceptance remain explicit unless a future workflow is separately approved.

### 4.5 Domains — existing route: `/profile/domains`; proposed future canonical route: `/portal/domains`

**Purpose:** domain search/quotes, order visibility, renewal information, and supported DNS management.

- Show domain name, current state, quote/order status, expiry/renewal data when authoritative, and available actions.
- Registration, transfer, renewal, and DNS actions are shown only when the provider capability and backend operation are implemented and enabled.
- A quote is not a registration. Payment verification is not fulfilment. Do not show a domain as registered without confirmed provider/account evidence.
- Domain invoices and payment claims link to the unified Bills & Payments ledger; do not add a parallel payment form.
- During implementation, decide whether to redirect the legacy route to the canonical portal route or keep a compatibility route. Do not break existing bookmarks or API return paths without an explicit redirect plan.

### 4.6 Files — proposed route: `/portal/files`

**Purpose:** one searchable library of client-accessible deliverables with project context.

- List/grid view with search and filters for project, category, file type, and date.
- File details include name, type, upload date, version where supported, related project/service, and description.
- Files remain accessible from their project and appear in the central library when the client is authorized to access them.
- Support previews for safe formats and authorized downloads for others.
- Private by default. Use server-checked ownership and time-limited downloads where supported; never expose private storage keys or unrestricted public links.
- Establish file size/type limits, upload scanning/validation expectations, versioning, retention, and deletion policy before implementation.
- Do not store files in a generic public bucket merely to make the UI easy.

### 4.7 Bills & Payments — existing route: `/portal/bills`

**Purpose:** one auditable billing centre for every Hembox Tech charge.

Preserve the existing unified billing workflow and its established rules:
- Covers websites/plans, domains and renewals, add-ons, custom work, and other supported invoice sources.
- Summary totals remain currency-separated; ZMW is the default, USD only when explicitly requested and supported.
- Tabs: All, Unpaid, Under Review, Paid; search by invoice/service/source reference.
- Invoice details include line items, dates, total, verified allocations, remaining balance, status, and printable/downloadable statement.
- Manual payment claim includes configured instructions, transaction reference, amount, optional note, and private evidence upload where enabled.
- Partial payments are supported.
- A claim/evidence submission is not settlement. Only authorized verification and ledger allocation changes the verified paid balance.
- Requests for custom payment arrangements are linked to the invoice and existing messaging model. An approved arrangement is not payment.
- Gateway checkout remains deferred until separately funded and approved.
- Billing/admin migrations must not be applied to production as part of this dashboard design phase.

### 4.8 Messages & Support — proposed route: `/portal/messages`

**Purpose:** one place for client conversations across projects, services, billing, and general support.

- Inbox list with unread state, latest message, linked context, and status.
- Thread view with message history, attachments where supported, and reply composer.
- Start a conversation from a project, service, invoice, or general support action so the context is preserved.
- Billing arrangement conversations continue to use the existing billing/messaging integration.
- Notifications link directly to the relevant thread or item.
- Do not expose internal admin notes or unrelated lead inquiries to clients.
- Before implementing project conversations, confirm the existing `inquiries`/ `inquiry_messages` schema can safely support the ownership and conversation types. Extend it additively or introduce a well-defined conversation abstraction; do not create a second inbox without a migration/integration plan.

### 4.9 Account Settings — proposed route: `/portal/settings`

**Sections**
- Profile and contact information.
- Account/security options supported by Supabase Auth.
- Notification preferences.
- Organization/company information if multi-user client organizations are intentionally supported.
- Sign out and account-related guidance.

Do not expose or allow self-editing of role/authorization fields. A client must never be able to grant themselves admin access by changing profile data.

## 5. Shared interaction patterns

- Consistent status labels and definitions across all pages.
- Search/filter state that is clearable and usable on mobile.
- Action confirmations for consequential changes.
- Accessible forms, validation messages, keyboard navigation, focus states, and adequate contrast.
- Skeleton/loading states, recoverable errors, empty states, and success confirmation.
- Clear links between projects, services, files, domains, invoices, and conversations.
- Notifications must be actionable and should not duplicate every item in the activity feed.
- Currency totals are never summed across currencies without an explicit, transparent conversion record.

## 6. Data and authorization design principles

This section defines requirements, not a migration specification.

- Use one clear ownership path from authenticated user to client/organization and its projects, services, files, conversations, and billing records.
- Enforce access on the server/database with Supabase RLS and verified authorization. Client-side filtering alone is insufficient.
- Admin access stays separate from client workspace routes and must be verified using the trusted role mechanism, not a client-editable cookie or form value.
- Prefer additive migrations and preserve existing data. Do not use the destructive `supabase_rebuild.sql` against a live database.
- New financial values must use the existing billing ledger and integer minor-unit rules.
- Service/project types should be extensible without requiring a different top-level dashboard for every new offering.
- Avoid denormalized duplicate balances/statuses; derive or transactionally maintain summaries from authoritative records.
- Audit approvals, change requests, invoice/payment transitions, and sensitive service operations.
- Do not assume a production schema matches all migration files in Git. Verify environment state and approved migration history before any migration plan is finalized.

## 7. Non-goals and explicit release boundaries

This design does not authorize:
- Writing application code or altering current pages.
- Applying any Supabase migration or changing production data.
- Enabling payment gateway checkout or collecting real payments.
- Enabling registrar mutations, live domain registration, transfers, renewals, or DNS changes.
- Merging feature branches or promoting a production deployment.
- Inventing deployment, uptime, renewal, or payment statuses where authoritative data is unavailable.

When implementation is separately approved, use a dedicated feature branch, preserve unrelated main-branch logo/favicon work, and follow the user's release gate: do not report completion until CI is green and the Vercel deployment for the exact final commit is green/READY, unless user input is required.

## 8. Proposed implementation sequence (after blueprint review)

1. **Foundation audit:** verify current branch/production state, exact deployed routes, current Supabase migration history, RLS policies, storage providers, and all existing customer flows.
2. **Portal shell:** responsive sidebar/top bar, navigation, shared status/empty/loading/error components, and authenticated route protection.
3. **Overview:** aggregate existing authorized project/domain/billing/message data without fake values.
4. **Projects and collaboration:** safe ownership model, project list/detail, milestones, deliverables, feedback/approvals, and audit events.
5. **Services and catalogue:** extensible service records and guided request workflow, with explicit triage/acceptance.
6. **Files:** private client library, project linking, safe previews/downloads, and storage controls.
7. **Messages and notifications:** unify the client view around existing messaging/billing conversations with proper ownership and deep links.
8. **Domain route integration:** compatibility-preserving navigation to the existing domain workflow.
9. **Account settings:** profile/preferences/security options supported by current auth.
10. **Verification:** tests for ownership/RLS, client/admin separation, cross-client access denial, currency/ledger invariants, mobile layouts, and all empty/error states; then exact-commit CI and Vercel verification.

Sequence may change after the audit reveals dependencies. No phase should bypass existing billing or domain release gates.

## 9. Acceptance criteria

- The portal clearly represents Hembox Tech as a creative and technical services company, not a website-only firm.
- A client can discover and request branding, design, website, app/software, domain/infrastructure, and custom services through one coherent request experience.
- Projects and ongoing services are distinct, linked where appropriate, and have clear statuses.
- The overview contains four primary summary cards plus projects, genuine attention items, and recent activity without overwhelming the client.
- Files are accessible centrally and from relevant projects, with private authorization.
- Existing billing workflows remain intact and use the single ledger.
- Existing domain workflows remain intact; no unsupported operation is presented as available.
- Messages and notifications lead to the correct authorized context.
- Client data cannot be accessed by another client, and client routes cannot expose admin-only records.
- All pages are responsive, accessible, and include complete loading/error/empty states.
- No production migration, payment gateway, registrar mutation, or production release occurs without explicit approval and the relevant release gates.

## 10. Decisions already agreed

- Modern + premium + technical visual direction.
- Balanced overview, not overloaded.
- Full client portal scope.
- Unified project experience for creative and technical work.
- Service catalogue plus adaptive guided request flow.
- Central Files library plus project-level access.
- Collaborative projects with approvals, feedback, change requests, and decision history.
- Technical details appear only when relevant to the service.
- Existing billing, messaging, authentication, and domain functionality should be preserved and integrated rather than replaced.


## 11. Implementation progress — 2026-10-26

### Implemented on `feature/client-portal-workspace`

- [x] Responsive client workspace shell with desktop sidebar, mobile navigation, account menu, and notification badge.
- [x] Data-driven overview for projects, outstanding balances net of signed payment allocations, services (when schema exists), domains, conversations, activity, and unread notifications.
- [x] Server-side authenticated overview and project APIs; legacy project schemas without the new category column remain readable until the migration is applied.
- [x] Project category support for branding, graphic design, websites, web applications, mobile apps, software, UI/UX, and custom engagements.
- [x] Client project list/detail views with search, status filters, milestones, deliverables, client approvals, change requests, and activity display.
- [x] Service catalogue and guided request flow; new requests are stored against the authenticated customer in the existing inquiry/message framework and do not automatically confirm a quote or project.
- [x] Client messaging inbox and replies with ownership checks.
- [x] Private file library UI, authenticated reference uploads, ownership-checked downloads, and short-lived signed URLs.
- [x] Persistent notification preferences UI and notification centre with read/mark-all-read actions.
- [x] Existing billing page integrated into the workspace shell without replacing the unified invoice/payment workflow.
- [x] Existing domain route exposed through a compatibility redirect.
- [x] Admin Client Workspace page to link an existing customer account, create projects, assign services, add milestones, share private deliverables, and review change requests.
- [x] Additive Supabase migration for service inventory, project milestones, deliverables, change requests, activity, private file metadata, notifications, notification preferences, and project categories.
- [x] SQL integration test for workspace schema, RLS, cross-customer isolation, service/client ownership integrity, and message-notification preferences.
- [x] CI workflow updated to apply and test the portal migration in the ephemeral CI database and to run checks on this feature branch.

### Release / environment boundaries

- The additive client-portal migration was applied to the production Supabase project on 2026-10-26 after the user explicitly authorized using production because no development database is available. Verification confirmed the new workspace tables exist and the `client-deliverables` bucket is private with a 20 MB limit. The existing `clients` and `projects` tables had zero rows at the time of pre-migration inspection.
- The private storage bucket is created by the migration, not by the application at runtime. File operations now use server-side service-role access only after a verified session and explicit ownership checks; the bucket remains private.
- The portal APIs use a verified Supabase Auth session before service-role queries/writes and scope project, service, file, conversation, and notification access to the authenticated customer or verified administrator.
- Client role changes are not exposed in account settings.
- No payment gateway activation or registrar mutation has been performed. Production deployment remains gated on green CI and a READY Vercel deployment for the exact final commit.

### Release verification and handoff

- CI must pass lint, TypeScript, provider tests, SQL integration tests, and production build for the exact release commit.
- A Vercel preview for that exact commit must reach READY before merging to `main`; the production deployment must also reach READY after merge.
- The user will perform the authenticated customer and admin journeys on `main` after release because no separate development database is available. The SQL integration tests cover schema, RLS, ownership integrity, cross-customer isolation, and notification preferences; they do not replace browser-based acceptance testing.
- Manual acceptance should cover service requests, messaging, projects, milestone/deliverable feedback, private upload/download, bills/domains, notification preferences, admin project/service setup, and cross-customer access denial on desktop and mobile.
- Payment gateway activation and registrar mutations remain out of scope.

Do not report the feature as fully accepted until the release checks are green and the user has completed the planned customer/admin testing on `main`.
