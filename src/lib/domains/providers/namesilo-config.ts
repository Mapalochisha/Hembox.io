export type NameSiloEnvironment = "test" | "live"

export type NameSiloApiConfig = {
  apiBaseUrl: string
  apiKey: string
}

const API_BASE_URLS: Record<NameSiloEnvironment, string> = {
  test: "https://ote.namesilo.com/api",
  live: "https://www.namesilo.com/api",
}

const API_KEY_NAMES: Record<NameSiloEnvironment, string> = {
  test: "NAMESILO_SANDBOX_API_KEY",
  live: "NAMESILO_API_KEY",
}

/**
 * Pair each endpoint with its own server-side credential. This prevents
 * sandbox credentials from being sent to production or live credentials from
 * being used for OTE tests.
 */
export function resolveNameSiloApiConfig(
  environment: NameSiloEnvironment,
  env: Record<string, string | undefined> = process.env,
): NameSiloApiConfig {
  const apiKeyName = API_KEY_NAMES[environment]
  const apiKey = env[apiKeyName]?.trim()

  if (!apiKey) {
    const label = environment === "test" ? "sandbox" : "live"
    throw new Error(`NameSilo ${label} API credentials are not configured (${apiKeyName}).`)
  }

  return {
    apiBaseUrl: API_BASE_URLS[environment],
    apiKey,
  }
}
