# HEMBOX.io domain reselling: implementation plan

## Current stage

The public `/domains` page remains enquiry-led. Provider-independent pricing policy and catalogue APIs are built around the registrar interface; no TLD is seeded or enabled without verified source costs. **NameSilo is now the selected initial registrar.** A server-only NameSilo adapter supports read-only availability checks using `checkRegisterAvailability`; unknown or malformed provider results remain `unknown`. It intentionally returns no prices and has no registration, renewal, transfer, DNS or privacy-management capability. The explicit `namesilo-sandbox` mode uses NameSilo's OTE endpoint and a separate `NAMESILO_SANDBOX_API_KEY`; the `namesilo` mode uses the production endpoint and `NAMESILO_API_KEY`. Live registration and payment remain disabled. The old Domain Name API adapter is no longer selected by the provider factory.

The pricing layer now uses integer minor-unit arithmetic, an explicit FX scaling convention, basis-point markup, upward rounding, a 24-hour freshness gate, and restricted price-history snapshots. Admins can maintain a TLD catalogue through role-protected server routes. Public catalogue responses expose retail-only ZMW prices and never imply domain availability. This foundation is not a live quote or checkout.

## Current blockers and reliability notes

- **NameSilo read-only connection verified; transactional readiness remains gated.** The first authenticated Preview smoke test returned a valid OTE availability result for example.com (unavailable in the sandbox), with provider namesilo, environment test, and live=false. This is not real registry availability. A Node-only OTE operation client now defines get-domain-info, registration, renewal, transfer and nameserver calls, with a local CLI for safe read-only tests and deliberately guarded sandbox mutations. It requires DOMAIN_PROVIDER_MODE=namesilo-sandbox plus NAMESILO_SANDBOX_API_KEY, hard-pins the sandbox host, applies confirmation and preflight guards to mutations, and is not wired to a customer-facing route. No state-changing OTE call has been performed. Live registration remains disabled. Before production use, review API Manager IP restrictions and commercial terms. Before production use, review API Manager IP restrictions and account readiness. The NameSilo [reseller terms](https://www.namesilo.com/support/v2/articles/about/reseller-options) say there is no special reseller pricing; its Discount Program requires account funds and the account-funding page lists a $50 minimum, so confirm the funding economics before relying on discounts.
- The public app's global Supabase providers now check for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` before creating a browser client, and public pages fall back to default agency settings when those values are missing. Configure those variables in the relevant Vercel Preview and Production environments regardless; auth-dependent functionality cannot work without them. Admin routes fail closed with a clear 503 when configuration is absent.
- The user reports that the client-side exception is gone on the deployed Preview. Vercel runtime-log inspection is still unavailable through the connected integration due to team-scope authorization, so the exact exception/root cause has not been independently confirmed from runtime logs.

## Product decisions

- Primary customer-facing currency: ZMW. Keep provider wholesale amounts and currency separate from retail prices; apply an explicit, reviewable FX and margin policy before displaying quotes.
- Domain purchase must be possible without buying a HEMBOX website-development package.
- Do not introduce existing-customer discount logic until there are customers and actual unit economics to justify it.
- Start with an enquiry-led customer journey. Do not accept payment for a domain until provider availability, final pricing, payment confirmation, and registration reconciliation are implemented.
- DNS is a provider capability behind the adapter; it is not exposed as a customer control until authorization, auditability, and provider support are ready.

## Phases

1. **Foundation:** registrar interface, provider capability flags, input validation, explicit disabled/mock modes, domain-order data model and audit requirements.
2. **Provider verification:** configure the separate server-side NameSilo sandbox key and `DOMAIN_PROVIDER_MODE=namesilo-sandbox` in Preview; run read-only `.com`/`.net` availability checks and confirm response shape and fail-closed behavior. Sandbox availability is not live registry truth. State-changing operations are not implemented; do not enable them until provider-backed idempotency/reconciliation, sandbox coverage, and explicit release approval exist.
3. **Quotes and orders:** server-calculated ZMW retail quotes, separately stored wholesale costs, expiry on quotes, idempotent order creation, and recoverable order states.
4. **Payments:** add a gateway only after its onboarding/approval and webhook verification are complete. Never trust a browser redirect as proof of payment.
5. **Live registration:** only after confirmed payment, re-check availability, register idempotently where supported, and reconcile ambiguous provider timeouts without blind failover.
6. **Customer domain area:** domain status, registration/expiry dates, renewal reminders and later DNS controls.
7. **Operations console:** provider health, failed orders, renewals, margin reporting, reconciliation and immutable audit events.

## Required safety properties

- Registrar credentials stay server-side and must never use a `NEXT_PUBLIC_` variable.
- A timeout after a registration request is an ambiguous outcome, not proof that registration failed.
- Store registrar order/reference IDs and provider responses with secrets and personal data redacted.
- Registration and renewal prices must be displayed separately.
- Never claim a domain is available without a live provider response, or registered without provider confirmation.
- Apply RLS to exposed tables and scope customer reads/writes to the authenticated owner.
- Add migrations to the feature branch first; review schema and policies before applying anything to the production Supabase project.


## 2026-10-18 implementation note

- Added `src/lib/domains/pricing.ts` for provider-independent pricing math and freshness checks.
- Added `/api/admin/domains/catalog` for admin-only catalogue maintenance and `/api/domains/catalog` for public retail-only catalogue reads.
- Added `/admin/domains` to maintain pricing inputs and enabled TLDs from the management console.
- Added a pricing-policy migration, restricted price-history table, and CI schema/unit tests.
- This does not verify provider availability, provider wholesale prices, payments, or registration. The admin must enter a documented, verified cost/FX source before enabling a TLD. OT&E troubleshooting remains deferred until the provider workstream resumes.


## Customer and operations surfaces added (2026-10-18)

- Signed-in customer order listing at GET /api/domains/orders and /profile/domains, relying on the authenticated user's RLS scope.
- Admin order queue at GET /api/admin/domains/orders, with status filters and recent audit events; no admin mutation actions yet.
- These screens are scaffolding around the durable order model, not a complete checkout. They remain read-only until provider-verified quotes and payment/registration workflows exist.


## Enquiry persistence and public catalogue (2026-10-18)

The domain storefront displays the enabled retail-only catalogue, suppressing stale prices and explicitly separating price from availability. A submitted domain enquiry remains saved in the existing inquiries system and now also creates a durable order in enquiry status when the domain-reselling migration is present. The order write is idempotent and best-effort, so it cannot break the existing inquiry form if the domain schema has not yet been applied to a Preview environment. An insert trigger records a minimal audit event. Payment and registration remain disabled.


## Current verification (2026-10-18)

The combined branch head `f3ee9b89d35ee3907e9d5dc064a277d429eba1fd` passed [push CI](https://github.com/Mapalochisha/Hembox.io/actions/runs/39154051748), [pull-request CI](https://github.com/Mapalochisha/Hembox.io/actions/runs/39154055608), and [Vercel](https://vercel.com/mapalochishas-projects/hembox-io/KLnxVvU5kywYXAUhk8btGqBZDdmt). Provider verification remains intentionally deferred while provider-independent pricing, enquiry persistence, customer visibility, and admin operations are built. Payments, checkout, live registration, and production migration remain disabled.


## Quote, payment and recovery foundations (2026-10-19)

- `src/lib/domains/quotes.ts` creates immutable quote snapshots from fresh server-side price inputs, with separate registration/renewal values, a 15-minute default expiry, a 60-minute maximum validity, and safe-integer checks. It does not create a checkout or write to the database.
- `src/lib/domains/payment-provider.ts` defines the gateway port and verified-payment evidence contract. The only available provider is disabled; unrecognized/non-disabled modes fail closed. No gateway has been selected or integrated, and browser redirects are not proof of payment.
- `src/lib/domains/recovery.ts` returns conservative operational recommendations. Ambiguous registrar outcomes require a status lookup/reconciliation before retry; inconsistent payment/order state is escalated instead of silently repaired.
- The durable-order migration now adds immutable quote snapshots and payment-attempt tracking with RLS, admin-only reads, server-side write privileges, unique idempotency keys, unique provider payment references, and unique provider webhook-event references.
- Unit and disposable-PostgreSQL assertions cover the new behavior. The code and schema remain feature-branch scaffolding, not a production checkout or payment system.

## Remaining before real checkout

1. Finish CI and Preview deployment verification for the latest commit.
2. Build admin recovery visibility around actual persisted quote/payment records, with explicit manual-review workflows and audit entries; no state-changing recovery buttons until transactional service operations exist.
3. Evaluate gateway eligibility for a Zambia-based merchant and document settlement currency, fees, approval/onboarding, webhook signature verification, refund support and reconciliation capabilities. Keep the payment adapter disabled until onboarding and end-to-end verification are complete.
4. Finish provider-backed quote creation and final availability/price recheck after NameSilo availability and pricing responses are verified.
5. Only then implement checkout, verified payment webhooks, registration/provisioning and release gates.


## Zambia payment gateway evaluation (2026-10-19; public documentation only)

**Provisional first integration candidate: Flutterwave Zambia. This is not an account approval or final commercial decision.**

- **Flutterwave:** its Zambia pricing page currently lists 3% for local mobile-money collections (Airtel Money, MTN MoMo and Zamtel Money) and 4.8% for international cards; it also publishes a Zambia mobile-money API and transaction-verification, webhook, and refund documentation. Its docs require server-side verification of transaction reference, status, currency and amount, and recommend signed webhook verification plus idempotent processing. Links: [Zambia pricing](https://flutterwave.com/zm/pricing/), [Zambia mobile-money API](https://developer.flutterwave.com/reference/charge-via-zambia-mobile-money), [webhooks](https://developer.flutterwave.com/docs/webhooks), [transaction verification](https://developer.flutterwave.com/docs/transaction-verification), [refunds](https://developer.flutterwave.com/docs/refunds).
- **DPO Pay by Network:** its Zambia page advertises ZMW, local support in Lusaka, Airtel/MTN mobile money and card payments. Public pricing was not established in this review. Link: [DPO Pay Zambia](https://dpogroup.com/online-payments/zambia/).
- **Pesapal:** its Zambia pages advertise online card/mobile-money payments and its FAQ says API access is provided to onboarded businesses and a merchant agreement/documentation is required before going live. Public fees were not established in this review. Links: [Zambia business solutions](https://www.pesapal.com/zm/business), [merchant FAQ](https://www.pesapal.com/zm/business/faqs).

**Why Flutterwave is first to investigate:** it has the clearest publicly documented ZMW mobile-money integration and published collection fees. Before selecting it, verify HEMBOX's merchant eligibility, required business documents, exact settlement destination/currency and timing, refund/chargeback costs, transaction limits, account approval, and current fees directly with the provider. If those terms are unsuitable, request quotes from DPO and Pesapal. Do not hard-code the public fee figures as permanent pricing policy.

The payment adapter remains disabled. No credentials, webhook endpoint, checkout session or live payment flow has been added.


## Latest implementation verification (2026-10-19)

The quote/payment/recovery implementation at `da00702017879ccbb6b8a8dffc8a167bc59bd81a` passed [push CI](https://github.com/Mapalochisha/Hembox.io/actions/runs/39301438289) and [pull-request CI](https://github.com/Mapalochisha/Hembox.io/actions/runs/39301442068). The disposable PostgreSQL schema/access-control tests, lint, TypeScript, domain unit tests and production build all passed. [Vercel Preview is READY for that commit](https://vercel.com/mapalochishas-projects/hembox-io/4tkCNhUK53PdYtdUg6nqJYVgS7yU).

A documentation-only commit records this evidence and will trigger its own CI/Preview checks; do not consider the new head verified until those complete.


## Database-enforced order lifecycle hardening (2026-10-19)

- PostgreSQL now mirrors the application order-transition graph and rejects invalid status jumps.
- Each actual order-state change writes an audit event in the same transaction, with only old/new status values. No-op updates do not create events.
- CI applies the migration to disposable PostgreSQL and checks permitted transitions, forbidden jumps, terminal states and audit behavior.
- Payment evidence additionally requires `status === "confirmed"`; a signed event describing a failed or pending payment cannot confirm an order.
- This is lifecycle defense-in-depth only. Payment, checkout, registration, DNS and renewal actions remain disabled.


## Payment-attempt lifecycle integrity (2026-10-19)

A follow-up feature migration enforces payment-attempt invariants at the database boundary: order/provider/idempotency/amount/currency identity cannot be edited, assigned provider references and confirmation timestamps cannot be replaced, confirmed payments cannot regress to pending/failed/cancelled, and refunded attempts are terminal. Creation and status changes produce transactional audit events with minimal non-secret metadata. Disposable PostgreSQL tests run in CI. This is a safety foundation only; no payment provider or live payment flow is enabled.


## Durable webhook replay ledger (2026-10-19)

Added a provider-neutral event ledger keyed uniquely by provider and event ID. Event identity and signature-verification evidence cannot be changed, rows cannot be deleted, processing transitions are constrained, and only minimal metadata is retained. Disposable PostgreSQL CI verifies replay rejection. A future webhook handler must still verify signatures, validate amount/currency/order/provider, and process each event transactionally; this migration alone does not enable payments.


## Webhook ledger processing guards (2026-10-19)

Security review found that the first ledger migration did not prohibit a failed signature check from being transitioned to `processed`, and allowed inserts directly into terminal states. The follow-up migration now requires received-only inserts, blocks processing when signature verification is false, enforces canonical trimmed event identifiers, and prevents rewriting `processed_at` after assignment. CI exercises these constraints against disposable PostgreSQL. This remains provider-neutral schema hardening only; signature verification must still happen in a future server-side handler before the database records verified evidence.


## Conservative registration recovery derivation (2026-10-19)

The recovery queue no longer treats local `registration_pending` or `registration_failed` statuses as independent provider confirmation. Both are ambiguous until a provider status lookup/reconciliation is implemented. A `registered` order needs a non-empty registrar domain reference and valid registration timestamp to be treated as confirmed by the dashboard; otherwise it is escalated for inconsistent-state review. Tests cover missing/malformed evidence. This is a safer read-only recommendation, not a live registrar integration.


## Payment confirmation evidence constraints (2026-10-19)

The database now rejects new attempts inserted directly as confirmed/refunded, rejects confirmation timestamps on pending/unknown/failed/cancelled attempts, requires confirmation evidence for confirmed/refunded states, rejects future confirmation timestamps, and prevents changing the first confirmed timestamp. Disposable PostgreSQL tests cover the new cases. This remains a disabled integration foundation: only a future verified server-side payment flow should move an attempt into confirmed state.


## Webhook ledger visibility in recovery operations (2026-10-19)

The admin recovery queue now surfaces recent webhook ledger events linked to the order's payment attempts: event ID/type, signature-verification result, processing status, sanitized error code and timestamps. It does not expose raw payloads or secrets and provides no state-changing controls. The feature is read-only operational visibility; verified payment processing remains disabled pending a selected and approved gateway.


## 2026-10-22 — Authenticated OTE smoke test passed; sandbox operations isolated

- The Preview API returned a valid NameSilo OTE availability response for example.com. The environment reported test and live=false; its unavailable value is sandbox-specific and must not be displayed as actual live registry status.
- Added a separate server-only OTE operation client and regression tests. Those methods are not wired to customer routes. Mutations require an explicit confirmation token; registration preflights availability and uncertain outcomes require domain-info reconciliation before retry.
- Registration, renewal, transfer and nameserver changes are not enabled in the storefront or customer dashboard. No OTE mutation or real purchase has been run.


## 2026-10-22 — Local sandbox CLI

A local `npm run namesilo:ote -- ...` CLI now supports OTE domain-info and availability checks, plus guarded registration, renewal and nameserver changes for disposable test domains. It reads the sandbox key from ignored `.env.local`, never accepts a live endpoint override, and does not expose transfer authorization codes through the CLI. See [NameSilo OTE sandbox testing](./namesilo-sandbox-testing.md). No state-changing operation has been performed.
