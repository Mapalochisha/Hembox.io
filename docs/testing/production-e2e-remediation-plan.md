# Production E2E Remediation Plan

**Target branch:** `main` (user-authorized direct changes)  
**Baseline:** `HEMBOX-E2E-2026-10-30`  
**Production data policy:** additive synthetic fixtures only; no real customer, payment, domain, pricing, or configuration records are to be changed.

## Client definition (must remain consistent)

A **client/customer account** is any `public.profiles` row whose role is explicitly in the base customer-role allowlist (currently `user`). Administrators and all elevated/privileged roles are excluded. A client account does **not** need a company/client record, enquiry, project, purchase, invoice, or payment to count. The `public.clients` table represents a separate company/workspace record linked to an account; it is not the source of truth for the customer-account count.

## Workstreams

- [ ] **F1 — Billing reconciliation API:** reproduce and inspect database errors, schema/policy contracts, and server logs; correct the read path without weakening authentication; distinguish unavailable data from a valid empty ledger.
- [ ] **F2 — Client definition and discovery:** use the explicit base-role allowlist for account counts and account directory; retain company/workspace records as a separate concept and explain that distinction in UI.
- [ ] **F3 — Session security review:** trace current Supabase browser/server auth and cookie lifecycle. Do not merely append cookie flags or set a client-readable role cookie and call it secure. Implement a supported server-managed session architecture only if compatible with existing flows; verify server-side role checks remain authoritative. Document any platform/library constraint that cannot safely be solved in this pass.
- [ ] **F4 — Login redirect:** honour a validated same-origin `next` destination; otherwise route admins to `/admin/dashboard` and base customer accounts to `/portal`.
- [ ] **F5 — Mobile drawer:** Escape closes the drawer; verify focus restoration and existing close/navigation behavior.
- [ ] **F6 — Admin denial UX:** authenticated non-admin accounts receive a clear no-access destination with a link to `/portal`; admin authorization remains server-side.
- [ ] **F7 — Homepage SVG:** locate and correct the two malformed path definitions; add or extend a regression check where practical.
- [ ] **Safe E2E fixtures:** use a clearly named disposable base-user test account and uniquely labelled `HEMBOX-E2E` project/milestone/service fixtures. For billing, use only a zero-value/draft test invoice if schema and business rules explicitly permit it; never create or verify a payment, claim, refund, or settlement. Record exact fixture IDs for controlled cleanup.
- [ ] **Verification:** run repository CI, relevant unit/integration tests, then authenticated production checks for the repaired paths and role matrix. Re-run only safe workflows; do not perform real-money or registrar actions.

## Release gates

- [ ] No destructive production data operations.
- [ ] CI checks green for the final `main` commit.
- [ ] Vercel production deployment READY for that commit.
- [ ] Production smoke tests pass for F1–F7 and customer/admin access control.
- [ ] Any workflow still blocked by lack of safe billing fixtures is reported honestly, not marked passed.

## Execution notes

The 30 October E2E report created synthetic conversation/message/file/notification records under the disposable account. Do not broadly delete or alter them; cleanup requires identifying exact IDs and confirming ownership first.
