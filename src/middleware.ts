import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Public pages and assets must not depend on Supabase availability.
  // Authentication is only required for the protected admin area.
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseAnonKey) {
    // Fail closed for admin pages, but return a clear response instead of a
    // thrown configuration exception when Preview env vars are missing.
    return NextResponse.json(
      { error: 'Admin authentication is not configured for this deployment.' },
      { status: 503 },
    )
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { data: role, error: roleError } = await supabase.rpc('get_user_role', {
      user_id: user.id,
    })

    if (roleError || role !== 'admin') {
      const deniedUrl = new URL('/access-denied', request.url)
      deniedUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(deniedUrl)
    }

    return response
  } catch (error) {
    // Fail closed for protected admin routes while keeping the public site available.
    console.error('Admin middleware authentication error:', error)
    return NextResponse.json(
      { error: 'Authentication service temporarily unavailable.' },
      { status: 503 }
    )
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
