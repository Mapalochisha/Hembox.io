/**
 * Pre-payment registrant gate for domain invoices.
 *
 * A domain registration legally requires the registrant's details, so a domain
 * invoice must not accept a payment claim unless the registrant record has been
 * positively confirmed.
 *
 * The rule this module exists to enforce: **only an explicit "ok" allows the
 * claim.** A missing record and an unverifiable check (for example the
 * registrant migration is not deployed, or the lookup failed) both deny. Keeping
 * the decision in one pure function means a caller cannot accidentally treat
 * "unavailable" as a pass.
 */

export type RegistrantGateCheck = "ok" | "missing" | "unavailable"

export type RegistrantGateDecision =
  | { allow: true; code: null; status: 200; message: null }
  | {
      allow: false
      code: "registrant_details_required" | "registrant_details_unavailable"
      status: 409 | 503
      message: string
    }

const REQUIRED_MESSAGE =
  "Add the domain registrant details in Portal → Domains before paying for this domain."

const UNAVAILABLE_MESSAGE =
  "Registrant details could not be verified, so this domain cannot accept a payment claim right now. No claim was recorded — please try again later or contact support."

/**
 * Decide whether a domain payment claim may proceed from a gate check result.
 * Anything other than an explicit "ok" denies, including values a future caller
 * might introduce.
 */
export function decideDomainRegistrantGate(check: RegistrantGateCheck): RegistrantGateDecision {
  if (check === "ok") {
    return { allow: true, code: null, status: 200, message: null }
  }
  if (check === "missing") {
    return {
      allow: false,
      code: "registrant_details_required",
      status: 409,
      message: REQUIRED_MESSAGE,
    }
  }
  return {
    allow: false,
    code: "registrant_details_unavailable",
    status: 503,
    message: UNAVAILABLE_MESSAGE,
  }
}
