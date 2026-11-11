# HEMBOX Tech Domain Reselling — Current Handoff

> **Purpose:** A current, self-contained handoff for anyone continuing the domain-reselling work. This document distinguishes implemented code from verified operational behaviour and from work that is still blocked.
>
> **Prepared:** 2026-11-11  
> **Repository:** [Mapalochisha/Hembox.io](https://github.com/Mapalochisha/Hembox.io)  
> **Baseline branch:** `main`  
> **Baseline before this handoff commit:** `bdb5f916aa988e2524be546bda7620344d57f85e`  
> **Product domain:** `https://hembox.tech`  
> **Status:** Sandbox implementation is present; live domain sales are **not ready**.

## 1. Executive status

HEMBOX has a substantial provider-independent domain-reselling implementation and a NameSilo OTE sandbox path. The repository contains the customer-facing domain journey, quote/order and billing foundations, registrant capture, admin operations, pricing controls, and sandbox management-request workflow.

That does **not** mean live domain sales are ready. The outstanding release blockers are:
- The customer/admin sandbox journey has not passed a complete authenticated end-to-end acceptance test.
- The latest user-reported customer-side Renew and Update/nameserver actions still return an ambiguous NameSilo sandbox outcome. The issue must be reconciled before another mutation is attempted.
- The live NameSilo credential, production wholesale cost verification, and funding route are not confirmed.
- The live TLD catalogue is empty; no TLD should be advertised as purchasable.
- Real payment acceptance and live registrar operations remain gated.
- Operational hardening, including rate limiting, alerting and authenticated E2E automation, remains incomplete.

**Recommended immediate priority:** resolve the sandbox management-request ambiguity and finish the customer/admin OTE acceptance journey. Do not switch to live registrar operations to work around a sandbox defect.

## 2. Repository and deployment baseline

| Item | Current record |
|---|---|
| Repository | `Mapalochisha/Hembox.io` |
| Branch to continue from | `main` |
| Previous main HEAD | `bdb5f916aa988e2524be546bda7620344d57f85e` |
| Last recorded GitHub Actions CI on that exact HEAD | Run [42273121099](https://github.com/Mapalochisha/Hembox.io/actions/runs/42273121099) — **success** |
| Stack | Next.js 16.4.5, React 19.2.9, Supabase Postgres, Vercel |
| Production site | `hembox.tech` |
| Production Supabase project | `jygxbernkptzhoyksoie` |
| Vercel deployment policy | Keep the existing main-only Git deployment policy; do not change it as part of domain work |

The GitHub CI run above passed on the exact main commit. The Vercel status reported for the subsequent main documentation commit was a canceled Production-target deployment, not a failed application build. The corresponding Production-target deployments were canceled because separate Production deployment authorization had not been granted. A canceled deployment must not be described as a failed build. Re-check the current Vercel deployment record before drawing conclusions about the current deployment.

## 3. Product and technical architecture

### Customer journey

The intended customer flow is:

1. Visit `/domains` and discover supported extensions.
2. Search for a domain and receive a provider-backed result (never a fabricated availability result).
3. Review registration and renewal pricing and the purchase terms.
4. Submit a quote/order and the registrant details and consent required for registration.
5. Pay through the configured payment workflow.
6. HEMBOX verifies settlement before the order can advance to registration.
7. The registrar operation is performed and reconciled against provider state.
8. The customer sees ownership/registration details only when the system has supporting provider evidence.
9. Supported management requests are submitted by the customer and reviewed/applied by an administrator.

Relevant customer surfaces include `/domains`, `/portal/domains`, and the isolated sandbox journey. The older `/profile/domains` path redirects to the portal domain area.

### Provider abstraction and NameSilo

- Provider selection is behind the server-side domain provider abstraction in `src/lib/domains/provider.ts`.
- NameSilo adapter/configuration code lives under `src/lib/domains/providers/`.
- OTE mode is explicitly selected with `DOMAIN_PROVIDER_MODE=namesilo-sandbox`, uses the fixed OTE endpoint `https://ote.namesilo.com/api`, and reads only `NAMESILO_SANDBOX_API_KEY`.
- Live mode is `DOMAIN_PROVIDER_MODE=namesilo` and requires the separate server-only `NAMESILO_API_KEY`.
- The application must fail closed when the provider mode or required credential is missing or inconsistent.
- Never expose registrar credentials through `NEXT_PUBLIC_*`, browser code, logs, or committed files.
- OTE availability and account state are test-environment evidence only. They are not authoritative public registry availability or proof of live readiness.

NameSilo's read-only price reader is implemented. Its `getPrices` output must be treated as account pricing and independently verified in the production account before use. The `retail_prices=1` parameter used by the reader is not confirmed in the published API reference. OTE pricing is not proof of production pricing.

### Billing and registration safety

The unified billing ledger is the financial source of truth. The domain-to-billing bridge creates/links the invoice to the domain order. Manual payment evidence is a claim for review, not proof of settlement.

The guarded fulfilment path requires settled payment evidence (a paid invoice with full allocations and matching customer/order/currency, or the supported verified legacy evidence path) and registrant details. Registration records are audited. A payment receipt, browser redirect, transaction reference, or test acknowledgement alone must never be treated as verified funds.

The sandbox zero-value test acknowledgement is not a real invoice payment and must not be represented as money received. Sandbox records must remain isolated from live financial records.

## 4. Implemented capabilities on main

The following implementation areas are present in the current main tree:

- Provider abstraction, explicit fail-closed mode selection, NameSilo read-only adapter, OTE client and response normalization.
- Domain search validation and provider diagnostics.
- Quote creation, pricing recomputation, quote expiry, idempotency and durable domain order creation.
- Domain order state helpers and database transition guards.
- Unified billing invoice bridge, payment claims/evidence and allocation controls.
- Registrant details capture, consent recording and server-side enforcement before payment/registration.
- Admin TLD catalogue and pricing surfaces, wholesale provider-price reference, domain order queue, manual-payment review, recovery and margin views.
- Customer portal domain list/details and isolated sandbox management requests.
- Admin sandbox management-request review/apply/reject and provider reconciliation paths.
- Bank of Zambia FX refresh integration and pricing snapshots.
- SQL and unit test coverage for provider parsing, pricing, order transitions, payment recovery, registrant gates, reconciliation, sandbox operations and database access controls.

Important source locations:
- `src/lib/domains/`
- `src/lib/domains/providers/`
- `src/app/(public)/domains/`
- `src/app/portal/domains/`
- `src/app/admin/domains/`
- `src/app/api/domains/`
- `src/app/api/admin/domains/`
- `supabase/migrations/`
- `supabase/tests/`
- `tests/`
- `scripts/namesilo-sandbox.mjs`

## 5. Latest sandbox test report and unresolved defect

### User-reported test state

The most recent hands-on customer UI test reported:
- Test domain: `giglgfhiikk.com`.
- Test payment/reference label: `HEMBOX-OTE-TEST-001`.
- Initial registration outcome was shown as **registration unknown**.
- The admin reconciliation action was subsequently run and completed; the domain then appeared in the customer Portal → Domains flow.
- The displayed expiry in that test record was `2026-11-03 18:17`. That date is now in the past and must not be assumed to represent a currently active OTE registration.
- When the customer later pressed **Renew** or **Update** (nameserver change) in the sandbox domain details UI, the same ambiguous-outcome error appeared immediately.

Reported error text:

```text
NameSilo sandbox outcome could not be confirmed.
Reconcile provider state before retrying; do not repeat the mutation blindly.
```

This is the latest known user-reported blocker. No verified resolution is recorded in this handoff.

### Required handling

1. Do not click Renew or Update repeatedly and do not send another registrar mutation as a diagnostic.
2. Start with read-only OTE account inspection (`listDomains`) and confirm whether `giglgfhiikk.com` is actually present in the sandbox account.
3. Only use `getDomainInfo` for a domain listed in the OTE account. NameSilo documents this as an account-scoped lookup; an out-of-account lookup (including arbitrary public domains) can return code `114` and is not proof of a bad API key or invalid domain syntax.
4. Inspect the existing management-request row, its audit events, the associated sandbox order, and the last sanitized provider result. Establish whether the mutation was never sent, was accepted but read-back failed, or remains genuinely unknown.
5. Use the existing read-only reconciliation action to determine current provider state. Do not retry until reconciliation establishes that the previous mutation did not succeed and the domain is eligible for the requested operation.
6. For renewal, verify that OTE reports the domain as active. Do not attempt restoration/renewal of an expired or restoration-period domain.
7. For nameserver changes, confirm the requested values are supported NameSilo nameservers (NS1–NS8) and compare the actual provider nameservers with the requested values.
8. If OTE state cannot be established, stop and escalate the sanitized request/result to NameSilo support. Preserve the request as unknown; do not display success to the customer.

### Intended management-request state model

The customer action should create a management request; it should not directly mutate the registrar. The request remains pending review until an administrator handles it. The admin path should:
- validate the customer/order ownership and request type;
- perform preflight checks;
- apply only in the explicitly selected OTE mode;
- confirm the resulting state with a read-only provider read-back;
- update the HEMBOX order/request only after confirmation;
- preserve an unknown state when the provider outcome cannot be proven;
- block duplicate application while an earlier request is unresolved.

Relevant implementation/documentation:
- `docs/namesilo-sandbox-testing.md`
- `src/lib/domains/providers/namesilo-sandbox-operations.ts`
- `src/app/api/admin/domains/sandbox/`
- `src/app/api/domains/sandbox/`
- `supabase/migrations/20261103182518_domain_sandbox_management_requests.sql`
- `supabase/tests/domain_sandbox_management_requests.test.sql`

## 6. Pricing and catalogue policy

Zambia is the primary launch market and ZMW is the default customer currency. The recorded owner pricing policy is:

- Reference FX: Bank of Zambia USD/ZMW published middle rate.
- Transport: AllRatesToday machine-readable republication of the BoZ table; this is a third-party transport layer, not a BoZ-operated API. Periodically compare it with the authoritative BoZ publication.
- Buffer: K1.00 per USD.
- Markup: 10% / 1,000 basis points.
- Minimum gross margin: K25 / 2,500 ZMW minor units.
- Retail rounding: upward to the next K1.
- FX refresh: daily at 16:00 CAT.
- FX-derived retail prices older than 24 hours are suppressed.
- Wholesale registration and renewal costs have a separate 30-day verification window; daily FX refresh does not refresh wholesale-cost verification.

The pricing engine recalculates retail prices server-side from wholesale cost, FX and markup. Registration and renewal prices are calculated independently. Invalid, stale or unverified inputs must fail closed.

**No TLD may be enabled until production registration and renewal costs have both been verified, the pricing inputs are recorded, and the catalogue row has been reviewed.** OTE rates cannot authorize live customer prices.

NameSilo does not appear to offer `.zm` / `.co.zm`; those extensions require a separate relationship with a ZICTA-accredited registrar. Do not advertise them as available through NameSilo. Start with a small, verified international TLD set (for example, `.com`) rather than enabling the entire catalogue.

Operations references:
- `docs/domain-pricing-inputs.md`
- `docs/boz-fx-operations.md`

## 7. Production and database facts — last documented audit

The production-readiness audit recorded the following read-only observations on 2026-11-06. These are a dated snapshot; re-check before making operational decisions.

- Production provider mode was recorded as `namesilo-sandbox`, with `NAMESILO_SANDBOX_API_KEY` present. The live `NAMESILO_API_KEY` was observed only in Preview at that audit. No secret values belong in documentation.
- Production `domain_tld_catalog` contained zero rows; there were no enabled retail TLDs.
- Production live `domain_orders` contained zero rows. The sandbox ledger contained one test order at the time of that audit; the subsequent user-reported test may have changed this.
- No recorded billing payments were found at that audit.
- The sandbox-related tables had RLS enabled, no client policies, and table grants restricted to `service_role`.
- Production migration history recorded 29 migrations, including canonical sandbox migration versions `20261102134924` and `20261103182518`.
- A complete all-schema source-versus-Production diff was still outstanding.

Do not infer current database contents from these historical counts. Use read-only queries to verify current state before testing or applying changes. Do not run `supabase db push`, apply a new Production migration, or mutate production data as part of this handoff.

## 8. Milestone status

| Area | Status | Remaining work |
|---|---|---|
| M0 Foundation | Implemented | Maintain existing test coverage |
| M1 Registrar/commercial verification | Partial | Live credential, funding route, production wholesale costs and TLD eligibility |
| M2 Provider adapter | Implemented for OTE/read-only and guarded sandbox operations | Verify live provider separately before live use |
| M3 Pricing/catalogue | Engine and BoZ FX integration implemented | Verify live costs; approve and enable only reviewed TLDs |
| M4 Quote/checkout/order | Partial | Final purchase review and authenticated E2E acceptance |
| M5 Manual payment | Partial | Operational proof of receiving instructions and customer/admin payment review |
| M6 Fulfilment | Guarded code implemented | Prove end-to-end with settled payment evidence and provider read-back |
| M7 Customer portal | Partial | Notifications, renewal reminders and complete support paths |
| M8 Admin operations | Partial | Reliable provider/payment reconciliation, recovery and incident workflow |
| M9 DNS/renewals/transfers | Deferred/partial | Supported nameserver request path is in sandbox; customer DNS editor, renewals and transfers are not launch-ready |
| M10 Security/QA | Partial | Rate limiting, authenticated E2E, alerting and runbooks |
| M11/M12 Launch and post-launch | Not ready | All technical, commercial and operational gates |

## 9. Recommended work sequence

### P0 — Resolve the current sandbox management defect
- Reconcile the last test domain through OTE read-only account/domain reads.
- Inspect the existing customer management request and admin audit trail.
- Reproduce the Renew and Update failure without issuing duplicate mutations.
- Fix the request lifecycle/API response handling and add regression tests for timeout, ambiguous result, successful mutation/read-back, failed mutation, and safe retry eligibility.
- Confirm customer status and admin status agree with provider state.

### P1 — Complete authenticated customer/admin sandbox acceptance
- Customer: search a supported OTE test name, complete the sandbox order/registrant/consent flow, and see only evidence-backed status.
- Admin: review the test acknowledgement, reconcile the provider result, inspect audit events and confirm the order state.
- Customer: submit a renewal and nameserver request.
- Admin: approve/reject, apply only in OTE, reconcile, and confirm the final state.
- Verify sandbox data cannot affect live invoices, payment records or orders.
- Capture exact commit, CI run, test account roles (never passwords), and test results.

### P2 — Complete technical hardening
- Add API rate limiting and abuse controls.
- Add authenticated browser/API E2E coverage.
- Review customer ownership, admin authorization, registrant PII access, RLS and privileged function grants.
- Enable Supabase leaked-password protection only after the previously approved Auth-impact and recovery-flow review/test is complete.
- Add alerts for provider errors, stale FX/prices, unknown mutations, failed payment claims and expiring domains.
- Document operator, incident, backup/restore and rollback procedures.

### P3 — Complete commercial prerequisites (owner decisions/external dependencies)
- Obtain and securely configure the dedicated live NameSilo credential.
- Confirm the Zambia funding/top-up route and actual provider account economics.
- Retrieve production registration and renewal costs; verify them against the NameSilo control panel.
- Review the approved FX/markup policy against taxes, fees and final margins.
- Approve the launch TLD set, customer-facing renewal terms, domain terms/refund rules and support process.
- Keep all catalogue entries disabled until every required input is verified.

### P4 — Controlled live launch (separate authorization required)
- Prove the full payment → settlement → registrar mutation → provider read-back → customer ownership path.
- Use a controlled live test only after explicit authorization for the specific live mutation and any real payment.
- Verify monitoring, reconciliation, rollback/kill switch and customer support coverage.
- Do not infer Production deployment or mutation authorization from an older approval for a different task.

## 10. Safety rules that must survive handoff

- Never repeat a registrar mutation after an ambiguous result until read-only reconciliation proves the previous outcome.
- Never mark a domain registered based only on an API acknowledgement, test receipt or payment reference.
- Never mark an invoice paid without verified settlement and correct ledger allocations.
- Never publish a price without verified production registration and renewal costs.
- Never treat OTE availability, pricing, expiry or ownership as live registry truth.
- Keep OTE and live API keys separate and server-only.
- Keep sandbox orders, acknowledgements and management requests isolated from live billing.
- Do not run new Production migrations, live registrar operations, real payments or a Production deployment without the applicable explicit authorization.
- Do not change the Vercel deployment policy.
- Re-run and record CI against the exact commit being handed over; do not reuse a green result from an older SHA.

## 11. Related documents

| Document | Use |
|---|---|
| `docs/domain-reselling-build-plan.md` | Detailed build plan and milestone history |
| `docs/domain-reselling-roadmap.md` | Implementation roadmap |
| `docs/namesilo-sandbox-testing.md` | OTE account probes, safe sandbox mutations and reconciliation |
| `docs/namesilo-ote-investigation.md` | OTE `getDomainInfo` behaviour and provider investigation |
| `docs/domain-pricing-inputs.md` | Verified wholesale costs, FX, markup and TLD enablement procedure |
| `docs/boz-fx-operations.md` | FX refresh operations and failure behaviour |
| `docs/production-readiness-remediation-plan.md` | Technical/commercial/operational release gates |
| `scripts/namesilo-sandbox.mjs` | Local OTE-only diagnostic/operation CLI |

## 12. Handoff completion checklist

- [ ] Re-check current `main` HEAD and exact-commit CI.
- [ ] Re-check Vercel deployment state without changing deployment policy.
- [ ] Read the current OTE account/domain state before any mutation.
- [ ] Resolve the last reported sandbox management-request ambiguity.
- [ ] Complete customer/admin sandbox acceptance and record evidence.
- [ ] Complete technical hardening and authenticated E2E.
- [ ] Verify production credentials, funding and wholesale costs.
- [ ] Obtain separate approval for each required Production action.
