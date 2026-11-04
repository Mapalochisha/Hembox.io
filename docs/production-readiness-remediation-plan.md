# HEMBOX Production Readiness Remediation Plan

**Status:** In progress  
**Working branch:** `production-readiness/stage-a`  
**Baseline:** PR #22, `feature/sandbox-domain-customer-journey`  
**Production changes:** Not authorized by this plan. No Production deployment, live registrar mutation, payment, or database migration is permitted without separate explicit approval.

This plan converts the repository and infrastructure audit into verifiable release gates. Checkboxes are updated only when evidence exists. A passing build or Preview does not by itself authorize a Production release.

## Release decision

HEMBOX is **not ready for live domain sales**. The sandbox customer journey is a useful foundation, but the live catalogue is empty, Production is configured for NameSilo OTE rather than live registrar operations, and payment-to-registration fulfilment has not been proven end to end.

A limited launch must not be enabled until all Stage A and Stage B release gates are met. Stage C operational controls must be completed or explicitly accepted as launch risks.

## Stage A — Technical release readiness

Goal: establish a coherent, secure, reproducible code and database baseline, and prove the non-live customer/admin journey.

### A1. Integrate the known-good sandbox implementation
- [ ] Reconcile PR #22 with current `main`; confirm its base/head SHAs and changed-file scope.
- [x] Confirm the admin management API on the release branch uses server-verified Supabase identity and administrator role checks; reject caller-supplied identity headers. The older `main` route remains unsafe/stale until PR #22 is merged.
- [ ] Confirm customer endpoints enforce authenticated ownership and do not expose service-role credentials or registrant data.
- [ ] Resolve all build/import failures on the release candidate and obtain green GitHub CI plus Vercel Preview.
- [ ] Update PR description and handover docs to match actual Production migration history and current sandbox limitations.
- **Acceptance:** CI and Preview are green on the exact reviewed SHA; no unauthenticated or header-spoofed access to customer/admin operations; no merge/deploy performed without release authorization.

### A2. Reconcile Supabase migration history before any further migration
- [x] Compare every sandbox migration filename in source, CI, and Production migration history; Production records `20261102134924` and `20261103182518`.
- [x] Remove duplicate SQL migration files after confirming the two journey files had identical Git blob hashes and selecting the already-applied Production version as canonical.
- [x] Align CI replay filenames with the canonical applied versions.
- [ ] Confirm the sandbox management migration's source version matches the Production history entry; preserve the SQL body and verify the resulting schema.
- [x] Run the complete migration chain against a fresh disposable PostgreSQL database; GitHub Actions run 41812095775 passed the schema replay and SQL regression job.
- [ ] Compare the resulting schema, constraints, indexes, functions, grants, and RLS settings with Production using read-only inspection.
- **Acceptance:** one canonical source file per applied migration version; no pending/duplicate sandbox migration; fresh-database CI replay succeeds; schema comparison has no unexplained drift. Do not run `supabase db push` or apply migrations to Production as part of this task.

### A3. Complete security review of privileged database functions
- [x] Review each flagged `SECURITY DEFINER` function. The six authenticated billing wrappers derive identity from `auth.uid()`; admin-only wrappers verify the caller's admin role; customer wrappers delegate with the caller's own identity; each has a fixed empty `search_path` and restricted EXECUTE grants. `get_user_role` returns the caller's own role and only permits cross-user lookup for admins. This is a source review, not a claim that the advisor warnings disappeared.
- [ ] Verify `auth.uid()` is the identity source for customer actions; validate ownership, admin/elevated-role authorization, input constraints, fixed `search_path`, and EXECUTE grants.
- [ ] Add/extend SQL regression tests for authorization boundaries and cross-user access.
- [ ] Enable Supabase leaked-password protection after assessing Auth impact and confirming recovery/reset behavior.
- [ ] Review service-role-only tables and ensure no unnecessary client policies or grants are introduced.
- **Acceptance:** every privileged function has a recorded review outcome and regression coverage; no caller can select another user's identity or bypass admin authorization; Auth protection is enabled or a documented blocker is approved.

### A4. Automated verification and dependency hygiene
- [x] Keep Node versions aligned between GitHub CI and Vercel (Node 24); GitHub CI run 41812095775 passed.
- [ ] Add a dependency vulnerability audit to CI with a defined severity policy and reviewed exceptions.
- [ ] Ensure CI covers lint, TypeScript, domain tests, full migration replay, SQL authorization tests, and production build.
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
- PR #22 is open/draft and contains the corrected admin management route; its base `main` still contains the older broken route.
- Production migration history was rechecked read-only on 2026-11-04: 29 migration entries are present, including `20261102134924` and `20261103182518`. Source filenames and CI now match those canonical versions on the remediation branch. Sandbox tables are present in Production with RLS enabled and service-role-only grants. A full schema diff is still outstanding.
- One sandbox nameserver operation remained `unknown` because NameSilo OTE read-back did not confirm the requested values. This is correctly treated as unresolved, not success.

## Work log

| Date | Work | Evidence / result |
|---|---|---|
| 2026-11-04 | Created this remediation plan on `production-readiness/stage-a`. | No Production or database changes. |
| 2026-11-04 | Rechecked PR #22 and admin management route on `main` vs feature branch. | Feature route verifies Supabase user and admin role; `main` still has stale imports and trusts `x-user-id`. |
| 2026-11-04 | Reconciled sandbox migration filenames and CI replay on `production-readiness/stage-a`; opened draft PR #23 against the sandbox feature branch. | Duplicate journey migration removed; canonical versions match Production history; fresh PostgreSQL migration/schema tests, lint, TypeScript, domain tests, and Node 24 build all passed in CI run 41812095775. Vercel Preview `dpl_HK4ygjz3p6jqSHeL4sCb7KXjs5Bs` is READY. No Production migration or deployment. |
| 2026-11-04 | Read-only Production migration/schema/grant inspection and source review of seven flagged SECURITY DEFINER functions. | Production records 29 migrations including the two canonical sandbox versions; sandbox tables are RLS-enabled and service-role-only. Authenticated wrappers use `auth.uid()` and role checks. Leaked-password protection remains disabled; additional cross-user regression coverage and full schema diff remain open. |
