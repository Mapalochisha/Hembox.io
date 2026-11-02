"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, CircleAlert, Loader2, RefreshCw, Server } from "lucide-react"
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"

type ProviderInfo = { state: string; domain: string; providerStatus: string | null; expiresAt: string | null; nameservers: string[]; message: string }
const nameserverOptions = Array.from({ length: 8 }, (_, index) => `ns${index + 1}.namesilo.com`)

export default function SandboxDomainManagePage() {
  const params = useParams<{ orderId: string }>()
  const [info, setInfo] = useState<ProviderInfo | null>(null)
  const [years, setYears] = useState(1)
  const [nameservers, setNameservers] = useState<string[]>(["ns1.namesilo.com", "ns2.namesilo.com"])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/domains/sandbox/orders/${params.orderId}/manage`, { cache: "no-store" })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error ?? "Could not read domain information.")
    setInfo(body.providerInfo)
    if (body.providerInfo?.nameservers?.length >= 2) setNameservers(body.providerInfo.nameservers.slice(0, 8))
  }, [params.orderId])

  useEffect(() => { refresh().catch((e) => setError(e instanceof Error ? e.message : "Could not load domain.")).finally(() => setLoading(false)) }, [refresh])

  async function submit(action: "renew" | "nameservers") {
    setBusy(true); setError(""); setNotice("")
    try {
      const response = await fetch(`/api/domains/sandbox/orders/${params.orderId}/manage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "renew" ? { action, years } : { action, nameservers }),
      })
      const body = await response.json()
      if (!response.ok && response.status !== 202) throw new Error(body.error ?? "Domain update failed.")
      setNotice(body.success ? action === "renew" ? `Renewal confirmed. New expiry: ${new Date(body.expiresAt).toLocaleDateString()}.` : "NameSilo OTE confirmed the nameserver change." : body.error ?? "The provider response needs reconciliation.")
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Domain update failed.")
    } finally { setBusy(false) }
  }

  function updateNameserver(index: number, value: string) {
    setNameservers((current) => current.map((item, i) => i === index ? value : item))
  }

  return <div className="min-h-screen bg-slate-50 text-navy"><Navbar /><main className="mx-auto max-w-4xl px-5 pb-20 pt-32 sm:px-8">
    <Link href="/domains/sandbox" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-teal"><ArrowLeft className="h-4 w-4" /> Your sandbox portfolio</Link>
    <div className="mt-7 rounded-3xl bg-navy p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-wider text-teal">NameSilo OTE · Test environment</p><h1 className="mt-2 text-3xl font-black">Manage your domain</h1><p className="mt-2 text-sm text-slate-300">Every operation below is sent to NameSilo OTE and then read back for confirmation. No live registrar account is contacted.</p></div>
    {error ? <div role="alert" className="mt-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><CircleAlert className="h-5 w-5 shrink-0" />{error}{error.toLowerCase().includes("sign in") ? <Link href="/login" className="font-bold underline">Sign in</Link> : null}</div> : null}
    {notice ? <div role="status" className="mt-5 flex gap-2 rounded-xl border border-teal/30 bg-teal/10 p-4 text-sm text-slate-800"><CheckCircle2 className="h-5 w-5 shrink-0 text-teal" />{notice}</div> : null}
    {loading ? <div className="mt-10 flex items-center justify-center gap-3 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Checking NameSilo OTE…</div> : info ? <>
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-teal">Confirmed provider record</p><h2 className="mt-1 text-2xl font-black">{info.domain}</h2></div><button onClick={() => { setLoading(true); refresh().catch(e=>setError(e instanceof Error?e.message:"Refresh failed.")).finally(()=>setLoading(false)) }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold"><RefreshCw className="h-4 w-4" />Refresh status</button></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Registrar status</p><p className="mt-1 font-bold">{info.providerStatus ?? "Unknown"}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Expiry date</p><p className="mt-1 font-bold">{info.expiresAt ? new Date(info.expiresAt).toLocaleDateString() : "Not confirmed"}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Environment</p><p className="mt-1 font-bold">Sandbox / OTE</p></div></div><p className="mt-4 text-xs text-slate-500">{info.message}</p></section>
      <section className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-teal" /><h2 className="text-lg font-black">Renew domain</h2></div><p className="mt-2 text-sm leading-6 text-slate-500">Request an OTE renewal. The app confirms the updated expiry date before recording success. NameSilo may consume sandbox test-account funds; no HEMBOX payment is collected.</p><label className="mt-5 block text-sm font-semibold">Renew for<select value={years} onChange={(e)=>setYears(Number(e.target.value))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1} {i===0?"year":"years"}</option>)}</select></label><button onClick={()=>void submit("renew")} disabled={busy || info.providerStatus?.toLowerCase()!=="active"} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:null}Renew in sandbox</button></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><Server className="h-5 w-5 text-teal"/><h2 className="text-lg font-black">Nameservers</h2></div><p className="mt-2 text-sm leading-6 text-slate-500">For this OTE rehearsal, NameSilo accepts its own NS1–NS8 hostnames only. The requested values are read back from the registrar before we show them as confirmed.</p><div className="mt-4 space-y-2">{nameservers.map((server,index)=><label key={index} className="block text-xs font-semibold text-slate-600">Nameserver {index+1}<select value={server} onChange={(e)=>updateNameserver(index,e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm">{nameserverOptions.map(option=><option key={option}>{option}</option>)}</select></label>)}</div><button onClick={()=>void submit("nameservers")} disabled={busy || info.providerStatus?.toLowerCase()!=="active" || nameservers.length<2} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:null}Update in sandbox</button></div>
      </section>
    </> : <div className="mt-6 rounded-2xl bg-white p-6 text-sm text-slate-600">Domain information is not available. Return to your sandbox portfolio or contact an administrator for reconciliation.</div>}
  </main><Footer/></div>
}
