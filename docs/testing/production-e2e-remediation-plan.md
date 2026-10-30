# Production E2E Remediation Plan

**Target branch:** `main` (user-authorized direct changes)  
**Baseline:** `HEMBOX-E2E-2026-10-30`  
**Production data policy:** additive synthetic fixtures only; no real customer, payment, domain, pricing, or configuration records are to be changed.

## Client definition (must remain consistent)

A **client/customer account** is any `public.profiles` row whose role is explicitly in the base customer-role allowlist (currently `user`). Administrators and all elevated/privileged roles are excluded. A client account does **not** need a company/client record, enquiry, project, purchase, invoice, or payment to count. The `public.clients` table represents a separate company/workspace record linked to an account; it is not the source of truth for the customer-account count.

## Workstreams

- [x] **F1 — Billing reconciliation API (code change; authenticated production verification still required):** reproduce and inspect database errors, schema/policy contracts, and server logs; correct the read path without weakening authentication; distinguish unavailable data from a valid empty ledger.
- [x] **F2 — Client definition and discovery:** use the explicit base-role allowlist for account counts and account directory; retain company/workspace records as a separate concept and explain that distinction in UI.
- [x] **F3 — Session security review (partial hardening; HttpOnly remains open):** trace current Supabase browser/server auth and cookie lifecycle. Do not merely append cookie flags or set a client-readable role cookie and call it secure. Removed the client-writable `user_role` cookie (middleware already uses the validated Supabase user plus `get_user_role` RPC), and configured `Secure` in production plus `SameSite=Lax` for browser/server cookie writes. **HttpOnly is intentionally not forced:** the current `@supabase/ssr` browser client must read/write its session cookie for refresh; setting HttpOnly on that cookie without migrating sign-in, refresh, OAuth/OTP callbacks, and sign-out to a server-managed auth flow would break sessions. Treat HttpOnly as a separate auth architecture migration, not as safely completed here. Server-side admin role checks remain authoritative.
- [x] **F4 — Login redirect:** honour a validated same-origin `next` destination; otherwise route admins to `/admin/dashboard` and base customer accounts to `/portal`.
- [x] **F5 — Mobile drawer:** Escape closes the drawer; verify focus restoration and existing close/navigation behavior.
- [x] **F6 — Admin denial UX:** authenticated non-admin accounts receive a clear no-access destination with a link to `/portal`; admin authorization remains server-side.
- [x] **F7 — Homepage SVG:** locate and correct the two malformed path definitions; add or extend a regression check where practical.
- [x] **Safe E2E fixtures (project and draft invoice; no claim/payment):** use a clearly named disposable base-user test account and uniquely labelled `HEMBOX-E2E` project/milestone/service fixtures. For billing, use only a zero-value/draft test invoice if schema and business rules explicitly permit it; never create or verify a payment, claim, refund, or settlement. Record exact fixture IDs for controlled cleanup.
- [ ] **Verification:** run repository CI, relevant unit/integration tests, then authenticated production checks for the repaired paths and role matrix. Re-run only safe workflows; do not perform real-money or registrar actions.

## Release gates

- [ ] No destructive production data operations.
- [ ] CI checks green for the final `main` commit.
- [ ] Vercel production deployment READY for that commit.
- [ ] Production smoke tests pass for F1–F7 and customer/admin access control.
- [ ] Any workflow still blocked by lack of safe billing fixtures is reported honestly, not marked passed.

## Execution notes

The 30 October E2E report created synthetic conversation/message/file/notification records under the disposable account. Do not broadly delete or alter them; cleanup requires identifying exact IDs and confirming ownership first.


## Current execution record (2026-10-31)

- Main commit under verification: `6836dc57f4a2b3cd44454051a56f5cd2a8410b34`.
- GitHub CI: all three jobs passed (domain schema integration, lint/type check, production build).
- Vercel production project is `hembox-io` (custom domains `hembox.tech` and `www.hembox.tech`). Do not deploy this repository to the separate `hembox` project.
- Vercel production deployment for the commit above reached `READY`; public homepage, login page, and access-denied page returned HTTP 200. Runtime error aggregation showed no reconciliation errors during the smoke-test window. Authenticated API/portal journey still requires an authenticated browser session.
- Synthetic production fixture IDs (all linked to disposable account `client@disposable.com`):
  - Client/workspace: `9cac258c-8cb9-41d1-8d76-b764659e2205`
  - Project: `39b49c7c-cfe3-4e85-af23-8afb99a0cfa4`
  - Milestone: `9b24de1e-1ca9-4b98-a4fa-da971b459a66`
  - Draft invoice: `498bdeb3-3a33-4aff-b999-086fcfaaea9b` (`E2E-2026-1031-01`, ZMW 0, explicitly non-payable)
  - Invoice line item: `2d68acb3-98e5-47d1-b322-ca1b8f21c55f`
- No payment claim, payment ledger row, settlement, domain operation, or real customer record was created or modified.
