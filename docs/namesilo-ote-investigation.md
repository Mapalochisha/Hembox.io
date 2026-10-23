# NameSilo OTE investigation: `getDomainInfo` failures

Status as of 2026-10-23. All calls described here are **read-only** against the
API-only OTE at `https://ote.namesilo.com/api`. No production credential, live
registrar call, registration, renewal, transfer, nameserver change or payment
has been made, and no sandbox funds have been spent.

## 1. What the evidence actually establishes

| Observation | What it proves | What it does **not** prove |
| --- | --- | --- |
| `POST /api/domains/search` for `example.com` + `example.net` returned `provider: namesilo`, `environment: test`, `live: false` | The selected mode, OTE host, sandbox key and availability parser all work end to end | Real registry availability, live credentials, or that prices/funds work |
| The batch reply had provider code `300` with per-domain buckets | NameSilo accepted and answered an authenticated request | That `getDomainInfo`, account reads or any mutation will succeed |
| `getDomainInfo?domain=example.com` returned code `114`, detail `Invalid Domain Syntax` | OTE answered with a **structured provider reply** | That HEMBOX sent malformed input (it did not — the value was a lowercased bare FQDN) |
| `getDomainInfo?domain=namesilo.com` returned HTTP `400` with no structured reply | A non-2xx response arrived before provider parsing | That the key, endpoint or transport is broken (the same key/host worked for availability) |

Two different failures for two ordinary-looking names is the whole puzzle. The
important correction to the earlier framing is this: **`getDomainInfo` is not a
connectivity probe.**

## 2. The key contract fact

NameSilo documents `getDomainInfo` as returning "essential information on a
domain **within your account**" ([API reference](https://www.namesilo.com/api-reference/pages?uid=domains%2Fget-domain-info)).
For a domain that is not active in the account, the documented response is
`code 200` — "Domain is not active, or does not belong to this user".

HEMBOX queried two public names it never registered in OTE. Neither was ever
expected to produce a `300` reply. So the useful question is not "why does the
integration fail?" but "why do two *out-of-account* lookups fail differently?"
That is a provider-side behaviour question, not an integration defect.

## 3. Ranked explanations

**H1 — Both results are account-scope failures (most likely).**
`example.com` and `namesilo.com` are not in the sandbox account, so no successful
lookup was possible. OTE appears to surface "not found for this account" through
inconsistent paths instead of the documented `200`. Confidence: moderate-high.

**H2 — `114` reflects provider-side name policy, not syntax.**
`example.com`/`example.net` are IANA-reserved names no registrar can sell. A
provider-side named-entity/reserved-name check may short-circuit to
"Invalid Domain Syntax" before the account lookup. This is consistent with the
availability endpoint treating the same strings as merely `unavailable`.
Confidence: moderate. The decisive test is a plain, non-reserved `.com`.

**H3 — The HTTP `400` is specific to `namesilo.com`.**
A third-party NameSilo client documents that using `namesilo.com` as an API
parameter "will almost always show an error ... This is an issue with the API"
([Raycast extension notes](https://www.raycast.com/xmok/namesilo)). The provider's
own apex name is a bad sample. Do not draw transport conclusions from it.
Confidence: moderate-high.

**H4 — Auth/transport is not the cause.**
The same key, host and request shape returned `300` from
`checkRegisterAvailability`. The failure is not `110` (invalid key), `111`
(invalid user), `112` (sub-account) or `113` (IP restriction). A `400` is not an
authentication status. Confidence: high.

**H5 — Shared Vercel egress IP, rate limiting or a drop-catch window (low).**
NameSilo recommends roughly one request per second per IP, and Vercel functions
share egress IPs. OTE access is also reported to be blocked during `.com`/`.net`
drop-catch windows. Both would be intermittent and would not explain a stable
`114`, but they are cheap to rule out by spacing requests and retrying at a
different time. Confidence: low.

What is *not* on the list: a malformed HEMBOX request. The URL builder sets
`version=1`, `type=json`, `key`, and a lowercased bare `domain`; the same builder
is exercised by contract tests and the working availability call.

## 4. Decisive diagnostic sequence

The revision that accompanies this note adds read-only account probes so the
next round answers the question in one deployment instead of one data point per
deploy.

Run these in order against the protected Preview:

```bash
# 1. Does the sandbox key work for account-scoped reads, and does the OTE
#    account contain any domains? (no domain parameter involved)
vercel curl "https://YOUR-PREVIEW-URL/api/domains/provider-diagnostic?scope=account"

# 2. If step 1 lists a domain, query that exact domain.
vercel curl "https://YOUR-PREVIEW-URL/api/domains/provider-diagnostic?domain=LISTED-DOMAIN.com"

# 3. One ordinary, real, non-provider-owned domain, sent alone after a pause.
vercel curl "https://YOUR-PREVIEW-URL/api/domains/provider-diagnostic?domain=github.com"

# 4. Repeat the two original requests, spaced apart, to test intermittency.
vercel curl "https://YOUR-PREVIEW-URL/api/domains/provider-diagnostic?domain=example.com"
vercel curl "https://YOUR-PREVIEW-URL/api/domains/provider-diagnostic?domain=namesilo.com"
```

### How to read the results

| Result | Interpretation | Next action |
| --- | --- | --- |
| `scope=account` balance `300`; domains list empty | Key, account and transport work. The OTE account has no domains, so no `getDomainInfo` success is possible without registering one. | Treat account probes as the OTE auth verification. Do not register just to make a diagnostic pass. |
| `scope=account` balance `300`; domains listed | The account has usable test domains. | Query a listed domain (step 2). A `300` there closes the `getDomainInfo` question. |
| Balance `110` / `113` / `116` | Key, IP restriction or sandbox-account problem. | Fix configuration/IP allowlist before any further domain-level testing. |
| `github.com` returns `200` (code) | The path works and correctly reports "not in account". `114` for `example.com` is then name-specific (H2). | Document and move on. |
| `github.com` returns `114` | OTE maps out-of-account lookups to `114` (H1). | Capture the detail text and stop treating `114` as evidence of bad input. |
| `github.com` returns HTTP `400` with a provider code | A non-2xx carrying a structured reply. | Read the code; the new message shows it. |
| `github.com` returns HTTP `400` with HTML/no code | Edge/WAF/OTE defect, not the API contract. | Note `content-type`/`server` from the new message, retry spaced, then raise with support. |
| Results change when requests are spaced or repeated at another hour | Intermittency (rate limit, shared egress IP, drop-catch window). | Add pacing/backoff; do not treat a single `400` as a contract fact. |

Do **not**: retry mutations blindly, register a sandbox domain solely to obtain a
`300`, test on the live endpoint, or paste keys/response bodies into chat or Git.

## 5. Questions to put to NameSilo support

1. Does a newly provisioned OTE account contain any seeded domains? If not, what
   is the intended way to exercise `getDomainInfo` without a sandbox purchase?
2. What should `getDomainInfo` return on OTE for a domain that exists publicly
   but is not in the sandbox account — documented `200`, `114`, or HTTP `400`?
3. Is `example.com`/`example.net` rejected by OTE validation (and is that the
   source of `114` "Invalid Domain Syntax")?
4. Why does `namesilo.com` produce HTTP `400` from `ote.namesilo.com` when used
   as the `domain` parameter? Is the apex domain filtered?
5. Is the OTE API key subject to IP allowlisting or shared-IP rate limiting that
   could surface as HTTP `400` (rather than `403`/`429`) from serverless egress?
6. Are `getAccountBalance` and `listDomains` supported on OTE with the sandbox
   key, and are they the recommended readiness probes?

## 6. Decision gate

M2 (read-only adapter and account verification) stays **incomplete** until one of
these is true:

- `getDomainInfo` returns `300` for a domain that `listDomains` confirms is in
  the sandbox account; or
- NameSilo confirms the OTE contract for out-of-account lookups and the account
  probes (`getAccountBalance` + `listDomains`) are accepted as the read-only
  verification evidence.

Availability search is already verified as *transport and parsing*, not as real
registry truth. Live credentials, funding and production pricing remain
unverified and out of scope for this investigation.

## 7. Changes in this revision

- **Non-2xx diagnostics:** OTE error responses now surface a sanitized provider
  `code`/`detail` when the body is JSON or XML, plus `content-type` and `server`.
  HTML bodies are never mined for codes and raw bodies are never returned. This
  should classify the `namesilo.com` `400` on the next deploy.
- **Account probes:** `getAccountBalance` and `listDomains` added to the
  OTE-only operations client; both are read-only and never reference a domain.
- **Preview diagnostic:** `?scope=account` returns the balance result and the
  sandbox account's domain names (capped at 200). `?domain=...` is unchanged.
  Still gated to `VERCEL_ENV=preview` + `DOMAIN_PROVIDER_MODE=namesilo-sandbox`.
- **CLI:** `npm run namesilo:ote -- account` and `... -- list`.
- **Tests:** JSON/XML/HTML error-body handling, account balance parsing, domain
  listing across JSON and XML-to-JSON shapes, and empty-vs-failed listings.

## 8. References

- NameSilo API reference — request format, `getDomainInfo`, `listDomains`,
  `getAccountBalance`, `checkRegisterAvailability`:
  https://www.namesilo.com/api-reference
- `getDomainInfo` (account-scoped wording):
  https://www.namesilo.com/api-reference/pages?uid=domains%2Fget-domain-info
- Raycast NameSilo extension note on `namesilo.com` parameters:
  https://www.raycast.com/xmok/namesilo
- Community mirror of NameSilo response codes (third-party, used only to read
  `114`/`116`/`200`):
  https://github.com/NETLINK/Blesta-Namesilo/blob/master/config/codes.php

## 9. 2026-10-23 — read-only Preview smoke-test results

- **Account scope:** HTTP 200 from the protected Preview; NameSilo OTE returned provider code 300 for both getAccountBalance and listDomains.
- **Domain list:** OTE returned an empty list. This is a successful listing of an empty sandbox account, not a listing transport failure.
- **Domain info:** querying github.com returned provider code 200 with the documented detail that the domain is not active or does not belong to this account. This confirms the account-scoped domain-info path without purchasing a domain.
- **Availability parsing:** example.com and example.net returned unavailable; github.com returned unavailable; a unique probe domain returned available. Every result was marked environment=test, live=false, with null registration/renewal prices. These are OTE-only classifications, not live registry results.
- **Balance parsing:** OTE returned code 300 and included a string-valued balance. The Preview's value-safe format classifier reported `grouped-decimal`; the raw value remains intentionally undisclosed.
- **Regression fix:** strict thousands grouping (for example, `12,345.67`) is normalized by removing only correctly placed grouping commas, yielding a canonical decimal string. Plain decimals remain supported; irregular comma grouping and other non-numeric formats are rejected. This does not use floating-point conversion and does not expose the balance in diagnostics.
- **Tests added:** valid grouped decimal normalizes successfully; malformed grouping remains null and its raw contents are not returned. The official API reference shows a plain numeric example (`355.75`), so this OTE-only formatting difference remains a provider-specific observation rather than a documented general format. See [NameSilo getAccountBalance documentation](https://www.namesilo.com/api-reference/pages?uid=account%2Fget-account-balance).
- **Safety:** no live provider endpoint, registration, renewal, transfer, nameserver mutation, payment, or OTE funds spend was performed.



## 10. 2026-10-23 — Normalize the observed OTE grouped-decimal balance

- The protected Preview reported `balanceStringFormat: grouped-decimal`, with provider code 300. The diagnostic intentionally does not return the balance value.
- The parser now accepts only strict decimal strings or strict comma-grouped decimals; correctly placed grouping commas are removed to produce a canonical decimal string. Malformed grouping remains unparsed. No JavaScript floating-point conversion is used.
- Regression tests cover grouped values and malformed grouping while asserting the raw malformed value is not present in diagnostic output.
- **Verification:** check GitHub Actions CI and Vercel Preview for the latest branch head before treating this parser change as complete.
- **Safety:** the change only parses the response to a read-only account-balance request. It performs no registration, renewal, transfer, nameserver change, payment or fund-spending operation.
