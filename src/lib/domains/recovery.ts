import type { DomainOrderStatus } from "./order-state"

export type PaymentReconciliationState =
  | "not_started"
  | "pending"
  | "confirmed"
  | "failed"
  | "refunded"
  | "unknown"

export type RegistrationReconciliationState =
  | "not_started"
  | "confirmed_registered"
  | "confirmed_not_registered"
  | "request_in_flight"
  | "ambiguous"
  | "failed"

export type DomainRecoveryAction =
  | "no_action"
  | "review_expired_quote"
  | "reconcile_payment"
  | "retry_payment_status_lookup"
  | "retry_registration_status_lookup"
  | "manual_review"
  | "eligible_for_registration_retry_after_reconciliation"
  | "eligible_for_refund_review"
  | "inconsistent_state_review"

/**
 * Suggests a safe next operational step; it never performs the action.
 * Ambiguous provider outcomes are reconciled before any retry is considered.
 */
export function getDomainRecoveryAction(input: {
  status: DomainOrderStatus
  quoteExpired?: boolean
  payment: PaymentReconciliationState
  registration: RegistrationReconciliationState
}): DomainRecoveryAction {
  const { status, payment, registration } = input

  if (input.quoteExpired && (status === "quoted" || status === "awaiting_payment")) {
    return "review_expired_quote"
  }

  if (status === "manual_review") return "manual_review"

  if (status === "awaiting_payment") {
    if (payment === "unknown" || payment === "pending") return "retry_payment_status_lookup"
    if (payment === "confirmed") return "inconsistent_state_review"
    if (payment === "failed" || payment === "refunded") return "reconcile_payment"
    return "no_action"
  }

  if (status === "payment_confirmed" || status === "registration_pending") {
    if (payment !== "confirmed") return "inconsistent_state_review"
    if (registration === "ambiguous" || registration === "request_in_flight") {
      return "retry_registration_status_lookup"
    }
    if (registration === "confirmed_registered") {
      return "inconsistent_state_review"
    }
    if (registration === "confirmed_not_registered" || registration === "failed") {
      return "eligible_for_registration_retry_after_reconciliation"
    }
    return "manual_review"
  }

  if (status === "registration_failed") {
    if (payment === "confirmed" && registration === "confirmed_not_registered") {
      return "eligible_for_registration_retry_after_reconciliation"
    }
    if (payment === "confirmed" && registration === "ambiguous") {
      return "retry_registration_status_lookup"
    }
    if (payment === "confirmed" && registration === "failed") return "eligible_for_refund_review"
    return "manual_review"
  }

  if (status === "registered" && registration !== "confirmed_registered") {
    return "inconsistent_state_review"
  }

  if (status === "refunded" && payment !== "refunded") return "inconsistent_state_review"

  return "no_action"
}
