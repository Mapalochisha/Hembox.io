'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, AuthState } from '@/types'

const AuthContext = createContext<AuthState & {
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}>({
  user: null,
  isLoading: true,
  isAdmin: false,
  signOut: async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAdmin: false,
  })

  const supabase = createClient()

  const refreshUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      console.log("[Auth] Session found:", !!session, session?.user?.email);

      if (session?.user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        console.log("[Auth] Profile fetch:", !!profile, "Role:", profile?.role, "Error:", error);

        if (profile) {
          setState({
            user: profile as User,
            isLoading: false,
            isAdmin: profile.role === 'admin',
          })

          // Set admin cookie for middleware
          document.cookie = `user_role=${profile.role}; path=/; max-age=${60 * 60 * 24 * 7}`
        } else {
          // Fallback if profile is missing but session exists
          console.warn("[Auth] Session exists but profile is missing or blocked by RLS");
          setState({ user: null, isLoading: false, isAdmin: false })
        }
      } else {
        setState({ user: null, isLoading: false, isAdmin: false })
        document.cookie = 'user_role=; path=/; max-age=0'
      }
    } catch (error) {
      console.error("[Auth] Refresh user error:", error);
      setState({ user: null, isLoading: false, isAdmin: false })
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    document.cookie = 'user_role=; path=/; max-age=0'
    setState({ user: null, isLoading: false, isAdmin: false })
    window.location.href = '/'
  }

  useEffect(() => {
    refreshUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          refreshUser()
        } else {
          setState({ user: null, isLoading: false, isAdmin: false })
          document.cookie = 'user_role=; path=/; max-age=0'
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}