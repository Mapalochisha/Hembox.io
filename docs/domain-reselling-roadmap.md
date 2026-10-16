# HEMBOX.io domain reselling: implementation plan

## Current stage

The public `/domains` page accepts enquiries only. The first backend slice defines a server-only registrar contract and a guarded availability endpoint. No real registrar API is called, no domain can be purchased or registered, and no prices or availability are fabricated.

## Product decisions

- Primary customer-facing currency: ZMW. Keep provider wholesale amounts and currency separate from retail prices; apply an explicit, reviewable FX and margin policy before displaying quotes.
- Domain purchase must be possible without buying a HEMBOX website-development package.
- Do not introduce existing-customer discount logic until there are customers and actual unit economics to justify it.
- Start with an enquiry-led customer journey. Do not accept payment for a domain until provider availability, final pricing, payment confirmation, and registration reconciliation are implemented.
- DNS is a provider capability behind the adapter; it is not exposed as a customer control until authorization, auditability, and provider support are ready.

## Phases

1. **Foundation:** registrar interface, provider capability flags, input validation, explicit disabled/mock modes, domain-order data model and audit requirements.
2. **Provider sandbox:** verify the selected registrar's API contract, credentials, supported TLDs, rate limits, sandbox semantics, and error behaviour. Build an adapter with contract tests.
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
