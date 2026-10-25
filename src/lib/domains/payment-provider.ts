/**
 * Payment gateway port only. No gateway is configured or invoked by this
 * module; live payment processing must remain disabled until onboarding,
 * signed webhook verification, reconciliation and release approval are done.
 */

export type DomainPaymentStatus =
  | "pending"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "refunded"
  | "unknown"

export type CreateDomainPaymentInput = Readonly<{
  orderId: string
  idempotencyKey: string
  amountMinor: number
  currency: "ZMW"
  returnUrl: string
}>

export type DomainPaymentIntent = Readonly<{
  provider: string
  providerPaymentId: string
  status: DomainPaymentStatus
  checkoutUrl?: string
  amountMinor: number
  currency: "ZMW"
}>

export type VerifiedDomainPaymentEvent = Readonly<{
  provider: string
  eventId: string
  providerPaymentId: string
  status: DomainPaymentStatus
  amountMinor: number
  currency: "ZMW"
  verified: true
}>

export type DomainPaymentLookup = Readonly<{
  provider: string
  providerPaymentId: string
  status: DomainPaymentStatus
  amountMinor: number
  currency: "ZMW"
}>

export interface DomainPaymentProvider {
  readonly id: string
  createIntent(input: CreateDomainPaymentInput): Promise<DomainPaymentIntent>
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedDomainPaymentEvent>
  lookupPayment(providerPaymentId: string): Promise<DomainPaymentLookup>
}

export class DomainPaymentsDisabledError extends Error {
  constructor() {
    super("Domain payments are disabled until a gateway is configured and verified.")
    this.name = "DomainPaymentsDisabledError"
  }
}

/**
 * Safe default implementation. It intentionally performs no network requests
 * and cannot create a checkout session or accept an unverified callback.
 */
export const disabledDomainPaymentProvider: DomainPaymentProvider = Object.freeze({
  id: "disabled",
  async createIntent(): Promise<DomainPaymentIntent> {
    throw new DomainPaymentsDisabledError()
  },
  async verifyWebhook(): Promise<VerifiedDomainPaymentEvent> {
    throw new DomainPaymentsDisabledError()
  },
  async lookupPayment(): Promise<DomainPaymentLookup> {
    throw new DomainPaymentsDisabledError()
  },
})

/** Fail closed: unknown environment values never select a real gateway. */
export function getDomainPaymentProvider(
  mode = process.env.DOMAIN_PAYMENT_PROVIDER_MODE ?? "disabled",
): DomainPaymentProvider {
  if (mode !== "disabled") {
    throw new DomainPaymentsDisabledError()
  }
  return disabledDomainPaymentProvider
}

/** Browser redirects and client-supplied statuses are never payment evidence. */
export function isVerifiedPaymentForOrder(
  event: VerifiedDomainPaymentEvent,
  expected: { provider: string; amountMinor: number; currency: "ZMW" },
): boolean {
  return (
    event.verified === true &&
    event.status === "confirmed" &&
    event.provider === expected.provider &&
    Number.isSafeInteger(event.amountMinor) &&
    event.amountMinor > 0 &&
    event.amountMinor === expected.amountMinor &&
    event.currency === expected.currency &&
    event.eventId.trim().length > 0 &&
    event.providerPaymentId.trim().length > 0
  )
}
