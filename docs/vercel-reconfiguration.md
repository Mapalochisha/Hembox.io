# Reconfiguring Vercel and the domain provider (hembox.tech)

> **Why this exists:** as of 2026-11-01 the NameSilo variables exist only for the Preview target,
> scoped to the historical branch `feature/domain-reselling-platform`. Production has none of
> them, so price retrieval and availability checks correctly fail closed on `hembox.tech`.
>
> **Not in this procedure:** any production registrar key. This stays on the sandbox until the
> flow is proven.

## 1. Required variables

| Key | Target | Branch scope | Value | Notes |
|---|---|---|---|---|
| `DOMAIN_PROVIDER_MODE` | Production | all | `namesilo-sandbox` | Server-only. Selects the OTE host and sandbox key. |
| `NAMESILO_SANDBOX_API_KEY` | Production | all | OTE key issued by NameSilo | Type **Sensitive**. Never `NEXT_PUBLIC_*`. |
| `NAMESILO_API_KEY` | — | — | **do not set yet** | Only when switching to live. |
| `NEXT_PUBLIC_SUPABASE_URL` | Production | all | existing | Already present. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | all | existing | Already present. |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | all | existing | Already present, sensitive. |
| `DOMAIN_MANUAL_PAYMENT_INSTRUCTIONS` | Production | all | the text customers should see | Value not yet verified. |

`DOMAIN_PROVIDER_MODE` must be exactly `namesilo-sandbox` or `namesilo`. Any other value, or no
value, makes the price reader and availability calls refuse rather than guess an endpoint or a
credential.

## 2. Apply

1. Vercel → project `hembox-io` → Settings → Environment Variables.
2. Add each key for the **Production** environment with no branch restriction.
3. Use type **Sensitive** (or Encrypted) for the key; Plain is acceptable for the mode string.
4. Redeploy production: Deployments → latest → Redeploy. Variables are read at runtime, but a
   redeploy guarantees clean instances.

CLI alternative:

```bash
vercel env add DOMAIN_PROVIDER_MODE production        # enter: namesilo-sandbox
vercel env add NAMESILO_SANDBOX_API_KEY production
vercel --prod
```

Never paste a key value into a shell history that is committed, a doc, an issue or a chat.

## 3. Verify

- `https://hembox.tech/api/domains/catalog` → `{"currency":"ZMW","catalog":[],...}`. An empty
  catalogue is correct until a TLD is approved.
- Sign in as an administrator → `/admin/domains/provider-prices` → the header must show
  **Environment: test (OTE sandbox)**; **Retrieve rates** must return registration and renewal
  values instead of a configuration error.
- A quote request must still refuse with `price_unavailable` while the catalogue is empty, and
  with `live_provider_required` while in sandbox mode.

## 4. Later: switching to live

1. Obtain and fund the production NameSilo account.
2. Re-read prices with the production key and record them per `domain-pricing-inputs.md` §1 —
   production values, not OTE values.
3. Set `NAMESILO_API_KEY`, then change `DOMAIN_PROVIDER_MODE` to `namesilo`.
4. Redeploy and confirm the reader shows `Environment: live`.
5. Only then enable a TLD, and only with the §7 approvals signed.

## 5. Rollback

Remove `DOMAIN_PROVIDER_MODE` (or delete the key) and redeploy. The application fails closed: no
price reads, no availability checks, no quotation. Nothing is published and no customer reaches a
checkout path.

## 6. Rules

- Provider credentials are server-side only; never `NEXT_PUBLIC_*`.
- Never paste a key value into an issue, PR, document or chat.
- Changing `DOMAIN_PROVIDER_MODE` changes where availability is checked: OTE answers are sandbox
  answers and must never be presented as real availability.
