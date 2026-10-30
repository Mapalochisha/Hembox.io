import Link from "next/link"
import { ShieldAlert } from "lucide-react"

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
          <ShieldAlert className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">You don’t have access to this area</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The administrator workspace is restricted to authorised HEMBOX administrators.
          Your account is still available through the client portal.
        </p>
        <Link href="/portal" className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-700">
          Return to client portal
        </Link>
      </section>
    </main>
  )
}
