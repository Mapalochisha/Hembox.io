# HEMBOX.io Domain Reselling — Build Plan & Progress Record

> **Purpose:** This is the canonical handoff document for the domain-reselling project. Read it before continuing implementation after a context switch. Update this file as milestones are completed, decisions change, or verification results become available.
>
> **Last updated:** 2026-10-23
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
- NameSilo read-only availability adapter is implemented in the feature branch; credentials are read only from server-side environment variables. It returns no provider prices and exposes no registration, renewal, transfer, DNS, or privacy operations. Account credentials and a safe live availability smoke test are not yet verified.
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

**Decision (updated 2026-10-20): NameSilo is the selected initial provider.** Domain Name API is retired from the active provider path because its OT&E access/contract troubleshooting was blocking progress. NameSilo documents a free API and private-label reseller options; however, its Discount Program requires account funds and the documented top-up minimum is $50, so the funding economics still need to be confirmed for HEMBOX.io. NameSilo API documentation: [API reference](https://www.namesilo.com/api-reference), [reseller options](https://www.namesilo.com/support/v2/articles/about/reseller-options), [API Manager](https://www.namesilo.com/support/v2/articles/account-options/api-manager), and [reseller FAQ](https://www.namesilo.com/support/v2/articles/domain-manager/reseller-frequently-asked). Sandbox credentials must be requested from NameSilo support before any state-changing operation is tested. The application-facing NameSilo adapter remains read-only availability only; live registration and prices remain disabled. NameSilo support provisioned an API-only OTE sandbox at `https://ote.namesilo.com/api`. The first authenticated Preview smoke test succeeded on 2026-10-22: POST /api/domains/search for example.com returned provider namesilo, environment test, and live=false; OTE reported unavailable. That status is sandbox-only, not real registry truth. Use .com or .net for tests and only the supported NS1.NAMESILO.COM through NS8.NAMESILO.COM nameservers. Sandbox credentials remain separate from NAMESILO_API_KEY.\n\n**Verification caveats:** The sandbox key has not yet been verified by a successful authenticated API call. Account funding/payment options from Zambia, account-specific live price list, and production readiness also remain unverified. Those must be confirmed before any live launch.

### [ ] M2 — NameSilo read-only adapter and account verification

**Scope**
- Implement the chosen provider behind the existing server-side provider interface.
- Support only verified provider capabilities; the current NameSilo adapter supports availability checks only and intentionally returns no prices.
- Add adapter contract tests, input/output normalization, timeouts, rate-limit handling and sanitized error logging.
- Keep live registration disabled.

**Acceptance criteria**
- Adapter parsing and failure behavior pass fixture-based tests. NameSilo sandbox credentials must be requested and verified before any state-changing operation; read-only availability still requires a controlled account/API-key smoke test.
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

### 2026-10-20 — Registrar decision changed from Domain Name API to NameSilo

- **Decision:** NameSilo is now the selected initial registrar. Domain Name API is retired from the active integration path because OT&E access and request/response troubleshooting were consuming time without a verified working connection.
- **Implementation:** Added a server-only `src/lib/domains/providers/namesilo.ts` adapter using NameSilo's documented `checkRegisterAvailability` endpoint. The provider factory accepts `DOMAIN_PROVIDER_MODE=namesilo`; the previous Domain Name API modes are no longer selected. The adapter uses an 8-second timeout, returns `unknown` on HTTP/network/parse failures, returns no prices, and exposes no registration, renewal, transfer, DNS, or privacy capability.
- **Testing:** Added NameSilo response parser fixtures and adapter regression coverage. The exact current branch head `04ddb1f5d7c58edbb2c993864258b69e225671b4` passed [push CI](https://github.com/Mapalochisha/Hembox.io/actions/runs/39379545939), [pull-request CI](https://github.com/Mapalochisha/Hembox.io/actions/runs/39379547861), and [Vercel Preview](https://vercel.com/mapalochishas-projects/hembox-io/4d3NZ34eC1cZWkauw6Wut9rndPju).
- **Commercial caveat:** NameSilo advertises free API/reseller tooling, but its Discount Program requires account funds and the published top-up minimum is $50. Confirm the account's funding options and actual TLD registration/renewal pricing before relying on the margin model. Request sandbox credentials from NameSilo support before testing any state-changing operation.
- **Safety:** No API key was added to source control. No real registration, payment, DNS, or renewal operation was enabled; no production migration was applied; PR #2 remains open and in draft.
- **Next action:** Configure `NAMESILO_API_KEY` and `DOMAIN_PROVIDER_MODE=namesilo` in Preview only when the user is ready, then run a read-only availability smoke test with a known available and known registered domain. Do not paste credentials into chat. Re-run CI/Preview after this progress-document update.


### 2026-10-17 — Domain order-state regression coverage and provider contract review

- **Milestone:** M0 regression coverage extended; M2 remains blocked pending verified OT&E access and an authoritative current request/response contract.
- **Changes:** Added unit tests for same-state idempotency, the intended enquiry-to-registration sequence, forbidden state skips, terminal cancelled/refunded orders, registration-failure recovery, and manual-review transitions. The domain test command now runs these tests with the existing request-validation and response-normalization suites.
- **Provider investigation:** The official [v2 migration troubleshooting guide](https://www.domainnameapi.com/knowledge-base/account-management/v2-migration-integration-error-troubleshooting-guide) states that IP whitelisting is mandatory on the v2 infrastructure and identifies a missing outbound-IP entry as a cause of authorization failures. The user reported that the whitelist is empty, making this a likely blocker, not a confirmed sole cause. Official materials currently disagree on API details: the [quick-start guide](https://www.domainnameapi.com/knowledge-base/account-management/how-to-start-domain-reselling) shows `/v1/domain/check` with `resellerId`, `apiKey`, and `domain`, while the v2 troubleshooting/rate-limit documentation refers to the newer API structure. The current OT&E Swagger page was not readable through the available inspection path. Do not switch endpoint or credential conventions based on inference; confirm with provider support or a successful OT&E response.
- **Client exception:** The user reports that the client-side exception is now gone. Vercel runtime logs remain inaccessible through the connected integration, so this is user-confirmed behavior rather than an independently inspected runtime trace.
- **Safety:** No registrar endpoint behavior changed; unknown/error states remain fail-closed. No production migration, payment integration, live registration, or merge to `main`.
- **Verification:** The immediately preceding validation commit `9faef45b079a39c46656866514b2e6f94cdc676d` passed GitHub Actions push and pull-request CI and its Vercel check. The order-state regression tests and provider-documentation update are included in the current branch. Latest verified head at this log update, `af061919a6c1a5e21e4db8e1be03c8f9da412e0e`, passed push CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39071824691)), pull-request CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39071829481)), and Vercel ([deployment](https://vercel.com/mapalochishas-projects/hembox-io/6UQ3BRRmRUBdnckfsd8ToAeH8NyN)). The checks included lint, TypeScript, domain validation/response/order-state tests, disposable PostgreSQL schema integration tests, and production build. This documentation-only follow-up will itself trigger checks, so re-verify the resulting head before reporting completion.
- **Superseded:** The Domain Name API workstream was retired on 2026-10-20 after continued OT&E access/contract friction. See the NameSilo provider-switch progress entry below.

### 2026-10-17 — Public domain-search validation hardening

- **Scope:** Continued safe work in parallel with the unresolved Domain Name API OT&E access/contract issue.
- **Changes:** Extracted public domain-search request validation into `src/lib/domains/validation.ts`; the API route now uses the shared validator. It normalizes whitespace/case, validates fully-qualified domain labels and length limits, rejects malformed/URL-like input and unexpected request fields, enforces a 1–10 item batch, and collapses duplicate names after normalization so one request cannot trigger repeated provider checks for the same domain.
- **Tests:** Added regression tests for normalization, duplicate collapse, empty/oversized batches, malformed labels, URL-like input, label/domain length limits, and strict request shape. The domain test command now runs both response-parser and request-validation tests.
- **Safety:** This does not change registrar endpoint assumptions, provider pricing, storefront behavior, live registration, payment processing, or production database state.
- **Verification:** The validation implementation at `9faef45b079a39c46656866514b2e6f94cdc676d` passed both GitHub Actions runs ([push run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39071611581), [pull-request run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39071615439)); lint, TypeScript type-check, domain response/request tests, disposable PostgreSQL schema integration tests, and production build all succeeded. Vercel check is successful: [deployment](https://vercel.com/mapalochishas-projects/hembox-io/4NySQwaHPjUqJHwNs8qRCLnh9oGM). CI caught a TypeScript target compatibility issue in the first deduplication implementation; it was corrected to use a filter/index lookup and the final commit passed. This progress-log update is documentation-only, so verify its resulting branch head before treating the latest commit as green. Do not mark M2 complete: OT&E credentials/permissions and the exact response contract still need a verified successful sandbox result.
- **Superseded:** The Domain Name API workstream was retired on 2026-10-20. Continue with NameSilo read-only verification and provider-independent work; do not resume Domain Name API troubleshooting unless the user explicitly reverses the decision.


### 2026-10-17 — OT&E blocker recorded and client-side configuration hardening

- **Milestone:** M2 remains in progress. Domain Name API OT&E requests still return `unknown` with an authentication/permissions message. The user reports that the provider dashboard's IP whitelist is empty; this is a possible blocker, not yet a confirmed root cause. A support ticket is being pursued to confirm the current endpoint, request contract, OT&E access, and Vercel outbound-IP policy.
- **Provider request change:** Updated the availability request payload to use the documented `domain` field rather than `domainName`. This has not yet been verified against a successful real OT&E response. Do not infer availability or pricing from errors.
- **Client-side exception investigation:** Prior troubleshooting identified missing `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the relevant Vercel environment as a likely cause of the global client crash. Vercel MCP log inspection is currently blocked by insufficient access to the Vercel team scope, so the exact browser exception has not been independently confirmed in current runtime logs.
- **Code changes on feature branch:** Added an explicit Supabase browser-client configuration guard. The global auth and agency providers, landing-page portfolio/services loaders, pricing page, and login/register/Google/phone auth components now avoid constructing the browser client when public Supabase configuration is absent; optional public content falls back to an empty/default state, while auth actions show a configuration message. The admin middleware returns a clear 503 for protected admin routes when Supabase configuration is absent, rather than throwing during client creation. This is defensive handling, not a substitute for configuring the correct Preview/Production environment variables.
- **Safety:** No production migration, payment processing, live registration, or merge to `main`. Registrar credentials remain server-side.
- **Verification:** Implementation head `af60c24c96fc1965f7d376700ac49424b687a335` passed both GitHub Actions CI runs ([push run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39069835069), [pull-request run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39069839697)); schema integration tests, lint/type check, and production build all succeeded. Vercel's check is successful and its Preview deployment is Ready: [deployment](https://vercel.com/mapalochishas-projects/hembox-io/9FMmPxE5mDaSXWZdZK92kQNqUAgT), [Preview URL](https://hembox-io-git-feature-domain-rese-acfcea-mapalochishas-projects.vercel.app). The exact browser exception has not yet been independently confirmed as resolved because runtime-log access is restricted and the Preview is not accessible to the web inspection tool; it still needs a real browser smoke test. This documentation follow-up creates a new commit, so its own CI/Vercel checks must also be rechecked. Do not mark M2 complete until the provider contract and sandbox result are confirmed.
- **Superseded:** Domain Name API is no longer the selected provider. NameSilo is the active adapter; its credentials and read-only availability response still require account-level verification.

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

**Immediate next action:** continue provider-independent quote/order foundations and safe operations tooling, then verify the NameSilo API key and read-only availability behavior in Preview. Request NameSilo sandbox credentials before any state-changing provider test. Evaluate the Zambia-compatible payment gateway and complete security/release gates. Keep checkout, live payments, and registration disabled.


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
- **Verification:** implementation commit `ed24e3dedaae36faa5b4283635b87c0adae734a6` passed push CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39318444932)), pull-request CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39318451696)), and Vercel Preview ([deployment](https://vercel.com/mapalochishas-projects/hembox-io/5A3uHFHKtFAEBcZJjFKN82N3U4xi)).
- **Scope unchanged:** no webhook route, gateway, payment initiation, refund, registrar call, production migration or live purchase action was enabled.


### 2026-10-19 — Conservative registration recovery derivation

- Security review found that the recovery dashboard inferred `confirmed_registered` or a definitive `failed` registration outcome directly from the order status. That is not independent registrar evidence and could overstate what is known after an ambiguous timeout.
- The recovery queue now treats `registration_pending` and `registration_failed` as ambiguous until a future provider lookup/reconciliation exists. A locally `registered` order is considered confirmed for the dashboard only when it has both a non-empty registrar domain reference and a valid registration timestamp; missing evidence is escalated as inconsistent state.
- Added unit tests for missing/malformed registration evidence and ambiguous failed/pending states. No registrar calls were introduced; the Domain Name API workstream remains deferred.
- **Verification:** the combined implementation commit `ed24e3dedaae36faa5b4283635b87c0adae734a6` passed push CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39318444932)), pull-request CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39318451696)), and Vercel Preview ([deployment](https://vercel.com/mapalochishas-projects/hembox-io/5A3uHFHKtFAEBcZJjFKN82N3U4xi)).


### 2026-10-19 — Payment confirmation evidence constraints

- A second persistence review found that a payment attempt could carry a non-null `confirmed_at` while its status remained pending/failed, and a service-role insert could start directly in a confirmed state. Those combinations could make downstream reconciliation trust inconsistent evidence.
- Added a database trigger that permits new attempts to start only as `pending` or `unknown`, rejects confirmation timestamps on unconfirmed attempts, requires timestamps for confirmed/refunded attempts, rejects future timestamps, and preserves the original confirmation timestamp.
- Added disposable PostgreSQL regression cases and wired the migration into CI. The change is schema hardening only; no payment route or provider is enabled.
- **Verification:** the combined implementation commit `ed24e3dedaae36faa5b4283635b87c0adae734a6` passed push CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39318444932)), pull-request CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39318451696)), and Vercel Preview ([deployment](https://vercel.com/mapalochishas-projects/hembox-io/5A3uHFHKtFAEBcZJjFKN82N3U4xi)). This documentation update itself will trigger fresh checks; verify the new documentation head before release.


### 2026-10-19 — Webhook ledger visibility in recovery operations

- Extended the admin recovery API and dashboard to display the latest linked webhook ledger events per order, including event ID/type, signature-verification result, processing state, sanitized error code and timestamps.
- The view deliberately excludes raw webhook bodies and secrets. It remains read-only and does not confirm payments, retry processing, or change order/payment state.
- **Verification:** implementation commit `c5d593403fa698bdbf7d635ed3fadd86cc4985e1` passed push CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39319287051)), pull-request CI ([run](https://github.com/Mapalochisha/Hembox.io/actions/runs/39319293703)), and Vercel Preview ([deployment](https://vercel.com/mapalochishas-projects/hembox-io/2YMGzpxbqzitEzyzDaLqfgDZkGJS)). This documentation update triggers fresh checks for the new head.


## 2026-10-22 — NameSilo OTE sandbox access received

- **Provider support response:** NameSilo provisioned API-only OTE access at `https://ote.namesilo.com/api`; sandbox data is separate from real registry state. The provider recommends testing only `.com` and `.net` domains for consistent results. Only `NS1.NAMESILO.COM` through `NS8.NAMESILO.COM` are supported for sandbox nameserver changes. Sandbox transactional operations use sandbox account funds or a payment ID; do not assume those funds or results apply to production.
- **Implementation change:** Added an explicit `namesilo-sandbox` provider mode and a configuration resolver that pairs the OTE URL exclusively with `NAMESILO_SANDBOX_API_KEY`. Existing `namesilo` mode continues to pair the production URL with `NAMESILO_API_KEY`. The public provider adapter remains read-only availability-only. A separate internal OTE operations client provides sandbox-only domain-info, registration, renewal, transfer, and nameserver methods; it is not selected by the normal provider factory or exposed to customer routes. Live registration and payments remain disabled.
- **Regression tests:** Added tests for live/sandbox endpoint and secret isolation and fail-closed behavior when the selected environment's key is missing. Added them to `npm run test:domains`.
- **Safety:** Do not put credentials in Git, source code, client-visible variables, logs, or chat. Configure DOMAIN_PROVIDER_MODE=namesilo-sandbox and NAMESILO_SANDBOX_API_KEY in Preview. Test only .com/.net domains. No mutation was performed by the successful smoke test.
- **Verification for implementation commit 7a1fbb0:** [push CI passed](https://github.com/Mapalochisha/Hembox.io/actions/runs/39827395544); [Vercel Preview completed](https://vercel.com/mapalochishas-projects/hembox-io/9u1PUqLbnT3LNx8beh32pMmqLLEn).
- **Sandbox operation boundary:** A separate server-only OTE operations client now defines getDomainInfo, registration, renewal, inbound transfer and nameserver calls. It is not wired to customer-facing routes. Every mutation requires an explicit OTE_ONLY confirmation token; registration preflights OTE availability, renew/nameserver operations require domain info confirming the domain is in the sandbox account, and ambiguous/network outcomes require reconciliation before retry. NameSilo registration/transfer codes 301/302 are treated as success-with-warning according to documented fallback behavior. No state-changing API request has been sent.


## 2026-10-22 — First authenticated NameSilo OTE request and sandbox lifecycle tools

- **Smoke test verified:** The deployed Preview accepted POST /api/domains/search and returned provider namesilo, environment test, live false, and a NameSilo OTE response for example.com (reported unavailable in the sandbox). This proves the selected sandbox mode, API key, endpoint and availability response parser are communicating. It does not verify real registry status or live credentials.
- **Sandbox tool:** Added a server-only OTE operation client for domain info, registration, renewal, inbound transfer and nameserver changes. It hard-pins the OTE hostname and NAMESILO_SANDBOX_API_KEY, requires DOMAIN_PROVIDER_MODE=namesilo-sandbox, validates test domains to .com/.net, and only accepts the sandbox's supported NameSilo nameservers.
- **Transactional safety:** Every mutation requires an explicit OTE_ONLY confirmation token. Registration first checks that OTE explicitly reports the domain available; renewal and nameserver updates require domain info confirming the domain is in the sandbox account. Ambiguous network outcomes must be reconciled before retry. Documented registration/transfer response codes 301/302 are treated as successful-with-warning rather than failure. The tool is not wired to public/customer API routes and has not been used to mutate the sandbox.
- **Verification:** The lifecycle implementation at `1ee6e481594e8fa915de69b63e7160270ecf7f6e` passed [CI](https://github.com/Mapalochisha/Hembox.io/actions/runs/39832810821) and [Vercel Preview](https://vercel.com/mapalochishas-projects/hembox-io/9gcgaDpiHoJMmX8jxbNosnwhMuup). The local OTE CLI and response-diagnostics follow-ups are recorded below. No sandbox domain has been registered/reserved, renewed, transferred or modified; no sandbox funds have been spent.


## 2026-10-22 — Local OTE lifecycle CLI and API response hardening

- Added `npm run namesilo:ote -- <command>` with read-only `info` and `availability` commands. Registration, renewal and nameserver commands require `--confirm-ote-only`; the CLI intentionally omits transfer so an EPP authorization code is never passed through command-line arguments.
- Added `docs/namesilo-sandbox-testing.md`, covering local ignored `.env.local` setup, read-only tests, mutation warnings, and the reconciliation rules.
- Updated domain-info parsing to match NameSilo's API behavior: a successful `getDomainInfo` response identifies the query in the request and may omit an echoed domain property. A returned mismatched domain still remains unknown. Added tests using the documented response shape.
- Updated mutation classification for NameSilo's documented error codes and restricted renewal and nameserver changes to domains OTE explicitly reports as active. NameSilo warns `renewDomain` can restore a domain during its restoration period; this tool blocks expired/processing domains instead of risking an unexpected restoration charge.
- The CLI and client remain separate from public/customer routes. No registration, renewal, transfer, nameserver change, payment, or sandbox-fund spend has been performed.
- **Verification:** CLI commit `f699afc54111261bd09e023b3fcaad601b490ee7` passed [CI](https://github.com/Mapalochisha/Hembox.io/actions/runs/39833284375) and [Vercel Preview](https://vercel.com/mapalochishas-projects/hembox-io/BiV2FWXVdSKBHmYzH8qqMNAR8eST). Response-diagnostics commit `dc7bcd5a588c20bee99ad2538c1a7331f9acd70e` passed [CI](https://github.com/Mapalochisha/Hembox.io/actions/runs/39833837149) and [Vercel Preview](https://vercel.com/mapalochishas-projects/hembox-io/72YgjAYFNv4yR1b9TaarKS4t7wXU). Both runs passed lint/type-check, schema integration, and production build. No OTE mutation was performed.


## 2026-10-22 — Vercel-first OTE diagnostics and batch parser fix

- **Batch response issue:** the OTE CLI returned code 300 for a request covering `example.com` and `example.net`, but classified both as `unknown`. The parser only handled a nested `{ domain: ... }` bucket. It now also supports arrays of domain records, plain string arrays, and the `$t` / `#text` XML-to-JSON forms.
- **Conservative classification:** explicit invalid names and domains present in both available/unavailable buckets remain `unknown`. A provider code of 300 alone is insufficient to claim availability.
- **Response diagnostics:** preserve sanitized, bounded provider `detail` text with unknown response codes (including 114), rather than guessing their meaning.
- **Vercel-first test path:** added `GET /api/domains/provider-diagnostic?domain=...`, which performs only a read-only NameSilo OTE domain-info lookup. It is gated to Vercel Preview with `DOMAIN_PROVIDER_MODE=namesilo-sandbox`, requires Preview deployment protection, and returns normalized fields only. It cannot run in production or perform state-changing operations.
- **Safety:** no production settings changed, no API key committed, no domain registered or modified, and no sandbox funds spent.
- **Verification for code commit `9082193ac8f9030ad08abc9bb363731b9387a7cb`:** [GitHub Actions CI passed](https://github.com/Mapalochisha/Hembox.io/actions/runs/39842061172), including lint/type-check, domain-provider and sandbox tests, disposable database-schema tests, and production build. [Vercel Preview completed successfully](https://vercel.com/mapalochishas-projects/hembox-io/2wiFKDBzPfACEmQQUm9fqCbxFH1s). The post-fix live OTE batch request has not been rerun yet; use `vercel curl` against the latest Preview so no local npm run is needed.

## 2026-10-22 — Classify NameSilo OTE transport failures

- **Observed result:** the protected Preview's read-only `getDomainInfo` diagnostic returned NameSilo code 114 with provider detail `Invalid Domain Syntax` for `example.com`. For `namesilo.com`, it returned no provider code and the adapter only reported a generic request failure/timeout. This does not yet establish the underlying OTE cause.
- **Diagnostic improvement:** the sandbox adapter now distinguishes non-2xx HTTP responses (including the HTTP status), timeouts, network failures, and invalid JSON. It does not expose authenticated URLs, API keys, response bodies, or raw exception text.
- **Regression coverage:** added tests for HTTP 403, timeout, network failure, and invalid JSON response handling.
- **Verification for code commit `1983357753b90e63f5866f021989246aed3bd979`:** [GitHub Actions CI passed](https://github.com/Mapalochisha/Hembox.io/actions/runs/39850379018), including Domain schema integration tests, Lint & Type Check, and Production Build. [Vercel Preview check passed](https://vercel.com/mapalochishas-projects/hembox-io/6kv7NNLNDriW7D62UFmo2A87KMnx).
- **Next verification:** rerun the protected Preview's `GET /api/domains/provider-diagnostic?domain=namesilo.com` on the latest deployment and inspect the now-specific failure message. The provider-level cause remains unresolved. No live API operations, registrations, renewals, transfers, nameserver changes, payments, or OTE fund spends have been performed.

## 2026-10-22 — Interpreting the HTTP 400 from the namesilo.com test

- The latest read-only Preview request for `namesilo.com` returned `HTTP 400` before a structured NameSilo reply was available.
- NameSilo's official API reference confirms API calls use GET with the operation in the path and `version`, `type`, and `key` query parameters ([official API reference](https://www.namesilo.com/api-reference)). The HEMBOX request follows that documented shape. The official static page does not explain this specific OTE HTTP 400.
- **Important test caveat:** a third-party Raycast NameSilo client documents that querying `namesilo.com` as a domain parameter almost always errors, which makes this a poor diagnostic sample. This is a third-party observation, not an official NameSilo guarantee ([reported behavior](https://www.raycast.com/xmok/namesilo)).
- The HTTP 400 therefore does not establish a general OTE transport or API-key problem. Use a different syntactically normal domain, such as `github.com`, for one more read-only domain-info request; because the OTE account has no confirmed registered test domain, the expected useful result may simply be a structured provider error indicating that the domain is not in the account. Do not register a domain just to complete this diagnostic without separately reviewing the sandbox reservation/funding implications.
- No API code changed for this observation. Live registration remains disabled; no state-changing OTE call or payment was performed.

## 2026-10-22 — OTE `getDomainInfo` diagnosed as an account-scope question

- **Correction to the investigation framing:** NameSilo documents `getDomainInfo` as returning information for "a domain within your account". Both test names were public names never registered in the OTE account, so neither could produce a successful `300` reply. The outstanding question is why two out-of-account lookups fail differently, not why the integration fails. A read-only account probe is the correct connectivity test; `getDomainInfo` is not.
- **Analysis:** Added `docs/namesilo-ote-investigation.md` with the verified/not-verified evidence table, ranked explanations (account scope; reserved example names; provider-specific rejection of `namesilo.com`; auth ruled out because the same key returned `300` for availability), a decisive test sequence, an interpretation table, and questions for NameSilo support.
- **Diagnostics:** Non-2xx OTE responses now include the HTTP status plus a sanitized provider `code`/`detail` when the body is JSON or XML, and the response `content-type`/`server`. HTML error pages are never mined for codes, and raw bodies are never returned or logged. This should classify the `namesilo.com` HTTP `400` on the next Preview run.
- **Read-only account probes:** Added `getAccountBalance` and `listDomains` to the OTE-only operations client. They never reference a domain and cannot mutate state. `GET /api/domains/provider-diagnostic?scope=account` returns the balance result and the sandbox account's domain names (capped at 200); the existing `?domain=...` mode is unchanged. The CLI gains `npm run namesilo:ote -- account` and `... -- list`.
- **Regression coverage:** Added tests for JSON, XML and HTML error bodies, accounted balance parsing/rejection, and domain listing across JSON and XML-to-JSON shapes, including the empty-vs-failed distinction.
- **Verification:** `npm run test:domains`, `npx tsc --noEmit` and `npm run lint` pass locally on this revision (lint reports only the pre-existing image/effect warnings). CI and Vercel checks must be re-read for the pushed head before treating the revision as green.
- **Next verification:** On the protected Preview, run `?scope=account` first. If the balance returns `300` and the domain list is empty, stop expecting a successful `getDomainInfo` until a sandbox domain exists; if a domain is listed, query that exact domain. Do not register a sandbox domain solely to make a diagnostic pass, and do not repeat the `namesilo.com` sample.
- **Safety:** No live API call, registration, renewal, transfer, nameserver change, payment or OTE fund spend. M2 remains incomplete until a `300` domain-info result for an account-listed domain exists, or NameSilo confirms the out-of-account contract and accepts the account probes as readiness evidence.

### 2026-10-23 — NameSilo OTE smoke tests and balance-field diagnosis

- **Verified read-only results:** account-balance and domain-list operations both returned provider code 300; the domain list was empty. A github.com domain-info query returned the documented account-scope code 200.
- **Availability endpoint:** tested reserved examples, an existing public domain, and a unique probe name. OTE returned both available and unavailable classifications through HEMBOX, with environment=test, live=false, and no fabricated prices. This verifies response parsing only; it does not establish live registry availability.
- **Balance follow-up:** OTE returned a successful reply with a string-valued balance field that did not match the expected decimal format. A safe classification is being added to identify its format without returning the balance value.
- **Regression fix:** corrected an over-escaped decimal regex discovered by CI; the string-value unit test covers this case. CI passed for commit ef0dea07e47bf137cd89e2f9af1698295ec43817.
- **Release status unchanged:** NameSilo prices/funding, live availability, registration, payment and production launch remain unverified or disabled. No provider mutations or fund spends were performed.



### 2026-10-23 — NameSilo OTE grouped balance response

- The protected Preview returned provider code 300 for the account-balance request, but the safe response-shape classifier identified the string as `grouped-decimal`. The actual account balance was not exposed in diagnostics.
- Updated the NameSilo parser to normalize only strict thousands-grouped decimal strings, without using floating-point conversion; malformed grouping remains rejected. Added tests for valid normalization and malformed-group rejection/privacy.
- This affects only the read-only OTE account probe. No credentials/configuration changed and no sandbox mutation or funds spend occurred.
- Implementation verification: inspect CI and Preview checks for the final branch head before considering this parser adjustment verified.
