# HEMBOX Tech — Authenticated Customer & Admin End-to-End Test

**Target:** Production — https://hembox.tech  
**Repository:** `Mapalochisha/Hembox.io`  
**Test type:** Full authenticated functional, authorization, workflow-continuity, regression, responsive and security acceptance test  
**Execution:** Independent tester; record evidence for every test  
**Important:** This is a production test plan. Use only the two disposable test identities and records explicitly created for this run. Do not edit, delete, refund, fulfil, or otherwise touch real customer records.

---

## 1. Objectives and completion standard

Verify the complete customer-to-admin-to-customer lifecycle, not merely whether each page loads:

1. A customer can authenticate, use every client-portal area, submit requests, exchange messages, follow project/service progress, and manage billing/domain enquiries.
2. An administrator can authenticate, see the same customer activity in the admin workspace, act on it, and produce the expected customer-visible result.
3. State changes persist across navigation, refresh, logout/login, and a second role's session.
4. Customer A cannot read or mutate Customer B's records; a normal customer cannot access admin pages, APIs, or admin-only data.
5. UI state, API responses, database state, notifications, audit history, and displayed totals remain consistent.
6. No production payment, domain registration, DNS mutation, or irreversible external operation is triggered.

**Pass rule:** Every applicable P0/P1 test passes, no unresolved security/data-isolation defect remains, and all P2 failures are documented with severity, evidence, and an owner. Mark tests **N/A** only with a reason. A page rendering without verifying its underlying action is not a pass.

## 2. Production safety rules

- Use a unique run label, for example `E2E-2026-10-30-<short-random>`, in every test company, project, conversation, invoice note, and file name where the UI permits.
- Use only synthetic names, addresses, descriptions, and files. Do not use real customer details.
- Do not use real payment details, submit a genuine transfer, upload a real receipt, or mark a real payment as settled.
- Do not register, transfer, renew, delete, or change DNS for a real domain. Domain search/quote may be tested only if the UI explicitly reports that checkout/registration is disabled; stop before any purchase or payment step.
- Do not enable live payment gateway settings or change NameSilo credentials, TLD catalogue, exchange rates, markups, or customer-facing prices.
- Do not alter existing production records. The current database inventory showed no rows in the core client/project/billing/domain tables, but there is existing inquiry/message data and four payment-method rows. Treat all pre-existing records as protected.
- Do not use SQL to fabricate business records or bypass application workflows. Create test data through the product UI/API as a real user would.
- Never put passwords, access tokens, cookies, service-role keys, API keys, or payment secrets in this repository, screenshots, test notes, or issue reports.
- Stop and report immediately if a test unexpectedly exposes or modifies another customer's data, changes a real payment/domain state, or performs an irreversible action.

## 3. Disposable test identities — provisioning required

Create two separate identities in the **Hembox.io production Supabase project** (`jygxbernkptzhoyksoie`):

| Identity | Suggested email | Required role | Purpose |
|---|---|---|---|
| Customer | `qa.customer+<run-id>@<controlled-test-mailbox-domain>` | `user` | Full client journey |
| Administrator | `qa.admin+<run-id>@<controlled-test-mailbox-domain>` | `admin` | Full admin journey and cross-role continuity |

Use mailboxes controlled by the project owner/test coordinator. Do not use an address that belongs to an unrelated person.

### Provisioning procedure

1. In Supabase Dashboard → Authentication → Users, create the two users with unique, randomly generated passwords. Enable email confirmation for these test accounts only if required by the project's current auth configuration.
2. Confirm each identity has a corresponding `public.profiles` row. The customer profile must have `role = 'user'`; the administrator profile must have `role = 'admin'`.
3. Set the admin role only on the dedicated disposable admin profile. Never change the role of an existing human account. Confirm the application role resolver (`get_user_role`) returns admin for this identity.
4. Sign in once with each identity and verify the expected landing route. If a profile row is not created automatically, stop and investigate the signup/profile trigger rather than inserting a profile or changing auth tables manually.
5. Deliver the two credentials to the tester through a password manager or another private, expiring channel. **Do not add credentials to this Markdown file, GitHub, email threads, or test screenshots.**
6. Record the two Auth user UUIDs in the private test evidence, not in this public-to-repository test document.

**Provisioning limitation:** The available Supabase connection for this run exposes project/database operations but not the Supabase Auth Admin create-user/invite-user operation. Therefore these two Auth identities have **not** been created by this task. The steps above are required before execution; no credentials have been invented or represented as active.

### Cleanup

After sign-off, disable/delete only the two identified disposable Auth users using Supabase Dashboard → Authentication → Users. First remove their test-created application records through supported admin/UI workflows where available. Verify no test records remain. Never delete by broad email/domain matching, and never delete any pre-existing inquiry/message or unrelated row. If audit retention requires preserving test records, mark them as test data and document that decision instead of deleting them.

---

## 4. Test setup and evidence

- Production URL: `https://hembox.tech`
- Browser: current Chrome/Firefox; run desktop and mobile viewport checks.
- Use a clean browser profile for each identity. Keep customer and admin sessions separate.
- Capture: test ID, timestamp, role, URL, action, expected result, actual result, pass/fail, screenshot/video reference, and relevant request/response correlation ID (redacted).
- For stateful tests, record before/after values and verify by reloading the page or signing in as the other role.
- Test with both a fresh session and a returning session. Include one full logout/login cycle per role.
- Do not expose session cookies or bearer tokens in DevTools screenshots.

### Seed records (created only through the app)

Create the following using the customer/admin UI and this run's unique label:
- One customer company profile.
- One project covering a non-website service category (e.g. branding or app development) to verify HEMBOX is represented as a multi-service digital partner.
- At least two milestones, one deliverable, and one change request if those admin controls are available.
- One client-service record in a safe test status.
- One support conversation with multiple alternating messages.
- One notification-producing event.
- One test file only if the file area provides a safe upload path; use a harmless synthetic PDF/image.
- One invoice only if the admin billing UI supports creating a draft/test invoice without sending a real payment request. Do not create a real payable invoice if no test/draft mechanism exists.
- Domain quote/search only, stopping before payment/registration. Do not enable registration for testing.

If any seed action is unavailable, record it as a product gap and continue with the remaining independent tests.

---

## 5. Customer journey — functional acceptance

### C01 — Authentication and session lifecycle [P0]
- Open `/login`; verify login form, validation, password visibility behavior (if present), and clear error for invalid credentials.
- Sign in as the disposable customer.
- Expected: customer is authenticated and routed to the client workspace; no admin navigation or admin-only content is visible.
- Refresh the page; navigate directly to `/portal`; verify session continuity.
- Open a protected portal URL in a new tab; verify it remains authenticated.
- Sign out; verify protected portal URLs redirect to login and no stale private data remains visible.
- Sign back in; verify the account and its test data remain intact.

### C02 — Portal shell, navigation and responsive behavior [P1]
- Check sidebar/navigation links: Overview, My projects, My services, Domains, Files, Bills & payments, Messages & support, and Account settings.
- Verify active-route indication, browser back/forward, direct deep links, mobile menu open/close, menu dismissal after navigation, keyboard focus, and no horizontal overflow.
- Verify avatar/profile menu and logout behavior.
- Check empty, loading, success, error and retry states where applicable.

### C03 — Overview dashboard [P1]
- Verify workspace heading and company context.
- Verify summary cards for active projects, active services, outstanding billing, domains, conversations/messages, notifications and recent activity where data is available.
- Verify each card's number/value agrees with its detail page and seeded records.
- Verify recent projects/activity order and links.
- Refresh and revisit: no duplicate counts, stale values, or unexplained changes.
- Confirm the dashboard is not misleading when the account has no projects/services/invoices.

### C04 — Projects [P0]
- Open My projects; verify list, status, search/filter, empty state and refresh.
- Open the seeded project and verify name, category, description, status, deadline and activity.
- Verify milestones and progress are shown accurately.
- Verify deliverable visibility/download/preview and access restrictions.
- Submit a change request if supported; verify validation, duplicate-submit protection, confirmation and customer-visible pending state.
- Refresh and sign out/in; verify persistence.
- Verify the customer cannot edit admin-controlled project status, budgets, internal notes, other clients' projects, or deliverable metadata.

### C05 — Services and service catalogue [P1]
- Open My services; verify service inventory, status, project association, dates, currency and refresh.
- Open service catalogue; inspect active service categories, descriptions, inclusions and request CTA.
- Submit a service request for a synthetic non-website service (branding/app development) using the run label.
- Verify the selected service/product is retained in the resulting inquiry/conversation and is not silently replaced by a generic website request.
- Verify duplicate submission and validation behavior.

### C06 — Files [P1]
- Open Files; verify list, loading/empty states and supported file metadata.
- If upload is supported, upload only the synthetic test file; verify it appears, opens/downloads, and remains after refresh.
- Verify customer cannot access another customer's file by changing URL/object ID or guessing a storage path.
- Verify unauthorized file types/oversized files are rejected with a safe message.
- Verify signed URLs expire or are access-controlled as designed; no public bucket exposure.

### C07 — Bills & payments [P0]
- Open `/portal/bills`; verify summary cards: Outstanding Balance, In Review, Total Paid.
- Verify tabs: All invoices, Unpaid, Under review, Paid; search by invoice ID/service; invoice detail and line items.
- Verify statuses and totals reconcile with invoice/payment allocations and currency. Test partial-payment display if the seeded draft invoice supports it.
- Verify payment-method instructions show the configured method/currency and are not stale or malformed.
- If safe test invoice exists, submit a **test-only** payment claim with synthetic transaction reference and note; upload no real receipt. Verify claim enters review and customer sees pending state.
- Verify customer cannot mark a claim verified, edit invoice totals, alter payment allocations, or access another customer's invoice.
- Verify arrangement/partial-payment request flow if enabled: submit, view pending state, then verify admin response in C14.
- Do not make a real transfer or invoke any payment gateway.

### C08 — Domains [P0]
- Open `/portal/domains`; verify order list, status, currency, registration/renewal price display and refresh.
- Run a domain availability/quote enquiry only if the UI explicitly allows read-only search/quote in the current disabled-registration state.
- Verify validation for malformed domains and unavailable/unconfigured provider states.
- Verify quote expiry, provider/check timestamp and checkout-disabled messaging where applicable.
- Verify a repeated request does not create duplicate orders (idempotency).
- Stop before payment, registration, transfer, renewal or DNS change. No live domain purchase is part of this test.

### C09 — Messages and support [P0]
- Open Messages & support; verify threads, status, timestamps, message ordering and selected-thread behavior.
- Send a customer message on the seeded test thread.
- Verify message appears once, persists after refresh, and is attributed to the customer.
- Verify empty-message and over-limit validation, send-in-progress state, retry behavior and duplicate-send protection.
- Keep this thread open for the admin continuity tests.

### C10 — Notifications and account settings [P1]
- Verify avatar/sidebar unread counter matches notifications endpoint and notification list.
- Trigger an admin reply or project event later in this plan; verify unread count increments and read state behaves correctly.
- Open Account settings; verify account identity and notification preferences.
- Change one preference, save, refresh, and verify persistence; restore original values before cleanup.
- Verify toggling a preference does not affect another preference or another user.

---

## 6. Admin journey — functional acceptance

### A01 — Admin authentication and route protection [P0]
- Sign in with the disposable admin identity.
- Verify admin route and navigation access, including `/admin/dashboard`.
- Open admin deep links directly and refresh.
- Sign out; verify admin pages and APIs are inaccessible.
- In a separate clean browser profile, sign in as the customer and request `/admin/dashboard` plus representative admin API endpoints directly. Expected: redirect/403; no admin HTML, counts, data, or mutations leak.
- Verify a missing/invalid session receives 401/redirect and a non-admin receives 403 from protected APIs.

### A02 — Admin dashboard [P1]
- Verify total clients, total projects, active projects, revenue/budget summary and recent clients.
- Compare values with test records and underlying business meaning. Confirm budget totals are not mislabeled as cash revenue or collected payments.
- Verify empty-state behavior and refresh consistency.

### A03 — Client management [P0]
- Locate the seeded customer/company.
- Verify profile, contact, status and associated records.
- Verify search/filter/sort/pagination if present.
- Update a harmless test-only field/status if supported; verify audit/activity record and customer-visible impact.
- Verify admin cannot accidentally select or modify a different existing client during test.
- Verify customer-facing profile data does not expose internal notes.

### A04 — Project operations [P0]
- Locate the seeded project.
- Update a test milestone/status; add a deliverable; respond to the change request.
- Verify required fields, valid status transitions, save feedback, error handling and duplicate submission behavior.
- Verify activity/audit trail records who changed what and when.
- Switch to customer session and verify the exact approved changes appear there after refresh.
- Verify project data remains associated with the correct client when navigating between clients.

### A05 — Service operations [P1]
- Review the customer's service request and/or client-service record.
- Change only test record status using supported workflow.
- Verify the customer sees the new status and dates.
- Verify service lifecycle changes do not mutate project status or invoice/payment state unexpectedly.

### A06 — Messaging/inbox continuity [P0]
- Locate the customer thread and read the message from C09.
- Reply as admin.
- Verify sender role, ordering, timestamp, and persistence.
- Return to customer session: verify admin reply appears exactly once, unread counter changes, and customer can reply.
- Reply as customer; return to admin; verify the new customer reply appears in the same thread.
- Repeat after refresh and after each role signs out/in. This is the core cross-role continuity test.
- Verify an admin cannot accidentally reply to the wrong customer thread; test empty/oversized messages and duplicate submission.

### A07 — Billing administration [P0]
- Locate the test invoice/payment claim/arrangement if safely created.
- Verify invoice details, line items, currency, due date and status.
- Review the test payment claim; request more information or reject it if those are reversible supported actions. Verify customer sees the exact status/note.
- If a verified-payment action is available, use it **only** on a clearly identified synthetic claim with no real funds and only if the workflow supports a safe test state. Otherwise do not mark paid; record verification as not safely testable in production.
- Verify a claim submission does not itself mark an invoice paid.
- Verify partial payments, allocations, outstanding balance, in-review totals and total-paid summary reconcile.
- Verify an admin cannot allocate a payment to the wrong invoice/customer.
- Verify every state transition creates the expected billing event/audit record.
- Do not issue a refund, initiate a transfer, or use a payment gateway.

### A08 — Domain operations and provider pricing [P0]
- Open admin domain operations and provider health pages.
- Verify TLD catalogue, order list, quote details, audit history and operational status render with correct empty states.
- Open Admin → Domains → Provider Prices; retrieve current read-only price data only if live credentials/configuration are already available and the endpoint reports a safe read-only operation.
- Verify registration and renewal are distinct; currency/source/time are visible; no provider key or wholesale secret is exposed to browser/network response.
- Verify non-admin receives 403 for `/api/admin/domains/provider-prices`.
- Do not enable TLDs, change prices/FX/markup, reconcile real payments, or fulfil an order.
- Confirm live registration remains disabled unless separately approved after commercial launch gates.

### A09 — Admin settings, audit and navigation [P1]
- Inspect all admin navigation destinations and verify no dead links, blank pages, console exceptions or unexpected redirects.
- Verify agency settings can be viewed safely. Do not change production contact details, terms, privacy policy, payment settings or branding.
- Verify audit/activity history for the test actions and that sensitive values are redacted.
- Verify admin mobile navigation, keyboard operation and responsive layouts.

---

## 7. Cross-role continuity matrix — mandatory

Execute each row in sequence and record the before/after evidence.

| Step | Customer session | Admin session | Expected continuity |
|---|---|---|---|
| 1 | Creates service/project inquiry | Finds inquiry in admin inbox | Same inquiry ID, selected service and customer association |
| 2 | Sends message | Reads and replies | Message order and authorship preserved |
| 3 | Refreshes messages | Sends second reply | Customer receives one copy; unread count updates |
| 4 | Opens project | Changes milestone/status | Customer sees same updated status and activity |
| 5 | Submits change request | Reviews/decides | Decision and note appear to the correct customer |
| 6 | Views deliverable | Publishes/adds deliverable | Correct file is visible only to owning customer |
| 7 | Views service inventory | Changes test service status | Customer status/date updates; unrelated records unchanged |
| 8 | Submits safe payment claim | Reviews claim | Claim is pending until explicit admin action; totals reconcile |
| 9 | Requests payment arrangement | Responds to arrangement | Customer sees admin decision and agreed terms |
| 10 | Requests read-only domain quote | Reviews order/quote in admin | Same quote/order identity; no purchase or registration occurs |
| 11 | Opens notification/settings | Triggers event/reply | Notification count and preference state are consistent |
| 12 | Signs out/in | Signs out/in | Persistent records remain; no session leakage across roles |

**Continuity acceptance:** No missing/duplicated messages, stale status, lost form submissions, cross-customer associations, inconsistent totals, or changes visible only in one role. Any eventual-consistency delay must be measured and documented; refresh must converge to the authoritative state.

---

## 8. Authorization, privacy and negative tests [P0]

Run with customer identity and, where possible, a second disposable customer identity created only if the owner authorizes it. Do not use another real customer's account.

- Customer requests another user's project, invoice, file, conversation, domain order, payment claim and notification by changing IDs in URL/body. Expected: 404/403 or empty result; no metadata leakage.
- Customer attempts admin route and admin API access. Expected: redirect/403; no mutation.
- Customer alters request payload fields such as `user_id`, `customer_id`, `client_id`, `role`, `status`, `amount`, `currency`, `verified_by`, or ownership IDs. Expected: server derives identity and protected values; forged ownership/role/status/amount is rejected or ignored.
- Customer attempts to mark invoice paid, claim verified, project complete, or domain registered. Expected: denied.
- Admin API called without session or with customer session. Expected: 401/403.
- Confirm no service-role key, NameSilo key, Lenco secret, payment secret, or other server credential appears in HTML, JavaScript bundles, source maps, client network responses, logs, or errors.
- Check responses for unnecessary personal data and internal notes.
- Confirm RLS prevents cross-customer access even when a user calls Supabase APIs directly with their own session.
- Verify all mutation endpoints validate input, enforce ownership/role server-side, and use safe error messages.
- Verify logout invalidates application session and protected pages do not render cached private data after logout.

Do not attempt destructive SQL, brute force, denial-of-service, credential stuffing, or production data extraction.

---

## 9. Reliability, regression and UX checks

- Refresh every major page after data is created or changed.
- Open deep links directly and use browser back/forward.
- Test slow network/offline recovery for list loads and form submissions where feasible.
- Confirm loading indicators terminate; retry buttons recover from transient errors.
- Confirm forms prevent accidental double submission and show useful validation.
- Check console and network for uncaught exceptions, failed API calls, hydration warnings, 4xx/5xx responses, and mixed-content errors.
- Check mobile widths (320, 375, 390, 430 px) and desktop (1280+ px): no clipped navigation, overlapping dialogs, unreadable tables or horizontal page overflow.
- Check keyboard navigation, visible focus, labels, headings, button names, form errors and contrast.
- Check dates/time zones and ZMW/USD currency formatting.
- Verify empty data states are informative and do not imply false zero revenue or paid status.
- Verify no unsupported payment/domain capability is presented as live or complete.
- Record response times for dashboard and major list endpoints; flag repeatable slow or hanging requests.

---

## 10. Runtime and backend verification

After the browser journey:
1. Review Vercel production deployment status and build/runtime logs for the test window.
2. Review Supabase Auth, Postgres and API logs for the same time window.
3. Correlate unexpected 401/403/404/409/422/429/5xx responses with the test action.
4. Confirm no server exception, auth callback loop, profile lookup failure, RLS denial on legitimate owned data, or leaked secret.
5. Confirm expected denials for negative authorization tests are not misclassified as product failures.
6. Re-run failed tests after a fix; record exact deployment commit and test time. Do not mark a test passed against a different deployment than the one recorded.

---

## 11. Test result register

Copy this table into the private execution report and fill every row.

| Test group | Result (Pass/Fail/Blocked/N/A) | Evidence reference | Defect / notes |
|---|---|---|---|
| Customer authentication/session | | | |
| Portal shell/navigation/responsive | | | |
| Overview dashboard | | | |
| Projects/milestones/deliverables/change requests | | | |
| Services/catalogue | | | |
| Files | | | |
| Bills/invoices/payment claims/arrangements | | | |
| Domains/read-only quote | | | |
| Messages/support | | | |
| Notifications/settings | | | |
| Admin authentication/route protection | | | |
| Admin dashboard | | | |
| Client management | | | |
| Project operations | | | |
| Service operations | | | |
| Admin inbox/reply continuity | | | |
| Billing administration | | | |
| Domain operations/provider prices | | | |
| Admin settings/audit/navigation | | | |
| Cross-role continuity matrix | | | |
| Authorization/privacy/RLS | | | |
| Reliability/regression/UX | | | |
| Vercel/Supabase runtime review | | | |
| Cleanup and account disablement | | | |

### Defect severity

- **P0 — Critical:** cross-customer data exposure, role bypass, unauthorized financial/domain mutation, secret exposure, production data loss, or broken authentication affecting all users. Stop testing.
- **P1 — High:** core customer/admin workflow blocked, state corruption, messages/billing/projects not continuous, or material incorrect financial/status display. Do not sign off.
- **P2 — Medium:** feature-specific defect with a safe workaround; document and assign.
- **P3 — Low:** cosmetic, copy, minor layout or non-blocking usability issue.

## 12. Final sign-off

The tester must report:
- Production URL and exact deployment commit tested.
- Test date/time and browser/device.
- Customer and admin Auth user UUIDs (private report only).
- Pass/fail/blocked counts by severity.
- Completed cross-role continuity rows.
- All P0/P1 defects and supporting evidence.
- Any tests blocked because a feature is intentionally disabled (payment gateway, live domain registration, DNS, renewals).
- Vercel and Supabase runtime findings.
- Confirmation that only run-labelled disposable records were touched and cleanup/disablement was completed.

**Release recommendation:** PASS only when all applicable P0/P1 checks pass, the continuity matrix passes, and runtime/security review has no unresolved critical/high issue. Otherwise report FAIL or BLOCKED with precise reasons. A successful login or green build alone is not production acceptance.
