import { RegisterForm } from "@/components/auth/register-form"
import { GoogleAuthButton } from "@/components/auth/google-auth"
import Link from "next/link"

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group mb-6">
            <div className="relative w-9 h-9 rounded-xl bg-navy flex items-center justify-center overflow-hidden group-hover:scale-105 transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="relative z-10">
                <path d="M4 4h7v7H4zM13 4h7v4h-7zM4 13h4v7H4zM13 11h7v9h-7z" fill="white" />
              </svg>
            </div>
            <span className="text-[19px] font-[800] tracking-tight">Hembox.io</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Create account</h1>
          <p className="text-gray-600 mt-1">Get started with Hembox.io</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-navy/5 p-8 space-y-6">
          <RegisterForm />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or continue with</span>
            </div>
          </div>

          <GoogleAuthButton />
        </div>
      </div>
    </div>
  )
}