# HEMBOX Tech — Production Customer & Admin Test

**Website:** https://hembox.tech  
**Purpose:** Independently test the customer portal and admin workspace, including workflows that pass information between the two roles.

## 1. Test accounts

Use the following disposable accounts only.

| Role | Email | Password |
|---|---|---|
| Customer | client@disposable.com | 12341234 |
| Administrator | admin@disposable.com | 43214321 |

Keep the customer and administrator sessions separate (preferably use separate browser profiles). Do not share these credentials with anyone else or include passwords in screenshots or the test report.

## 2. Important safety rules

This is a test on the live production website.

- Use synthetic names and information. Add the label `HEMBOX-E2E` to test records wherever possible.
- Do not access, edit, or delete any real customer's information.
- Do not make real payments, initiate refunds, or enter real payment details.
- Do not purchase, register, transfer, renew, or delete a domain. Do not change DNS.
- Do not change live prices, payment settings, provider settings, company details, or production configuration.
- Do not attempt destructive actions. If an action could affect a real customer, move money, or trigger a domain operation, stop and report it.
- Do not use SQL, developer tools to alter data, or any external administration system. Perform the test through the website only.
- If you encounter another customer's private information, stop that test and report it immediately.

## 3. Customer test

Sign in using the **Customer** account.

### C01 — Sign-in and session
1. Open https://hembox.tech and sign in.
2. Confirm that you enter the customer portal.
3. Refresh the page and open the portal in a new tab.
4. Confirm that you remain signed in.
5. Sign out and try opening a customer-only page directly. It should require sign-in.
6. Sign in again.

### C02 — Portal navigation and mobile layout
1. Visit each available customer section:
   - Overview
   - My projects
   - My services
   - Domains
   - Files
   - Bills & payments
   - Messages & support
   - Account settings
2. Confirm each page loads and navigation works.
3. Check the site at desktop width and mobile width.
4. Check that menus open and close correctly, text is readable, and there is no unwanted horizontal scrolling.

### C03 — Overview
1. Review the dashboard cards, recent activity, and project/service summaries.
2. Open the relevant detail pages and check that the displayed counts and statuses agree.
3. Refresh and confirm the information remains consistent.

### C04 — Projects
1. Open My projects.
2. Open any project available to the test account.
3. Review its details, status, milestones, progress, and deliverables.
4. If the interface allows it, submit a clearly labelled test change request.
5. Record whether the request is confirmed and whether it remains visible after refreshing.

### C05 — Services
1. Open My services and inspect the service list and statuses.
2. Browse the service catalogue, including services beyond website development (for example branding and apps).
3. If a service request can safely be submitted, submit a clearly labelled test enquiry.
4. Confirm the selected service is correctly reflected in the request.

### C06 — Files
1. Open Files and inspect the available files and page states.
2. If uploads are supported, upload only a harmless, synthetic test file labelled `HEMBOX-E2E`.
3. Confirm that it appears and can be opened or downloaded.
4. Do not open or download files that do not belong to the test account.

### C07 — Bills & payments
1. Open Bills & payments.
2. Review Outstanding Balance, In Review, and Total Paid.
3. Check the available invoice tabs and search.
4. Open any invoice belonging to the test account and review its details and line items.
5. If a clearly safe test-only payment claim workflow is available, submit a claim using a fictional transaction reference and the `HEMBOX-E2E` label. Do not make a transfer or upload a real receipt.
6. Do not mark anything as paid or verified.

If there is no safe test invoice or payment-claim option, record this as **Blocked / not safely testable**.

### C08 — Domains
1. Open Domains.
2. Review the page, any existing test entries, and the available domain enquiry/search functionality.
3. If read-only search or quote functionality is available, test it with a made-up domain name.
4. Stop before any checkout, payment, registration, transfer, renewal, or DNS action.

### C09 — Messages and support
1. Open Messages & support.
2. Open an available test conversation, or create a clearly labelled test conversation if the interface allows.
3. Send a short message containing `HEMBOX-E2E`.
4. Confirm it appears once and remains after refreshing.
5. Leave the conversation available for the administrator test below.

### C10 — Notifications and settings
1. Check the notification list and unread counter.
2. Open Account settings and inspect the available preferences.
3. If safe, change one non-critical preference, save it, refresh, and confirm it persists.
4. Restore the original setting.

## 4. Administrator test

Sign out of the customer account. In a separate browser profile, sign in using the **Administrator** account.

### A01 — Admin access and security
1. Open the admin dashboard at https://hembox.tech/admin/dashboard.
2. Confirm the admin dashboard and navigation load.
3. Open a few admin sections directly and refresh them.
4. Sign out of the admin account.
5. In the customer browser profile, try opening https://hembox.tech/admin/dashboard.
6. Confirm the customer account cannot access the admin workspace or admin-only information.

### A02 — Admin dashboard
1. Review the dashboard summaries and recent activity.
2. Check that the figures and labels are understandable and consistent with the test records.
3. Note any misleading totals, broken cards, or empty states.

### A03 — Client and project records
1. Find the test customer and any test records created during the customer test.
2. Open the customer record and verify its details and associations.
3. Open the test project, if available.
4. If safe, update a test-only milestone/status or respond to a test change request.
5. Do not modify any record that is not clearly associated with this test.

### A04 — Services
1. Find the test service enquiry or service record.
2. Review its details.
3. If safe, update its status using the normal admin workflow.
4. Record whether the customer can see the updated status.

### A05 — Inbox and messaging
1. Find the conversation created or used in C09.
2. Reply with a message containing `HEMBOX-E2E admin reply`.
3. Confirm the reply appears once in the conversation.
4. Return to the customer browser profile.
5. Confirm the admin reply is visible to the customer.
6. Reply as the customer, then return to the admin profile and confirm the customer's reply appears.
7. Refresh both sides and confirm the conversation remains in the correct order.

### A06 — Billing administration
1. Inspect the billing area and look for the clearly labelled test invoice or claim, if one was safely created.
2. Confirm its details and status.
3. Do not verify, settle, refund, or otherwise financially process a payment.
4. Do not change any real invoice or payment record.
5. If no safe test billing record exists, report the relevant checks as blocked.

### A07 — Domain administration
1. Inspect the admin domain area and provider-pricing page, if available.
2. Check whether the pages load and whether the displayed information is clear.
3. Do not change prices, markups, exchange rates, provider settings, TLD availability, or domain status.
4. Do not register, transfer, renew, or change DNS for a domain.

### A08 — Other admin pages
1. Visit the remaining admin navigation sections that can be inspected safely.
2. Note broken links, blank pages, confusing labels, errors, or layout problems.
3. Do not change production configuration, company details, payment settings, or branding.

## 5. Cross-role checks

These checks are important. Use the two separate browser profiles and verify each action from the other role.

| Customer action | Administrator action | What to verify |
|---|---|---|
| Sends a test message | Reads and replies | Both messages appear once, in the correct order |
| Receives admin reply | Sends admin reply | Customer sees the reply and notification state updates |
| Submits a test change request | Reviews/responds | Customer sees the resulting status or response |
| Views a test project | Updates a test milestone, if safe | Customer sees the updated milestone/status |
| Submits a safe test service enquiry | Reviews the enquiry | Admin sees the correct customer and selected service |
| Views a safe test payment claim, if available | Reviews it without processing payment | Status remains accurate; no payment is falsely marked as paid |

If a workflow cannot be safely performed in production, mark it **Blocked** and explain why. Do not improvise a workaround that could affect real data.

## 6. General checks

Throughout the test:

- Refresh pages after important actions and confirm changes persist.
- Check browser back/forward navigation and direct page links.
- Note any page that loads indefinitely, crashes, or displays an unexpected error.
- Note failed actions, duplicate submissions, missing confirmations, incorrect totals, and inconsistent statuses.
- Check desktop and mobile layouts.
- Check that customer pages do not expose admin-only information.
- Check that the customer account cannot access another customer's records.
- Do not attempt to bypass security controls or access records belonging to other users.

## 7. Test report

When finished, send a report containing:

1. Date and approximate time of testing.
2. Browser and device used.
3. Confirmation that both supplied accounts could or could not sign in.
4. Results for each test section, using **Pass**, **Fail**, or **Blocked**.
5. Steps to reproduce every failure.
6. Screenshots or short recordings for failures (hide passwords, personal information, and session data).
7. Any pages that were unavailable or features that could not be safely tested.
8. Confirmation that you did not make payments, register domains, change DNS, or modify real customer records.

### Severity guide

- **Critical:** Security breach, access to another customer's private data, or an action that changes real financial/domain state. Stop testing and report immediately.
- **High:** A major customer or admin workflow does not work, or the two roles do not see consistent updates.
- **Medium:** A feature has a defect but a safe workaround exists.
- **Low:** Cosmetic, wording, or minor layout issue.

**Do not declare the test passed just because both accounts can sign in.** The report must cover the workflows above and clearly identify anything that could not be tested.
