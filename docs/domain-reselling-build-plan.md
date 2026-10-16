# HEMBOX.io Domain Reselling — Build Plan & Progress Record

> **Purpose:** This is the canonical handoff document for the domain-reselling project. Read it before continuing implementation after a context switch. Update this file as milestones are completed, decisions change, or verification results become available.
>
> **Last updated:** 2026-10-16  
> **Repository:** `Mapalochisha/Hembox.io`  
> **Working branch:** `feature/domain-reselling-platform`  
> **Pull request:** https://github.com/Mapalochisha/Hembox.io/pull/2  
> **Related technical roadmap:** [domain-reselling-roadmap.md](./domain-reselling-roadmap.md)

## 1. Product objective

Build a reliable, self-service domain-reselling product within HEMBOX.io. Customers must be able to discover domains, understand the registration and renewal costs, pay securely, register domains, and manage supported domain settings without being required to buy HEMBOX web-development services.

The first market is Zambia, with **ZMW as the primary customer-facing currency**. The project has no existing customers yet, so do not build customer-loyalty discounts without a demonstrated business need.

## 2. Non-negotiable constraints

- **Registrar cost requirement:** prefer a provider with no activation/setup fee, monthly fee, or mandatory upfront deposit. Verify the actual terms, not only marketing claims.
- Keep domain purchases independent from web-development packages.
- Keep all registrar and payment secrets server-side; never commit secrets or use `NEXT_PUBLIC_*` variables for them.
- Do not fabricate domain availability, prices, registration status, payment status, or provider capabilities.
- Never treat a browser redirect as proof of payment. Verify payment server-side using authenticated/signed gateway events and reconciliation.
- Recheck domain availability and price before purchase/registration.
- Design for duplicate requests, webhook retries, timeouts, and ambiguous registrar outcomes. A timeout after a registration request does not prove that registration failed.
- Use the feature branch for implementation. Do not merge to `main` unless explicitly asked.
- Do not apply migrations to production Supabase, enable live registration, or accept real payments without explicit authorization and completed release gates.
- Before calling a milestone complete, verify its acceptance criteria. Record actual CI and Vercel results and link to the relevant runs/commit.

## 3. Recorded baseline (as of 2026-10-16)

### Implemented on the feature branch

- Public `/domains` enquiry storefront and navigation links.
- Domain provider types/contracts and a mock provider that reports unknown availability and no fabricated prices.
- Server-side provider selection that fails closed unless an explicit development mock mode is enabled.
- `POST /api/domains/search` validation and guarded provider call.
- Domain order lifecycle state helpers.
- Initial database migration for TLD catalogue, domain orders and audit events.
- SQL integration assertions and a CI database-schema job using disposable PostgreSQL.
- Automated quality checks for lint/type-check and production build.

### Last recorded verification

- Latest recorded CI run: https://github.com/Mapalochisha/Hembox.io/actions/runs/38897605545
- Latest recorded Vercel check/deployment: https://vercel.com/mapalochishas-projects/hembox-io/3KW6yaVmpawpKV6ZkL2cBxPaFTiK
- Pull request: https://github.com/Mapalochisha/Hembox.io/pull/2
- Latest known feature commit at the time of the prior handoff: `2334c4dd12aefff9f112ab1eebca088136b4e1fa`
- **Important:** these are historical verification results, not a claim that the latest commit after this document is automatically green. Re-check CI/Vercel after every meaningful change.
- No real registrar adapter or payment gateway has been implemented.
- No production Supabase migration has been applied.
- The storefront is an enquiry flow, not a live domain checker or checkout.

## 4. Milestone plan

Use `[x]` only after the milestone's acceptance criteria have been met and verified. Add the date, commit, checks, and evidence in the progress log below.

### [x] M0 — Foundation

**Scope**
- Add the enquiry storefront and navigation.
- Define provider contracts, mock/disabled behavior, search validation and order-state helpers.
- Add the initial domain database schema and SQL integration tests.
- Include schema integration, lint/type checks and production build in CI.

**Acceptance criteria**
- Initial foundation tests pass in CI.
- Unconfigured provider behavior fails closed.
- The site does not claim live availability or registration.

**Recorded state:** Implemented. Last recorded CI and Vercel checks were green; re-verify after subsequent commits.

### [ ] M1 — Registrar selection and commercial verification

**Scope**
- Compare eligible providers, prioritizing the zero-upfront-cost requirement.
- Verify activation/setup fees, recurring fees, mandatory deposit/minimum balance, sandbox requirements, API access, supported TLDs, registration/renewal costs, transfer-out, DNS, and refund/support terms.
- Determine whether provider pricing and payout/funding arrangements are practical for a Zambia-based business.
- Record official documentation links and any unverified terms.

**Acceptance criteria**
- Provider is selected using a documented comparison.
- Sandbox access and required credentials/account prerequisites are understood.
- No critical commercial blocker is hidden or assumed away.

**Current state:** Next milestone; provider not confirmed. Domain Name API remains a candidate, not an approved integration.

### [ ] M2 — Registrar sandbox adapter

**Scope**
- Implement the chosen provider behind the existing server-side provider interface.
- Support only verified provider capabilities, beginning with availability and pricing where available.
- Add adapter contract tests, input/output normalization, timeouts, rate-limit handling and sanitized error logging.
- Keep live registration disabled.

**Acceptance criteria**
- Tests use real sandbox responses or documented fixtures where the sandbox cannot support a test.
- Unknown/error states are not reported as available.
- Credentials remain server-only; no live registration can be triggered accidentally.

### [ ] M3 — Pricing policy and TLD catalogue

**Scope**
- Define retail margin, FX source/update policy, rounding, quote validity, and treatment of taxes/fees.
- Store provider wholesale cost/currency separately from retail price/currency.
- Store registration and renewal prices separately, with timestamps/source snapshots.
- Define which TLDs can be offered and ensure prices are complete before enabling a TLD.

**Acceptance criteria**
- Prices are calculated server-side in ZMW.
- Registration and renewal prices are clearly shown.
- Quotes can be traced to the cost/FX assumptions used to produce them.
- Stale or missing prices cannot be represented as current confirmed quotes.

### [ ] M4 — Cart, checkout and durable orders

**Scope**
- Build domain selection, customer/registrant data collection and checkout review.
- Recheck availability and final price before order confirmation.
- Store immutable quote/price snapshots and unique order identifiers.
- Add idempotency and concurrency protection for duplicate submissions and simultaneous attempts to buy the same domain.
- Define secure guest-order access if guest checkout is supported.

**Acceptance criteria**
- Duplicate requests do not create duplicate orders or charges.
- The final customer-confirmed amount matches the stored order snapshot.
- Sensitive customer data is collected only when needed and access is restricted.

### [ ] M5 — Payment gateway

**Scope**
- Select a gateway that supports the intended ZMW methods and business onboarding requirements.
- Implement server-side payment initiation, signed webhook verification, idempotent event processing and reconciliation.
- Handle pending/failed payments, retries, duplicate events, refunds and payment-without-registration outcomes.
- Keep live payments disabled until approval and sandbox tests are complete.

**Acceptance criteria**
- A client-side redirect alone can never mark an order paid.
- Duplicate/out-of-order webhooks are handled safely.
- Payment failures and refunds have explicit order-state and support paths.

### [ ] M6 — Registration and provisioning

**Scope**
- Trigger registration only after verified payment and a fresh availability/price check.
- Use recoverable jobs or equivalent durable processing.
- Persist provider references and registration/expiry information.
- Reconcile ambiguous timeouts before retrying; prevent blind duplicate registration attempts.
- Implement failure, manual-review, cancellation and refund/recovery paths.

**Acceptance criteria**
- Sandbox end-to-end purchase tests pass.
- Duplicate/replayed events cannot create duplicate registrations.
- Every order can be reconciled to payment and provider state.

### [ ] M7 — Customer account and domain dashboard

**Scope**
- Display customer orders, domain status, registration/expiry dates and renewal information.
- Add order-status notifications.
- Enforce owner-only access; decide and securely implement guest access if offered.
- Show clear support paths for pending, failed or manual-review orders.

**Acceptance criteria**
- Automated authorization tests prove users cannot access other customers' orders/domains.
- Status shown to customers is based on verified backend state.

### [ ] M8 — Admin and operations console

**Scope**
- Manage TLD enablement and pricing.
- Search orders and inspect provider/payment reconciliation.
- Support manual review, failed registrations, refund workflows and audit history.
- Enforce server-side role checks and log privileged actions.

**Acceptance criteria**
- Non-admin users cannot invoke administrative actions.
- High-impact changes and manual overrides are auditable.

### [ ] M9 — DNS, renewals and extended domain management

**Scope**
- Add DNS/nameserver management only for capabilities supported by the chosen provider.
- Add expiry reminders, renewal ordering/payment and renewal-result reconciliation.
- Document provider-specific grace/redemption rules and transfer/lock capabilities.
- Clearly disclose unsupported features rather than simulating them.

**Acceptance criteria**
- Supported operations are tested against sandbox/provider contracts.
- Renewal failures and approaching expirations are visible and actionable.

### [ ] M10 — Security, reliability and regression QA

**Scope**
- Review RLS, grants, ownership policies, database constraints, order-state transitions and audit integrity.
- Test API validation, abuse/rate limiting, secret exposure, webhook signature/replay protection and logging redaction.
- Test provider/payment outages, concurrent orders, retries and recovery.
- Document backups, alerts, reconciliation and rollback procedures.

**Acceptance criteria**
- No unresolved critical security or data-integrity defects.
- CI includes meaningful automated tests for the high-risk paths.
- Recovery procedures have been reviewed and tested where practical.

### [ ] M11 — Staging and production launch

**Scope**
- Verify production environment variables, account permissions, domain configuration and operational alerts.
- Review the final database migration, backup and rollback plan.
- Run staging acceptance tests and controlled end-to-end tests.
- Obtain explicit authorization before production migrations, real payment acceptance or live registration.
- Merge only after required reviews and checks pass.

**Acceptance criteria**
- CI and Vercel checks are green for the intended release commit.
- Production smoke tests and order/payment/registration reconciliation pass.
- Launch checklist is approved and rollback/support ownership is clear.

### [ ] M12 — Post-launch operations and improvement

**Scope**
- Track search-to-order conversion, registration success, failed orders, margins, refunds, renewals and support issues.
- Reconcile provider registrations against payments and internal orders.
- Improve TLD coverage and pricing based on actual demand and unit economics.
- Review incidents and customer feedback.

**Acceptance criteria**
- Routine monitoring, reconciliation and customer support have clear owners and documented procedures.

## 5. Release gates

Do not skip these gates even if UI work can continue in parallel.

1. **Provider gate:** commercial terms and sandbox capabilities verified.
2. **Pricing gate:** current provider costs, ZMW conversion and renewal prices are trustworthy.
3. **Order gate:** availability recheck, quote snapshots, idempotency and concurrency controls pass.
4. **Payment gate:** server-verified payment, webhook replay protection and reconciliation pass.
5. **Registration gate:** sandbox end-to-end registration and ambiguous-outcome recovery pass.
6. **Security gate:** authorization, RLS, audit trail and secrets handling reviewed.
7. **Launch gate:** intended commit has green CI and Vercel checks, production readiness is verified, and explicit authorization is obtained.

A green build proves only the checks that ran. It does not independently prove real payment, registrar, production database, renewal or operational workflows.

## 6. Progress log

Add a new entry at the top of this section after each substantive implementation or verification session. Never overwrite earlier entries; retain the historical record.

### 2026-10-16 — Plan established

- **Milestone:** M0 recorded complete; M1 is next.
- **Baseline:** storefront/enquiry flow, provider contract and guarded search API, order-state helpers, initial database migration/tests and CI schema job are recorded as implemented.
- **Verification evidence:** [CI run](https://github.com/Mapalochisha/Hembox.io/actions/runs/38897605545), [Vercel check/deployment](https://vercel.com/mapalochishas-projects/hembox-io/3KW6yaVmpawpKV6ZkL2cBxPaFTiK), [PR #2](https://github.com/Mapalochisha/Hembox.io/pull/2).
- **Caveat:** results above are the last recorded baseline and must be rechecked after new commits.
- **Blockers:** registrar not confirmed; payment gateway not selected; no live adapter; production migration not applied.
- **Next action:** verify registrar commercial terms and sandbox requirements, then document the decision before implementing M2.

### Progress-entry template

Copy and fill this template for every substantive work session:

```md
### YYYY-MM-DD — Short description
- **Milestone:** M#
- **Changes:** files/features changed
- **Tests:** exact commands or CI jobs and results
- **CI:** run URL, commit SHA, status
- **Vercel:** check/deployment URL and status
- **Database/production impact:** none, or explicitly describe approved action
- **Blockers/risks:** unresolved items
- **Next action:** one concrete step
```

## 7. Current handoff instructions

When resuming this project:

1. Read this file and [the technical roadmap](./domain-reselling-roadmap.md).
2. Check the current branch, latest commit, open PR, CI runs and Vercel checks; do not rely solely on the historical status above.
3. Inspect the current implementation before changing it; do not assume the repo has not changed.
4. Continue from the earliest incomplete milestone, unless a documented blocker requires a different order.
5. Work on `feature/domain-reselling-platform`, keep changes focused, run relevant tests, and update this file with the commit and verification evidence.
6. Never claim a feature or milestone is complete without evidence, and never enable production payments/registration or apply production migrations without explicit approval.

**Immediate next action: M1 — verify and choose a registrar that meets the zero-upfront-cost requirement.**
