export const DOMAIN_ORDER_STATUSES = [
  "enquiry",
  "quoted",
  "awaiting_payment",
  "payment_confirmed",
  "registration_pending",
  "registered",
  "registration_failed",
  "cancelled",
  "refunded",
  "manual_review",
] as const

export type DomainOrderStatus = (typeof DOMAIN_ORDER_STATUSES)[number]

const transitions: Record<DomainOrderStatus, readonly DomainOrderStatus[]> = {
  enquiry: ["quoted", "cancelled", "manual_review"],
  quoted: ["awaiting_payment", "cancelled", "manual_review"],
  awaiting_payment: ["payment_confirmed", "cancelled", "manual_review"],
  payment_confirmed: ["registration_pending", "refunded", "manual_review"],
  registration_pending: ["registered", "registration_failed", "manual_review"],
  registered: ["manual_review"],
  registration_failed: ["registration_pending", "refunded", "cancelled", "manual_review"],
  cancelled: [],
  refunded: [],
  manual_review: [
    "quoted",
    "awaiting_payment",
    "payment_confirmed",
    "registration_pending",
    "registered",
    "registration_failed",
    "cancelled",
    "refunded",
  ],
}

/**
 * A pure guard for service-layer order transitions. Call this before persisting
 * a status update and write an audit event in the same database transaction.
 * Provider/payment callbacks must still be authenticated and idempotent.
 */
export function canTransitionDomainOrder(
  current: DomainOrderStatus,
  next: DomainOrderStatus,
): boolean {
  return current === next || transitions[current].includes(next)
}

export function getAllowedDomainOrderTransitions(
  current: DomainOrderStatus,
): readonly DomainOrderStatus[] {
  return transitions[current]
}
