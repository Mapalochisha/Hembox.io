import { LoginForm } from "@/components/auth/login-form"
import { GoogleAuthButton } from "@/components/auth/google-auth"
import { PhoneAuthForm } from "@/components/auth/phone-auth"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group mb-6">
            <div className="relative w-9 h-9 rounded-xl bg-navy flex items-center justify-center overflow-hidden group-hover:scale-105 transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="relative z-10">
                <path d="M4 4h7v7H4zM13 4h7v4h-7zM4 13h4v7H4zM13 11h7v9h-7z" fill="white" />
              </svg>
            </div>
            <span className="text-[19px] font-[800] tracking-tight">Pixel Forge</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-gray-600 mt-1">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-navy/5 p-8">
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="phone">Phone</TabsTrigger>
              <TabsTrigger value="google">Google</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="mt-0">
              <LoginForm />
            </TabsContent>

            <TabsContent value="phone" className="mt-0">
              <PhoneAuthForm />
            </TabsContent>

            <TabsContent value="google" className="mt-0">
              <div className="space-y-4">
                <GoogleAuthButton />
                <p className="text-sm text-center text-gray-500">
                  You will be redirected to Google to complete sign in
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}