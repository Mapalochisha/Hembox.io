# Domain pricing inputs — how to obtain and approve verified costs

> **Purpose:** the operating procedure for obtaining the commercial inputs that gate M3/M11: verified registration and renewal costs, an approved USD/ZMW source and rate, and an approved per-TLD markup. No TLD may be enabled, and no customer price may be published, until every step below is complete and recorded.
>
> **Owner decisions required:** FX source, markup policy and the launch TLD set. Everything else can be executed by an administrator.
>
> **Related:** [domain-reselling-build-plan.md](./domain-reselling-build-plan.md) §3.1–§5, [namesilo-ote-investigation.md](./namesilo-ote-investigation.md).

## 0. The gate (do not skip)

A TLD may be enabled only when **all** of these are recorded:

1. registration cost in provider currency, from the provider, with a retrieval timestamp;
2. renewal cost in provider currency, for the same term basis;
3. an approved FX source **and** the observed rate with its timestamp;
4. an approved markup in basis points for that TLD (or for the TLD group);
5. a saved catalogue row whose retail price was recalculated by the server;
6. a written approval reference recorded in the row's `pricing_source`.

Until then the TLD stays `enabled = false`. The public catalogue shows nothing, and `/api/domains/quotes` refuses to quote (`price_unavailable`).

## 1. Retrieve provider costs — sandbox first

The price reader now follows `DOMAIN_PROVIDER_MODE`; it no longer forces the production endpoint.

1. In the Vercel environment (server-side only, never `NEXT_PUBLIC_*`):
   - `DOMAIN_PROVIDER_MODE=namesilo-sandbox`
   - `NAMESILO_SANDBOX_API_KEY=<OTE key>`
2. Sign in as an administrator and open **Admin → Domains → Wholesale price reference** (`/admin/domains/provider-prices`).
3. Press **Retrieve rates**. The endpoint is read-only: it persists nothing, enables nothing and never logs the key.
4. The response is labelled `environment: test`, and the screen shows a sandbox warning. Record every value you plan to use:

| TLD | Registration (USD) | Renewal / year (USD) | Environment | Retrieved at | API key used |
|---|---|---|---|---|---|

**Sandbox caveat:** OTE is for rehearsing the flow. NameSilo sandbox pricing is not guaranteed to match production pricing. Repeat step 1–4 against the production account **before** approving any customer-facing price, and record both retrievals.

**Provider caveat:** NameSilo's `getPrices` returns the schedule for the account making the call. The reader sends `retail_prices=1` to ask for public retail rates; that query parameter is **not confirmed** in NameSilo's published API reference, so treat the numbers as account pricing and verify them against the NameSilo control panel when you switch to the production key. Do not assume Discount Program rates — quote from standard pay-as-you-go.

## 2. Decide the launch TLD set

- Start with one or two TLDs you can support operationally (`.com` is the safest default for Zambian businesses that need international recognition).
- **`.zm` / `.co.zm` reality check:** NameSilo does not appear to sell Zambian ccTLDs; `.zm` registration runs through ZICTA-accredited registrars. Do not advertise `.co.zm` until a provider relationship and priced contract exist. If local domains are required for launch, that is a separate commercial task, not a catalogue entry.
- Exclude any TLD whose renewal price you have not verified — renewal is a separate line item the customer sees.

## 3. FX source and cadence (approved policy)

HEMBOX uses the Bank of Zambia USD/ZMW middle rate, retrieved through a machine-readable republication at `https://allratestoday.com/api/open/central-bank/boz`. This is a third-party transport layer, not a BoZ-operated API. The authoritative publication remains `https://www.boz.zm/markets-securities/boz-exchange-rates`. The integration validates a direct published middle rate and stores both source URLs.

Choose one source, write it down, and never mix sources inside a single snapshot:

- **Official:** Bank of Zambia published daily ZMW/USD rate (best for an auditable, citable rate).
- **Market API:** a commercial FX feed, if you prefer intraday accuracy and can store the response reference.

Rules:

- Vercel Cron refreshes daily at 16:00 CAT and stores the actual BoZ publication date plus retrieval timestamp.
- Encode the rate as `wholesale_fx_rate_micros = round(ZMW per USD × 1_000_000)`.
- Do **not** hand-edit retail prices; the server recalculates them from cost × FX × markup.
- Prices older than 24 hours are suppressed automatically (`price_stale`), so someone must own the daily refresh. Suppression is the safe failure mode — it never shows a stale price.

## 4. Markup policy (owner decision)

- HEMBOX launch markup is **10% (1,000 basis points)**.
- Apply a **K25 minimum gross margin** (2,500 ZMW minor units) after FX conversion.
- Add a **K1.00 per USD** buffer to the BoZ middle rate, then re-price daily.
- Record provenance for every price: BoZ middle rate date, K1 buffer, 1,000 bp markup and K25 minimum margin.

## 5. Enter and enable the catalogue

Admin → Domains → TLD catalogue (`/admin/domains`):

1. Enter the TLD, provider (`namesilo`), wholesale currency (`USD`), registration and renewal costs in **minor units** (cents), the FX micros, the markup basis points, and a `pricing_source` string that names the evidence:
   `namesilo-standard:2026-11-02;fx=BOZ:2026-11-02:28.00;markup=2000bp;approved=MC`
2. Save. The server recalculates the ZMW retail price, rejects inconsistent snapshots, and writes a price-history record.
3. Leave **enabled** off until every value has been reviewed. Enable only when both registration and renewal retail prices exist.
4. Verify the public catalogue (`/domains`) shows the price with "availability is checked separately", and that the quote endpoint returns a quote for an available domain in that TLD.

## 6. Rehearse the purchase lifecycle in the sandbox

With `DOMAIN_PROVIDER_MODE=namesilo-sandbox`:

1. Admin → Domains → Provider diagnostic: confirm availability parsing for a `.com` domain.
2. As a test customer: `/portal/domains` → request a live quote (this requires a **live** provider environment; in sandbox the quote endpoint correctly refuses with `live_provider_required`, so use a staging Supabase project with the sandbox provider only for availability work).
3. Registrant details → save → consent recorded.
4. Payment: submit a manual payment claim with a **test** transaction reference, verify it as an admin, and confirm the invoice reaches `paid` and the order reaches `payment_confirmed`. No real money moves.
5. Register a disposable test domain in the NameSilo OTE account (sandbox funds), then record it through the guarded manual fulfilment action with the real sandbox order reference and expiry date.
6. Confirm the audit trail shows the registrant capture, the payment evidence source and the registration record.

## 7. Approval record to complete before launch

| Input | Value | Source / evidence | Observed at | Approved by |
|---|---|---|---|---|
| FX source | | | | |
| FX rate | | | | |
| Launch TLDs | | | | |
| Markup per TLD | | | | |
| Minimum margin floor | | | | |
| Daily refresh owner | | | | |
| Production cost re-verification | | | | |

## 8. Still blocked outside this procedure

- Production NameSilo credential and account funding route (the sandbox fund is disposable and does not fund production registrations).
- Production provider price re-verification before enabling any TLD.
- Explicit authorization to accept real customer payments after the sandbox rehearsal passes.
