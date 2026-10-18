# HEMBOX.io domain reselling: implementation plan

## Current stage

The public `/domains` page remains enquiry-led. Provider-independent pricing policy and catalogue APIs are now being built around the registrar interface; no TLD is seeded or enabled without verified source costs. A server-only Domain Name API OT&E adapter is now implemented behind the registrar contract for sandbox availability checks. It returns unknown when the provider response is unrecognized, does not provide prices, and has no registration/renewal/DNS capability. Live registration and payment are still disabled.

The pricing layer now uses integer minor-unit arithmetic, an explicit FX scaling convention, basis-point markup, upward rounding, a 24-hour freshness gate, and restricted price-history snapshots. Admins can maintain a TLD catalogue through role-protected server routes. Public catalogue responses expose retail-only ZMW prices and never imply domain availability. This foundation is not a live quote or checkout.

## Current blockers and reliability notes

- Domain Name API OT&E availability is not yet verified: requests currently return an authentication/permissions message and `unknown` availability. The user reports the provider IP whitelist is empty; the provider's [v2 migration troubleshooting guide](https://www.domainnameapi.com/knowledge-base/account-management/v2-migration-integration-error-troubleshooting-guide) says IP whitelisting is mandatory, making this a likely blocker but not proof of the only cause. Official materials conflict on the current domain-check route and credential shape: the [quick-start](https://www.domainnameapi.com/knowledge-base/account-management/how-to-start-domain-reselling) documents `/v1/domain/check` with `resellerId`, `apiKey`, and `domain`, while newer v2 guidance references the newer API structure. The OT&E Swagger page could not be inspected through the available path. Confirm endpoint, OT&E Reseller ID/key pairing, and Vercel outbound-IP requirements with support before changing network assumptions.
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
2. **Provider sandbox:** validate the Domain Name API OT&E request/response contract against the current Swagger and real sandbox responses; confirm credentials, supported TLDs, rate limits, and error behavior. Add and run response-normalization and adapter contract tests.
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
