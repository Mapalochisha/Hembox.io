'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Public pages must remain renderable when Preview/Production environment
 * variables have not been configured yet. Callers can use this guard to
 * disable Supabase-dependent behavior without crashing the whole app.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return false

  try {
    const parsed = new URL(url)
    return (parsed.protocol === 'https:' || parsed.hostname === 'localhost') && !!parsed.hostname
  } catch {
    return false
  }
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !anonKey || !isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for this deployment environment.',
    )
  }

  return createBrowserClient(url, anonKey, {
    cookieOptions: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' },
  })
}
