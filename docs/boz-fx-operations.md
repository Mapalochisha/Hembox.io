# Bank of Zambia FX refresh — operations

## Commercial policy
- Reference: Bank of Zambia USD/ZMW published middle rate.
- Buffer: K1.00 per USD.
- Markup: 10% (1,000 basis points).
- Minimum gross margin: K25 (2,500 ZMW minor units).
- Retail rounding: upward to the next K1.
- Registration and renewal are calculated independently.

## Data source
The authoritative publication is the Bank of Zambia exchange-rate page:
https://www.boz.zm/markets-securities/boz-exchange-rates

The Bank of Zambia site is dynamically rendered and does not publish a documented public JSON API. The scheduled integration currently uses the AllRatesToday open JSON republication of the BoZ table:
https://allratestoday.com/api/open/central-bank/boz

AllRatesToday is a third-party transport layer, not a BoZ-operated API. HEMBOX requires the bank identity, USD/ZMW pair, middle rate, publication date and non-derived status. It stores the official source URL and retrieval URL for audit. Periodically compare the feed with the BoZ page.

## Schedule and secrets
Vercel Cron invokes `/api/cron/domain-fx-refresh` daily at 14:00 UTC (16:00 CAT). Set a high-entropy `CRON_SECRET` in the Vercel Production environment. The endpoint accepts only `Authorization: Bearer <CRON_SECRET>`.

Optional server-only `BOZ_FX_API_URL` overrides the default feed endpoint. Never use a `NEXT_PUBLIC_` prefix for either variable.

## Run and verify
1. Admin → Domains → TLD catalogue shows the latest saved FX snapshot.
2. Select **Refresh FX now** to perform an authenticated manual refresh.
3. Confirm publication date, BoZ middle rate, K1 buffer and effective rate.
4. Confirm catalog prices recalculate and price-history snapshots are recorded.
5. Confirm the enabled/disabled state of every TLD is unchanged.
6. Check Vercel Cron invocations after the daily scheduled run.

## Failure behaviour
- HTTP/feed errors, malformed data, missing middle rates, derived rates, future dates and rates older than five calendar days fail closed.
- No fallback market rate is invented.
- Existing saved FX and prices are left untouched if feed validation fails.
- TLDs with missing wholesale costs, non-USD currency, sandbox/test provenance or wholesale costs older than 30 days are skipped.
- Wholesale costs must be re-verified at least every 30 days. FX refresh updates the FX price timestamp but never resets the separate wholesale-cost verification timestamp. Quotes fail closed when the wholesale-cost verification is stale.
- FX refresh never enables a TLD and does not bypass the live-provider quote gate.

## Schema
- `public.domain_fx_rate_snapshots`: append/upsert keyed by source, currency pair and actual BoZ publication date.
- `public.domain_price_snapshots`: price history includes wholesale costs, effective FX, 10% markup, K25 floor and calculated retail prices.
