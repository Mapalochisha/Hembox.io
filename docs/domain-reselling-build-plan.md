# HEMBOX.io Domain Reselling — Build Plan & Progress Record

> **Purpose:** This is the canonical handoff document for the domain-reselling project. Read it before continuing implementation after a context switch. Update this file as milestones are completed, decisions change, or verification results become available.
>
> **Last updated:** 2026-10-17  
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
- Domain Name API OT&E availability adapter is implemented in the feature branch; credentials are read only from server-side environment variables. Live registration and pricing are not implemented.
- No payment gateway has been implemented.
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

**Decision:** Domain Name API is the selected initial provider for HEMBOX.io. Its official reseller page advertises no activation fee, mandatory deposit, minimum balance, or monthly charge; live registration still requires adding account balance. The provider's official quick-start documents separate test and live environments, API credentials, availability/pricing checks, registration, renewal, transfer, and DNS operations. See [reseller terms](https://www.domainnameapi.com/domain-reseller) and [official API quick start](https://www.domainnameapi.com/knowledge-base/account-management/how-to-start-domain-reselling).\n\n**Verification caveats:** This verifies published provider documentation, not the user's account approval, actual account-specific price list, API credentials, Zambia-specific payment/funding availability, or production readiness. Those must be confirmed before any live launch.

### [ ] M2 — Domain Name API sandbox adapter

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

### 2026-10-17 — OT&E blocker recorded and client-side configuration hardening

- **Milestone:** M2 remains in progress. Domain Name API OT&E requests still return `unknown` with an authentication/permissions message. The user reports that the provider dashboard's IP whitelist is empty; this is a possible blocker, not yet a confirmed root cause. A support ticket is being pursued to confirm the current endpoint, request contract, OT&E access, and Vercel outbound-IP policy.
- **Provider request change:** Updated the availability request payload to use the documented `domain` field rather than `domainName`. This has not yet been verified against a successful real OT&E response. Do not infer availability or pricing from errors.
- **Client-side exception investigation:** Prior troubleshooting identified missing `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the relevant Vercel environment as a likely cause of the global client crash. Vercel MCP log inspection is currently blocked by insufficient access to the Vercel team scope, so the exact browser exception has not been independently confirmed in current runtime logs.
- **Code changes on feature branch:** Added an explicit Supabase browser-client configuration guard. The global auth and agency providers, landing-page portfolio/services loaders, pricing page, and login/register/Google/phone auth components now avoid constructing the browser client when public Supabase configuration is absent; optional public content falls back to an empty/default state, while auth actions show a configuration message. The admin middleware returns a clear 503 for protected admin routes when Supabase configuration is absent, rather than throwing during client creation. This is defensive handling, not a substitute for configuring the correct Preview/Production environment variables.
- **Safety:** No production migration, payment processing, live registration, or merge to `main`. Registrar credentials remain server-side.
- **Verification:** Implementation head `af60c24c96fc1965f7d376700ac49424b687a335` passed both GitHub Actions CI runs ([push run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39069835069), [pull-request run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39069839697)); schema integration tests, lint/type check, and production build all succeeded. Vercel's check is successful and its Preview deployment is Ready: [deployment](https://vercel.com/mapalochishas-projects/hembox-io/9FMmPxE5mDaSXWZdZK92kQNqUAgT), [Preview URL](https://hembox-io-git-feature-domain-rese-acfcea-mapalochishas-projects.vercel.app). The exact browser exception has not yet been independently confirmed as resolved because runtime-log access is restricted and the Preview is not accessible to the web inspection tool; it still needs a real browser smoke test. This documentation follow-up creates a new commit, so its own CI/Vercel checks must also be rechecked. Do not mark M2 complete until the provider contract and sandbox result are confirmed.
- **Next action:** Wait for CI/Vercel status, test the newest Preview with Supabase env configured, inspect browser/runtime errors if any remain, and use Domain Name API support's response to finish the OT&E adapter.

### 2026-10-17 — Domain Name API OT&E adapter implementation started

- **Milestone:** M2 in progress; M1 provider selection is decided, but account-specific commercial/funding checks remain open.
- **Credentials confirmed by user:** Reseller ID, live API key, and separate Test Environment API Key. Provider support confirmed that OT&E uses the existing Reseller ID together with the Test Environment API Key.
- **Code changes:** Added `src/lib/domains/providers/domainnameapi-test.ts`, `src/lib/domains/providers/domainnameapi-response.ts`, explicit `environment` on provider contracts, a `DOMAIN_PROVIDER_MODE=domainnameapi-test` selection path, and response metadata distinguishing test results from live availability. Added server-side environment-variable placeholders to `.env.example`, six response-normalization unit tests in `tests/domainnameapi-response.test.mjs`, an `npm run test:domains` script, and a CI job step to execute those tests.
- **Safety:** Adapter only permits the official OT&E REST host, uses an 8-second timeout, returns `unknown` on errors or unrecognized payloads, never returns prices, and exposes no registration/renewal/DNS capabilities. It does not use or select the live API key.
- **Verification:** Latest code/CI configuration commit is `daeef453a1d6132d7c8655a694c830176e26fdd3`. The GitHub status and workflow-run lookups currently report no checks for this commit, so CI/Vercel are not yet verified. No credentials were added to GitHub, no production database was changed, and no live registration/payment was enabled.
- **Next action:** Validate the request/response contract against the current OT&E Swagger and real sandbox responses, run the new automated tests and full CI, and verify Vercel.

### 2026-10-16 — Domain Name API selected as initial registrar provider

- **Decision:** Domain Name API is the initial provider for HEMBOX.io domain reselling.
- **Commercial review:** Its official reseller page advertises no activation fee, no mandatory deposit/minimum balance, and no monthly fee. Higher pricing tiers can be unlocked by domain volume or optional deposits; do not make those deposits while starting without customers.
- **API/test review:** The official quick-start documents a separate test environment through the OT&E REST API at `https://ote.domainresellerapi.com/swagger/index.html`, with no real registrations or charges. Provider support confirmed that the existing Reseller ID is paired with the Test Environment API Key for OT&E. Live registration requires funded balance. Test availability may differ from live registry availability.
- **Documentation:** [Reseller program](https://www.domainnameapi.com/domain-reseller), [API quick start](https://www.domainnameapi.com/knowledge-base/account-management/how-to-start-domain-reselling).
- **Milestone:** Provider decision recorded. Account credential access is now confirmed by the user; M1 remains in progress pending account-specific pricing, payment/funding methods from Zambia, and TLD-level prices.
- **Changes:** Build-plan documentation only; no application code, provider credentials, production database, or live registration changed.
- **Next action:** Implement and validate the server-only OT&E adapter, while separately confirming Zambia-specific funding options and TLD-level prices. Keep live registration and payments disabled.


Add a new entry at the top of this section after each substantive implementation or verification session. Never overwrite earlier entries; retain the historical record.

### 2026-10-16 — Architecture decision: continue with current HEMBOX.io stack

- **Decision:** Continue with the existing Next.js + Supabase architecture and custom domain-reselling workflow. FOSSBilling was considered as an incidental discovery but will not be introduced as a dependency at this stage.
- **Rationale:** Preserve the current implementation and avoid adding a separate system to host, secure, maintain, and integrate without a demonstrated benefit.
- **Milestone:** M1 remains the next active milestone; this decision does not complete M1.
- **Changes:** Documentation decision only; no application code or infrastructure changed for this decision.
- **Tests/CI/Vercel:** No new code checks were triggered by the decision itself. Existing CI/Vercel evidence remains historical and must be rechecked after subsequent code commits.
- **Blockers:** Registrar not confirmed; payment gateway not selected; no live provider adapter.
- **Next action:** Verify registrar commercial terms and sandbox requirements, prioritizing no setup fee, no monthly fee, and no mandatory upfront deposit.

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

**Immediate next action: validate the OT&E adapter request/response schema against the provider's current Swagger contract and real sandbox responses, run the automated response-normalization tests and full CI, then verify Vercel. Keep live registration, customer checkout, and payment disabled.**
