import { z } from "zod"

const domainSearchRequestSchema = z.object({
  domains: z.array(z.string().trim().toLowerCase().min(3).max(253)).min(1).max(10),
}).strict()

export function isValidFullyQualifiedDomain(value: string): boolean {
  const labels = value.split(".")
  return labels.length >= 2 && labels.every((label) =>
    label.length >= 1 &&
    label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  )
}

/**
 * Validate and normalize public domain-search requests before any provider call.
 * Duplicate domains are collapsed after normalization to avoid duplicate
 * registrar requests in a single batch.
 */
export function parseDomainSearchRequest(value: unknown) {
  const parsed = domainSearchRequestSchema.safeParse(value)
  if (!parsed.success || !parsed.data.domains.every(isValidFullyQualifiedDomain)) {
    return { success: false as const }
  }

  return {
    success: true as const,
    data: { domains: [...new Set(parsed.data.domains)] },
  }
}
