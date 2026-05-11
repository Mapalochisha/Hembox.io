import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  console.log(`[Middleware] Path: ${pathname} | User: ${user?.id || 'none'}`);

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    if (!user) {
      console.log(`[Middleware] No user found for ${pathname}, redirecting to /login`);
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Use the RPC function to bypass RLS issues in middleware
    const { data: role, error } = await supabase
      .rpc('get_user_role', { user_id: user.id })

    console.log(`[Middleware] Admin Check | Role: ${role} | Error: ${JSON.stringify(error)}`);

    if (role !== 'admin') {
      console.log(`[Middleware] Access denied for ${pathname}, redirecting to / | Role found: ${role}`);
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}