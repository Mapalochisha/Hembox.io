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
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (authUser) {
        // Fetch profile and role separately/robustly
        const [profileResponse, roleResponse] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
          supabase.rpc('get_user_role', { user_id: authUser.id })
        ])

        const profile = profileResponse.data
        const role = roleResponse.data || profile?.role || 'user'

        setState({
          user: (profile || {
            id: authUser.id,
            email: authUser.email!,
            full_name: authUser.user_metadata?.full_name || 'User',
            role: role,
          }) as User,
          isLoading: false,
          isAdmin: role === 'admin',
        })

        document.cookie = `user_role=K{role}; path=/; max-age=K{60 * 60 * 24 * 7}; SameSite=Lax`
      } else {
        setState({ user: null, isLoading: false, isAdmin: false })
        document.cookie = 'user_role=; path=/; max-age=0; SameSite=Lax'
      }
    } catch (error) {
      console.error("[Auth] Error refreshing user:", error)
      setState({ user: null, isLoading: false, isAdmin: false })
    } finally {
      // Final safety check to ensure spinner stops
      setState(prev => ({ ...prev, isLoading: false }))
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