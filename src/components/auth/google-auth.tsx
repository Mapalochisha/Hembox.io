"use client"

import { useMemo } from "react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Chrome } from "lucide-react"

export function GoogleAuthButton() {
  const supabase = useMemo(() => isSupabaseConfigured() ? createClient() : null, [])
  const { toast } = useToast()

  const handleGoogleSignIn = async () => {
    if (!supabase) {
      toast({ title: "Sign-in unavailable", description: "Authentication is not configured for this deployment. Please contact support.", variant: "destructive" })
      return
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      })
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      size="lg"
      onClick={handleGoogleSignIn}
    >
      <Chrome className="mr-2 h-4 w-4" />
      Continue with Google
    </Button>
  )
}