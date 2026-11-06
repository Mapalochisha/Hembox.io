# HEMBOX Production Readiness Remediation Plan

**Status:** In progress  
**Merged release commit:** `0f161959a638eced0ee997420953e0d5aae647cf` on `main`  
**Baseline:** PR #22 (feature branch merged 2026-11-06)  
**Production changes:** Not authorized by this plan. No Production deployment, live registrar mutation, payment, or database migration is permitted without separate explicit approval.

This plan converts the repository and infrastructure audit into verifiable release gates. Checkboxes are updated only when evidence exists. A passing build or Preview does not by itself authorize a Production release.

## Release decision

HEMBOX is **not ready for live domain sales**. The sandbox customer journey is a useful foundation, but the live catalogue is empty, Production is configured for NameSilo OTE rather than live registrar operations, and payment-to-registration fulfilment has not been proven end to end.

A limited launch must not be enabled until all Stage A and Stage B release gates are met. Stage C operational controls must be completed or explicitly accepted as launch risks.

## Stage A — Technical release readiness

Goal: establish a coherent, secure, reproducible code and database baseline, and prove the non-live customer/admin journey.

### A1. Integrate the known-good sandbox implementation
- [x] Reconcile and merge PR #22 into `main`; base SHA `7850a8d3ba5e26aacba86c9a4d469f24b33f9f4b`, reviewed head SHA `4169e628b5f48012fc969ca5eb799c0ba81e74fd`, merge commit `0f161959a638eced0ee997420953e0d5aae647cf`.
- [x] Confirm the merged admin management API uses server-verified Supabase identity and administrator role checks; reject caller-supplied identity headers.
- [ ] Confirm customer endpoints enforce authenticated ownership and do not expose service-role credentials or registrant data.
- [x] Resolve build/import failures and obtain green GitHub CI plus Vercel Preview on head `4169e628b5f48012fc969ca5eb799c0ba81e74fd`; CI run `42268037248` passed and Preview `dpl_GB7pXBzxUumMWkbAEFUmaiD19EYp` is READY.
- [x] Update PR #22 description and sandbox handover documentation to match Production migration history and known OTE limitations.
- **Acceptance:** CI and Preview are green on the exact reviewed SHA; no unauthenticated or header-spoofed access to customer/admin operations; no merge/deploy performed without release authorization.

### A2. Reconcile Supabase migration history before any further migration
- [x] Compare every sandbox migration filename in source, CI, and Production migration history; Production records `20261102134924` and `20261103182518`.
- [x] Remove duplicate SQL migration files after confirming the two journey files had identical Git blob hashes and selecting the already-applied Production version as canonical.
- [x] Align CI replay filenames with the canonical applied versions.
- [x] Confirm the sandbox management migration source filename `20261103182518` matches Production migration history and that the SQL-created table/columns, constraints, indexes, trigger and service-role-only grants are present in Production.
- [x] Run the complete migration chain against a fresh disposable PostgreSQL database; GitHub Actions run `42268037248` passed schema replay and SQL regression tests on the merged candidate.
- [ ] Compare the resulting schema, constraints, indexes, functions, grants, and RLS settings with Production using read-only inspection.
- **Acceptance:** one canonical source file per applied migration version; no pending/duplicate sandbox migration; fresh-database CI replay succeeds; schema comparison has no unexplained drift. Do not run `supabase db push` or apply migrations to Production as part of this task.

### A3. Complete security review of privileged database functions
- [x] Review each flagged `SECURITY DEFINER` function. The six authenticated billing wrappers derive identity from `auth.uid()`; admin-only wrappers verify the caller's admin role; customer wrappers delegate with the caller's own identity; each has a fixed empty `search_path` and restricted EXECUTE grants. `get_user_role` returns the caller's own role and only permits cross-user lookup for admins. This is a source review, not a claim that the advisor warnings disappeared.
- [x] Add cross-user regression coverage: a customer can read only their own role; a customer cannot inspect another user's role; an administrator can inspect another user's role; `anon` cannot execute `get_user_role`. SQL authorization tests passed in GitHub Actions run `42268893665`.
- [x] Extend `supabase/tests/billing_authenticated_runtime.test.sql` with role lookup and EXECUTE-grant assertions; the Domain schema integration job passed on the follow-up branch.
- [ ] Enable Supabase leaked-password protection. The user approved enabling it in the future; it remains intentionally disabled until Auth impact and password-reset/recovery behavior are reviewed and tested.
- [x] Verify the three sandbox tables have RLS enabled, no table policies, and grants only to `service_role`; no `anon` or `authenticated` table grants were found.
- **Acceptance:** every privileged function has a recorded review outcome and regression coverage; no caller can select another user's identity or bypass admin authorization; Auth protection is enabled or its deferral is explicitly approved with a follow-up review. Leaked-password protection is approved for future enablement but intentionally remains disabled until Auth impact and password-reset/recovery behavior are reviewed and tested.

### A4. Automated verification and dependency hygiene
- [x] Keep Node 24 aligned between GitHub CI and Vercel; the Next.js 16 upgrade and lockfile refresh were validated with Node 24.
- [x] Add `npm audit --audit-level=high` to CI and remediate the initial 19 findings (1 critical, 9 high, 7 moderate, 2 low). Upgrade Next.js to 16.4.5, React/React DOM to 19.2.9, Zod to 4.6.7, and Supabase SSR to 0.12.7; remove unused vulnerable dependencies, apply compatible transitive fixes, and pin the patched minimatch override. The final audit reported 0 vulnerabilities in workflow run `42272251525`.
- [x] CI covers lint, TypeScript, domain provider tests, full migration replay, SQL regression tests, and production build. The merged sandbox candidate passed run `42268037248`; the security-upgrade branch passed audit, lint, domain tests, TypeScript and production build in run `42272251525`; PR #24 then passed exact-commit CI run `42272580745` and was merged to `main`.
- [ ] Add authenticated browser/API E2E coverage for customer and admin sandbox flows, including ambiguous provider outcomes and safe reconciliation.
- **Acceptance:** all required checks pass on the same candidate SHA; dependency findings are triaged; E2E proves isolation and safe handling of ambiguous mutations.

### A5. Sandbox end-to-end acceptance
- [ ] Customer: search OTE availability, submit registrant data, submit zero-value test acknowledgement, see admin review state, and see ownership only after provider read-back.
- [ ] Admin: review/approve/reject test acknowledgement, reconcile registration, inspect audit trail, and safely handle unknown outcomes.
- [ ] Customer: request renewal and nameserver changes; confirm requests are visible to admin and no false success is shown.
- [ ] Admin: apply only after preflight; verify provider state after mutation; leave ambiguous outcomes unresolved and prevent blind retries.
- [ ] Confirm sandbox orders/events remain isolated from live orders, invoices, and payment claims.
- **Acceptance:** customer and admin journeys pass against OTE; all displayed states match database/provider evidence; no real payment or live registrar mutation occurs.

## Stage B — Commercial and live-provider readiness

Goal: enable a limited, accurately priced, funded live domain service only after technical gates pass.

- [ ] Obtain and securely configure a dedicated live NameSilo API credential; keep OTE and live credentials/environment selection strictly separated.
- [ ] Verify registrar account identity, funding/payment method, API permissions, account balance, and support/escalation path.
- [ ] Populate the live TLD catalogue from verified wholesale prices; validate registration and renewal costs separately.
- [ ] Validate BoZ FX source, freshness, conversion buffer, markup, minimum margin, rounding, and stale-rate fail-closed behavior.
- [ ] Approve customer-facing retail prices, renewal terms, expiry/renewal policy, privacy/WHOIS options, and domain-specific terms/refund policy.
- [ ] Verify manual payment instructions and the payment evidence review process; ensure invoice/payment ledger remains the financial source of truth.
- [ ] Prove paid invoice/payment claim → admin verification → registrar registration → provider read-back → customer ownership and expiry display.
- [ ] Verify live availability, registration, renewal, nameserver update, and provider reconciliation with an explicitly authorized controlled live test.
- [ ] Keep transfers, DNS record editing, registrar lock, and other nonessential capabilities disabled or clearly marked as deferred until independently verified.
- **Acceptance:** live credentials and funds are verified; catalogue is populated and price-fresh; customer terms are approved; payment-to-registration is proven; every live mutation has a tested reconciliation path.

## Stage C — Operational readiness

Goal: support customers and recover safely from failures after launch.

- [ ] Publish an operator runbook for registration, renewal, nameserver changes, provider outages, ambiguous outcomes, and reconciliation.
- [ ] Define support ownership, response targets, incident escalation, refund/chargeback handling, and customer communications.
- [ ] Verify backups and perform a restore exercise; document database recovery objectives.
- [ ] Add monitoring/alerts for provider errors, stale FX/prices, failed payments, pending/unknown orders, expiring domains, and webhook failures.
- [ ] Implement and test renewal/expiry reminders and customer notification delivery.
- [ ] Review audit-log retention, access controls, PII handling, and operational access to registrant data.
- [ ] Document launch rollback/kill-switch procedure for live registrar writes and payment acceptance.
- **Acceptance:** on-call/operator ownership is clear; critical alerts are tested; restore and incident procedures are rehearsed; customer notification and renewal operations are verified.

## Commercial recommendations (proposed, not yet approved)

- Start with Zambia as the primary market; default invoices and retail quotes to ZMW, with USD available for international customers.
- Start with a limited, curated TLD catalogue rather than enabling every extension.
- Use verified manual payments initially; do not connect live registration to unverified payment evidence.
- Show registration and renewal prices separately, including renewal dates and terms before checkout.
- Use the existing pricing proposal as a starting point: BoZ FX rate + K1 conversion buffer, 10% markup, and K25 minimum gross margin, subject to verified wholesale costs, taxes, payment fees, rounding and a final price review.
- Register domains using the customer's verified registrant details and clearly explain HEMBOX's management/support role.
- Publish failure, duplicate-payment, delayed-confirmation and refund rules before accepting live orders.

These are recommendations only; retail pricing, allowed TLDs and customer terms still require explicit approval.

## External prerequisites and decisions

These are not code tasks and must not be fabricated or silently assumed:
- Live NameSilo credential and verified account funding/payment method.
- Confirmed wholesale prices and permitted TLDs.
- Approval of retail margins, FX buffer, and customer-facing domain terms.
- Confirmation of manual payment destination/instructions and payment review ownership.
- Explicit authorization before any controlled live registrar mutation, real payment, Production migration, or Production deployment.

## Current audit baseline

- Production domain: `hembox.tech`; `www` redirects to apex.
- Production Supabase project: `jygxbernkptzhoyksoie`.
- Production `domain_tld_catalog`: 0 rows; no enabled retail TLDs.
- Production live `domain_orders`: 0; sandbox order ledger contains 1 test order; no recorded billing payments.
- Production environment has `NAMESILO_SANDBOX_API_KEY`; live `NAMESILO_API_KEY` was observed only in Preview. Production provider mode was observed as `namesilo-sandbox`.
- PR #22 was merged into `main` as `0f161959a638eced0ee997420953e0d5aae647cf`; the corrected admin route is now on `main`.
- Production migration history was rechecked read-only: 29 entries were present, including `20261102134924` and `20261103182518`. Source filenames and CI replay now use those canonical versions. Production sandbox inventory confirms expected columns, constraints, indexes and update triggers; RLS is enabled and grants are service-role-only. A complete all-schema source-vs-Production diff remains outstanding.
- PR #24 merged the Next.js/React, Supabase SSR and Zod upgrades, unused dependency removals, ESLint flat config and refreshed lockfile into `main`. CI audit reported 0 vulnerabilities; exact-commit CI run `42272580745` passed and Preview `dpl_4rNeFm1WE3YWPqM1j9qdUcos2peT` is READY.
- One sandbox nameserver operation remained `unknown` because NameSilo OTE read-back did not confirm the requested values. This is correctly treated as unresolved, not success.

## Work log

| Date | Work | Evidence / result |
|---|---|---|
| 2026-11-04 | Created this remediation plan on `production-readiness/stage-a`. | No Production or database changes. |
| 2026-11-04 | Rechecked PR #22 and admin management route on `main` vs feature branch. | Feature route verifies Supabase user and admin role; `main` still has stale imports and trusts `x-user-id`. |
| 2026-11-04 | Reconciled sandbox migration filenames and CI replay on `production-readiness/stage-a`; opened draft PR #23 against the sandbox feature branch. | Duplicate journey migration removed; canonical versions match Production history; fresh PostgreSQL migration/schema tests, lint, TypeScript, domain tests, and Node 24 build all passed in CI run 41812095775. Vercel Preview `dpl_HK4ygjz3p6jqSHeL4sCb7KXjs5Bs` is READY. No Production migration or deployment. |
| 2026-11-04 | Read-only Production migration/schema/grant inspection and source review of seven flagged SECURITY DEFINER functions. | Production records 29 migrations including the two canonical sandbox versions; sandbox tables are RLS-enabled and service-role-only. Authenticated wrappers use `auth.uid()` and role checks. Leaked-password protection remains disabled; additional cross-user regression coverage and full schema diff remain open. |
| 2026-11-06 | Merged the sandbox customer journey and migration-history remediation to `main`. | PR #23 merged into the feature branch, then PR #22 merged to `main` as `0f161959a638eced0ee997420953e0d5aae647cf`. GitHub CI run `42268037248` passed schema replay, SQL tests, lint, TypeScript, domain tests and production build. Vercel Preview `dpl_GB7pXBzxUumMWkbAEFUmaiD19EYp` is READY. Merge triggered a Production-target Vercel build automatically; it was canceled because a separate Production deployment was not authorized. No Production database migration, live registrar operation or real payment was performed. |
| 2026-11-06 | Read-only verification of sandbox Production schema and grants. | Three sandbox tables have RLS enabled, no client policies, and only `service_role` table grants. Full database schema diff remains open. |
| 2026-11-06 | Added cross-user role authorization regression tests. | Customer self-role lookup succeeds; customer cross-user role lookup is denied; admin cross-user lookup succeeds; anonymous EXECUTE is denied. SQL integration job passed in run `42268893665`. |
| 2026-11-06 | Remediated dependency vulnerabilities on `production-readiness/stage-a-followup`. | Upgraded Next.js 16.4.5 / React 19.2.9, Supabase SSR 0.12.7 and Zod 4.6.7; migrated async cookies and route params; refreshed lockfile. `npm audit` reported 0 vulnerabilities. Lint, domain tests, TypeScript and production build passed in run `42272251525`. PR #24 merged the security upgrade into `main` as `587d4afb8f5d05aba4c349c32e1e5cb956e7d320`; exact-commit CI run `42272580745` passed and Preview `dpl_4rNeFm1WE3YWPqM1j9qdUcos2peT` is READY.

| 2026-11-06 | Merged the dependency-security hardening PR #24 to `main`. | Merge commit `587d4afb8f5d05aba4c349c32e1e5cb956e7d320`; PR CI run `42272580745` passed audit, lint, TypeScript, domain provider tests, SQL integration tests and build; Preview `dpl_4rNeFm1WE3YWPqM1j9qdUcos2peT` is READY. The automatic Production-target deployment triggered by the merge was canceled because separate Production deployment authorization was not given. No Production DB migration, live registrar mutation or real payment occurred. |
