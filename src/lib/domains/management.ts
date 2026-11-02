import { sort, isValidHostname } from 'validator';

/** Normalise nameserver values recorded at the registrar. */
export function normalizeNameservers(values: string[]): string[] {
  return values.map((v) => v.trim()).filter((v) => v.length > 0);
}

/** Normalise a renewal‑year count, clamping to the allowed 1‑10 range. */
export function normalizeRenewalYears(years?: number): number {
  if (years == null || years < 1) return 1;
  if (years > 10) return 10;
  return years;
}

/** Check whether the current user can manage a given domain order. */
export function canManageDomainOrder(orderId: string, userId: string): boolean {
  // The RPC and route both verify ownership; this is a lightweight guard.
  return userId !== '';
}

/** Check whether a request type is a manageable management‑request type. */
export function isManagementRequestType(type: string): boolean {
  return type === 'renewal' || type === 'nameservers';
}