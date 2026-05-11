"use client"

import { useAuth } from "@/components/providers/auth-provider"
import { Navbar } from "@/components/landing/navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { User, Mail, Shield, Calendar, LogOut } from "lucide-react"

export default function ProfilePage() {
  const { user, isAdmin, signOut, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal"></div>
      </div>
    )
  }

  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-32 pb-20">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-navy">Your Profile</h1>
            <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
          </div>

          <Card className="rounded-[32px] overflow-hidden border-black/5 shadow-xl shadow-black/5">
            <div className="h-32 bg-gradient-to-r from-teal to-coral opacity-20" />
            <CardHeader className="relative -mt-16 pb-0">
              <div className="w-24 h-24 rounded-3xl bg-navy border-4 border-white flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                {user.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-navy">{user.full_name || "User"}</h2>
                <p className="text-gray-500">{user.email}</p>
              </div>

              <div className="grid gap-6">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-black/5">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <Mail className="w-5 h-5 text-teal" />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Email Address</p>
                    <p className="font-medium text-navy">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-black/5">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <Shield className="w-5 h-5 text-coral" />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Account Role</p>
                    <p className="font-medium text-navy capitalize">{user.role}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-black/5">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <Calendar className="w-5 h-5 text-navy" />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Joined Date</p>
                    <p className="font-medium text-navy">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : "Recently"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-4">
                <Button 
                  variant="outline" 
                  className="rounded-xl h-12 px-6 font-semibold"
                  onClick={() => window.location.href = isAdmin ? "/admin/dashboard" : "/"}
                >
                  {isAdmin ? "Go to Dashboard" : "Back to Home"}
                </Button>
                <Button 
                  variant="destructive" 
                  className="rounded-xl h-12 px-6 font-semibold gap-2"
                  onClick={signOut}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
