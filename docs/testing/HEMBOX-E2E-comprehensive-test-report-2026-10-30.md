# HEMBOX Tech — Comprehensive End-to-End Test Report
### Customer Portal · Administrator Workspace · Cross-role Workflows

| | |
|---|---|
| **Site under test** | https://hembox.tech (live production) |
| **Report ID** | HEMBOX-E2E-2026-10-30 |
| **Report date** | 30 October 2026 |
| **Test window** | 30 Oct 2026, approx. **21:44 – 22:25** (Africa/Lusaka, UTC+2) |
| **Roles exercised** | Customer (`client@disposable.com`) and Administrator (`admin@disposable.com`), in separate isolated browser profiles |
| **Platform** | Next.js application on Vercel-class hosting, Supabase auth + storage (`jygxbernkptzhoyksoie.supabase.co`) |
| **Test basis** | Client-supplied brief: *“Production Customer & Admin Test”* (`uploads/production-authenticated-customer-admin-e2e-test.md`) |
| **Deliverables** | This report · `HEMBOX-E2E-test-evidence.html` (visual evidence) · `e2e/shots/` (104 screenshots) · `e2e/*.json` (raw machine results) |

---

## 1. Executive summary

The portal and the admin console are, on the whole, in good shape. Both roles authenticate reliably, every customer section and all twenty admin sections load, the responsive layouts hold up on phone, tablet and desktop, and — most importantly for this brief — **information genuinely passes between the two roles**. A customer service enquiry became an admin inbox conversation; an admin reply became a customer message, a customer notification and a visible status change; replies in both directions appeared exactly once, in the right order, and survived refreshes on both sides. Access control behaved correctly in every scenario I tested: unauthenticated visitors are pushed to sign-in, a signed-in customer cannot reach admin pages, and record-level lookups return “not found” rather than someone else’s data.

Against that, one feature is outright broken and one headline number is misleading:

* **`/admin/billing/reconciliation` cannot load its data** — the backing API returns HTTP 500 every time, so the panel shows “Unable to load billing reconciliation data.” and any real reconciliation content would be invisible. **(Medium)**
* **The dashboard reports “Total Clients 0”** while seven conversations and multiple registered accounts are visible elsewhere in the same console. The KPI is measuring *client company records*, not accounts, and reads as “you have no customers”. **(Medium)**

Four further items are low severity: a non-`HttpOnly`, non-`Secure` session cookie; customer sign-in landing on the marketing homepage instead of the portal; a mobile drawer that ignores the Escape key; and a silent bounce to the homepage when a customer opens an admin URL. Two malformed SVG icons also produce console errors on the public homepage.

**Verdict:** the customer-facing product and the customer↔admin messaging loop are releasable. The finance-reporting surface needs a fix (F1) and a labelling/definition decision (F2) before it can be relied on.

### 1.1 Result totals

| Status | Count | Meaning |
|---|---|---|
| **Pass** | 26 | Behaves as the brief requires |
| **Fail** | 1 | Defect found and reproduced (F1) |
| **Blocked** | 9 | Could not be exercised safely in production with the supplied accounts |
| **Low observations** | 5 | UX, wording, console hygiene, hardening |
| **Total mapped checks** | 36 | Sub-steps within a case are counted once |

No **Critical** or **High** severity issues were found. There was no exposure of another customer’s private data, no access-control failure, no financial or domain side effect, and no lost or duplicated data during the run.

### 1.2 Findings at a glance

| ID | Severity | Area | Summary | Status |
|---|---|---|---|---|
| F1 | **Medium** | Admin / Billing | `/admin/billing/reconciliation` data call returns HTTP 500; panel unusable | Open |
| F2 | **Medium** | Admin / Reporting | “Total Clients 0” and empty Clients table while accounts and conversations exist | Open (definition issue) |
| F3 | Low | Security hardening | Supabase session cookie is neither `HttpOnly` nor `Secure`; `user_role` cookie is client-readable | Open |
| F4 | Low | Auth / UX | Customer sign-in lands on `/` (marketing page) instead of `/portal`; `?next=` not honoured on direct sign-in | Open |
| F5 | Low | Accessibility / UX | Mobile navigation drawer does not close on Escape | Open |
| F6 | Low | UX consistency | Signed-in customer opening `/admin/*` is silently redirected to `/` (no “not authorised” state) | Open |
| F7 | Low | Front-end hygiene | Two malformed SVG `path d` attributes raise console errors on the public homepage | Open |
| N1–N4 | Note | Copy / IA | Domain quoting intentionally disabled; branding absent from catalogue; two admin nav labels differ from page titles; empty-state copy is consistently good | Informational |

---

## 2. Scope, method and environment

### 2.1 What was tested

* **Customer portal** (`/portal` and its ten sub-sections): sign-in/session lifecycle, navigation, dashboard accuracy, projects, services and the service-request flow, files (upload, persistence, signed-URL download), bills & payments (metrics, tabs, search), domains (read-only quote attempt), messaging, notifications and account preferences.
* **Administrator workspace** (`/admin/*`, twenty sections): sign-in/out, dashboard and analytics figures, clients, projects, client workspace, services, portfolio, pricing, domain catalogue / orders / manual payments / margins, billing invoices / claims / arrangements / methods / reconciliation, media, messages, settings.
* **Cross-role workflows**: enquiry → inbox; reply → notification; status change → customer visibility; bidirectional messaging persistence.
* **Non-functional passes**: refresh persistence after every write, browser back/forward, deep links, error surfaces, console/network noise, responsive layout at three widths, account-scoped record access.

### 2.2 What was deliberately not tested (and why)

| Area | Reason |
|---|---|
| Payments, refunds, payment claims, invoice issuing | Would create or move real money/records in production — prohibited by the brief |
| Domain registration, transfer, renewal, DNS, price/markup/FX edits | Production domain and commercial state — prohibited |
| Creating client/project/milestone records | Would write operational records into production; the brief requires “test-only” records and none pre-existed |
| Settings, portfolio, pricing, media, branding edits | Production configuration — prohibited |
| Phone OTP and Google sign-in on `/login` | No credentials or test numbers supplied; visible but out of scope |
| Registration (`/register`) | Out of scope |
| Anything touching other customers’ records | Prohibited; only the disposable thread was opened in the admin inbox |

### 2.3 Method

1. Each role got its own **isolated browser context** (separate cookie jar), so the sessions could not contaminate each other — the equivalent of two browser profiles.
2. All actions were driven through the **real UI** (no API shortcuts for writes; no SQL; no DB or provider consoles).
3. Every page visit captured: final URL, HTTP status, visible text, form inventory, console errors, failed (≥400) responses, `scrollWidth` vs `innerWidth` (overflow test) and a full-page screenshot.
4. After each write the page was refreshed and, where relevant, re-opened in the other role to confirm persistence and mutual visibility.
5. Domain and finance flows were stopped at the first step that could create real state.

### 2.4 Environment

| Item | Detail |
|---|---|
| Browser | Chromium 156 (Playwright-driven), headless |
| Desktop | 1440 × 900 |
| Tablet | 768 × 1024 |
| Mobile | 390 × 844 (phone emulation, not a physical handset) |
| OS | Linux sandbox (x86-64) |
| Network | Public internet; site responded HTTP 200 in ~1.7 s for the marketing homepage |
| Locale/timezone observed in app | Africa/Lusaka-style timestamps, e.g. “30 Oct 2026, 9:50 pm”, “30 Oct 2026, 9:55 pm” |

### 2.5 Phase timings

| Phase | Duration |
|---|---|
| Customer suite (C01–C10) | ≈ 189 s |
| Admin route sweep (20 pages) | ≈ 67 s |
| Admin interactive suite (A01–A08) | ≈ 110 s |
| Cross-role verifications | ≈ 110 s (two runs) |
| Supplementary probes (download, cookies, anonymous access, 404 handling) | ≈ 130 s |

---

## 3. Accounts and authentication

| Role | Account | Sign-in attempts | Result | Landing page |
|---|---|---|---|---|
| Customer | `client@disposable.com` | 4 (initial, after sign-out, cross-role, notification test) | All succeeded | `/` (homepage) — see F4 |
| Administrator | `admin@disposable.com` | 3 | All succeeded | `/admin/dashboard` (correct) |
| Anonymous | — | 1 (wrong password) | Rejected with inline *“Invalid login credentials”* | stays on `/login` |

* Sign-out works from both consoles and immediately invalidates access: subsequent `/portal/*` and `/admin/*` requests redirect to `/login`.
* Session survives hard refresh and is shared across tabs of the same profile (C01.3, C01.4).
* The `/login` page exposes **Email / Phone / Google** tabs; only Email was exercised.
* Cookies observed after customer sign-in:

| Cookie | HttpOnly | Secure | SameSite | Notes |
|---|---|---|---|---|
| `sb-jygxbernkptzhoyksoie-auth-token` | **false** | **false** | Lax | Supabase session token, readable by page JavaScript (F3) |
| `user_role` | **false** | **false** | Lax | Role hint readable/settable by JavaScript (F3) |

---

## 4. Findings register

### F1 — Billing reconciliation panel fails with HTTP 500 · **Medium** · Admin / Billing

**Observed.** `/admin/billing/reconciliation` renders its shell but displays a red banner *“Unable to load billing reconciliation data.”* The backing call `GET /api/admin/billing/reconciliation` returns **HTTP 500** with body `{"error":"Unable to load billing reconciliation data."}`. Reproduced twice, including after clicking **Refresh** and doing a full reload. All dependent panels stay empty: *Recent invoices*, *Verified payment ledger*, *Recent audit history*, *Outstanding by currency*. The three KPI tiles (Invoices 0 / Verified payment records 0 / Audit events loaded 0) show zeros that cannot be distinguished from “genuinely no data”, and are probably placeholders because the fetch failed.

**Impact.** The only screen intended to reconcile issued balances against verified payments is unusable. Because the 500 is server-side, the fault is in the aggregation query/route, not the client. With the current empty database the impact is invisible; with real invoices it would be a blind spot in financial control — and a support question the operator cannot answer.

**Steps to reproduce.**
1. Sign in as `admin@disposable.com`.
2. Open `https://hembox.tech/admin/billing/reconciliation` (nav: **Billing Reconciliation**).
3. Observe the red error banner and empty panels.
4. DevTools → Network: `GET /api/admin/billing/reconciliation` → 500 `{"error":"Unable to load billing reconciliation data."}`.
5. Click **Refresh** and reload the page: identical failure (100 % reproducible in ≥4 attempts across two sessions).

**Evidence.** `e2e/shots/a08_reconciliation_500.png`, `e2e/shots/admin_billing_reconciliation.png`

**Recommendation.** Inspect the server log for that route (likely a schema/join mismatch or a missing view/aggregate for the empty dataset). Until fixed, surface a clearer message distinguishing “no data” from “data unavailable”, and monitor the endpoint.

---

### F2 — Dashboard and Clients tell a different story from the rest of the console · **Medium** · Admin / Reporting

**Observed.** With a live customer account, seven inbox conversations and several registered accounts in the system, the console reports:

* Dashboard: **Total Clients 0**, Total Projects 0, Active Projects 0, Revenue K0.
* Analytics: same zeros (Total Revenue K0, Avg Budget K0, Active 0, Completed 0).
* Clients: table header only (`Client · Company · Contact · Status · Industry · Actions`); search for “disposable” returns nothing.
* Yet: Messages lists **7 conversations** including `client@disposable.com`; the **Billing Invoices** customer picker offers `client@disposable.com`, `admin@disposable.com` and two other accounts; the **Client Workspace** “Choose an account” picker offers `client@disposable…`.

**Impact.** Two consistent explanations exist — “clients” means *client company records*, which simply do not exist yet, or the aggregate query is broken. Either way the top-line KPI reads as “this business has no customers”, which will mislead the operator and undercut trust in the reporting. It also means there is no admin surface where an account-first customer (like this test account) can be inspected outside of billing/messaging.

**Steps to reproduce.**
1. Sign in as administrator.
2. `/admin/dashboard` and `/admin/analytics` → Total Clients 0, Revenue K0.
3. `/admin/clients` → empty table; search “disposable” → no rows.
4. `/admin/messages` → “All (7)” conversations, first is `client@disposable.com`.
5. `/admin/billing/invoices` → Customer dropdown lists `client@disposable.com` and others.

**Evidence.** `e2e/shots/admin_dashboard.png`, `e2e/shots/a03_clients.png`, `e2e/shots/admin_analytics.png`, `e2e/shots/a06_billing_invoices.png`

**Recommendation.** Decide and document the definition. If “clients” = company records, relabel the card (“Client records”, with a hint and a link to where accounts live) and add an empty-state explanation on `/admin/clients`. If it is meant to count customers, fix the query to include account-backed clients. Consider auto-creating a client record on first portal request so account-first customers are discoverable.

---

### F3 — Session cookie is not `HttpOnly` and not `Secure` · **Low (security hardening)** · Auth

**Observed.** After sign-in the cookies are set as: `HttpOnly = false`, `Secure = false`, `SameSite = Lax`. The session token is therefore readable by any JavaScript running on the origin, and would be eligible for transmission over plain HTTP.

**Impact.** Increases the blast radius of any future XSS or compromised third-party script on the site: the token can be exfiltrated directly rather than only being usable for in-page actions. The `user_role` cookie is likewise client-readable/writable — I did **not** test tampering with it (that would be attempting to bypass a security control), but authorisation must never trust it; it should be a UI hint only, with every server route re-checking the authenticated role.

**Steps to reproduce.** Sign in, then inspect DevTools → Application → Cookies for `hembox.tech` (or read the `Set-Cookie` headers on the auth response).

**Recommendation.** Move session handling to server-set cookies (`@supabase/ssr` pattern) with `HttpOnly; Secure; SameSite=Lax`. Confirm server-side that admin routes, admin API routes and storage policies all authorise on the validated JWT, not on `user_role`.

---

### F4 — Customer sign-in lands on the marketing homepage · **Low** · Auth / UX

**Observed.** Signing in from `/login` as the customer ends on `https://hembox.tech/` (public marketing page with a `CD` avatar in the header) — the portal must be opened manually. The administrator, by contrast, is redirected directly to `/admin/dashboard`. When a signed-out user opens a protected URL, the app correctly remembers the target (`/login?next=%2Fportal%2Fbills`), and after signing in from that flow the destination *is* honoured.

**Impact.** New and returning customers finish sign-in with no obvious next step; they may not realise a portal exists, and support gets “I logged in but nothing happened”.

**Steps to reproduce.**
1. Sign out. Open `https://hembox.tech/login`.
2. Sign in as `client@disposable.com`.
3. Observe the landing page is `/` rather than `/portal`.

**Evidence.** `e2e/shots/c01_after_login.png`

**Recommendation.** After successful customer sign-in, redirect to `/portal` (or to `?next=` when present). Mirror the admin behaviour.

---

### F5 — Mobile drawer ignores Escape · **Low** · Accessibility / UX

**Observed.** At 390 × 844 the customer workspace drawer opens correctly and lists all sections. Two explicit close controls exist (`Close navigation overlay`, `Close navigation`), and tapping a nav item navigates and closes the drawer. Pressing **Escape** leaves it open.

**Impact.** Minor keyboard/AT friction; no functional loss.

**Steps to reproduce.** Open `/portal` at mobile width → tap the menu button → press Escape.

**Evidence.** `e2e/shots/c02_mobile_menu_open.png`, `e2e/shots/c02_mobile_menu_after_escape.png`, `e2e/shots/x_mobile_drawer_after_nav.png`

**Recommendation.** Handle `Escape` in the drawer, and trap/restore focus while it is open.

---

### F6 — Customer hitting an admin URL is silently bounced to the homepage · **Low** · UX consistency

**Observed.** Signed out, `/admin/dashboard` and `/admin/clients` redirect to `/login` (correct). Signed in **as a customer**, the same URLs redirect to `/` — the public homepage — with no explanation, no 403 page, and nothing logged in the UI.

**Impact.** Access is correctly denied (good), but the behaviour is confusing for a legitimate user who follows a stale link, and it makes denial events hard to distinguish from ordinary navigation in logs/analytics.

**Steps to reproduce.** Sign in as the customer in one profile; request `https://hembox.tech/admin/clients`; observe redirect to `/`.

**Evidence.** `e2e/shots/x_customer_at_admin_clients.png`

**Recommendation.** Return a dedicated “You don’t have access to this area” page (with a link back to `/portal`) and keep the reason server-side.

---

### F7 — Malformed SVG paths raise console errors on the homepage · **Low** · Front-end hygiene

**Observed.** Loading `https://hembox.tech/` logs two console errors of the form `Error: <path> attribute d: Expected number, "…-14 4-4 9-6 14-6z"` / `"…-1 1-1.5 2-1.5 3z"` — the icons still render, but the path data is invalid. The customer portal and the admin console produced **no** console errors during the run (apart from the F1 network error).

**Impact.** Noise in error monitoring and a latent icon-rendering inconsistency across browsers.

**Steps to reproduce.** Open the homepage with DevTools → Console.

**Recommendation.** Fix or replace the two icon paths; add a console-error check to CI.

### Notes (informational, no action strictly required)

| ID | Note |
|---|---|
| N1 | **Domain quoting is intentionally disabled.** The portal answers a quote request with *“Live domain quoting is not configured yet. Please use the domain enquiry form. No payment or registration was attempted.”* — clear and honest. The public `/domains` page also states no TLD prices are published yet and that an enquiry does not reserve a domain. Consistent messaging. |
| N2 | **Branding is not a catalogue service.** Six services are published (Web development, SEO Optimization, School Information Systems, Mobile app development, Portfolio design, AI Workflow Intergration). The brief mentioned “branding and apps”; apps exist, branding does not — nearest are Portfolio design and Mobile app development. Confirm this is intended. |
| N3 | **Two admin nav labels differ from their page titles:** *Billing Claims* → “Payment claim review”; *Manual Payments* → “Manual payment review”; *Domain Orders* → “Domain order queue”. Not wrong, but the mixed vocabulary slows orientation. |
| N4 | **Empty-state and safety copy is consistently strong** across the portal (e.g. “Claims do not count as paid until verified”, “Quotes require live registrar confirmation…”). This is a genuine strength of the product and worth preserving as features grow. |

---

## 5. Detailed results — Customer portal (C01–C10)

> Legend: **PASS** meets the brief · **FAIL** defect · **BLOCKED** could not be exercised safely · evidence filenames are in `e2e/shots/`.

### C01 — Sign-in and session

| Step | Result | Observed |
|---|---|---|
| 1–2. Sign in, confirm portal | **PASS** (landing nit → F4) | Auth succeeded; `/portal` renders “Your workspace · client@disposable.com” with Overview as default. Landing URL after sign-in was `/` (F4). |
| 3. Refresh | **PASS** | Hard refresh stayed on `/portal`; workspace re-rendered from session. |
| 4. New tab | **PASS** | A new tab opened directly on `/portal` showed the signed-in workspace, no re-auth prompt. |
| 5. Sign out, then direct customer URL | **PASS** | Sidebar **Sign out** → `/login?next=%2Fportal`. All eleven portal routes were then requested anonymously and each redirected to `/login?next=<path>` — none rendered content. |
| 6. Sign in again | **PASS** | Repeat sign-ins worked throughout the run (4 in total for this account). |

**Evidence:** `c01_after_login.png`, `x_overview_full.png`
**Anonymous redirect map (all correct):** `/portal`, `/portal/projects`, `/portal/services`, `/portal/services/catalogue`, `/portal/services/request`, `/portal/bills`, `/portal/files`, `/portal/messages`, `/portal/domains`, `/portal/settings`, `/portal/notifications` → `/login?next=…` (HTTP 200 login page).

### C02 — Portal navigation and responsive layout

| Step | Result | Observed |
|---|---|---|
| 1–2. Visit each section | **PASS** | Ten sections, all HTTP 200, all with the correct page title and sidebar state: Overview, My projects, My services, Domains, Files, Bills & payments, Messages & support, Account settings, Notifications, Service catalogue. No console errors, no ≥400 API calls, no broken links. |
| 3–4. Desktop + mobile | **PASS** | Desktop 1440×900 and tablet 768×1024: `scrollWidth == innerWidth` on every page (no unwanted horizontal scrolling). Mobile 390×844: same on all ten pages; text readable; cards stack correctly. |
| Menus open/close | **PASS** (Escape nit → F5) | Drawer opens with all sections, closes on navigation, has two explicit close controls; Escape does not close it. |

**Evidence:** `c02_desktop_*.png` (10), `c02_mobile_*.png` (10), `c02_mobile_menu_open.png`, `x_tablet_messages.png`
**Overflow measurements:** desktop 1440/1440, tablet 768/768, mobile 390/390 on every section.

### C03 — Overview accuracy

| Check | Result | Observed |
|---|---|---|
| Cards, activity, summaries | **PASS** | On the pristine account: Active projects **0** (“0 projects in your workspace”), Active services **0** (“Currently active”), Outstanding balance **K 0.00** (“0 invoices to review”), Conversations **0** (rising to **1** after the service request). Recent activity and “Needs your attention” show correct empty states. |
| Counts agree with detail pages | **PASS** | My projects: “No projects connected yet”; My services: “No ongoing services recorded yet”; Bills: “No invoices found”. |
| Refresh consistency | **PASS** | Identical figures before/after refresh; the Conversations counter updated correctly once a thread existed. |

**Evidence:** `c02_desktop_Overview.png`, `x_overview_full.png`

### C04 — Projects

**Result: BLOCKED.**

My projects loads, the **Search projects…** box and the status filter (`All statuses / Draft / In progress / In review / Completed / Cancelled`) both respond correctly and return the empty state without error. However the disposable account has **no project records** (“No projects connected yet”) and the customer UI offers no way to create one, so project details, milestones, progress, deliverables and the change-request flow could not be exercised. Nothing was created.

**Evidence:** `c02_desktop_My_projects.png`, `c02_mobile_My_projects.png`

### C05 — Services and service enquiry

| Step | Result | Observed |
|---|---|---|
| 1. Service list & statuses | **PASS** | My services explains the difference between projects and ongoing services; empty state renders correctly. |
| 2. Catalogue (incl. services beyond web dev) | **PASS** | `/portal/services/catalogue` lists six published services. “Request this service” links carry the selection via query string and the form **preselects** it (verified value: `SEO Optimization`). |
| 3. Submit a labelled test enquiry | **PASS** | Submitted with service = SEO Optimization, timing = “As soon as possible”, budget = “not sure”, description and references prefixed `HEMBOX-E2E`. Confirmation banner: *“Request submitted — Your request has been sent to Hembox Tech. It is awaiting review; no project or quote is confirmed yet.”* with a **View messages →** link. |
| 4. Selected service reflected | **PASS** | The resulting conversation records category, requested service, timing, budget, references and the full brief. |

**Evidence:** `c05_catalogue.png`, `c05_request_preselected.png`, `c05_request_submitted.png`, `c05_messages_after_request.png`

### C06 — Files

| Step | Result | Observed |
|---|---|---|
| 1. Page states | **PASS** | Empty state, search field and uploader all render; supported types (images, SVG, PDF, ZIP, text, Markdown, JSON; 20 MB) stated. |
| 2–3. Upload a labelled file | **PASS** | Uploaded `HEMBOX-E2E-test-file.txt` (88 B) with description `HEMBOX-E2E synthetic test upload`; toast *“File uploaded to your private client library.”*; listed as “1 file(s)”, with type/size/date. Still listed after refresh. |
| 4. Open/download | **PASS** | The row’s **Download** button calls `GET /api/portal/files?fileId=<uuid>` (200) which returns a **short-lived Supabase signed URL** inside the account’s own folder; opened in a new tab and the content was verified. No other account’s files were accessible or opened. |

**Evidence:** `c02_desktop_Files.png`, `c06_files_after_upload.png`

### C07 — Bills & payments

**Result: BLOCKED.**

The page is complete and coherent: **Outstanding balance “—”**, **Claims under review 0**, **Total allocated “—”**, tabs **All invoices / Unpaid / Under review / Paid**, and a working search (`Search invoice or service…`), with the safety copy *“Submitting payment details only creates a claim for review…”*. The disposable account has **no invoices**, so invoice detail, line items and the payment-claim workflow could not be entered — submitting a claim against a non-existent invoice would either fail or create real financial state. Nothing was marked paid or verified.

**Evidence:** `c02_desktop_Bills_and_payments.png`, `c07_bills.png`

### C08 — Domains

**Result: BLOCKED / not safely testable.**

The portal domains page offers a read-only quote request. Submitting the invented domain `hembox-e2e-check-8412.com` produced a clear, honest refusal: *“Live domain quoting is not configured yet. Please use the domain enquiry form. No payment or registration was attempted.”* There is no checkout, registration, transfer, renewal or DNS surface to stop at — and none was attempted. The public `/domains` page (availability enquiry, TLD chips, “no current TLD prices published yet”) was reviewed read-only.

**Evidence:** `c08_domains.png`, `c08_domain_quote.png`, `m_public_domains.png`

### C09 — Messages and support (customer side)

| Step | Result | Observed |
|---|---|---|
| 1. Open/create conversation | **PASS** | One conversation existed (the service request). “New request” leads to the service-request form. |
| 2–3. Send labelled message | **PASS** | Sent `HEMBOX-E2E customer message — please reply so we can verify cross-role messaging.` Toast *“Message sent.”* |
| 4. Appears once, survives refresh | **PASS** | Exactly **one** thread bubble. (The raw text count of 2 on the page = one bubble + the conversation-list preview; verified visually and in the DOM.) Persisted after reload. |
| 5. Left for admin test | **PASS** | Conversation retained with message history, used by A05. |

**Evidence:** `c09_messages_list.png`, `c09_thread_open.png`, `c09_compose.png`, `c09_after_send.png`, `c09_after_reload.png`

### C10 — Notifications and settings

| Step | Result | Observed |
|---|---|---|
| 1. Notification list / unread counter | **PASS** | Initially “No notifications yet”. After the admin reply a real entry appeared: *“New reply from HEMBOX — Your HEMBOX team replied to a conversation — 30 Oct 2026, 9:55 pm”* with a **New** chip and bell badge **1**. |
| 2. Preferences | **PASS** | Five toggles (Project / Service / Billing / Domain / Messages) with **Save preferences**. Toggled “Project updates” off → saved → refreshed → state `[false,true,true,true,true]`; restored → `[true,true,true,true,true]`, matching the original. Profile fields are read-only and clearly labelled; sign-in security correctly delegated to the provider. |
| 3. Read state | **PASS** | **Mark all read** cleared the “New” chip and the button itself after refresh. |

**Evidence:** `c10_notifications.png`, `c10_settings_before.png`, `c10_settings_after_restore.png`, `x_customer_notifications_after_reply.png`, `m_notifications_marked_read.png`

---

## 6. Detailed results — Administrator workspace (A01–A08)

### A01 — Access and security

| Step | Result | Observed |
|---|---|---|
| 1–2. `/admin/dashboard` and navigation | **PASS** | Sign-in lands directly on the dashboard; “MANAGEMENT CONSOLE / Admin User / Active Session”; 20 nav destinations. |
| 3. Sections directly + refresh | **PASS** | All 20 routes opened by direct URL and refreshed cleanly. |
| 4–5. Sign out → admin URL | **PASS** | Sign-out returns to `/`; `/admin/dashboard` then redirects to `/login`. |
| 6. Customer tries admin workspace | **PASS** | With a live customer session, `/admin/dashboard` and `/admin/clients` redirect away (to `/`) and expose no admin data. Probe requests to plausible admin JSON endpoints (`/api/admin/clients`, `/api/admin/projects`, `/api/admin/stats`, `/api/admin/messages`) returned 404 HTML — no data leaked. See F6 for the UX nit. |

**Evidence:** `a01_admin_after_login.png`, `x_customer_at_admin_clients.png`

### A02 — Dashboard

**PASS with observation.** Cards, labels and typography render cleanly at both widths; totals are internally consistent between Dashboard and Analytics; empty states (“Recent Clients — No clients found.”) are deliberate rather than broken. The **Total Clients 0** reading is misleading → **F2**.

**Evidence:** `admin_dashboard.png`, `admin_analytics.png`, `a_mobile_dashboard.png`

### A03 — Client and project records

**Result: BLOCKED.** No client company record and no project exist for the disposable account, so there was nothing to open, no milestone/status to change and no change request to answer. `/admin/clients` (Add Client, search) and `/admin/projects` (“No projects yet”) were inspected. The **Client Workspace** builder (tabs: Client / Project / Service / Milestone / Deliverable, plus the “link existing non-admin account” picker that offers `client@disposable.com`) was examined but **not submitted** — creating client/project records in production is outside the safe scope of this test.

**Evidence:** `a03_clients.png`, `admin_client-workspace.png`, `admin_projects.png`

### A04 — Services

**Result: BLOCKED.** The enquiry reached the administrator, but as an inbox conversation (source `client-portal`) rather than a service record: Client Workspace reports Services 0, and `/admin/services` manages only the public catalogue (six ACTIVE offerings with “Edit basics”/“Details”). There was therefore no enquiry status to advance. To still prove that a customer sees an admin-side change, the **conversation status** was moved `new → in progress`, which the portal does display (see A05).

**Evidence:** `a04_services.png`, `admin_services.png`

### A05 — Inbox and messaging

| Step | Result | Observed |
|---|---|---|
| 1–2. Find the C09 conversation and reply | **PASS** | Opened only the `client@disposable.com` thread; replied `HEMBOX-E2E admin reply — administrator test response…`. Appeared once in the thread; still once after refresh. |
| 3. No duplication | **PASS** | Single bubble; composer shows “Enter to send · Shift + Enter for a new line”; “Mark as read” available. |
| 4–6. Cross-role | **PASS** | Customer sees the admin reply once (with “Hembox Tech” as sender) and replied again; admin sees the customer’s second reply after the admin reply. |
| 7. Refresh both sides | **PASS** | Order preserved identically on both sides: Service request → customer → admin → customer. |
| Status change | **PASS** | Setting the conversation to **in progress** persisted (`in_progress`) and is shown to the customer as an “In progress” chip in the thread header. |

**Evidence:** `a05_admin_thread_open.png`, `a05_admin_after_reply.png`, `a05_admin_after_reload.png`, `a05_status_in_progress.png`, `x4_admin_sees_second_reply.png`

### A06 — Billing administration

**Result: BLOCKED.** Claim queue: **Awaiting review 0 / Verified claims 0 / Rejected claims 0**, tabs *Needs review / All claims*, “No payment claims here”. The invoices page renders the issuing form (customer picker incl. `client@disposable.com`, invoice number, currency ZMW/USD, source, line items with **Add item**, payment instructions, **Issue invoice**) with correct safety copy. No invoice or claim was created, verified, settled or refunded — doing so would create real financial records.

**Evidence:** `a06_billing_payments.png`, `a06_billing_invoices.png`, `admin_billing_arrangements.png`, `admin_billing_methods.png`

### A07 — Domain administration

**PASS (read-only).** All four domain surfaces load with explicit safety language: *“Enter costs and FX inputs only after verifying them from a documented source… The provider connection, checkout, payment, and registration are still disabled.”* Margins report: Quotes sampled 0, Complete cost snapshots 0, Expired quotes 0. Order queue: read-only, “No payment or registration actions are available yet.” **No** price, FX, markup, TLD availability, order status or DNS value was modified.

**Evidence:** `a07_admin_domains.png`, `a07_domain_orders.png`, `a07_domain_margins.png`, `admin_domains_manual-payments.png`

### A08 — Remaining admin pages

**FAIL (1 of 20 pages).** All twenty admin routes return HTTP 200 and render content — no blank pages, no dead links, no horizontal overflow at 1440×900 or 390×844. The single broken panel is `/admin/billing/reconciliation` (**F1**).

| Route | HTTP | Renders | Notes |
|---|---|---|---|
| `/admin/dashboard` | 200 | Yes | KPI cards, Recent Clients, Quick Actions |
| `/admin/analytics` | 200 | Yes | Zero-state revenue chart (May–Oct), New Projects frequency |
| `/admin/clients` | 200 | Yes | Empty table, Add Client, search (F2) |
| `/admin/projects` | 200 | Yes | “No projects yet” |
| `/admin/client-workspace` | 200 | Yes | Counters (Clients/Projects/Services/Deliverables 0) + builder form |
| `/admin/services` | 200 | Yes | 6 ACTIVE offerings, Add Service |
| `/admin/portfolio` | 200 | Yes | Published case studies (e.g. Clinic Website, Personal Portfolio) |
| `/admin/pricing` | 200 | Yes | Starter K1,500 / Professional K3,500 / Enterprise K7,500 per project, all ACTIVE |
| `/admin/domains` | 200 | Yes | TLD catalogue & pricing, NameSilo reference, disabled checkout |
| `/admin/domains/orders` | 200 | Yes | Read-only order queue, full status filter set |
| `/admin/domains/manual-payments` | 200 | Yes | “No manual payment claims have been submitted.” |
| `/admin/domains/margins` | 200 | Yes | Margin report, 0 quotes sampled |
| `/admin/billing/invoices` | 200 | Yes | Issue-invoice form |
| `/admin/billing/payments` | 200 | Yes | Claim review queue (empty) |
| `/admin/billing/arrangements` | 200 | Yes | “No arrangement requests yet.” |
| `/admin/billing/methods` | 200 | Yes | Airtel Money (Active), Bank transfer (Inactive) — **not edited** |
| `/admin/billing/reconciliation` | 200 | **Data Fails** | **F1** — API 500 |
| `/admin/media` | 200 | Yes | Uploader (PNG/JPG/GIF ≤ 10 MB) |
| `/admin/messages` | 200 | Yes | 7 conversations; badge 2 |
| `/admin/settings` | 200 | Yes | Contact info, social links, legal content — **not edited** |

**Evidence:** `admin_*.png` (one per route), `a_mobile_*.png`

---

## 7. Cross-role verification

| # | Customer action | Administrator action | Verification | Result |
|---|---|---|---|---|
| 1 | Sends `HEMBOX-E2E customer message` | Reads it in the inbox | Appears once, correct thread, labelled `client@portal` source and the customer’s email; sidebar shows “Unknown client · client@disposable.com · Email client” | **PASS** |
| 2 | — | Replies `HEMBOX-E2E admin reply` | Customer sees it **once**, sender “Hembox Tech”, timestamped, with status chip **In progress** | **PASS** |
| 3 | — | Admin reply triggers notification | Customer bell badge = **1**; notification *“New reply from HEMBOX”* listed with time; **Mark all read** clears it | **PASS** |
| 4 | Sends a second message after the reply | Refreshes inbox | Admin sees it once, after the admin reply, order intact after refresh; both sides show the same sequence | **PASS** |
| 5 | Submits `HEMBOX-E2E` service enquiry | Opens the enquiry | Correct account, source (`client-portal`), category, selected service (SEO Optimization), timing, budget and full brief visible | **PASS** |
| 6 | Submits a test change request | Reviews / responds | — | **BLOCKED** — no project exists on the test account |
| 7 | Views a test project | Updates a milestone | Customer would see updated milestone/status | **BLOCKED** — no project/milestone records; creating them in production was out of scope |
| 8 | Views a safe payment claim | Reviews without processing | Status remains accurate, nothing falsely marked paid | **BLOCKED** — no invoice/claim exists; none created |

**Conversation transcript achieved in production (all labelled HEMBOX-E2E):**
`Service request submitted (portal) → customer message (9:50 pm) → customer message (9:51 pm) → admin reply (9:55 pm) → customer second reply` — order identical in both portals after refreshes.

**Evidence:** `x1_customer_thread.png`, `x3_customer_after_reload.png`, `x4_admin_sees_second_reply.png`, `x_customer_notifications_after_reply.png`, `a05_*` series.

---

## 8. Non-functional and data-consistency checks

| Check | Result | Detail |
|---|---|---|
| Refresh persistence after writes | **PASS** | Verified for: service request, chat messages (both directions), file upload, conversation status, notification read-state, notification preferences. |
| Duplicate submissions | **PASS** | Every message/file/notification appeared exactly once; no double-posting after refresh or repeat clicks. |
| Ordering & timestamps | **PASS** | Chronological in both roles; timestamps formatted consistently (“30 Oct 2026, 9:50 pm”). |
| Browser back/forward | **PASS** | `/portal/bills` → `/portal/files` → Back returned to Bills, Forward returned to Files; both rendered correctly. |
| Deep links | **PASS** | Every portal and admin route opens directly when authorised; blocks when not. |
| Own-record scoping | **PASS** | `/portal/projects/<random-uuid>` → *“Project not found.”*; `/portal/files/<uuid>` and `/portal/bills/<uuid>` → 404. No cross-account access path observed. |
| Error surfaces | **PASS** except F1 | No stack traces, no infinite spinners, no hung pages; the only server error is F1. |
| Console/network hygiene | **PASS** except F7 | Portal and admin: no console errors, no 4xx noise (except the 401 on `/api/portal/notifications` when unauthenticated, which is expected). Homepage: two SVG path errors (F7). |
| Responsive | **PASS** | Zero horizontal overflow across 10 customer + 20 admin routes at 1440, 768 and 390 px. |
| Customer isolation | **PASS** | Customer pages expose no admin-only information and no links into the admin console. |
| Untranslated/dead UI | **PASS** | No lorem ipsum, no broken images, no “undefined”, no dead nav links in 30 routes. |

---

## 9. Blocked items and what is needed to unblock them

| Blocked check | Why blocked | Needed to unblock |
|---|---|---|
| C04 project details, milestones, deliverables, change request | No project linked to the test account; customer UI cannot create one | Link one clearly-labelled `HEMBOX-E2E` project to `client@disposable.com` (admin → Client Workspace) |
| C07 invoice detail, line items, payment claim | No invoice on the account; creating one is a real financial record | Issue a `HEMBOX-E2E` zero-value or dummy invoice to the test account (admin → Billing Invoices), then claim against it |
| A03 client/project record review, milestone update | No client or project record exists | Same as C04, plus a client record for the account |
| A04 enquiry status workflow | Enquiries are messages, not service records | Confirm intended model, or create a `HEMBOX-E2E` service record |
| A06 billing admin review of a test claim | No claim exists | A dummy invoice + claim as above (review only; nothing verified) |
| Cross-role rows 6–8 | Depend on the above | As above |
| Phone / Google sign-in | No test number or Google test account supplied | Optional; provide test identities if in scope |

---

## 10. Security and privacy review (as observed)

**Access-control matrix (tested by ordinary navigation only — no bypass attempts):**

| Subject | Target | Observed behaviour | Verdict |
|---|---|---|---|
| Anonymous | `/portal/*` (11 routes) | Redirect to `/login?next=…` | Correct |
| Anonymous | `/admin/*` (5 routes sampled) | Redirect to `/login` | Correct |
| Customer | `/admin/dashboard`, `/admin/clients` | Redirect to `/`; no admin content | Access denied (UX nit F6) |
| Customer | `/api/admin/*` (4 plausible paths) | 404 HTML, no JSON | No leakage observed |
| Customer | Another account’s records (random UUIDs) | “Project not found.” / 404 | Correct |
| Admin | Customer conversation | Full thread + account email + source | Expected for role |
| Any | File download | Short-lived signed URL, folder scoped to the account | Correct pattern |

**Strengths observed:** server-enforced route protection; signed-URL downloads with scoping; per-account data separation on every record lookup; clear financial safety language in both consoles (claims do not count as paid until verified; receipts are not proof of settlement); domain checkout, payment and registration deliberately disabled behind explicit guards; no credentials echoed to URLs, logs or screenshots.

**Hardening items:** F3 (cookie flags, `user_role` trustworthiness). Recommend also reviewing rate limiting on `/login` and session expiry/rotation policy — not tested here.

**Privacy note:** the admin inbox lists real enquiries from members of the public. During this test only the `client@disposable.com` thread was opened; the others were visible as list previews but never clicked. No personal information from those conversations is reproduced in this report.

---

## 11. Test data created and cleanup

Everything below exists **only** inside the disposable customer account, and every record carries the `HEMBOX-E2E` label.

| # | Object | Detail |
|---|---|---|
| 1 | Service request conversation | “SEO Optimization”, timing “As soon as possible”, budget “not sure”, brief beginning “HEMBOX-E2E test enquiry — automated QA check…” |
| 2 | Customer messages | `HEMBOX-E2E customer message…`, `HEMBOX-E2E customer second reply…` |
| 3 | Admin reply | `HEMBOX-E2E admin reply…` (sent by the administrator, visible in the test thread) |
| 4 | Conversation status | Changed `new → in progress` |
| 5 | File | `HEMBOX-E2E-test-file.txt` — 88 bytes, plain text, description “HEMBOX-E2E synthetic test upload” |
| 6 | Notification | Generated by the admin reply, then marked read |
| 7 | Notification preference | Project updates toggled off → saved → **restored** to original and verified |
| 8 | Domain quote attempt | `hembox-e2e-check-8412.com` — rejected by the app (“quoting not configured”); no record, no reservation |

**Cleanup note.** The customer portal exposes no delete action for conversations or files, so items 1–5 must be removed from the admin/database side if you want a pristine account. Preferences are already restored.

---

## 12. Safety attestation

I confirm that during this test:

* **No payments** were made, no refunds initiated, no payment details, receipts or real transaction references entered, and **no claim was submitted, verified or settled**.
* **No domains** were registered, transferred, renewed, reserved or checked at a registrar, and **no DNS records** were changed.
* **No prices, FX rates, markups, provider settings, TLD availability, company details, social links, legal documents, payment methods or branding** were modified.
* **No real customer record** was opened, edited or deleted.
* **No SQL**, database console, provider dashboard or developer tooling was used to alter data; every action was performed through the website UI.
* **No security control was bypassed or attacked.** All access-control observations came from ordinary navigation with a legitimate session.
* Passwords do not appear in this report or in any screenshot, and session tokens were not reproduced.

---

## 13. Recommendations, prioritised

| Priority | Item | Finding | Suggested action | Effort |
|---|---|---|---|---|
| 1 | Fix the reconciliation API | F1 | Trace the 500 in `/api/admin/billing/reconciliation`; differentiate “no data” from “failed to load”; alert on it | S–M |
| 2 | Clarify the “clients” definition | F2 | Relabel KPI or fix counting; add Clients empty-state guidance; consider auto-creating a client record on first portal request | S–M |
| 3 | Harden the session cookie | F3 | Server-set `HttpOnly; Secure` cookies via `@supabase/ssr`; verify admin authorisation is server-side and never cookie-role-based | M |
| 4 | Post-login redirect | F4 | Send customers to `/portal`, honour `?next=` | S |
| 5 | Access-denied page | F6 | Replace silent bounce to `/` with a clear “no access” screen returning to `/portal` | S |
| 6 | Drawer accessibility | F5 | Escape to close + focus management | S |
| 7 | Icon paths | F7 | Fix the two malformed SVG paths; add a console-error assertion to CI | S |
| 8 | Navigation vocabulary | N3 | Align nav labels with page titles (Billing Claims ↔ Payment claim review) | S |
| 9 | Catalogue scope | N2 | Confirm whether branding should be a published service | — |
| 10 | Testability | — | Provide seeded `HEMBOX-E2E` project/invoice/service records in a staging environment so the blocked workflows can be covered properly | — |

**Regression risk of the recommended fixes:** F1 and F2 touch admin reads only; F3/F4/F6 touch auth/redirect logic and warrant a re-run of C01, A01 and the anonymous-access matrix; F5/F7 are cosmetic.

---

## 14. Suggested re-test plan

1. After the F1 fix — re-load `/admin/billing/reconciliation` with at least one invoice and one verified payment present; confirm the ledger, audit history and per-currency outstanding totals agree with the invoice list.
2. After F3/F4/F6 — re-run: anonymous portal/admin matrix, customer→admin URL attempt, sign-in landing page, sign-out, and the cookie flags.
3. With seeded records — run the six currently-blocked cases (C04, C07, A03, A04, A06 and cross-role rows 6–8), including a change-request round-trip and a milestone update visible to the customer.
4. Add these as permanent smoke checks: portal section load, enquiry → inbox, reply → notification, file upload → signed download, preference persist, admin route sweep with console/network assertions.

---

## Appendix A — Route inventory

**Customer portal (all HTTP 200 when signed in):** `/portal`, `/portal/projects`, `/portal/services`, `/portal/services/catalogue`, `/portal/services/request` (accepts `?service=` & `?category=`), `/portal/domains`, `/portal/files`, `/portal/bills`, `/portal/messages`, `/portal/notifications`, `/portal/settings`.
**Public:** `/` , `/about`, `/pricing`, `/domains`, `/privacy`, `/terms`, `/services/{web-development, seo-optimization, school-information-systems, mobile-app-development, portfolio-design, ai-workflow-intergration}`, `/login`, `/register`. (Homepage emitted 2 console errors — F7.)
**404 (no such route):** `/dashboard`, `/client`, `/account`, `/account/settings`, `/dashboard/projects`, `/client/dashboard`, `/my-projects`, `/my-services`, `/projects`, `/services`, `/files`, `/bills`, `/billing`, `/invoices`, `/messages`, `/support`, `/settings`, `/portal/billing`, `/portal/account`.

**Admin (all HTTP 200):** `/admin/dashboard`, `/admin/analytics`, `/admin/clients`, `/admin/projects`, `/admin/client-workspace`, `/admin/services`, `/admin/portfolio`, `/admin/pricing`, `/admin/domains`, `/admin/domains/orders`, `/admin/domains/manual-payments`, `/admin/domains/margins`, `/admin/billing/invoices`, `/admin/billing/payments`, `/admin/billing/arrangements`, `/admin/billing/methods`, `/admin/billing/reconciliation` (data 500), `/admin/media`, `/admin/messages`, `/admin/settings`.

## Appendix B — API endpoints observed

| Endpoint | Method | Context | Result |
|---|---|---|---|
| `/api/portal/notifications` | GET | Anonymous | 401 (correct) |
| `/api/portal/notifications` | GET | Customer | 200 |
| `/api/portal/files?fileId=<uuid>` | GET | Customer (own file) | 200 → `{"url": "https://<project>.supabase.co/storage/v1/object/sign/client-deliverables/<account-folder>/…?token=…"}` |
| `/api/admin/billing/reconciliation` | GET | Admin | **500** `{"error":"Unable to load billing reconciliation data."}` (F1) |
| `/api/admin/{clients,projects,stats,messages}` | GET | Customer | 404 (routes do not exist at these paths) |

## Appendix C — Raw measurements

* **Horizontal overflow:** customer 10 routes × {1440, 768, 390} → `scrollWidth == innerWidth` in all 30 combinations. Admin 4 sampled routes × {1440, 390} → equal in all 8.
* **Page heights (mobile, 390 px):** Overview 2519 px, Service catalogue 2337 px, Account settings 1721 px, Files 1489 px, Bills 1468 px, Domains 1215 px, Messages 1006 px, My services 870 px, My projects/Notifications 844 px.
* **Timing:** all portal/admin documents responded in well under a second after first paint settled; no request exceeded the 40 s navigation timeout and none was retried.
* **Empty-state wording captured verbatim** for projects, services, files, bills, domains, notifications, clients, projects, claims, arrangements, manual payments, margins.

## Appendix D — Evidence index

`e2e/shots/` contains **104** full-page PNG screenshots. Highlights by area:

| Area | Files |
|---|---|
| Findings | `a08_reconciliation_500.png`, `admin_billing_reconciliation.png`, `a03_clients.png`, `admin_dashboard.png`, `admin_analytics.png`, `c01_after_login.png`, `c02_mobile_menu_open.png`, `c02_mobile_menu_after_escape.png`, `x_customer_at_admin_clients.png`, `m_login_error.png` |
| Customer sections (desktop) | `c02_desktop_{Overview,My_projects,My_services,Domains,Files,Bills_and_payments,Messages_and_support,Account_settings,Notifications,Service_catalogue}.png` |
| Customer sections (mobile) | `c02_mobile_*.png` (same ten) |
| Customer flows | `c05_*` (5), `c06_files_after_upload.png`, `c07_bills.png`, `c08_*` (2), `c09_*` (5), `c10_*` (3) |
| Admin sweep | `admin_*.png` (20, one per route) |
| Admin flows | `a01_admin_after_login.png`, `a05_*` (4), `a06_*` (2), `a07_*` (3), `a_mobile_*` (4) |
| Cross-role | `x1_customer_thread.png`, `x3_*` (2), `x4_admin_sees_second_reply.png`, `x_customer_notifications_after_reply.png`, `m_notifications_marked_read.png` |

Machine-readable results: `e2e/results_customer.json`, `e2e/results_admin.json`, `e2e/results_cross2.json`, `e2e/results_cross_admin.json`, `e2e/admin_sweep.json`, `e2e/misc.json`, `e2e/followup_customer.json`.
Visual companion: `HEMBOX-E2E-test-evidence.html` (key screenshots embedded, opens in any browser).

## Appendix E — Severity guide used

| Severity | Definition | Applied to |
|---|---|---|
| **Critical** | Security breach, access to another customer’s private data, or an action that changes real financial/domain state | None found |
| **High** | A major customer or admin workflow does not work, or the two roles do not see consistent updates | None found |
| **Medium** | A feature has a defect but a safe workaround exists (or the defect is misinformative) | F1, F2 |
| **Low** | Cosmetic, wording, accessibility or minor layout/hardening issue | F3–F7 |
| **Blocked** | Could not be exercised safely in production | C04, C07, C08, A03, A04, A06, cross-role rows 6–8 |

---

### Report sign-off

The test was executed against the live production site between 21:44 and 22:25 on 30 October 2026 using only the two supplied disposable accounts, with customer and administrator sessions isolated throughout. Every result above is backed by a screenshot and/or a machine-readable record in the workspace. Nothing was declared passed merely because the accounts could sign in: 26 checks passed on observed behaviour, one feature failed reproducibly, and nine workflows are explicitly marked blocked rather than assumed to work.

**Not signed off as fully covered:** project/milestone/change-request workflows, invoice and payment-claim workflows, and service-record administration — all blocked by the absence of safe test data. Provide seeded `HEMBOX-E2E` records (or authorise their creation) and these can be completed in a follow-up run.
