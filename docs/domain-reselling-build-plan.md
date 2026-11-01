# Hembox Tech Domain Reselling — Build Plan & Progress Record

> **Purpose:** This is the canonical handoff document for the domain-reselling project. Read it before continuing implementation after a context switch. Update this file as milestones are completed, decisions change, or verification results become available.
>
> **Last updated:** 2026-11-01 (assessment, M6 + M4 merged to `main`, production migration reconciliation, sandbox pricing path, deployment policy restored). Full session handover: [`arena-ai-handover.md`](./arena-ai-handover.md). Production configuration procedure: [`vercel-reconfiguration.md`](./vercel-reconfiguration.md).
> **Repository:** `Mapalochisha/Hembox.io`  
> **Historical implementation branch:** `feature/domain-reselling-platform`  
> **Pull request:** https://github.com/Mapalochisha/Hembox.io/pull/2  
> **Related technical roadmap:** [domain-reselling-roadmap.md](./domain-reselling-roadmap.md)

## 1. Product objective

Build a reliable, self-service domain-reselling product within Hembox Tech. Customers must be able to discover domains, understand the registration and renewal costs, pay securely, register domains, and manage supported domain settings without being required to buy Hembox Tech web-development services.

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

## 3.1 Fresh technical assessment — 2026-11-01 (current `main`)

This section supersedes the older "recorded baseline" above where they disagree. It was produced by reading the current tree, migrations, CI configuration and GitHub state, not by trusting earlier progress entries.

### Verified repository and CI state

| Item | Verified state |
|---|---|
| Branch head reviewed | `main` @ `663fd27edb112391f10503a20d7a9e520e845e7c` |
| Push CI on that head | **Green** — [run 41300880941](https://github.com/Mapalochisha/Hembox.io/actions/runs/41300880941) (Lint & Type Check, Domain schema integration tests, Production Build) |
| Pull-request CI on the cleanup branch | Green — run 41287246324 |
| Vercel Git deployments | The owner lifted the abuse block on 2026-11-01. `vercel.json` now enables Git deployments for `main` only (previews stay off), so merges to `main` deploy automatically; other branches still build in CI only. |
| Open pull requests | None open (PRs #1–#14 all merged or closed) |
| Historical feature branches | Still exist remotely but are stale copies of already-merged work. See "reusable work" below. |
| Production Supabase migrations | **Correction to earlier entries: the 20 pre-existing domain/billing migrations were already applied to production** (versions dated 2026-10-24 → 2026-10-26). Both migrations introduced on 2026-11-01 are applied to production with the owner's authorization. `domain_fulfilment_payment_evidence` applied in one step. `domain_registrant_details` first failed with HTTP 502 from the Supabase Management API; when the API recovered it was confirmed absent (no partial state) and applied as three smaller migrations — `domain_registrant_details_table`, `domain_registrant_details_save_function`, `domain_manual_registration_requires_registrant`. Verified in production afterwards: table present, RLS on, 2 policies, both functions present, `record_domain_manual_registration` reference the registrant table, `anon`/`authenticated` cannot execute either function and `service_role` can. |

### What is genuinely complete

- **Provider abstraction and fail-closed selection** — `src/lib/domains/provider.ts`, `providers/mock.ts`, `providers/namesilo.ts`, explicit `namesilo-sandbox` vs `namesilo` modes, server-only credentials (`NAMESILO_API_KEY`, `NAMESILO_SANDBOX_API_KEY`), no `NEXT_PUBLIC_` registrar keys.
- **NameSilo read-only adapter** — availability parsing (nested/array/XML-to-JSON fixtures), `getAccountBalance`, `listDomains`, `getPrices` reader normalising to integer USD minor units, refusal of malformed responses, OTE operations client confined to a local CLI and a protected diagnostic route.
- **Pricing policy** — integer minor-unit math, explicit FX scaling (`micros`), basis-point markup, upward ZMW rounding, 24-hour freshness gate, price-history table, retail-vs-wholesale separation, public retail-only catalogue endpoint, admin catalogue with server-side recomputation.
- **Quote creation** — authenticated `POST /api/domains/quotes`: catalog validation, recomputation of retail from stored wholesale/FX/markup, 60-second availability-evidence freshness, 15-minute quote validity, user-scoped idempotency key, atomic `create_domain_quote_order` RPC, billing-invoice bridge, replay recovery.
- **Order lifecycle integrity** — order-state helper plus database transition guards, transactional audit events, payment-attempt invariant guards, webhook replay ledger with signature-verification guards (all schema-level; no gateway is enabled).
- **Customer dashboard** — `/portal/domains` (order list, quote request, payment status, claim status) with owner-scoped reads through RLS; `/profile/domains` redirects there.
- **Admin surfaces** — `/admin/domains` (catalogue/pricing), `/admin/domains/orders` (queue + audit), `/admin/domains/manual-payments`, `/admin/domains/recovery`, `/admin/domains/margins`, `/admin/domains/provider-prices`, plus `/admin/billing/*` for the unified ledger.
- **Unified billing ledger** — invoices, items, immutable events, payment claims with private receipt storage, allocations, arrangements, invoice void, and the domain↔billing bridge (`create_domain_billing_invoice`, paid-invoice→order advance).
- **CI** — lint, `tsc`, domain unit tests, disposable PostgreSQL migration + access-control assertions, production build.

### What is partially implemented

| Area | Current reality | Remaining work |
|---|---|---|
| M1 commercial verification | NameSilo selected; OTE connection verified | Production API key, Zambia funding route, live `getPrices`, real TLD economics — **blocked on business/credentials** |
| M3 catalogue | Working machinery, safe by default | No TLD is enabled. Needs approved FX source + markup + verified registration/renewal costs |
| M4 checkout | Quote + durable order + billing invoice exist, and registrant details/consent are now captured and enforced before payment and before registration (see the 2026-11-01 M4 entry) | A dedicated review/confirmation screen, multi-year terms, and a final pre-purchase recheck UI |
| M5 manual payments | Bills claim → admin verify → allocation → invoice paid → order `payment_confirmed` works and is tested; mobile-money methods active, bank transfer intentionally inactive | Operational E2E with real accounts (requires owner authorization), reconciliation cadence |
| M6 manual fulfilment | Guarded, audited RPC; admin route | Was unreachable (see defects). Registrar-console procedure/runbook still needs documenting |
| M7 dashboard | Orders, prices, claim status visible | Renewal reminders, notifications, support paths |
| M8 ops console | Queue, audit, claims, recovery, margins | Payment/provider reconciliation views, refunds, failed-order handling |
| M10 security/QA | RLS + guards reviewed in migrations | No rate limiting anywhere, no authenticated E2E, no alerting/runbooks |

### What is missing

- A dedicated checkout review screen (the current flow collects registrant details and consent, and the billing claim endpoint refuses payment until they exist, but there is no single confirm-everything review page).
- Renewals, reminders, DNS/nameserver management, transfer/lock/privacy (M9) — nothing customer-facing exists, correctly.
- Rate limiting/abuse controls, operational alerts, backup/rollback runbooks, authenticated customer/admin end-to-end tests.
- Verified production provider economics (external dependency).

### Defects found during this assessment (both fixed in this session)

1. **Manual fulfilment was unreachable for every real paid order.** Every live quote creates a unified billing invoice, and the `manual-payment` API deliberately redirects those orders to Bills, so no legacy `domain_manual_payment_claims` row is ever created for the real flow. `record_domain_manual_registration()` nevertheless required a verified legacy claim, so an order paid through Bills reached `payment_confirmed` and could never be recorded as registered. Fixed by reconciling the payment-evidence rule with the ledger.
2. **The admin fulfilment form could not be opened.** `/admin/domains/orders` rendered an "Action" column with no control that set the fulfilment order, so the form was dead code; the page also rendered a literal `\n` and described itself as read-only. Fixed with a payment-signal-aware action column and corrected copy.

### Reusable work from historical branches

- `feat/domain-pricing-policy`: **already fully merged** — `git diff origin/feat/domain-pricing-policy origin/main -- src/lib/domains src/app/api/admin/domains src/app/admin/domains src/app/api/domains supabase/migrations` is empty for the domain paths. Nothing further to port.
- `feature/domain-reselling-platform`, `feature/unified-billing-platform`, `feature/client-portal-workspace`, `rebrand/hembox-tech`: content already on `main` via PRs #2, #7, #10, #11. Their remaining "ahead" commits are pre-squash history; **do not merge them wholesale**.
- `docs/client-portal-blueprint`, `preview/performance-optimization`, `arena/ceace407-hembox-io`: no domain implementation to reuse.

### Safest next milestone

Order of work that needs no external credentials:

1. **M6 payment-evidence reconciliation** (done in this session) — makes the existing paid→fulfil path actually usable and tested.
2. **M4 registrant/checkout review** — prerequisite for a real registration to be completable at all.
3. **M7/M8 operational completeness** (renewal dates visible to admins, reconciliation view, refunds policy).
4. **M10 hardening** — rate limiting, authenticated E2E, runbooks.
5. **M1/M3 commercial verification** — requires the owner's production credentials and pricing decisions.


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

**Decision (updated 2026-10-20): NameSilo is the selected initial provider.** Domain Name API is retired from the active provider path because its OT&E access/contract troubleshooting was blocking progress. NameSilo documents a free API and private-label reseller options; however, its Discount Program requires account funds and the documented top-up minimum is $50, so the funding economics still need to be confirmed for Hembox Tech. NameSilo API documentation: [API reference](https://www.namesilo.com/api-reference), [reseller options](https://www.namesilo.com/support/v2/articles/about/reseller-options), [API Manager](https://www.namesilo.com/support/v2/articles/account-options/api-manager), and [reseller FAQ](https://www.namesilo.com/support/v2/articles/domain-manager/reseller-frequently-asked). Sandbox credentials must be requested from NameSilo support before any state-changing operation is tested. The application-facing NameSilo adapter remains read-only availability only; live registration and prices remain disabled. NameSilo support provisioned an API-only OTE sandbox at `https://ote.namesilo.com/api`. The first authenticated Preview smoke test succeeded on 2026-10-22: POST /api/domains/search for example.com returned provider namesilo, environment test, and live=false; OTE reported unavailable. That status is sandbox-only, not real registry truth. Use .com or .net for tests and only the supported NS1.NAMESILO.COM through NS8.NAMESILO.COM nameservers. Sandbox credentials remain separate from NAMESILO_API_KEY.

**Current verification status (2026-10-23):** The authenticated NameSilo OTE key/endpoint is now verified for read-only account probes: `getAccountBalance` and `listDomains` both returned provider code 300; the availability endpoint returned normalized OTE results; and a grouped-decimal balance response was normalized successfully. This confirms the sandbox connection and those response parsers, **not** live credentials, live registry availability, or production pricing. The OTE account currently has no active domains, so a successful `getDomainInfo` response for a domain inside the account has not been tested. Account funding/payment options from Zambia, actual registration/renewal prices, and production readiness remain unverified.

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

**Current status:** The OTE credential and read-only account/API connection test is complete. The decision gate recorded in [`namesilo-ote-investigation.md`](./namesilo-ote-investigation.md) remains open only for the account-scoped `getDomainInfo` contract: the sandbox domain list is empty, and we will not register a test domain just to satisfy diagnostics. Continue provider-independent work in parallel; do not enable live registration or claim live availability/pricing.

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

**Implementation progress (2026-11-01):** Quote creation, durable orders, atomic idempotent persistence, price/availability evidence freshness and the billing-invoice bridge are implemented and tested. Registrant data capture is now implemented: `domain_order_registrant_details` (owner-scoped RLS, server-side-only writes through `save_domain_order_registrant_details`, consent version recorded, personal data deliberately excluded from audit events), `POST/GET /api/domains/orders/registrant`, the customer panel in `/portal/domains`, an admin-only reader for the registrar console work, and two enforcement points — the unified billing claim endpoint refuses a domain payment claim until details exist, and `record_domain_manual_registration()` refuses to record a registration without them. Still missing: a single combined review/confirmation page, multi-year terms and a final pre-purchase recheck UI.

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

### [ ] M5 — Manual payment workflow (initial launch)

**Decision (2026-10-23):** Defer payment-gateway integration until Hembox Tech can fund a custom domain and complete the provider's onboarding requirements. This is a planned deferral, not a claim that payment-gateway work is complete. Keep the gateway visibly deferred in the plan and do not make it a blocker for the initial manual-payment release.

**Scope**
- Provide customer-facing instructions for manual payment and a unique order/payment reference.
- Allow customers to submit a transaction reference and optional note; do not store receipt uploads in the initial release. A reference is a claim, not proof of settled funds.
- Add an administrator-only review queue to mark a claim as verified, rejected, or needing more information.
- Record reviewer, timestamp, decision, reason, and immutable audit events; make repeated submissions and repeated decisions idempotent.
- Keep order state separate from payment-claim state. Only an authorized admin can mark manual payment as verified after checking the actual receiving account/transaction.
- Require a fresh availability and price check before any registration action; never register based only on a submitted receipt.
- Clearly disclose manual processing times and a support path. Do not collect payment-card credentials or unnecessary personal data.

**Acceptance criteria**
- Unverified customer claims cannot transition an order to paid/eligible-for-registration.
- Only authorized admins can verify/reject claims, with audit history.
- Duplicate submissions and repeated review actions cannot create duplicate payment confirmations.
- The initial workflow stores only the transaction reference and optional note; no receipt files are uploaded or served.
- Automated tests cover ownership, admin authorization, idempotency, state transitions, and audit records.

**Deferred gateway scope — greyed out and excluded from the initial release**
- ~~Payment gateway selection/onboarding, hosted checkout, gateway API calls, signed webhooks, gateway event replay protection, and gateway settlement reconciliation.~~
- ~~Do not implement or enable this until a custom domain and required gateway onboarding can be funded.~~ Keep the gateway disabled and clearly labelled as deferred; do not create placeholder secrets or imply the integration is operational.

### [ ] M6 — Registration and provisioning

**Scope**
- Initial release: an administrator completes registration in the registrar's own console after verified manual payment and a fresh availability/final-price check, then records the actual registrar references and dates through the guarded, audited manual-fulfillment action. Hembox Tech must not claim to have registered a domain based only on a payment claim.
- The manual fulfillment action does not call the registrar and only accepts payment-confirmed orders with a verified manual-payment claim.
- Automated registrar registration, durable provisioning jobs, provider mutation idempotency, and ambiguous API-timeout recovery remain deferred until state-changing provider operations are verified in a safe environment.
- Persist real provider references and registration/expiry information; keep failed or ambiguous outcomes in manual review rather than blindly retrying.

**Implementation progress (2026-11-01):** `record_domain_manual_registration()` previously required a verified legacy `domain_manual_payment_claims` row. Because every live quote is billed through the unified ledger and legacy claims are redirected to Bills, no paid order could ever satisfy that guard, making manual fulfilment unreachable. Migration `20261101090000_domain_fulfilment_payment_evidence.sql` now accepts either a verified legacy claim **or** the order's fully settled, correctly linked unified billing invoice, records the evidence source in the audit event, and keeps every other guard (admin-only, `payment_confirmed`, provider/domain match, availability + price recheck, idempotent replay). The admin queue now exposes the fulfilment action and shows invoice settlement state.

**Acceptance criteria**
- Manual payment-to-manual-fulfillment workflow passes authorization, state, amount, quote-validity, and audit tests.
- The manual fulfillment record is idempotent and cannot create duplicate registration records.
- Automated registrar mutation is not enabled until provider sandbox coverage and ambiguous-outcome recovery are verified.

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

**Implementation progress (2026-11-01):** The order queue now shows read-only billing settlement state per order and offers the guarded manual-fulfilment action only for `payment_confirmed` orders. The earlier claim that the queue was "read-only with no actions" is obsolete.

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


> **Brand note (2026-10-29):** Current company name is Hembox Tech. Historical progress entries retain the brand name, repository paths, and URLs that were accurate when recorded. Cloudinary asset folders, domain-provider configuration, and existing technical identifiers are not renamed as part of the brand-copy phase.

## 6. Progress log

### 2026-11-01 (later still) — Handover docs and price-reference → catalogue handoff

- Added [`arena-ai-handover.md`](./arena-ai-handover.md) and [`vercel-reconfiguration.md`](./vercel-reconfiguration.md).
- Implemented the handoff that closes the gap between "verified cost exists" and "cost entered correctly": the wholesale price reference now offers **Use in catalogue** per TLD, and the catalogue form validates and prefills the cost plus its provenance. It cannot enable a TLD and deliberately supplies no FX rate and no markup, because those are owner decisions. The requirement-2 values are therefore carried with the environment and retrieval timestamp attached to the price row, and the provenance is recorded in `pricing_source` as `namesilo-standard:<environment>:<retrievedAt>`.
- `src/lib/domains/admin-catalogue-prefill.ts` holds the validation as a pure function (rejects unknown environment/provider/currency, non-integer, zero, negative or absurd costs, unsafe TLDs and unusable timestamps; accepts second-level ccTLDs). Covered by `tests/admin-catalogue-prefill.test.mjs`, 6 assertions, wired into `npm run test:domains` (78 total).

### 2026-11-01 (later) — Registrant migration applied to production; live deployment verified

- **Production migration complete.** PR #16 merged to `main` at `21a2e70`. Once the Supabase Management API recovered, the pending registrant-details migration was confirmed absent and applied in three idempotent steps, then verified in production: table `domain_order_registrant_details` present with RLS enabled and two read policies (owner, admin), `save_domain_order_registrant_details()` present, and `record_domain_manual_registration()` is the version that requires registrant details before any registration can be recorded.
- **Privilege defect found and fixed.** The first application revoked the save function from `anon` and `authenticated` but not from `PUBLIC`, so both roles could still execute it through the default grant. Production was corrected to revoke from `PUBLIC`, and `supabase/tests/domain_registrant_details.test.sql` now asserts that neither function is executable by `anon` or `authenticated` and that both are executable by `service_role`, so this cannot regress.
- **Deployments confirmed live.** Automatic Git deployments are working again: a preview deployment for `25b8a85` and a production deployment for the merge commit `21a2e70` both succeeded. `https://hembox.tech/api/domains/catalog` responds with an empty catalogue (no TLD enabled — still by design) and `https://hembox.tech/domains` continues to state that no TLD prices are published yet.
- **Still unverified on the live site:** the admin price reader and the customer registrant form need an authenticated session, so they have not been exercised against production. That verification requires signing in as the owner — the next step before recording any TLD.

### 2026-11-01 — Merged to main, production migrations reconciled, sandbox pricing path enabled

- **Merged:** PR #15 (fulfilment payment evidence, registrant capture, fail-closed registrant gate) merged to `main` at `27ae938` with the owner's authorization.
- **Production Supabase — important correction:** production already had all 20 earlier domain/billing migrations applied (2026-10-24 → 2026-10-26); earlier entries claiming "no production migration applied" were wrong. With the owner's authorization the new `domain_fulfilment_payment_evidence` migration was applied successfully. The `domain_registrant_details` migration could **not** be applied: the Supabase Management API returned HTTP 502 for every request in this session (including read-only calls). Retry it before exercising domain payments on production.
- **Sandbox-first pricing:** `getNameSiloStandardPrices()` previously forced the production endpoint and `NAMESILO_API_KEY`, so the commercial flow could not be rehearsed without a production key. It now follows `DOMAIN_PROVIDER_MODE` (`namesilo-sandbox` → OTE host + `NAMESILO_SANDBOX_API_KEY`, `namesilo` → production host + `NAMESILO_API_KEY`) and fails closed when NameSilo is not the configured provider. The admin price reader reports the environment and shows a sandbox warning; no TLD is enabled and nothing is persisted by the retrieval.
- **Deployment policy:** `vercel.json` now enables Git deployments for `main` only, matching the owner's decision to re-enable deployments without exposing every branch to automatic builds.
- **New operational documentation:** [`domain-pricing-inputs.md`](./domain-pricing-inputs.md) is the step-by-step procedure for obtaining verified registration/renewal costs, an approved FX source and rate, and an approved markup, then entering and enabling TLDs — including the `.zm` provider reality check and the sandbox caveat.
- **Tests:** `tsc --noEmit` clean; `npm run lint` no errors; NameSilo price-reader tests extended to 7 assertions covering sandbox/live host and credential separation, disabled-provider refusal and mode resolution.
- **Safety:** no production NameSilo key was used, no registrar mutation, no real payment, no TLD enabled, and no customer-facing price published.
- **Next action:** apply the pending `domain_registrant_details` migration, then retrieve and record verified prices per the playbook.


### 2026-11-01 — Registrant payment gate corrected to fail closed

- **Milestone:** M4/M5 (pre-payment registrant enforcement).
- **Defect:** the first version of the domain registrant gate returned `unavailable` when the registrant migration or table was missing, and the payment-claim endpoints only rejected the `missing` result. A domain payment claim could therefore be submitted while registrant verification was impossible — a fail-open path in exactly the check that protects a legal registrant requirement.
- **Fix:** the allow rule now lives in one pure function, `decideDomainRegistrantGate()` in `src/lib/domains/registrant-gate.ts`, and **only an explicit `ok` allows a claim**. `missing` denies with `409 registrant_details_required`; `unavailable` (missing migration/table, lookup error, unexpected value) denies with `503 registrant_details_unavailable`. The gate helper no longer throws on an unexpected database error — it logs a sanitised code and returns `unavailable`, so both claim submission and claim resubmission are blocked consistently.
- **Regression coverage:** `tests/domain-registrant-gate.test.mjs` asserts that `unavailable` and unexpected values (including `null`, `undefined`, `"OK"`, objects) deny, wired into `npm run test:domains`. A negative control (temporarily restoring the fail-open branch) fails two assertions, confirming the test catches the original bug.
- **Customer/admin surfaces:** when the gate cannot be evaluated, `/portal/domains` now explains that the domain cannot accept a payment claim instead of silently hiding the registrant panel, and the admin fulfilment panel states the order is blocked.
- **Tests:** `tsc --noEmit` clean; `npm run lint` no errors; `npm run test:domains` 68 unit assertions + 24 sandbox-operation assertions, all passing.
- **Safety:** still no registrar call, gateway, production migration, live registration or real payment.
- **Next action:** M8 reconciliation completeness, then M10 hardening; commercial verification still requires the owner's production credentials and pricing decisions.


### 2026-11-01 — M4 registrant capture, consent and checkout enforcement

- **Milestone:** M4 (registrant data / checkout prerequisites), feeding M5 and M6.
- **Why:** a registrar registration legally requires registrant contact details, and the platform captured none, so an administrator could not complete a real registration at all and no consent to share personal data with the registrar was recorded.
- **Changes:**
  - `supabase/migrations/20261101110000_domain_registrant_details.sql` — new `domain_order_registrant_details` table (one row per order, owner-scoped RLS read, admin read, writes only through `save_domain_order_registrant_details()`), validation constraints, consent version/acceptance timestamps, personal-data-minimised audit events (`domain_order.registrant_details_added` / `_updated`), and a redefinition of `record_domain_manual_registration()` that refuses to record a registration without registrant details. Editing is blocked once registration has started so the recorded registrant remains the legal record.
  - `src/app/api/domains/orders/registrant/route.ts` — authenticated owner-scoped save/read with strict validation, international phone normalisation, a server-pinned consent version, and safe degradation when the migration is absent.
  - `src/app/api/domains/orders/route.ts` — the dashboard payload now includes the customer's registrant details.
  - `src/app/portal/domains/page.tsx` — registrant panel per order: saved summary, add/update form, explicit consent checkbox, locked state after registration starts.
  - `src/app/api/billing/claims/route.ts` — a domain invoice payment claim is refused with `registrant_details_required` until registrant details exist (resubmission path included). Environments without the migration fall back to a logged warning; the fulfilment guard remains authoritative.
  - `src/app/api/admin/domains/orders/registrant/route.ts` + `src/app/admin/domains/orders/page.tsx` — admin-only single-order registrant reader surfaced inside the manual-fulfilment panel, with an explicit warning that fulfilment will be refused when details are missing.
  - `supabase/tests/domain_registrant_details.test.sql` (new), `supabase/tests/domain_manual_registration.test.sql` and `supabase/tests/domain_fulfilment_payment_evidence.test.sql` updated; `.github/workflows/ci.yml` applies and asserts the new migration.
- **Tests performed:** `tsc --noEmit` clean; `npm run lint` no errors; `npm run test:domains` 24/24. The complete CI chain (23 migrations + 15 PostgreSQL suites, 38 steps) was applied to a fresh local PostgreSQL 16 database: all pass.
- **CI:** [run 41303848513](https://github.com/Mapalochisha/Hembox.io/actions/runs/41303848513) — all three jobs green on `91e1bc06246f`; the new *Apply domain registrant details migration* and *Assert domain registrant details, consent and fulfilment guard* steps succeeded.
- **Safety:** no registrar call, no gateway, no production migration, no live registration, no real payment. Personal data stays server-side; audit events exclude address and contact values.
- **Next action:** M8 reconciliation completeness, then M10 hardening (rate limiting, authenticated E2E, runbooks); M1/M3 commercial verification still requires the owner's production credentials and pricing decisions.


### 2026-11-01 — Technical reassessment and M6 payment-evidence reconciliation

- **Milestone:** M6 (fulfilment), with assessment input to M4/M5/M8.
- **Assessment:** See section 3.1. `main` @ `663fd27` was green in CI (run 41300880941). Vercel Git deployments are disabled by config, so no deployment for that head was verified. The historical pricing branch has nothing left to port.
- **Defect fixed (critical):** `record_domain_manual_registration()` required a verified legacy domain payment claim, but the real payment path is the unified billing ledger (the legacy claim API redirects paid orders to Bills and never creates such a row). Every genuinely paid order therefore reached `payment_confirmed` and could never be recorded as registered.
- **Changes:**
  - `supabase/migrations/20261101090000_domain_fulfilment_payment_evidence.sql` — redefines the fulfilment RPC to accept settled payment evidence from either a verified legacy claim or the order's linked, fully allocated, paid unified billing invoice. It verifies invoice ownership/customer/currency/source linkage, requires `status = 'paid'` with `paid_at` and allocations covering the total, returns `payment_evidence`, and records the evidence and invoice detail in the immutable audit event. All previous guards are retained, including the availability/price rechecks that can only be asserted by an administrator.
  - `supabase/tests/domain_fulfilment_payment_evidence.test.sql` — new disposable-PostgreSQL assertions covering: quoted/unpaid order rejected; unified-billing-paid order accepted with `unified_billing_invoice` evidence (via the real claim→verify→paid→`payment_confirmed` chain); non-admin rejected; idempotent replay without duplicate audit or registration records; partially paid invoice rejected even when the order was moved to `payment_confirmed`; fulfilment without any payment evidence rejected; legacy verified-claim path still accepted with `domain_manual_claim` evidence.
  - `.github/workflows/ci.yml` — applies the new migration and runs the new assertions.
  - `src/app/api/admin/domains/orders/route.ts` — read-only settlement visibility (billing invoice status/total/paid-at) for the queue, with a safe fallback when the billing bridge columns are absent.
  - `src/app/admin/domains/orders/page.tsx` — the fulfilment form was unreachable because no control ever selected an order; added a per-row "Record registration" action for `payment_confirmed` orders, a payment-status column, corrected copy, and removed a literal `\n` render artefact.
- **Defect reproduced before the fix:** against the pre-fix schema, a domain order paid through the real unified-billing chain reached `payment_confirmed` with zero legacy claims, and `record_domain_manual_registration()` failed with `A verified manual payment claim is required for this release workflow` (SQLSTATE 23514).
- **Tests performed:** `tsc --noEmit` clean; `npm run lint` no errors; `npm run test:domains` 24/24 pass. The complete CI migration chain plus all 15 disposable-PostgreSQL suites (including the new one) were applied to a local PostgreSQL 16 instance: all pass, and a deliberately failing control run confirmed the suite fails loudly. The local production build cannot fetch Google Fonts in this sandbox network, so the build is verified in CI.
- **CI:** [run 41303119901](https://github.com/Mapalochisha/Hembox.io/actions/runs/41303119901) — Lint & Type Check, Domain schema integration tests and Production Build all green on implementation commit `2b4684e62441`; the new *Apply domain fulfilment payment evidence migration* and *Assert fulfilment payment evidence reconciliation* steps both succeeded. [PR #15](https://github.com/Mapalochisha/Hembox.io/pull/15) is open against `main` and has not been merged.
- **Vercel:** not applicable — `vercel.json` disables Git deployments; no manual deployment of this branch was requested, so no deployment for this commit exists. Do not treat any older deployment as evidence for this commit.
- **Database/production impact:** none. Migration is added to the branch only; it has not been applied to any Supabase project.
- **Blockers/risks:** registrant/contact data is still not captured anywhere, so an administrator cannot complete a real registration; pricing inputs and production registrar credentials remain unverified; no rate limiting exists on any domain route.
- **Next action:** M4 checkout review with registrant data capture and an explicit confirmation step, keeping live registration and real payment acceptance disabled.


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
- Implementation commit `b1329b86e38ffab49baaf61bdc1f29df2f186165` passed [GitHub Actions CI](https://github.com/Mapalochisha/Hembox.io/actions/runs/39923512370) (Lint & Type Check, Domain schema integration tests, Production Build); its Vercel Preview check also passed ([deployment](https://vercel.com/mapalochishas-projects/hembox-io/2QSazKr9bwEKniJ2ans16KjRkMrX)). The follow-up progress-document commits have fresh checks pending verification.


### 2026-10-23 — Grouped balance parsing confirmed against OTE

- Re-ran the protected Preview's read-only account probe after the grouped-decimal parser update. It returned provider code 300 and a normalized `balance: "5000.00"`, confirming the parser fix works end to end.
- The amount is sandbox account funds only; it is not production balance or revenue. No funds were spent.
- The same response again reported no active domains. M2's remaining `getDomainInfo` acceptance criterion is unresolved unless NameSilo confirms the out-of-account behavior and accepts the account probes as readiness evidence; do not register a domain merely for diagnosis.
- Evidence: parser/test implementation CI passed at [run 39923512370](https://github.com/Mapalochisha/Hembox.io/actions/runs/39923512370), and the subsequent progress-document head passed [run 39923838731](https://github.com/Mapalochisha/Hembox.io/actions/runs/39923838731), including lint/type-check, schema integration, production build, and Vercel Preview. The documentation update itself must receive fresh checks.


### 2026-10-23 — Atomic live-verified quote foundation (M3/M4)

- Added a server-only quote preparation service that requires live-mode availability capability, a fresh enabled TLD snapshot, matching provider identity, complete wholesale/FX/margin inputs, and retail prices that recompute exactly from those inputs. Unknown, unavailable, mismatched, and stale provider responses cannot produce a quote. The initial endpoint only quotes one-year terms until verified per-term prices exist.
- Added authenticated POST /api/domains/quotes. It will fail closed in mock/test/sandbox mode and returns no quote unless the selected live provider confirms the exact requested domain available. A fresh enabled, consistent catalogue entry is also required. The response explicitly states that checkout and registration remain disabled.
- Added an atomic server-only SQL function that writes a quoted order and immutable quote snapshot in one transaction, serializes duplicate idempotency keys, rejects key reuse for a different domain/customer, and records provider availability plus wholesale/FX/margin inputs for later reconciliation and margin traceability.
- Customers can read quote snapshots only when linked to their own domain order. The creation RPC is executable only by service_role; all quote and order writes remain server-side.
- Added unit and disposable-PostgreSQL regression coverage for live-mode gating, TLD/provider identity, freshness, computed-price consistency, exact-domain availability, immutable quote creation, idempotent replay, mismatched-key rejection, stale evidence and RPC permissions.
- No payment gateway, live registration, customer checkout UI, TLD enablement, production migration or provider mutation was enabled. The OTE account stays read-only. This milestone remains incomplete until commercial cost/funding checks and actual live-provider pricing are verified.
- **Verification:** inspect the final head's GitHub Actions and Vercel checks before considering this increment complete.


### 2026-10-23 — Customer live-quote request surface (M4 continuation)

- Added a signed-in customer quote-request panel to `/profile/domains`, wired to `POST /api/domains/quotes`. It displays registration, annual renewal, total due for the quoted term, expiry, and the provider's availability-check timestamp while explicitly stating that availability is not a reservation and checkout/registration are disabled.
- The client preserves an idempotency key through a failed request so an uncertain response can recover the same saved quote; a successful response clears the key so a deliberate follow-up request can create a new quote. The API still enforces authenticated ownership and requires a live provider plus current, internally consistent catalogue pricing.
- Quote response semantics now say `available_at_check` rather than suggesting availability is guaranteed when a saved quote is replayed.
- Customer order reads use `Cache-Control: no-store` to avoid caching private account data.
- Corrected the admin pricing form's new-entry provider default from the retired Domain Name API to `namesilo`. Existing catalogue entries are not silently rewritten; old cost data must be verified and re-saved against the correct provider before they can support a quote.
- **Safety:** no TLD was enabled, no real payment/checkout/registration enabled, no production migration applied, and no live or OTE mutation performed. The quote endpoint remains fail-closed when live provider/pricing gates are unmet.
- **Verification:** CI and Vercel Preview must be checked for the resulting commit before this increment is treated as complete.

### 2026-10-23 — Provider-independent margin reporting

- Added an administrator-only, no-store margin-report endpoint and a linked admin dashboard.
- The report uses the most recent saved quote snapshots and their captured wholesale costs, FX inputs, and retail prices. It calculates indicative registration and renewal gross-margin estimates separately, flags incomplete snapshots, shows expired/unexpired quote counts, and labels the 500-record sample boundary.
- The report is read-only and does not expose customer contact data, provider secrets, raw webhook payloads, or state-changing controls. It explicitly excludes gateway fees, taxes, refunds, chargebacks, operating costs, and post-quote FX movement; figures are not accounting profit or realized revenue.
- Added the dashboard to admin navigation. The feature remains on `feature/domain-reselling-platform`; no merge, production migration, payment acceptance, or live registration was performed.
- **Verification pending:** final CI and Vercel Preview must pass on the exact latest branch head before this change is considered complete.

### 2026-10-23 — Initial launch will use manual payments; gateway deferred

- **Decision:** Because gateway onboarding requires a custom domain that is not currently affordable, defer gateway integration and mark it as postponed in the plan. This does not waive payment safety requirements.
- **Initial release path:** implement manual payment instructions and order references, customer payment claims, and an admin review/verification workflow with audit history. A receipt or screenshot alone is never proof that funds settled.
- **Registration guard:** a domain must not be registered based solely on a customer claim. Registration remains gated on authorized admin payment verification, fresh availability/pricing, and verified provider registration/recovery behavior.
- **Gateway explicitly deferred:** gateway selection/onboarding, hosted checkout, API integration, signed webhooks and gateway-specific reconciliation are out of scope until a custom domain and required onboarding can be funded. Revisit this milestone later.
- **Launch scope:** continue building provider-independent customer, order, admin, reconciliation, security and staging workflows. Do not enable live payment acceptance or live registration, apply production migrations, or merge without explicit authorization and completed release gates.
- **Verification:** this is a plan/priority decision; the implementation must receive fresh CI and Vercel checks before being treated as complete.

### 2026-10-23 — Manual payment workflow implementation started

- Added a feature-branch migration for manual payment claims, with customer/admin read policies, server-only writes, an active-claim uniqueness guard, immutable claim identity, and an administrator-only transactional review function.
- Added customer API actions to request configured manual payment instructions and submit a transaction reference against the current saved quote. Order ownership is checked server-side; quote expiry and exact amount are enforced. Idempotency and duplicate-active-claim protections are included.
- Added customer dashboard payment instructions/claim status UI, an admin review queue, and an admin review API. Verifying funds requires the signed-in administrator role, a matching saved quote amount, and a claim submitted before quote expiry; it atomically records the review and transitions the order to `payment_confirmed`.
- No receipt upload is collected. Admins must independently verify actual settled funds; a customer-provided transaction reference is not payment evidence by itself.
- Added disposable-PostgreSQL integration assertions for amount mismatch rejection, non-admin rejection, audit history, and successful verification; CI now applies and tests the manual-payment migration.
- Gateway hosted checkout, gateway credentials, signed webhooks and gateway reconciliation remain deferred. The new workflow requires `DOMAIN_MANUAL_PAYMENT_INSTRUCTIONS` to be configured before customers can begin payment. This configuration has not been populated with real receiving-account details.
- **Code verification (commit `55831e75a25368bffaed9d65b3f1e7506819e89c`):** [GitHub Actions CI passed](https://github.com/Mapalochisha/Hembox.io/actions/runs/39985581157) — Domain schema integration tests, Lint & Type Check, and Production Build succeeded. [Vercel Preview is READY](https://vercel.com/mapalochishas-projects/hembox-io/8RgtThLn2QoJ6S1P7PqDrFh2FzoV). The manual-payment release milestone remains incomplete until runtime/staging review and approved receiving-account instructions are configured. No production migration, real payment acceptance, live registration, or merge has been performed.

### 2026-10-23 — Guarded manual registrar fulfillment added

- Added an admin-only database function and API endpoint to record a registration that an administrator has already completed in the registrar's own console. The endpoint does not call NameSilo or initiate a registration.
- The function requires a payment-confirmed order, a verified manual-payment claim, provider identity matching the saved quote, matching domain reference, actual registration/expiry timestamps, and explicit attestations that live availability and final price were rechecked.
- It transitions the order through the allowed registration lifecycle, stores the actual provider references/dates, writes an audit event, and treats an exact replay as idempotent.
- Added an admin order-queue form and disposable-PostgreSQL tests for precondition rejection, successful fulfillment, audit history, and replay safety.
- **Automated registrar registration remains deferred** until state-changing provider operations and ambiguous outcomes are verified. No live registration was performed.
- **Code verification (commit `55831e75a25368bffaed9d65b3f1e7506819e89c`):** [GitHub Actions CI passed](https://github.com/Mapalochisha/Hembox.io/actions/runs/39985581157), including the guarded manual-fulfillment PostgreSQL integration test. [Vercel Preview is READY](https://vercel.com/mapalochishas-projects/hembox-io/8RgtThLn2QoJ6S1P7PqDrFh2FzoV). Runtime/staging review and production release gates remain outstanding; no production migration or merge was performed.

### 2026-10-23 — Manual payment and fulfillment code verification

- Exact implementation commit: `55831e75a25368bffaed9d65b3f1e7506819e89c`.
- GitHub Actions run [39985581157](https://github.com/Mapalochisha/Hembox.io/actions/runs/39985581157) completed successfully: Domain schema integration tests, Lint & Type Check, and Production Build all passed.
- Vercel Preview deployment [8RgtThLn2QoJ6S1P7PqDrFh2FzoV](https://vercel.com/mapalochishas-projects/hembox-io/8RgtThLn2QoJ6S1P7PqDrFh2FzoV) is `READY` for that exact code commit.
- This verifies code/build and disposable-PostgreSQL behavior only. The new migrations have not been applied to production; receiving-account instructions are not configured; no real payment or registration has occurred. PR #2 remains open and unmerged.


### 2026-10-25 — Billing integration and release-gate recheck

- Rechecked the current integration head: `27a793c8ccb1f7e090240aa3bebc9caf629d1912` (`feat(billing): complete unified billing foundation`).
- Vercel reports the exact head's Preview deployment `dpl_AqJtvQKydf3MepUPTEbs8qediH6R` as `READY`: https://vercel.com/mapalochishas-projects/hembox-io/AqJtvQKydf3MepUPTEbs8qediH6R. The matching GitHub commit status currently exposes a successful Vercel check. The commit-specific GitHub Actions lookup returned no workflow runs, so this check alone does **not** establish that CI passed for the exact head.
- Preview environment metadata confirms branch-scoped `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and NameSilo sandbox configuration are present. `DOMAIN_MANUAL_PAYMENT_INSTRUCTIONS` is not configured yet; no service-role key is present in the branch-scoped Preview variables. Do not disclose or copy environment secret values into logs or documentation.
- Read-only code review reconfirmed that the provider diagnostic route returns data only when `VERCEL_ENV=preview` and `DOMAIN_PROVIDER_MODE=namesilo-sandbox`; account probes are read-only. The protected endpoint has not been re-run in this review, so no new OTE response is claimed.
- The domain manual-payment claim verification trigger bridges verified legacy domain claims into the unified billing ledger and advances the domain order only when the invoice becomes fully paid. This path remains gated by the configured payment instructions and by successful authenticated runtime access.
- **Next verification work:** obtain exact-head GitHub Actions evidence; use the protected Preview's read-only `scope=account` and `domain=github.com` diagnostics, with requests spaced apart; then exercise authenticated customer/admin flows using disposable or rollback-only records. Do not register a sandbox domain to satisfy `getDomainInfo`, change production data, enable live registration, or accept real payments as part of diagnostics.
- **Still external to code:** approved `DOMAIN_MANUAL_PAYMENT_INSTRUCTIONS` receiving details. The gateway remains deferred. Current Preview is not release-ready for customer payments while those instructions are absent and authenticated runtime paths remain unverified.


### 2026-10-25 — Exact-head CI and protected Preview diagnostics

- Confirmed GitHub Actions was running; the earlier apparent absence was a limitation of the commit-workflow helper, which only returned pull-request-triggered runs while the latest execution was a `push` event. No workflow trigger repair was necessary.
- CI run [`40148839538`](https://github.com/Mapalochisha/Hembox.io/actions/runs/40148839538) completed successfully for commit `3c285dbafadbefeb09beeeba6b77e9a56c4bdb51`: Domain schema integration tests, Lint & Type Check (including provider tests), and Production Build all passed.
- Matching Vercel Preview deployment [`H5rQMvaAFKwmFwWidHPETmqJ2HD7`](https://vercel.com/mapalochishas-projects/hembox-io/H5rQMvaAFKwmFwWidHPETmqJ2HD7) reached `READY`; its Vercel commit status is successful.
- Protected Preview `GET /api/domains/provider-diagnostic?scope=account` returned HTTP 200 from NameSilo OTE: both `getAccountBalance` and `listDomains` returned provider code 300 (successful response), and the sandbox account reported no active domains. The sandbox balance is intentionally not copied into this progress log.
- Protected Preview `GET /api/domains/provider-diagnostic?domain=github.com` returned HTTP 200 from NameSilo OTE. The provider returned code 200 with “Domain is not active, or does not belong to this user”; this is consistent with an account-specific domain-info lookup, not a registration-availability verdict. The API correctly exposes the result as `unknown`, not available/unavailable. No registration or funds were used.
- `GET /api/domains/search?domain=github.com` returned HTTP 405, which is expected for this POST-only search endpoint; this GET probe does not validate the search request contract. A valid POST search smoke test and authenticated customer/admin E2E checks remain to be completed.
- Anonymous `GET /portal/bills` returned HTTP 200 and rendered the client-side loading shell; this confirms page delivery only, not authenticated billing functionality.
- No CI configuration change was made because workflow triggers are functioning. Continue with valid read-only/isolated tests; do not enable live registration, real payment processing, or production mutations during diagnostics.


### 2026-10-25 — Keep domain payments on the unified billing ledger

- **Changes:** Updated `POST /api/domains/manual-payment` so a domain order already linked to a unified billing invoice cannot create or review a separate legacy payment claim. The endpoint now returns a stable `unified_billing_in_use` response directing the authenticated owner to Portal → Bills, regardless of whether the invoice has an allocation yet.
- **Customer experience:** The domain dashboard now redirects to `/portal/bills` both when a customer begins manual payment and if a previously open legacy claim form is submitted after the unified invoice is linked. This keeps partial payments, payment claims, verified allocations, reconciliation, and invoice status in one ledger.
- **Verification:** Code commit `aa32c807a97b17d924983f048751adde4e400175` passed [GitHub Actions CI run 40149889697](https://github.com/Mapalochisha/Hembox.io/actions/runs/40149889697): Lint & Type Check (including domain/provider tests), Domain schema integration tests, and Production Build all succeeded. The exact commit's Vercel Preview is [READY](https://vercel.com/mapalochishas-projects/hembox-io/HndiSq8vXJvBE9cViFrAT7w32a6n).
- **Safety:** No database migration, production environment, payment instruction, live payment, or registrar mutation was changed. Live registration and gateway processing remain disabled. PR #2 remains open and unmerged.
- **Remaining handoff:** Configure approved payment methods/instructions in the unified billing admin UI before accepting customer claims. Authenticated customer/admin smoke tests against the real Preview session and commercial verification of NameSilo costs remain release gates; do not claim launch readiness from CI alone.


### 2026-10-25 — Initial unified-billing payment instructions seeded

- Added an idempotent migration that seeds three active ZMW manual-payment methods: MTN Mobile Money (+260969868508), Airtel Money (+260772448274), and Zamtel Kwacha (+260953780272), each naming Mapalo Chisha as the recipient/account holder.
- Added a bank-transfer method with clearly marked placeholders and Mapalo Chisha as account holder. It remains inactive so customers cannot accidentally transfer funds using fabricated bank details; enable it only after the real bank details have replaced every placeholder.
- Instructions require the customer to pay the exact invoice amount, use the invoice number as a reference where supported, submit the transaction reference and amount through Portal → Bills, and wait for HEMBOX verification. A claim is explicitly not proof of settled funds. Mobile money methods support ZMW only; bank transfer is configured for ZMW/USD but inactive.
- Migration uses `ON CONFLICT (method_key) DO NOTHING` to avoid overwriting any existing admin-edited methods when applied.
- **Safety boundary:** this commit adds the seed migration to the feature branch only. It does not apply a migration to production or enable live domain registration/payment-gateway processing. Confirm CI and the exact-commit Vercel Preview before treating the code change as complete.


### 2026-10-30 — M3 pricing investigation resumed

- Created working branch `feat/domain-pricing-policy` from the current `main` head (`d72b05e81d7d75b228c691d6a07590802da2c2a4`). This intentionally avoids continuing from the historical domain branch, which predates later main-branch work.
- Re-read the current pricing implementation. The repository already contains integer-minor-unit ZMW pricing math, upward rounding, registration/renewal wholesale fields, a manually verified FX snapshot, markup basis points, append-only price history, admin catalogue management, and a 24-hour freshness gate. The M3 code foundation exists; the milestone is not complete because the inputs and operational source path are not yet verified.
- Official NameSilo documentation confirms:
  - The API is free and supports custom reseller storefront integrations; there is no special reseller-only price tier.
  - The Discount Program requires purchases to use NameSilo Account Funds. Each top-up while enrolled must be at least USD 50; this is not a general minimum balance for ordinary pay-as-you-go purchases.
  - Standard account funding documentation says no minimum deposit for ordinary funding, while wire transfers have a USD 50 minimum and USD 15 fee. Funding methods and availability for a Zambia-based Hembox account still need direct confirmation.
  - The read-only `getPrices` API returns registration, transfer and renewal prices by TLD and can return account-specific pricing; this is the preferred machine-readable wholesale-cost source once the production API credential is available.
- Official references reviewed: NameSilo [API getPrices](https://www.namesilo.com/api-reference/pages?uid=account%2Fget-prices), [reseller options](https://www.namesilo.com/support/v2/articles/about/reseller-options), [reseller FAQ](https://www.namesilo.com/support/v2/articles/domain-manager/reseller-frequently-asked), [Discount Program](https://www.namesilo.com/discount-program), [account funding](https://www.namesilo.com/support/v2/articles/account-options/account-funds-manager), and [published pricing](https://www.namesilo.com/pricing).
- Commercial interpretation: do not assume Discount Program prices in the Hembox margin model unless the business chooses to pre-fund the account and confirms a viable funding route. Model the actual account-specific `getPrices` result, not promotional pricing-page examples. Keep first-year registration and renewal prices separate.
- No NameSilo live credential was used or exposed, no provider API was called, no customer price was published, no migration was applied, and no live registrar or payment action was performed.
- **M3 remains in progress.** Remaining work: add a server-only, read-only `getPrices` adapter and admin retrieval path; validate its response parser with fixtures; record the provider quote timestamp/source; establish a defensible USD/ZMW FX source/update cadence and Hembox markup/rounding policy; then seed only TLDs with verified registration and renewal costs. Do not enable a TLD merely because a price can be fetched.
- **Decision required before publishing prices:** confirm whether Hembox is willing and able to use the NameSilo Discount Program's USD 50 minimum top-up for discounted purchases, or whether to price from standard pay-as-you-go account rates. Until that is decided and a live account-specific price response is available, keep all TLDs disabled.


### 2026-10-30 — Standard pay-as-you-go pricing selected

- **Commercial decision:** use NameSilo's standard pay-as-you-go/public retail rates for the initial Hembox launch. Do not enroll in or model Discount Program prices and do not require the USD 50 minimum top-up.
- Added `src/lib/domains/providers/namesilo-prices.ts`, a server-only, read-only NameSilo `getPrices` client. It explicitly sends `retail_prices=1` so the returned price list is the standard retail schedule rather than Discount Program account rates.
- The parser normalizes registration and renewal values into integer USD cents, rejects malformed/incomplete/non-success responses, and never guesses missing prices. It does not log or expose the API-key URL.
- Added fixture tests for successful parsing, error/incomplete responses, and the explicit standard-retail request contract.
- **Safety:** the client is not yet wired to a public/customer route or a write operation. It only retrieves prices. No catalogue rows were changed, no ZMW conversion or markup assumptions were invented, no production database migration was applied, and no registration/payment operation was invoked.
- **Next M3 work:** expose the read-only result to authorized admins, define and document an FX source/rate timestamp policy and Hembox margin/rounding policy, then create an explicit human-reviewed price-snapshot action. TLDs remain disabled until both registration and renewal prices, FX and margin are approved and recorded.


### 2026-10-30 — Admin-only standard wholesale price review

- Added an administrator-authenticated, no-store endpoint at `GET /api/admin/domains/provider-prices`. It calls the server-only NameSilo `getPrices` adapter and returns only normalized TLD registration/renewal costs, currency, source and retrieval timestamp. The API key and request URL are never returned.
- Added the admin screen at `/admin/domains/provider-prices` and linked it from the TLD catalogue. It presents standard pay-as-you-go rates as a review reference; it does not persist rates, create catalogue rows, or enable TLDs.
- Tightened parsing to reject zero as well as malformed, missing, unsafe or non-success prices. Added a credential non-disclosure regression test.
- **FX policy for the initial launch:** use an administrator-entered, manually verified USD/ZMW rate. The admin must record the source and observation date in the pricing source/verification note when saving a price snapshot. No undocumented rate is fetched or assumed. Recheck the rate before each new price snapshot; the existing 24-hour catalogue freshness gate prevents stale published prices from being quoted.
- **Markup policy in code:** keep markup configurable per TLD in basis points, with the current form's 20% value as a convenience default only. The admin must explicitly review the markup before saving; it is not silently imposed on provider prices. Retail calculations use integer minor units and round upward to the next ZMW 1.00. Registration and renewal costs remain separate.
- **Approval boundary:** saving a pricing snapshot remains an explicit admin action. The current admin form disables the TLD while writing the catalogue row and immutable snapshot, then applies the requested enabled state only after the snapshot succeeds. The provider retrieval screen itself is strictly read-only.
- **Outstanding external prerequisites:** configure `NAMESILO_API_KEY` in the server environment and confirm the live NameSilo account's operational funding route. Until then the new endpoint safely returns a configuration error. No live provider call, catalogue publication, production migration, registration, or payment was performed by this code change.
- **Verification:** CI and the exact-head Vercel Preview must pass before this increment is complete. A successful build does not prove the production NameSilo credential is configured or that any TLD is commercially approved.


---

# Handover snapshot — 2026-11-01

> This section supersedes older milestone summaries where they conflict. It is the operational starting point for the next engineer/AI. The dated log above is retained as historical evidence, not as a claim that every historical branch or deployment is current.

## Current repository baseline and implementation reality

- Repository: `Mapalochisha/Hembox.io`; production application project: Vercel `hembox-io`; production site: `https://hembox.tech`.
- The current known `main` baseline before this documentation/housekeeping change was `c744d4f52068ba67e6209dbb03444d8e59dcd7c6`.
- The older `feature/domain-reselling-platform` branch and the later `feat/domain-pricing-policy` branch diverged materially from `main`. Do not merge either wholesale. The pricing branch contained useful NameSilo standard-retail pricing work; integrate only by reviewing individual commits/files against current main.
- This document is canonical. The companion roadmap is a condensed technical view; the two NameSilo documents are operational references.

## Product and commercial decisions — treat as approved unless the business owner changes them

1. Domain sales must be available standalone, as a website-plan add-on, or bundled with other HEMBOX services. HEMBOX is a broader digital-services business (branding, websites, applications and digital systems), not a website-only company.
2. Initial market: Zambia. Customer-facing default currency: ZMW. USD may be used by customer request/manual administrative handling.
3. Selected initial registrar: NameSilo. The old Domain Name API path is retired from provider selection.
4. Use NameSilo standard pay-as-you-go/public retail schedule for launch. Do not enroll in the Discount Program or assume its USD 50 minimum top-up economics.
5. Provider costs are USD; registration and renewal costs must remain distinct. Initial FX policy is a manually entered, manually verified USD/ZMW rate with source and observation date recorded for every saved price snapshot.
6. Markup is configurable per TLD in basis points. The 20% form value is a convenience default, not an approved universal margin. Retail calculations use integer minor units and round upward to the next ZMW 1.00.
7. Price freshness gate: 24 hours. No TLD may be enabled until both registration and renewal costs, FX, markup and source evidence are reviewed and saved.
8. Payment gateway/hosted checkout/webhooks are deferred. Initial release uses manual payment claims and authorized human verification. A claim/reference is not proof of settlement.
9. Initial registration is manual fulfilment in the registrar console after verified payment and a fresh live availability/final-price check. The administrator records the actual registrar result in HEMBOX. No automated live registrar mutation is authorized.
10. Keep DNS abstraction/provider capability boundaries in place, but do not expose customer DNS controls until implemented, authorized and tested.
11. Do not introduce loyalty discounts without real customer demand and unit-economics evidence.
12. No live registration, renewal, transfer, DNS mutation, real payment collection, or new production database migration is authorized merely by this handover.

## What has actually been built (code/schema foundations; not all are release-ready)

### Provider and NameSilo
- Provider abstraction/contracts, fail-closed provider selection, mock/disabled behavior and validated domain search.
- Server-side NameSilo availability adapter. Unknown/malformed responses remain unknown; sandbox availability is not live registry truth.
- Separate OTE configuration using `DOMAIN_PROVIDER_MODE=namesilo-sandbox` and `NAMESILO_SANDBOX_API_KEY`; live mode uses `NAMESILO_API_KEY`. Secrets must remain server-side.
- Read-only OTE account probes (`getAccountBalance`, `listDomains`) and availability parsing were verified on protected Preview. The OTE account listed no domains; `getDomainInfo` for `github.com` returned the documented account-scope not-active/not-owned result. No test domain was registered and no sandbox funds were spent.
- A separate OTE operations client/CLI has guarded read-only and sandbox mutation commands, explicit confirmation/preflight guards, and ambiguous-outcome reconciliation rules. It is not a customer-facing live registrar integration. No state-changing OTE operation has been performed.
- A server-only NameSilo `getPrices` reader was added on the pricing workstream. It explicitly requests standard retail pricing, normalizes registration/renewal values to integer USD cents, and rejects malformed/incomplete responses.
- Admin-only `GET /api/admin/domains/provider-prices` and `/admin/domains/provider-prices` were added as read-only review surfaces. They do not persist prices or enable TLDs. The production NameSilo credential/account funding route still needs verification.

### Pricing and catalogue
- Provider-independent integer pricing calculations, FX scaling, basis-point markup, upward ZMW rounding, 24-hour freshness gate, price history and admin-only catalogue management exist.
- Public catalogue API is retail-only and must not imply availability.
- Price-review retrieval exists, but the commercial inputs and approved catalogue are not complete. No TLD should be considered commercially enabled/launch-ready solely because the code can fetch a price.

### Customer and admin domain workflows
- Public `/domains` remains enquiry-led; it is not a complete live search/checkout.
- Enquiry persistence and durable order creation foundations exist, with idempotency/audit behavior where the domain schema is present.
- Authenticated customer order API and `/profile/domains` read-only dashboard exist with owner scoping/RLS.
- Admin TLD catalogue and read-only order queue/audit visibility exist.
- Quote/order foundations include immutable quote snapshots, expiry, idempotency and provider/payment evidence contracts. The later pricing branch adds durable quote/order and billing bridge work that must be checked carefully against current main before reuse.

### Manual payments and fulfilment
- Manual payment claim/review code and database foundations were developed: customer transaction-reference/optional-note submission, admin verify/reject/needs-information actions, amount/quote checks, audit/idempotency controls and customer claim status.
- Unified HEMBOX billing integration was developed in the domain workstream, including invoice linkage and arrangement workflow foundations. Payment gateway remains disabled/deferred.
- Manual fulfilment SQL/RPC foundation exists to record an actual registration performed outside HEMBOX; it must not call the registrar or invent a registration.
- Treat these workflows as implemented foundations requiring current-main integration/release verification, not as permission to accept live customer funds or register domains.

## Phase-by-phase status at handover

| Phase | Status | What remains |
|---|---|---|
| M0 Foundation | Complete historically | Re-run current-main CI after any code integration; retain fail-closed behavior. |
| M1 Registrar/commercial selection | Partially complete | NameSilo selected; confirm live account access, Zambia funding route, terms, supported TLDs and actual account-specific commercial costs. |
| M2 NameSilo adapter/account verification | Substantially complete for read-only OTE | Production credential/account readiness and live read-only price/availability verification remain open. No live mutations. |
| M3 Pricing policy/TLD catalogue | In progress | Verify production `getPrices` response; approve FX source/rate cadence, per-TLD markup and costs; save reviewed snapshots; seed/enable only fully priced TLDs. |
| M4 Cart/checkout/durable orders | Incomplete | Finish/reconcile current-main quote-to-order flow, registrant data, checkout review, idempotency/concurrency, ownership and final live availability/price recheck. |
| M5 Manual payments | Substantial implementation; release verification open | Integrate/reconcile with current billing, configure and verify receiving instructions, authenticated customer/admin E2E, audit/reconciliation and exact amount/expiry rules. Gateway intentionally deferred. |
| M6 Registration/provisioning | Manual foundation exists; not launch-verified | Verify paid-order guard, manual registrar-console procedure, actual provider reference capture, expiry dates, idempotency and reconciliation. Automated registration remains deferred. |
| M7 Customer domain dashboard | Partial | Complete order lifecycle/status/notifications and customer-visible registered-domain/renewal data; verify owner isolation end to end. |
| M8 Admin operations console | Partial | Complete manual review/fulfilment operations, provider/payment reconciliation, failed/ambiguous order handling, refunds policy, margins and audit workflows. |
| M9 DNS/renewals/extended management | Not implemented for customers | Provider capability adapter, nameserver/DNS controls, renewals, reminders, transfer/lock/privacy support and recovery. |
| M10 Security/reliability/QA | Partial | Full current-main RLS/grants/secret/rate-limit/state-machine review, abuse/concurrency/retry tests, operational alerts, backups and recovery runbooks. |
| M11 Staging/production launch | Not complete | Current-main integration, migrations/release review, exact-head CI + Vercel, authenticated E2E, commercial approvals and explicit owner authorization. |
| M12 Post-launch operations | Not started | Monitoring, reconciliation cadence, support ownership, margin/conversion/renewal metrics and incident process. |

## External prerequisites and explicit blockers

- A production NameSilo API key/account with a verified funding method usable from Zambia; keep it separate from the OTE key.
- A successful, read-only production `getPrices` response and verified live availability behavior before publishing any TLD.
- Admin-approved USD/ZMW rate source and rate, per-TLD markup, registration/renewal price snapshots, and TLD enablement decisions.
- Approved manual-payment receiving instructions in the correct server configuration. Do not expose or activate placeholder bank details.
- Business owner approval before production schema changes, accepting real customer payments, live registrar mutations, or enabling customer-facing domain sales.
- If gateway work is resumed later: confirm custom-domain/onboarding eligibility and merchant settlement terms first; then implement signed webhook verification, idempotent ledger processing and reconciliation.

## Recommended next implementation sequence

1. Start from current `main`, inspect the current tree and CI state, and do not merge old feature branches wholesale.
2. Diff the pricing-policy branch against current main. Port the NameSilo `getPrices` adapter, admin-only read-only price review endpoint/screen and tests only where missing and compatible.
3. Finish M3 commercial inputs and explicit admin price-snapshot/TLD enablement controls. Keep every TLD disabled until its registration and renewal costs are verified.
4. Reconcile quote/order creation and the unified-billing bridge against the current schema; finish durable customer order creation and the final availability/price recheck.
5. Complete and test manual payment claims/review against the current billing ledger; verify payment instructions and admin permissions without touching real customer balances.
6. Complete the guarded manual fulfilment path and customer/admin operations surfaces. No automated live registrar calls.
7. Run disposable-database/schema tests, unit tests, lint, TypeScript and production build; then authenticated Preview customer/admin E2E. Record exact commit, CI run and Vercel deployment.
8. Only after the owner explicitly approves, prepare and review production migrations and launch controls. A green CI/build alone is not launch approval.

## Verification and evidence discipline

- Historical CI/Preview links in the dated progress log refer to the commits stated there; they are not evidence that the current `main` head is green.
- The E2E remediation report dated 2026-10-30 recorded 33 PASS, one observation and one known gap across 35 checks. It covered general customer/admin/billing/portal controls, not a complete domain purchase, payment or registrar lifecycle. Do not misrepresent it as domain-reseller E2E.
- Never report a phase complete without exact-commit evidence and the relevant acceptance tests.
- Record provider environment (`test` vs `live`), operation type, timestamps and sanitized outcomes. Never paste API keys, raw sensitive provider payloads, payment secrets or personal data into docs/issues/chat.
- The current repository cleanup is documentation-only. It does not change application code, Supabase schema/data, provider configuration, Vercel settings or live registrar/payment state.


## 2026-11-01 — M8 reconciliation and M10 rate-limit baseline

**Implementation in progress on `feature/domain-operations-reconciliation`; not merged.**

### M8 — Unified billing reconciliation

- Extended the admin Recovery & Reconciliation view to compare each domain order with its linked unified billing invoice, source/customer/currency ownership, net payment allocations (including reversals), outstanding balance, submitted billing claims, registrant-capture presence and registration evidence.
- The diagnostic is read-only. It does not approve claims, alter allocations, mark invoices paid, refund funds, or change domain-order state.
- Registrant contact/address values are deliberately excluded; the endpoint only reads the order/customer association, consent version and acceptance timestamp.
- Added pure reconciliation rules and regression tests for missing/mismatched invoices, under/over-allocation, currency mismatch, pending claims, missing registrant records, incomplete registration evidence and legacy claim detection.

### Production migration-history reconciliation

- Read the production Supabase migration history. The four production versions are `20261101141742`, `20261101142511`, `20261101142524`, and `20261101142538`.
- Source control previously represented those four production changes as two combined files with different timestamps. The feature branch now splits/renames them to the exact production version names so a future migration runner can compare history accurately.
- This is a source-control alignment only. No production SQL was executed and no migration was applied during this work.

### M10 — Edge rate limiting

- Enabled one Vercel Firewall fixed-window rule: 20 requests per 60 seconds per IP across POST/PATCH requests to `/api/domains/search`, `/api/domains/quotes`, `/api/inquiries`, `/api/upload`, `/api/billing/claims`, and `/api/domains/orders/registrant`.
- Rule ID: `rule_hembox_public_api_rate_limit_2izcxf`; active firewall configuration version 2.
- Removed the inquiry route's process-local in-memory limiter. Vercel Firewall is now the consistent edge control rather than a per-instance counter.
- Vercel's current documentation lists WAF rate limiting on Hobby; usage beyond included allowance may be billable. Monitor usage before increasing thresholds.

### Vercel NameSilo sandbox configuration

- `DOMAIN_PROVIDER_MODE=namesilo-sandbox` and the existing `NAMESILO_SANDBOX_API_KEY` are scoped to both Preview and Production. The existing sandbox secret value was retained without exposing it.
- No live `NAMESILO_API_KEY` was added to Production. The live registrar remains disabled.
- Vercel deployment policy was intentionally left unchanged.
- Environment-variable changes take effect on a new deployment; a fresh Production deployment is still required to activate them there.

### Remaining acceptance work

- Run CI on the exact branch head and inspect the Vercel Preview deployment.
- Verify the WAF rule with safe invalid requests (no provider calls or database writes).
- Complete authenticated customer/admin E2E with isolated test identities and clearly tagged test data. The current quote API intentionally rejects sandbox mode for live quotes, and no TLD is enabled; do not bypass those commercial safeguards with invented prices.
- Review the Supabase security-advisor finding for `public.handle_new_user()` before closing M10. The advisor also flags authenticated SECURITY DEFINER RPCs; inspect each function's identity/ownership checks rather than revoking intended customer/admin workflows blindly.
- Do not apply or replay production migrations, create simulated paid invoices, enable TLDs, accept real payments, or perform live registrar mutations without the required explicit authorization.

### M10 — Supabase advisor follow-up (2026-11-01)

- Production advisor confirmed `public.handle_new_user()` was SECURITY DEFINER and directly executable by both `anon` and `authenticated`, despite being intended only as the `auth.users` insert trigger. The trigger is attached as `on_auth_user_created`.
- Added pending migration `20261101170000_harden_auth_signup_trigger.sql` to pin an empty `search_path` and revoke direct execution from `PUBLIC`, `anon` and `authenticated`. Added a disposable-Postgres regression test proving the trigger still creates profiles while direct RPC execution is denied. **This migration has not been applied to production.**
- The advisor's eight authenticated SECURITY DEFINER warnings are not blanket permission to revoke those RPCs. `get_user_role(uuid)` was inspected: it derives caller identity from `auth.uid()`, permits self-role lookup, and permits cross-user lookup only for admins. The remaining RPCs still require individual body/ownership review.
- The advisor's INFO findings for `domain_tld_catalog` and `domain_price_snapshots` were checked: neither `anon` nor `authenticated` has SELECT; only `service_role` does. Their RLS-enabled/no-policy posture is intentional server-only access.
- Leaked-password protection is currently disabled in Supabase Auth; review/enable separately after considering its effect on account sign-in and password reset.


## 3.2 Bank of Zambia FX and automated retail pricing — 2026-11-02

Implemented on `feature/boz-fx-daily-pricing`:

- BoZ USD/ZMW published middle rate is the pricing reference. The authoritative publication is the Bank of Zambia exchange-rate page.
- Because the BoZ website is dynamically rendered and no documented public JSON API was identified, the implementation currently uses AllRatesToday as a machine-readable republication of the BoZ table. This is a third-party transport layer, not a BoZ-operated API; the code validates the bank identity, publication date, direct USD/ZMW middle row and rejects derived, future or more-than-five-day-old rates. Both source URLs are retained in FX history.
- Daily Vercel Cron is configured for 16:00 CAT. `CRON_SECRET` is configured as a Production-only secret. The endpoint is also manually invokable by an authenticated administrator from Admin → Domains.
- FX history is stored in `domain_fx_rate_snapshots`, including published rate, K1.00/USD buffer, effective rate, publication date and retrieval timestamp.
- Domain pricing now applies 10% markup, K25 minimum gross margin and upward rounding to the next whole kwacha. Registration and renewal are recalculated separately.
- Every refresh writes immutable price history, updates USD wholesale catalogue rows, and preserves each TLD's enabled/disabled state. Sandbox/OTE/test cost rows are skipped and cannot be enabled through the admin catalogue API. Wholesale-cost verification is tracked separately from FX refresh, expires after 30 days, and must be re-verified before quote issuance; daily FX refresh never resets that timestamp.
- The existing 24-hour price freshness gate and live-provider quote guard remain in force. FX refresh does not enable TLDs or activate live registration/payment.
- CI now replays the FX schema migration and tests service-role-only access. New unit tests cover direct BoZ middle-rate parsing, stale/future/derived feed rejection and minimum-margin calculations.

**Release gates still open:** production Supabase migration `20261102100000_boz_fx_daily_pricing.sql` must be applied after CI verification; the BoZ republication feed must be smoke-tested from the deployed Vercel function; NameSilo production-account registration and renewal costs must be verified before enabling `.com` or any other TLD. No TLD has been enabled by this work.
