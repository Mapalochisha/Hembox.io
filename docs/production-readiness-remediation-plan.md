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
- [ ] Confirm the admin management API uses server-verified Supabase identity and administrator role checks; reject caller-supplied identity headers.
- [ ] Confirm customer endpoints enforce authenticated ownership and do not expose service-role credentials or registrant data.
- [ ] Resolve all build/import failures on the release candidate and obtain green GitHub CI plus Vercel Preview.
- [ ] Update PR description and handover docs to match actual Production migration history and current sandbox limitations.
- **Acceptance:** CI and Preview are green on the exact reviewed SHA; no unauthenticated or header-spoofed access to customer/admin operations; no merge/deploy performed without release authorization.

### A2. Reconcile Supabase migration history before any further migration
- [ ] Compare every sandbox migration filename in source, CI, and Production migration history.
- [ ] Remove duplicate SQL migration files only after proving their contents are identical and selecting the already-applied Production version as canonical.
- [ ] Align CI replay filenames with the canonical applied versions.
- [ ] Confirm the sandbox management migration's source version matches the Production history entry; preserve the SQL body and verify the resulting schema.
- [ ] Run the complete migration chain against a fresh disposable PostgreSQL database.
- [ ] Compare the resulting schema, constraints, indexes, functions, grants, and RLS settings with Production using read-only inspection.
- **Acceptance:** one canonical source file per applied migration version; no pending/duplicate sandbox migration; fresh-database CI replay succeeds; schema comparison has no unexplained drift. Do not run `supabase db push` or apply migrations to Production as part of this task.

### A3. Complete security review of privileged database functions
- [ ] Review each flagged `SECURITY DEFINER` function: `authenticated_accept_billing_arrangement`, `authenticated_create_billing_invoice`, `authenticated_request_billing_arrangement`, `authenticated_review_billing_arrangement`, `authenticated_review_billing_payment_claim`, `authenticated_void_billing_invoice`, and `get_user_role`.
- [ ] Verify `auth.uid()` is the identity source for customer actions; validate ownership, admin/elevated-role authorization, input constraints, fixed `search_path`, and EXECUTE grants.
- [ ] Add/extend SQL regression tests for authorization boundaries and cross-user access.
- [ ] Enable Supabase leaked-password protection after assessing Auth impact and confirming recovery/reset behavior.
- [ ] Review service-role-only tables and ensure no unnecessary client policies or grants are introduced.
- **Acceptance:** every privileged function has a recorded review outcome and regression coverage; no caller can select another user's identity or bypass admin authorization; Auth protection is enabled or a documented blocker is approved.

### A4. Automated verification and dependency hygiene
- [ ] Keep Node versions aligned between GitHub CI and Vercel, or explicitly test both configured versions.
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
- Production migration history and source/CI sandbox migration versions differ; this must be reconciled before another migration.
- One sandbox nameserver operation remained `unknown` because NameSilo OTE read-back did not confirm the requested values. This is correctly treated as unresolved, not success.

## Work log

| Date | Work | Evidence / result |
|---|---|---|
| 2026-11-04 | Created this remediation plan on `production-readiness/stage-a`. | No Production or database changes. |
| 2026-11-04 | Rechecked PR #22 and admin management route on `main` vs feature branch. | Feature route verifies Supabase user and admin role; `main` still has stale imports and trusts `x-user-id`. |
