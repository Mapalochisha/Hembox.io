# HEMBOX.io Domain Reselling — Build Plan & Progress Record

> **Purpose:** This is the canonical handoff document for the domain-reselling project. Read it before continuing implementation after a context switch. Update this file as milestones are completed, decisions change, or verification results become available.
>
> **Last updated:** 2026-10-19  
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

**Implementation progress (2026-10-18):** Provider-independent integer pricing math, a 24-hour price-freshness gate, an admin-only TLD catalogue API, a public retail-only catalogue endpoint, price-history snapshots, and unit/schema tests have been added. This milestone remains incomplete until actual wholesale/renewal costs and FX inputs are verified, the catalogue is configured from trustworthy source data, and the full acceptance criteria are tested.

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

**Implementation progress (2026-10-18):** Added an authenticated, read-only customer order API and /profile/domains dashboard. Reads are scoped to the signed-in user and backed by the existing owner RLS policy. The dashboard is intentionally read-only; order creation and guest-order access remain gated until quote/order flow is implemented.

**Scope**
- Display customer orders, domain status, registration/expiry dates and renewal information.
- Add order-status notifications.
- Enforce owner-only access; decide and securely implement guest access if offered.
- Show clear support paths for pending, failed or manual-review orders.

**Acceptance criteria**
- Automated authorization tests prove users cannot access other customers' orders/domains.
- Status shown to customers is based on verified backend state.

### [ ] M8 — Admin and operations console

**Implementation progress (2026-10-18):** Added an admin-only domain catalogue screen and server-side catalogue API with role verification, server-calculated ZMW retail prices, and price-history recording. Added a read-only admin order queue with status filtering and recent audit-event visibility. Full order/payment/provider reconciliation, manual review actions, refunds, and operational audit workflows remain unimplemented.

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

### 2026-10-17 — Domain order-state regression coverage and provider contract review

- **Milestone:** M0 regression coverage extended; M2 remains blocked pending verified OT&E access and an authoritative current request/response contract.
- **Changes:** Added unit tests for same-state idempotency, the intended enquiry-to-registration sequence, forbidden state skips, terminal cancelled/refunded orders, registration-failure recovery, and manual-review transitions. The domain test command now runs these tests with the existing request-validation and response-normalization suites.
- **Provider investigation:** The official [v2 migration troubleshooting guide](https://www.domainnameapi.com/knowledge-base/account-management/v2-migration-integration-error-troubleshooting-guide) states that IP whitelisting is mandatory on the v2 infrastructure and identifies a missing outbound-IP entry as a cause of authorization failures. The user reported that the whitelist is empty, making this a likely blocker, not a confirmed sole cause. Official materials currently disagree on API details: the [quick-start guide](https://www.domainnameapi.com/knowledge-base/account-management/how-to-start-domain-reselling) shows `/v1/domain/check` with `resellerId`, `apiKey`, and `domain`, while the v2 troubleshooting/rate-limit documentation refers to the newer API structure. The current OT&E Swagger page was not readable through the available inspection path. Do not switch endpoint or credential conventions based on inference; confirm with provider support or a successful OT&E response.
- **Client exception:** The user reports that the client-side exception is now gone. Vercel runtime logs remain inaccessible through the connected integration, so this is user-confirmed behavior rather than an independently inspected runtime trace.
- **Safety:** No registrar endpoint behavior changed; unknown/error states remain fail-closed. No production migration, payment integration, live registration, or merge to `main`.
- **Verification:** The immediately preceding validation commit `9faef45b079a39c46656866514b2e6f94cdc676d` passed GitHub Actions push and pull-request CI and its Vercel check. The order-state regression tests and provider-documentation update are included in the current branch. Latest verified head at this log update, `af061919a6c1a5e21e4db8e1be03c8f9da412e0e`, passed push CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39071824691)), pull-request CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39071829481)), and Vercel ([deployment](https://vercel.com/mapalochishas-projects/hembox-io/6UQ3BRRmRUBdnckfsd8ToAeH8NyN)). The checks included lint, TypeScript, domain validation/response/order-state tests, disposable PostgreSQL schema integration tests, and production build. This documentation-only follow-up will itself trigger checks, so re-verify the resulting head before reporting completion.
- **Next action:** Verify this commit's CI and Vercel status. Then resolve the provider whitelist and contract with Domain Name API support; keep customer-facing availability/pricing and checkout disabled until sandbox results are verified.

### 2026-10-17 — Public domain-search validation hardening

- **Scope:** Continued safe work in parallel with the unresolved Domain Name API OT&E access/contract issue.
- **Changes:** Extracted public domain-search request validation into `src/lib/domains/validation.ts`; the API route now uses the shared validator. It normalizes whitespace/case, validates fully-qualified domain labels and length limits, rejects malformed/URL-like input and unexpected request fields, enforces a 1–10 item batch, and collapses duplicate names after normalization so one request cannot trigger repeated provider checks for the same domain.
- **Tests:** Added regression tests for normalization, duplicate collapse, empty/oversized batches, malformed labels, URL-like input, label/domain length limits, and strict request shape. The domain test command now runs both response-parser and request-validation tests.
- **Safety:** This does not change registrar endpoint assumptions, provider pricing, storefront behavior, live registration, payment processing, or production database state.
- **Verification:** The validation implementation at `9faef45b079a39c46656866514b2e6f94cdc676d` passed both GitHub Actions runs ([push run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39071611581), [pull-request run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39071615439)); lint, TypeScript type-check, domain response/request tests, disposable PostgreSQL schema integration tests, and production build all succeeded. Vercel check is successful: [deployment](https://vercel.com/mapalochishas-projects/hembox-io/4NySQwaHPjUqJHwNs8qRCLnh9oGM). CI caught a TypeScript target compatibility issue in the first deduplication implementation; it was corrected to use a filter/index lookup and the final commit passed. This progress-log update is documentation-only, so verify its resulting branch head before treating the latest commit as green. Do not mark M2 complete: OT&E credentials/permissions and the exact response contract still need a verified successful sandbox result.
- **Next action:** Confirm this commit's CI and Vercel status, then continue with provider-contract verification or other provider-independent regression/security work while support clarifies OT&E access.


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

**Immediate next action:** continue provider-independent quote/order foundations and safe operations tooling, then evaluate the Zambia-compatible payment gateway and complete security/release gates. Return to the Domain Name API OT&E credentials, IP allowlisting, and request/response contract only after the surrounding product layers are built. Keep checkout, live payments, and registration disabled.


### 2026-10-18 — Provider-independent pricing and catalogue foundation

- **Scope:** Build around the registrar abstraction while deferring OT&E credentials, IP whitelisting, and provider request/response verification until the provider workstream resumes.
- **Changes:** Added integer-only ZMW retail pricing calculations with explicit FX-rate scaling, basis-point markup, upward rounding, and safe-integer validation. Added a freshness gate that suppresses public prices when a saved pricing snapshot is missing, invalid, future-dated, or older than 24 hours.
- **Catalogue API:** Added an admin-only API to maintain TLD wholesale costs, renewal costs, FX assumptions, markup, source notes, and enablement. Retail prices are calculated on the server. The public catalogue endpoint returns only enabled TLDs and ZMW retail prices; it never returns wholesale costs and explicitly states that availability has not been checked. A stale price is returned as unavailable rather than presented as a current price.
- **Audit/schema:** Added a migration for pricing-policy fields and a restricted price-history table. Catalogue rows remain disabled by default. If price-history recording fails, the API leaves the TLD disabled rather than making it purchasable without its history record.
- **Tests:** Added pricing calculation/freshness unit tests and disposable-PostgreSQL checks for row-level security, grants, and complete pricing requirements. CI now applies the new migration after the existing foundation migration.
- **Safety:** No provider API behavior changed. No checkout, payment gateway, registration, DNS controls, or production migration was enabled. No catalogue prices are seeded, because actual wholesale/renewal costs and FX inputs have not yet been verified.
- **Verification:** The combined implementation through commit `f3ee9b89d35ee3907e9d5dc064a277d429eba1fd` passes push CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39154051748)), pull-request CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39154055608)), and Vercel ([check](https://vercel.com/mapalochishas-projects/hembox-io/KLnxVvU5kywYXAUhk8btGqBZDdmt)). Checks include lint, TypeScript, domain/pricing/order-state tests, disposable PostgreSQL migration and access-control tests, and production build.
- **Next:** Verify CI and deployment checks, then continue with durable order/quote foundations, customer order visibility, and admin operations while keeping all real purchase actions disabled.


### 2026-10-18 — Customer domain dashboard and admin order visibility

- Added a signed-in customer endpoint that reads only that user's domain orders through the authenticated Supabase client and the existing owner RLS policy. Added /profile/domains as a read-only order dashboard with explicit status and pricing display.
- Added an admin-only order-list endpoint with status filtering, bounded results, and recent audit events. Added a Domain Orders entry in the admin sidebar. No order state can be mutated from this screen.
- No guest-order retrieval, checkout, payment, registration, or DNS controls. If the domain schema has not been applied to a Preview database, these pages show a controlled unavailable state rather than inventing orders.
- Verification: included in the combined green CI/Vercel result recorded in the latest progress entry below.


### 2026-10-18 — Durable domain enquiries and public catalogue display

- The public /domains page now reads the public retail-only catalogue endpoint and displays registration and renewal prices only when the backend marks the price snapshot current. It continues to make no availability claim.
- Domain enquiries now carry the normalized domain and a browser-generated idempotency key. After the inquiry is saved, the API best-effort creates an enquiry-state row in domain_orders. A missing/unapplied domain migration does not break the established inquiry flow; the failure is logged server-side.
- Added optional account association for signed-in enquiries, plus a contact field so WhatsApp-only enquiries are not mislabeled as email addresses. Guest orders are visible only to admins; there is no guest retrieval endpoint.
- Added a database trigger to write a minimal audit event transactionally when a domain order is inserted. This does not authorize payment or registration transitions.
- Verification: the combined implementation through commit `f3ee9b89d35ee3907e9d5dc064a277d429eba1fd` passes push CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39154051748)), pull-request CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39154055608)), and Vercel ([check](https://vercel.com/mapalochishas-projects/hembox-io/KLnxVvU5kywYXAUhk8btGqBZDdmt)).


### 2026-10-18 — Verification and current handoff

- **Verified head:** `f3ee9b89d35ee3907e9d5dc064a277d429eba1fd`.
- **Push CI:** passed — https://github.com/Mapalochisha/Hembox.io/actions/runs/39154051748
- **Pull-request CI:** passed — https://github.com/Mapalochisha/Hembox.io/actions/runs/39154055608
- **Vercel:** passed — https://vercel.com/mapalochishas-projects/hembox-io/KLnxVvU5kywYXAUhk8btGqBZDdmt
- **Current delivery:** provider-independent pricing math/catalogue, public retail-only price display with a freshness gate, idempotent durable domain enquiries and insert audit events, customer read-only order dashboard, admin catalogue and read-only order queue, and order/payment transition foundations.
- **Still incomplete:** trusted registrar costs and real availability, quote expiry/final pre-purchase recheck, full cart/checkout, gateway selection/integration, signed webhook processing, registration/provisioning, renewals/DNS, full operational recovery, and production launch. Do not merge or apply production migrations without explicit authorization.
- **Next:** continue quote/order and checkout foundations without activating them, then gateway/security work; return to the registrar blocker at the end as requested.


### 2026-10-19 — Quote, payment-port, and recovery foundations

- Added `src/lib/domains/quotes.ts`: immutable quote snapshots, normalized domain names, integer ZMW price values, separately recorded registration/renewal prices, bounded validity (15-minute default; 60-minute maximum), and rejection of stale/future price snapshots. Expired quotes require a new quote; this module does not persist or issue checkout sessions.
- Added `src/lib/domains/payment-provider.ts`: a gateway port, typed payment intent/lookup/verified-event contracts, exact amount/currency/provider matching, and a fail-closed disabled provider. Any non-disabled provider mode throws rather than accidentally enabling a gateway. No payment provider is integrated.
- Added `src/lib/domains/recovery.ts`: conservative recovery recommendations for expired quotes, pending/unknown payment states, and ambiguous registration outcomes. It never executes retries or treats a timeout as proof of registration failure.
- Added quote snapshot and payment-attempt schema foundations to the unmerged durable-order migration. Quote snapshots reject UPDATE and DELETE; payment attempts have idempotency keys and unique provider payment/webhook-event references. Both tables use RLS and admin-only reads; writes are server-side. The payment schema is operational scaffolding only and stores no raw webhook bodies or credentials.
- Added unit coverage for quote expiry and stale pricing, disabled payment behavior, payment evidence matching, and recovery decisions. Extended disposable-PostgreSQL assertions for quote immutability, RLS/grants, and duplicate webhook-event protection.
- No payment initiation/webhook route, gateway credentials, checkout UI, registration operation, production migration, or live purchase capability was enabled.
- Verification of code commit `da00702017879ccbb6b8a8dffc8a167bc59bd81a` completed successfully; the verification evidence is recorded below.



### 2026-10-19 — Read-only recovery dashboard and gateway assessment

- Added admin-only `GET /api/admin/domains/recovery` and `/admin/domains/recovery`. The dashboard combines the latest saved quote, payment attempt and order/registrar references, then displays a conservative recommended next step. It is read-only: no status mutation, payment confirmation, refund, or registration retry is exposed.
- Linked the recovery dashboard from the admin domain-order queue.
- Evaluated public Zambia merchant documentation for Flutterwave, DPO Pay by Network and Pesapal. Flutterwave is the provisional first candidate to investigate because it publishes Zambia ZMW mobile-money API documentation and collection fees; DPO and Pesapal are viable alternatives to request commercial terms from. The roadmap records the source links and outstanding merchant eligibility/settlement checks.
- No gateway was selected for implementation or connected. The payment port remains disabled; onboarding, current fee confirmation, settlement verification, signed webhook handling, idempotent event processing and end-to-end reconciliation remain release prerequisites.


### Verification snapshot — implementation commit `da00702017879ccbb6b8a8dffc8a167bc59bd81a`

- Push CI: **passed** — https://github.com/Mapalochisha/Hembox.io/actions/runs/39301438289
- Pull-request CI: **passed** — https://github.com/Mapalochisha/Hembox.io/actions/runs/39301442068
- CI jobs: disposable PostgreSQL schema/access-control assertions, lint, TypeScript, all domain unit tests, and production build passed.
- Vercel Preview: **READY** for the same commit — https://vercel.com/mapalochishas-projects/hembox-io/4tkCNhUK53PdYtdUg6nqJYVgS7yU
- The docs update containing this verification snapshot will itself trigger a new CI/Preview verification; treat that newer head as unverified until its checks complete.


### 2026-10-19 — Database-enforced order lifecycle hardening

- Added a feature-branch migration that enforces the order-state transition graph inside PostgreSQL, in addition to the TypeScript guard. Invalid jumps are rejected at the persistence boundary.
- Successful status changes now create transactional audit events containing the old and new state. No-op status updates do not create misleading events.
- Added disposable-PostgreSQL checks for valid transitions, invalid jumps, terminal-state protection and audit evidence, and wired them into CI.
- Tightened payment evidence validation: a provider/amount/currency match must also explicitly report a confirmed payment.
- All payment and registrar operations remain disabled; this is defense-in-depth, not a checkout or provisioning workflow. Record CI and Preview evidence only after the new commit has completed its checks.


### 2026-10-19 — Payment-attempt lifecycle integrity

- **Milestone:** M4/M5 reliability foundations; payment integration remains disabled.
- **Changes:** Added a feature-branch migration that protects the immutable identity of a payment attempt (order, provider, idempotency key, amount, currency), prevents replacement of an assigned provider payment reference or confirmed timestamp, and enforces conservative status transitions. A confirmed attempt may only move to refunded; failed, cancelled and refunded attempts cannot silently be reopened. Unknown attempts may return to pending when reconciled with provider evidence.
- **Audit:** Payment-attempt creation and each actual status change now write minimal audit events transactionally. Audit details exclude webhook bodies, secrets and provider payment references.
- **Tests/CI:** Added disposable-PostgreSQL regression assertions for audit creation, allowed unknown-to-confirmed flow, forbidden confirmed-to-pending and refunded-to-confirmed regressions, and immutable amount/reference/timestamp. CI applies the migration after the existing order-transition migration and runs the new integration test.
- **Safety:** This does not create a payment route or activate any gateway. Service-role operations remain subject to the database triggers. No production migration was applied, and PR #2 remains unmerged.
- **Verification:** Pending for the new implementation commit; do not mark this entry verified until push CI, pull-request CI, and Vercel Preview have completed for the exact head.
- **Next:** Re-check the latest CI and Preview result, address any failures, then continue security review of recovery-state derivation and persistence constraints.


### 2026-10-19 — Durable payment webhook replay ledger

- Added an append-only-by-identity webhook event ledger with a database-enforced unique provider/event ID key, so replay protection can cover the entire event history rather than only the most recent event stored on a payment attempt.
- Stores only event identifiers, signature-verification outcome, processing state and sanitized error codes. Raw webhook bodies, credentials and cardholder data are not stored.
- Added RLS/admin-read controls, server-role write access, immutable event identity/verification evidence, constrained processing transitions and a no-delete guard. CI includes disposable-PostgreSQL tests for duplicate-event rejection and ledger immutability.
- This is schema groundwork only: no gateway is integrated, no webhook route exists, and no real payments are accepted. Verification remains pending for the resulting branch head.


### 2026-10-19 — Webhook ledger security review

- Reviewed the durable webhook ledger after adding its initial schema. The review found that the database still permitted a row with `signature_verified = false` to transition to `processed`, and allowed direct insertion in a terminal processing state. Those paths could undermine the future webhook handler if a caller made a mistake.
- Added `20261019220000_domain_payment_webhook_processing_guards.sql`: ledger rows must be inserted as `received`; unverified events cannot be marked processed; provider/event/type identifiers must be trimmed; and `processed_at` becomes immutable once assigned. Verification evidence and event identity remain immutable.
- Expanded disposable PostgreSQL integration assertions to cover unverified-event rejection, bypassing the received state, timestamp mutation and non-canonical event IDs. Added the new migration to the CI schema sequence.
- **Verification status:** pending for the resulting head. Do not treat the change as complete until push CI, pull-request CI and Vercel Preview have finished for the exact commit.
- **Scope unchanged:** no webhook route, gateway, payment initiation, refund, registrar call, production migration or live purchase action was enabled.


### 2026-10-19 — Conservative registration recovery derivation

- Security review found that the recovery dashboard inferred `confirmed_registered` or a definitive `failed` registration outcome directly from the order status. That is not independent registrar evidence and could overstate what is known after an ambiguous timeout.
- The recovery queue now treats `registration_pending` and `registration_failed` as ambiguous until a future provider lookup/reconciliation exists. A locally `registered` order is considered confirmed for the dashboard only when it has both a non-empty registrar domain reference and a valid registration timestamp; missing evidence is escalated as inconsistent state.
- Added unit tests for missing/malformed registration evidence and ambiguous failed/pending states. No registrar calls were introduced; the Domain Name API workstream remains deferred.
- **Verification:** pending for the latest branch head; CI and Vercel must complete successfully before this work is marked verified.


### 2026-10-19 — Payment confirmation evidence constraints

- A second persistence review found that a payment attempt could carry a non-null `confirmed_at` while its status remained pending/failed, and a service-role insert could start directly in a confirmed state. Those combinations could make downstream reconciliation trust inconsistent evidence.
- Added a database trigger that permits new attempts to start only as `pending` or `unknown`, rejects confirmation timestamps on unconfirmed attempts, requires timestamps for confirmed/refunded attempts, rejects future timestamps, and preserves the original confirmation timestamp.
- Added disposable PostgreSQL regression cases and wired the migration into CI. The change is schema hardening only; no payment route or provider is enabled.
- Verification is pending for the newest head and must be confirmed against push CI, pull-request CI and Vercel Preview.
