# Reconfiguring Vercel and the domain provider (hembox.tech)

## Current state

The NameSilo production variables are now configured on Vercel Production:

| Key | Target | Value | Notes |
|---|---|---|---|
| `DOMAIN_PROVIDER_MODE` | Production | `namesilo` | Server-only. Selects the production NameSilo host and `NAMESILO_API_KEY`. |
| `NAMESILO_API_KEY` | Production | configured | Type **Sensitive**. Never `NEXT_PUBLIC_*`. |
| `NAMESILO_SANDBOX_API_KEY` | Production | not required | Only needed for OTE sandbox mode. |

`DOMAIN_PROVIDER_MODE` must be exactly `namesilo` or `namesilo-sandbox`. Any other value, or no value, makes the price reader and availability calls fail closed rather than guess an endpoint or credential.

## Required variables (full reference)

| Key | Target | Value | Notes |
|---|---|---|---|
| `DOMAIN_PROVIDER_MODE` | Production | `namesilo` | Selects production endpoint + `NAMESILO_API_KEY`. |
| `NAMESILO_API_KEY` | Production | configured | Production NameSilo API key. Type **Sensitive**. Never `NEXT_PUBLIC_*`. |
| `NAMESILO_SANDBOX_API_KEY` | Preview | OTE key | Only for sandbox mode (`namesilo-sandbox`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Production | existing | Already present. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | existing | Already present. |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | existing | Already present, sensitive. |
| `DOMAIN_MANUAL_PAYMENT_INSTRUCTIONS` | Production | configured | Manual payment instructions shown to customers. |

## How to apply changes

1. Vercel → project `hembox-io` → Settings → Environment Variables.
2. Add or edit each key for the **Production** environment with no branch restriction.
3. Use type **Sensitive** (or Encrypted) for keys; Plain is acceptable for mode strings.
4. Redeploy production: Deployments → latest → Redeploy. Variables are read at runtime, but a redeploy guarantees clean instances.

CLI alternative:

```bash
vercel env add DOMAIN_PROVIDER_MODE production   # enter: namesilo
vercel env add NAMESILO_API_KEY production
vercel --prod
```

Never paste a key value into a shell history that is committed, a doc, an issue or a chat.

## Verify

- `https://hembox.tech/api/domains/catalog` → empty catalogue until a TLD is approved (correct).
- Sign in as administrator → `/admin/domains/provider-prices` → header must show **Environment: live**; **Retrieve rates** must return registration and renewal values.
- A quote request refuses with `price_unavailable` while the catalogue is empty.
- `POST /api/admin/domains/registration` is available for recording manual registrations completed externally at NameSilo.

## Switching back to sandbox

1. Set `DOMAIN_PROVIDER_MODE` to `namesilo-sandbox`.
2. Set `NAMESILO_SANDBOX_API_KEY` to the OTE key.
3. Redeploy production.
4. Confirm the reader shows `Environment: test (OTE sandbox)`.

## Rollback

Remove `DOMAIN_PROVIDER_MODE` (or delete the key) and redeploy. The application fails closed: no price reads, no availability checks, no quotation. Nothing is published and no customer reaches a checkout path.

## Rules

- Provider credentials are server-side only; never `NEXT_PUBLIC_*`.
- Never paste a key value into an issue, PR, document or chat.
- `DOMAIN_PROVIDER_MODE=namesilo` uses the live NameSilo endpoint and production credentials. OTE answers are sandbox answers and must never be presented as real availability.
