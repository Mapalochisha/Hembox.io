export type ValidationResult<T> =
  | ({ ok: true } & T)
  | { ok: false; message: string }

function isHostname(value: string): boolean {
  if (value.length < 1 || value.length > 253 || !/[a-z]/i.test(value)) return false
  const labels = value.split(".")
  return labels.length >= 2 && labels.every((label) =>
    label.length >= 1 &&
    label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  )
}

/** Validate, lowercase and de-duplicate a registrar nameserver list. */
export function normalizeNameservers(values: unknown): ValidationResult<{ nameservers: string[] }> {
  if (!Array.isArray(values)) return { ok: false, message: "Provide between 2 and 8 nameservers." }
  if (values.length < 2 || values.length > 8) {
    return { ok: false, message: "Provide between 2 and 8 nameservers." }
  }
  if (values.some((value) => typeof value !== "string" || !value.trim())) {
    return { ok: false, message: "Nameserver entries cannot be blank." }
  }

  const nameservers = (values as string[]).map((value) => value.trim().toLowerCase().replace(/\.$/, ""))
  if (new Set(nameservers).size !== nameservers.length) {
    return { ok: false, message: "Nameserver entries must be unique." }
  }
  if (!nameservers.every(isHostname)) {
    return { ok: false, message: "Every nameserver must be a valid hostname." }
  }
  return { ok: true, nameservers }
}

/** Renewal terms are explicit integers; invalid values are rejected, never clamped. */
export function normalizeRenewalYears(value: unknown): ValidationResult<{ years: number }> {
  const years = typeof value === "number" ? value
    : typeof value === "string" && value.trim() ? Number(value) : Number.NaN
  if (!Number.isInteger(years) || years < 1 || years > 10) {
    return { ok: false, message: "Renewal years must be a whole number between 1 and 10." }
  }
  return { ok: true, years }
}

/** Only a successfully registered domain is eligible for post-purchase management. */
export function canManageDomainOrder(status: unknown): boolean {
  return status === "registered"
}

export function isManagementRequestType(type: unknown): type is "renewal" | "nameservers" {
  return type === "renewal" || type === "nameservers"
}
