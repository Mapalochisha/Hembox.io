"use client"

import { useMemo, useState } from "react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Mail, Lock, ArrowRight } from "lucide-react"
import Link from "next/link"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const supabase = useMemo(() => isSupabaseConfigured() ? createClient() : null, [])
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) {
      toast({ title: "Sign-in unavailable", description: "Authentication is not configured for this deployment. Please contact support.", variant: "destructive" })
      return
    }
    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      toast({
        title: "Welcome back!",
        description: "Successfully signed in.",
        variant: "success",
      })

      // Check role and redirect
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single()

      const requestedDestination = new URLSearchParams(window.location.search).get("next")
      const safeDestination =
        requestedDestination &&
        requestedDestination.startsWith("/") &&
        !requestedDestination.startsWith("//") &&
        !requestedDestination.includes("\\") &&
        !/[\r\n]/.test(requestedDestination)
          ? requestedDestination
          : null

      if (profile?.role === "admin") {
        window.location.assign(safeDestination || "/admin/dashboard")
      } else {
        // Base customer accounts must never be redirected into the admin area.
        window.location.assign(
          safeDestination && !safeDestination.startsWith("/admin")
            ? safeDestination
            : "/portal",
        )
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10"
            required
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        variant="navy"
        size="lg"
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Sign In
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      <p className="text-sm text-center text-gray-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-teal hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </form>
  )
}