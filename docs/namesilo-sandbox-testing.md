# NameSilo OTE sandbox testing

This guide is for NameSilo's API-only OTE sandbox, not the live registrar. Sandbox domain availability is not authoritative for real registry availability. NameSilo support recommends testing only `.com` and `.net` domains.

## Local credentials

1. In the repository root, use the ignored local file `.env.local` (the repository's `.gitignore` excludes `.env*.local`).
2. Set these entries in that file without committing them:

   ```dotenv
   DOMAIN_PROVIDER_MODE=namesilo-sandbox
   NAMESILO_SANDBOX_API_KEY=your-sandbox-key
   ```

3. Keep `NAMESILO_API_KEY` separate. The OTE client pins the base URL to `https://ote.namesilo.com/api` and reads only `NAMESILO_SANDBOX_API_KEY`.

## Read-only checks

Start with the account probes. They validate the sandbox key/account and reveal
which domains actually exist in OTE, without referencing a domain:

```bash
npm run namesilo:ote -- account
npm run namesilo:ote -- list
```

`getDomainInfo` is documented as account-scoped ("a domain within your account"),
so it can only return `300` for a domain that `list` shows in the sandbox
account. Querying a public name that is not in OTE is expected to fail; that
failure does **not** indicate a HEMBOX or credential problem. See
[namesilo-ote-investigation.md](./namesilo-ote-investigation.md).

Read sandbox domain information for a domain that OTE lists:

```bash
npm run namesilo:ote -- info <domain-from-list>.com
```

Check availability for one or more sandbox test names:

```bash
npm run namesilo:ote -- availability example.com example.net
```

A not-found/not-owned domain may return `state: "unknown"` and a provider code/message from the domain-info command; code 200 means NameSilo did not confirm that the domain is active or owned by the sandbox account. A `checkRegisterAvailability` result of `unavailable` only describes the sandbox registry.

## Mutating sandbox operations

The CLI requires the explicit `--confirm-ote-only` switch for registration, renewal, and nameserver changes. This is a deliberate safety guard, not authorization for using the live API: the underlying client will only connect to OTE and will fail unless `DOMAIN_PROVIDER_MODE=namesilo-sandbox` is set.

**Do not run a mutation unless you have intentionally selected a disposable sandbox test domain.** NameSilo support says a sandbox registration reserves the name for all OTE users and that requests can consume the test account's funds. No mutation has been executed by adding this CLI.

Register a disposable name only after OTE has explicitly returned `available`:

```bash
npm run namesilo:ote -- register <your-disposable-domain.com> 1 --confirm-ote-only
```

Renewal is restricted to a domain which OTE domain-info reports as `Active`; expired/restoration-period domains are deliberately blocked to avoid unexpected restoration charges:

```bash
npm run namesilo:ote -- renew <your-active-sandbox-domain.com> 1 --confirm-ote-only
```

Change nameservers for an active sandbox domain using only the supported NameSilo NS1–NS8 hostnames:

```bash
npm run namesilo:ote -- nameservers <your-active-sandbox-domain.com> ns1.namesilo.com ns2.namesilo.com --confirm-ote-only
```

Transfers are implemented in the OTE operations module but not exposed in this CLI, because EPP authorization codes should be entered through a future secure prompt rather than command-line arguments or shell history.

## Reconciliation rules

- A successful registrar reply is an acknowledgement, not by itself the final internal order status.
- If a mutation times out or returns an unrecognized result, the tool marks the result ambiguous and requires read-only provider reconciliation before any retry. Never repeat a mutation blindly.
- NameSilo documents registration/transfer result codes 301/302 as successful operations with fallback behavior; the adapter treats these as success-with-warning.
- No API key or raw provider response body is printed by the client.


## Vercel Preview diagnostics (preferred to local npm)

For testing the actual OTE connection, use the protected Preview deployment with `vercel curl`. You do not need to run npm locally.

After the feature branch's latest Preview deployment finishes, test batch availability:

```bash
vercel curl "https://YOUR-PREVIEW-URL/api/domains/search" -- \
  --request POST \
  --header "Content-Type: application/json" \
  --data '{"domains":["example.com","example.net"]}'
```

The response should contain one result per domain. A provider code of 300 means NameSilo accepted the availability request, but the parser still needs a recognized per-domain entry to classify availability.

To prove the sandbox key/account work and see which domains OTE actually holds,
use the read-only account scope (no domain involved):

```bash
vercel curl "https://YOUR-PREVIEW-URL/api/domains/provider-diagnostic?scope=account"
```

To inspect a single sandbox `getDomainInfo` response, call the domain scope. Use
a domain returned by the account scope, not `example.com` or `namesilo.com` —
both are known-bad samples:

```bash
vercel curl "https://YOUR-PREVIEW-URL/api/domains/provider-diagnostic?domain=LISTED-DOMAIN.com"
```

The endpoint returns normalized fields and safe provider messages only. For
non-2xx OTE responses the message now includes the HTTP status, a sanitized
provider code/detail when the body is JSON or XML, and the response
`content-type`/`server`; raw response bodies and credentials are never returned.
The endpoint exists only when `VERCEL_ENV=preview` and
`DOMAIN_PROVIDER_MODE=namesilo-sandbox`, relies on Vercel Preview deployment
protection, and has no mutation operations. Production and other provider modes
return 404.
