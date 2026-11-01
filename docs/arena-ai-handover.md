# Arena AI handover — HEMBOX Tech domain reselling

> **Status:** written 2026-11-01. Production database, GitHub `main` and Vercel were
> queried while writing this. Where something is unverified, it says so.
>
> **Scope:** everything delivered across the three merged pull requests (#15, #16, #17) and
> everything still owed. Read §4 (configuration truth) before running any test, and §6
> (pending work) before starting any new work.

## 1. Repository and current state

| Item | Value |
|---|---|
| Repository | `Mapalochisha/Hembox.io` |
| Assignment base | `663fd27` |
| `main` at handover | `2caf2eb` — *Merge pull request #17* |
| Stack | Next.js 14 + Supabase Postgres, deployed on Vercel at `hembox.tech` |
| Production Supabase project | `jygxbernkptzhoyksoie` |
| Domain tables in production | all empty (0 rows in every `domain_*` table) |

### Merged pull requests

| PR | Branch head | Merge commit | Contents |
|---|---|---|---|
| #15 | `f512075` | `27ae938` | M6 payment-evidence reconciliation, M4 registrant capture, fail-closed registrant gate |
| #16 | `25b8a85` | `21a2e70` | Sandbox-first NameSilo price retrieval, `vercel.json` main-only deployments, `docs/domain-pricing-inputs.md` |
| #17 | `67f0593` | `2caf2eb` | Registrant migration applied to production, `PUBLIC` privilege leak fixed, SQL regression test, docs updated |

### CI and deployment evidence

| Target | Commit | Result |
|---|---|---|
| CI `41315931514` (`main`) | `21a2e70` | success |
| CI `41315415144` (`main`) | `27ae938` | success |
| CI `41315649994` (branch) | `25b8a85` | success |
| CI `41316197312` (branch) | `67f0593` | success |
| CI `41316419312` (`main`) | `2caf2eb` | success |
| Vercel production | `21a2e70`, `2caf2eba` | success (Git deployments restored) |
| Vercel preview | `25b8a85`, `67f0593` | success |

## 2. What was implemented

### 2.1 M6 — payment evidence reconciliation for fulfilment

`record_domain_manual_registration()` requires **settled** payment evidence before a
registration can be recorded: either a verified manual claim, or a linked billing invoice that
is `paid`, fully allocated by `billing_payment_allocations`, and belonging to the same customer,
order and currency. A receipt or transaction reference alone is never sufficient. The audit
event records which evidence path was used (`domain_manual_claim` / `unified_billing_invoice`)
with the invoice totals — never the raw payment reference.

### 2.2 M4 — registrant capture before payment

- New table `domain_order_registrant_details`: one row per order, read-only to the owning
  customer, readable by admins, RLS enforced with two SELECT policies.
- Writes only through `save_domain_order_registrant_details()`, which checks order ownership,
  refuses changes once registration has started, and writes an audit event recording registrant
  type, country and consent version **without copying address or contact values**.
- `record_domain_manual_registration()` refuses to run when registrant details are absent.
- Customer-facing capture exists on the checkout/portal path with the consent version recorded.

### 2.3 Fail-closed correction (owner review item)

A registrant check that could not be evaluated previously passed. It now **blocks** the payment
claim. Every unsatisfied or unevaluable condition is a refusal, not a warning.

### 2.4 Sandbox-first NameSilo pricing

`getNameSiloStandardPrices()` previously hard-coded the production endpoint and
`NAMESILO_API_KEY`, which made sandbox verification impossible and silently preferred the
production key. It now resolves through `DOMAIN_PROVIDER_MODE`:

| `DOMAIN_PROVIDER_MODE` | Host | Credential |
|---|---|---|
| `namesilo-sandbox` | `ote.namesilo.com` | `NAMESILO_SANDBOX_API_KEY` |
| `namesilo` | production API | `NAMESILO_API_KEY` |
| anything else / unset | — | **refuses** ("not the configured domain provider") |

The reader is read-only: it persists nothing, enables nothing and never logs the key. It returns
`environment` (`test` / `live`), and `/admin/domains/provider-prices` displays that environment
with an OTE warning banner.

### 2.5 Deployment policy restored

`vercel.json` re-enables Git deployments for `main` only (`$schema` + `"main": true`),
replacing `git.deploymentEnabled: false`. Previews stay off; feature branches build in CI only.

### 2.6 Privilege defect found in production and fixed

The first application of the registrant migration revoked the save function from `anon` and
`authenticated` but **not from `PUBLIC`**, so PostgreSQL's default EXECUTE grant still allowed
both roles to call it. Production was corrected to
`REVOKE ... FROM PUBLIC, anon, authenticated`. `supabase/tests/domain_registrant_details.test.sql`
now asserts that neither `save_domain_order_registrant_details` nor
`record_domain_manual_registration` is executable by `anon`/`authenticated`, and that both are
executable by `service_role`.

## 3. Production database state

24 migrations applied. The 20 original ones were applied 2026-10-24 → 2026-10-26 (earlier docs
claiming nothing had been applied were wrong). Added during this work:

| Version | Name | Note |
|---|---|---|
| `20261101141742` | `domain_fulfilment_payment_evidence` | applied in one step |
| `20261101142511` | `domain_registrant_details_table` | split for safety |
| `20261101142524` | `domain_registrant_details_save_function` | split for safety |
| `20261101142538` | `domain_manual_registration_requires_registrant` | split for safety |

The split was necessary because the Supabase Management API returned HTTP 502 on the single large
migration. Once it recovered, the object was confirmed **absent** (no partial state) before the
retry.

Post-application verification in production: table present; RLS enabled; 2 policies; both
functions present; `record_domain_manual_registration()` references the registrant table;
`service_role` has EXECUTE and `anon`/`authenticated` do not.

## 4. Configuration truth — read this before testing

**The domain provider is not configured on production.** In Vercel project `hembox-io`,
`DOMAIN_PROVIDER_MODE`, `NAMESILO_SANDBOX_API_KEY` and `NAMESILO_API_KEY` exist only with target
`preview`, scoped to the branch `feature/domain-reselling-platform`. Production carries only the
six original Supabase/Cloudinary variables.

Consequences on `hembox.tech` today: the price reader refuses by design, availability search
cannot reach NameSilo, and no catalogue row exists (every domain table is empty). Public pages
load correctly and `/api/domains/catalog` returns an empty catalogue — the intended state until a
TLD is approved.

Test accounts exist and are email-confirmed: `admin@disposable.com` (`role = admin`) and
`client@disposable.com` (`role = user`); neither has a `profiles` row. Passwords are held by the
owner and must never be committed.

See [`vercel-reconfiguration.md`](./vercel-reconfiguration.md) for the exact fix.

## 5. Milestone status

| Milestone | State | Notes |
|---|---|---|
| M0 Foundation | done | |
| M1 Registrar selection and commercial verification | partial | NameSilo chosen; **production key and funding still outstanding** |
| M2 NameSilo read-only adapter | partial | adapter and OTE path work; production key never used; OTE returns `114` for out-of-account names |
| M3 Pricing policy and TLD catalogue | partial | schema, server recalculation and staleness rules exist; **no cost, FX or markup input approved; no TLD enabled** |
| M4 Cart, checkout and durable orders | partial (merged) | registrant capture, consent and fail-closed gate done; full purchase path not rehearsed |
| M5 Manual payment workflow | partial | claims, evidence reconciliation and admin verification exist |
| M6 Registration and provisioning | partial (merged) | guarded manual fulfilment with settled-payment evidence |
| M7–M9 Dashboard, admin console, DNS/renewals | partial / missing | catalogue, claims and price-reference admin pages exist; renewals and DNS not built |
| M10 Security and QA | partial | fail-closed gates, privilege tests, CI SQL suites; **M10a rate limiting not started** |
| M11/M12 Launch and post-launch | not started | blocked on commercial inputs and payment authorization |

## 6. Pending work, in recommended order

1. **Configure production** — add `DOMAIN_PROVIDER_MODE=namesilo-sandbox` and
   `NAMESILO_SANDBOX_API_KEY` (Sensitive) to Vercel **Production**, all branches, then redeploy.
   Verify `/admin/domains/provider-prices` reports `Environment: test`.
2. **Obtain the pricing gate inputs** — registration *and* renewal cost from the provider for the
   same term basis, recorded with environment, timestamp and key used. OTE values are indicative
   and cannot authorise a published price.
3. **Approve commercial inputs** — FX source and rate, markup in basis points, ZMW minimum margin
   floor, launch TLD set (`.com` recommended), daily refresh owner.
4. **Seed the catalogue disabled** — enter approved values, let the server recompute the ZMW
   retail price, review, then enable.
5. **Price reference → catalogue handoff** — carry verified costs from the admin reader into a
   pre-filled catalogue form so approval inputs cannot be mistyped or half-entered.
6. **Authenticated E2E on `hembox.tech`** — price reader, registrant capture, manual claim,
   guarded fulfilment. Requires a signed-in session.
7. **M10a rate limiting** — the next unstarted milestone.

## 7. Blockers and external dependencies

- Production NameSilo credential and account funding — **owner has explicitly deferred** until the
  sandbox flow is proven. Do not switch.
- Zambian funding route — provider access expected 2026-11-02. Not blocking.
- Real payments and live registration — sandbox only, by standing instruction.
- `DOMAIN_MANUAL_PAYMENT_INSTRUCTIONS` is read by `src/app/api/domains/manual-payment/route.ts`
  but its production value has not been verified.

## 8. Known unknowns — do not paper over

- `retail_prices=1` is sent to NameSilo but is **not documented** in their published API
  reference; treat returned numbers as account pricing.
- OTE pricing fidelity versus production is unverified. An earlier diagnostic showed the OTE
  account balance as `300`, not 5,000 — confirm in the OTE panel.
- In sandbox mode the quote endpoint correctly refuses with `live_provider_required`, so a *full*
  purchase-path rehearsal in sandbox cannot obtain a live quote. Decide whether sandbox rehearsal
  is availability-only (manual/seed quotes) or whether a sandbox quote path is wanted.
- NameSilo does not sell `.zm`/`.co.zm`; those need a ZICTA-accredited registrar. Do not advertise.
- OTE maps out-of-account `getDomainInfo` lookups to code `114`; that is not evidence of bad input.

## 9. Constraints that must survive this handover

- Sandbox key only. No production registrar credential, and no registrar mutation, without an
  explicit owner decision.
- Never register a domain merely because an order is paid.
- Never fabricate availability, pricing, registration status or provider capability.
- A payment receipt or transaction reference is never proof of settlement.
- No TLD enablement without verified registration **and** renewal pricing.
- Gates fail closed; an unevaluable check blocks.
- Secrets never enter the repo, never use `NEXT_PUBLIC_*`, and are never echoed to a client.
- Re-verify CI and Vercel per commit; never assume an older result covers a newer commit.

## 10. Files that matter

| Path | Purpose |
|---|---|
| `docs/domain-reselling-build-plan.md` | canonical plan, assessment §3.1, milestones, progress log |
| `docs/domain-reselling-roadmap.md` | progress notes and blockers |
| `docs/domain-pricing-inputs.md` | how to obtain and approve costs, FX, markup; enable a TLD |
| `docs/vercel-reconfiguration.md` | restoring the production provider configuration |
| `docs/namesilo-ote-investigation.md` | OTE behaviour, `114` findings, support questions |
| `docs/namesilo-sandbox-testing.md` | sandbox testing notes |
| `src/lib/domains/providers/namesilo-prices.ts` | price retrieval and environment resolution |
| `src/lib/domains/providers/namesilo-config.ts` | endpoint and credential resolution |
| `src/app/api/admin/domains/provider-prices/route.ts` | read-only admin price reader |
| `src/app/admin/domains/provider-prices/page.tsx` | reader UI with sandbox banner |
| `supabase/migrations/20261101110000_domain_registrant_details.sql` | M4 schema and functions |
| `supabase/migrations/20261101090000_domain_fulfilment_payment_evidence.sql` | M6 evidence rules |
| `supabase/tests/domain_registrant_details.test.sql` | ownership, immutability, RLS, privileges |
| `.github/workflows/ci.yml` | applies migrations, runs SQL suites |
| `vercel.json` | main-only Git deployments |

## 11. Local verification

```bash
npm ci                                     # node_modules is required and not in git
npx tsc --noEmit                           # type check
npm run lint                               # 0 errors expected
npm run test:domains                       # 72 + 24 assertions
node --experimental-strip-types --test tests/namesilo-prices.test.mjs   # 7 assertions
```

Any new caller of the price reader must set `DOMAIN_PROVIDER_MODE`, otherwise it fails closed.

## 12. Resuming after this handover

Start from a new branch off `main`. A merged branch cannot accept commits or pushes — Arena closes
it, so a follow-up must be a fresh branch. First actions: execute §6 in order, beginning with the
production configuration.
