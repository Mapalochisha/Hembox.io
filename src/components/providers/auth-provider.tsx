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
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle()

        if (profile) {
          setState({
            user: profile as User,
            isLoading: false,
            isAdmin: profile.role === 'admin',
          })
          document.cookie = `user_role=${profile.role}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
        } else {
          // Fallback to auth user data if profile is missing
          setState({
            user: {
              id: authUser.id,
              email: authUser.email!,
              full_name: authUser.user_metadata?.full_name || 'User',
              role: 'user',
            } as User,
            isLoading: false,
            isAdmin: false,
          })
        }
      } else {
        setState({ user: null, isLoading: false, isAdmin: false })
        document.cookie = 'user_role=; path=/; max-age=0; SameSite=Lax'
      }
    } catch (error) {
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