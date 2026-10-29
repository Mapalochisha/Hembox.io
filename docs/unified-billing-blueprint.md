# Hembox Tech Unified Billing — Blueprint & Progress Record

> Canonical implementation handoff. Update this document as decisions, milestones, and verification results change.
>
> **Last updated:** 2026-10-23  
> **Repository:** Mapalochisha/Hembox.io  
> **Working branch:** feature/unified-billing-platform  
> **Base branch:** feature/domain-reselling-platform  
> **Status:** Financial schema and first customer/admin billing workflows implemented; later workflow phases remain in progress. Not merged or released.

## 1. Objective

Build one auditable billing system for every Hembox Tech charge: website plans, domain registration and renewals, add-ons, and custom work. Customers need one place to view invoices, understand balances, submit payment claims, request alternative arrangements, and track reviews. Administrators need controlled review and reconciliation.

The billing engine must be independent of any registrar or future payment gateway. Launch uses manually collected payments; gateway checkout and signed webhooks remain deferred until separately approved and funded.

## 2. Decisions locked in

- **Coverage:** website plans, domains and renewals, add-ons, and custom work.
- **Default currency:** ZMW for new customer quotes and invoices.
- **USD:** only when the client explicitly requests it and the product/quote supports USD. Display and confirm currency and total before acceptance. Never silently convert or switch currencies.
- **Invoice currency is immutable** after issuance, except through an explicit, audited amendment/credit/reissue process. Keep client currency preference separate from a specific quote or invoice currency.
- **Partial payments are supported from launch.** Track invoiced amount, verified payments, allocations, and remaining balance independently.
- **A submitted receipt/transaction reference is a claim, not proof of settlement.** An invoice balance changes only when an authorized administrator verifies funds and a payment allocation is recorded.
- **Custom payment arrangements begin in Hembox Tech messaging.** A request is linked to the customer, invoice, and relevant conversation; states are pending, approved, declined, or cancelled. Agreement is not payment.
- **External communication** (e.g. WhatsApp) is optional fallback only. Agreed terms must be recorded in Hembox Tech and confirmed in the portal.
- **All methods use the same verification and allocation controls.** Alternative arrangements never bypass review.
- **Domain fulfilment remains separate.** Verified payment/allocation can make an order eligible for fulfilment; it does not prove domain registration succeeded.
- **No production migration, real payment collection, registrar mutation, or merge** without explicit approval and completed release gates.

## 3. Core model and invariants

### Records

1. **Invoices** — customer, human-readable invoice number, currency, issue/due dates, status, totals, and immutable commercial snapshot.
2. **Invoice items** — description, product/source reference, quantity, unit amount, line total, and metadata snapshot. Values are copied at issue time; later catalogue/plan edits do not rewrite issued invoices.
3. **Payment methods/instructions** — administrator-configured options and customer-facing instructions. Snapshot the exact instruction version shown to a customer on each claim.
4. **Payment claims/evidence** — transaction reference, claimed amount/currency, optional note, and secure receipt metadata/path. Claim states remain separate from invoice financial status.
5. **Verified payments** — payment events confirmed by an authorized reviewer or, later, verified gateway/reconciliation.
6. **Payment allocations** — ledger entries allocating verified payment amounts to one or more invoices. This supports partial payments and eventually one payment covering multiple invoices.
7. **Arrangement requests** — requests for a custom schedule/method, linked to invoice and existing conversation; approval captures agreed terms and actor/time.
8. **Billing events/audit trail** — append-only record of issue, submission, review, allocation, amendment, void, reversal, and arrangement decisions.

### Invoice status

- draft, unpaid, partially_paid, paid, overdue, void.
- Overdue is derived from due date and outstanding balance, or materialized only through a safe, tested rule.
- Under review is **not** an invoice status. It is a payment-claim indicator shown alongside the actual financial state.
- Do not delete issued financial records or allocations. Use explicit voids, credit/adjustment records, or reversal entries with audit evidence.

### Claim status

- submitted, needs_info, verified, rejected, withdrawn.
- Re-submission after a request for information preserves history; it must not overwrite review evidence without an event.
- Only authorized review can turn a claim into a verified payment. Review must be idempotent and prevent double allocation.

### Money and currency

- Use integer minor units and database integer/numeric arithmetic; never use floating-point money arithmetic.
- Currency is a three-letter ISO code stored per invoice/payment/allocation.
- A payment can only be allocated to an invoice in the same currency unless an explicit, separately reviewed FX conversion record exists. No implicit FX or mixed-currency arithmetic.
- Amounts allocated cannot exceed verified payment amount or invoice outstanding balance.
- Totals are server/database-calculated, never trusted from client input.
- Partial payment leaves the invoice partially paid until fully allocated. Overpayment handling must be explicit rather than silently allocating excess.

## 4. Payment evidence and storage

- Allow PNG, JPG/JPEG, and PDF evidence with a strict size limit, MIME/extension validation, randomized object paths, and private storage.
- Do not put receipt bytes or public storage URLs in ordinary database fields. Store private object key and minimal metadata; serve through authorized, short-lived access.
- Customers can read only their own invoices, claims, allocations, and arrangement requests. Admin review requires server-verified admin role. Service-role writes remain server-only.
- Never expose service-role credentials or payment secrets to browser code.
- Retain review actor, timestamps, reason, idempotency key, and relevant before/after references in audit events.

## 5. Custom payment arrangement workflow

1. Customer opens a conversation from an invoice and submits a structured arrangement request.
2. Request records invoice, customer, conversation reference, requested terms, currency, reason, and pending status.
3. Admin may approve or decline with a recorded note. Approval snapshots accepted terms and due dates/schedule; it does not mark anything paid.
4. Customer confirms proposed terms in the portal. If they do not accept, the arrangement stays unconfirmed or is cancelled.
5. Every resulting payment claim follows normal evidence review and verified-payment allocation.
6. If communication moved to WhatsApp or another channel, final terms and customer confirmation are still recorded in Hembox Tech.

The conversation/message is a communication record, not a financial ledger. Inspect the current messaging schema before binding arrangement requests to exact foreign keys; do not invent a parallel messaging system.

## 6. Domain integration

- Generalize the existing domain manual-payment workflow rather than create a competing domain-only billing system.
- Introduce generic invoice/claim/payment/allocation records in additive migrations.
- Link domain orders to their invoice/quote using a stable source reference and preserve existing order lifecycle protections.
- During migration, do not silently treat historical domain claims as generic verified payments. Add an explicit, auditable reconciliation/backfill plan if needed.
- Payment verification/allocation does not perform registration. Domain fulfilment remains a distinct, audited step requiring fresh availability/price checks and manual registrar action until registrar mutations are separately approved.

## 7. Customer experience: /portal/bills

- Summary cards: outstanding balance, claims under review, and total paid for the selected period/currency.
- Tabs: All, Unpaid, Under Review, Paid; search by invoice number, service, or source reference.
- Invoice rows/details: invoice number, service description, issue/due dates, currency, total, allocated payments, remaining balance, status, and actions to view/download invoice and submit a payment claim.
- Payment modal: configured method selection, instruction snapshot, amount (capped at outstanding balance for that claim), transaction reference, optional notes, and private receipt upload.
- After submission, the claim is under review while invoice remains unpaid/partially paid until verification.
- Show admin request-for-information/rejection notes and allow safe re-submission where permitted.
- Support ZMW and USD invoices without combining unlike currencies into a misleading single total. Label summary totals by currency.

## 8. Administrator experience

- Invoice issue/amend/void controls with audit history.
- Payment claim queue with evidence access, invoice/customer context, claimed amount/currency, transaction reference, and review actions: verify, request information, reject.
- Verification requires checking funds against the receiving account, not just the receipt image.
- Allocation UI/API must prevent duplicate verification, over-allocation, cross-currency allocation, and stale concurrent decisions.
- Payment method/instruction management with versioning and audit trail.
- Arrangement request queue linked to invoice and conversation.
- Reconciliation view showing invoice totals, verified payments, allocations, outstanding amounts, unmatched receipts, and discrepancies.
- Operational metrics and audit logs; never assume a customer claim is settled revenue.

## 9. Phased delivery

### Phase 0 — Blueprint and repository inspection
- [x] Record decisions and invariants in this document.
- [x] Inspect existing domain manual-claim/fulfilment implementation and current messaging entry points.
- [x] Confirm billing implementation surface and existing test harness.

### Phase 1 — Financial data foundation
- [x] Add additive invoice, invoice-item, payment-method, claim, verified-payment, allocation, arrangement-request, and billing-event schema.
- [x] Add RLS, explicit grants, server-only mutation paths, constraints, indexes, and append-only audit protections.
- [x] Add SQL integration tests for currency invariants, partial allocation, idempotency, permissions, over-allocation, invoice issuance, and invalid transitions.
- [ ] Do not apply migrations to production.

### Phase 2 — Domain integration
- [x] Define the domain-order-to-invoice path without bypassing existing quote/order guards. New domain quotes create one immutable invoice snapshot keyed to the saved quote/order; quote retry is idempotent.
- [x] Reconcile the existing domain claim workflow into the generic billing path, with no silent backfill. Verified legacy domain claims create verified ledger payments/allocations; generic full allocation advances the domain order to payment-confirmed.
- [x] Keep manual registration/fulfilment separate; paid status does not register a domain.

### Phase 3 — Customer billing
- [x] Build /portal/bills, invoice line-item details, print/save-as-PDF invoice statements, payment method/instruction selection, private receipt upload, claim state, and re-submission for claims needing information.
- [x] Link arrangement requests to the existing in-app messaging model. Customer/admin arrangement decisions and customer replies are linked to an invoice-scoped billing conversation.
- [x] Implement authentication/ownership checks, loading/error/empty states, responsive portal layout, and currency-separated totals. Runtime review still requires applying migrations to an approved non-production database.

### Phase 4 — Admin operations
- [x] Implement invoice issuance, safe voiding of unpaid non-domain invoices, claim review with atomic allocation, payment method/instruction management, arrangement review, reconciliation, and audit history. Manual reversal/refund operations remain a later controlled workflow.
- [x] Add admin-only server routes and atomic/idempotent SQL operations for invoice issuance, claim verification, arrangement review, domain invoice creation, and invoice voiding; SQL integration tests cover core transitions.

### Phase 5 — Product source integrations
- [x] Add stable source references and immutable pricing snapshots for website plans, domain registration/renewal, add-ons, custom work, adjustments, and other invoice types. Domain registration has automatic quote-to-invoice bridging; renewal scheduling and any future checkout integrations must use this same ledger.
- [x] Verify idempotent invoice creation and duplicate source protection in the schema/API; domain quote retries reuse the existing invoice.
- [ ] Keep gateway checkout and signed webhooks deferred.

### Phase 6 — Release gates
- [ ] Re-run all SQL integration tests, lint/type-check, and production build on the final documentation/implementation commit.
- [ ] Verify GitHub Actions CI is green for the exact final PR head.
- [ ] Verify Vercel Preview deployment is READY for the exact same final commit and inspect relevant deployment checks/logs where available.
- [ ] Record commit SHA, CI run URL, and Preview deployment URL here.
- [ ] No merge, production migration, production deployment promotion, live payment collection, or registrar mutation without explicit user approval.


> **Brand note (2026-10-29):** Current company name is Hembox Tech. Dated entries below retain the wording and URLs used at the time they were recorded; the GitHub repository and existing deployment identifiers remain unchanged during the rebrand.

## 10. Progress log

- **2026-10-23 — Blueprint recorded.** Confirmed scope, ZMW default / explicit USD choice, launch-time partial payments, and in-portal custom arrangements. Existing domain manual payment claims and manual registration are the integration baseline. No production data or configuration changed.
- **2026-10-23 — Foundation and first workflows implemented.** Added the unified billing schema, RLS/grants, append-only audit events, atomic claim review/allocation, atomic invoice issuance, SQL tests, customer /portal/bills page and claim submission API, admin invoice issuance, and admin claim review queue. SQL integration tests, lint/type-check, and production build passed for commit 5276f7e400fa0816f9929e6dfdab11cf5b9523ff. Vercel Preview is READY at https://hembox-k524dutj8-mapalochishas-projects.vercel.app for that exact commit. Verification links: CI https://github.com/Mapalochisha/Hembox.io/actions/runs/40005250944; Preview https://vercel.com/mapalochishas-projects/hembox-io/44JMYrNwbk71wzNX6JGkqRuNvPBH. This is a feature-branch milestone only; no merge or production migration occurred.
