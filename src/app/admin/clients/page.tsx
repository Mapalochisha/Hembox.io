import { createServiceClient } from "@/lib/supabase/service"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, Mail } from "lucide-react"
import Link from "next/link"

type CustomerAccount = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  created_at: string
}

async function getCustomerAccounts(search?: string) {
  const supabase = createServiceClient()
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, phone, created_at")
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(500)

  if (search?.trim()) {
    const term = search.trim().replace(/[,%()]/g, " ")
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
  }

  const [{ data: accounts, error: accountError }, { data: workspaces, error: workspaceError }] = await Promise.all([
    query,
    supabase.from("clients").select("id, user_id, company_name, status"),
  ])

  if (accountError) {
    console.error("Error fetching customer accounts:", accountError)
    return { accounts: [], workspaces: [] }
  }
  if (workspaceError) {
    console.error("Error fetching client workspace records:", workspaceError)
  }

  return {
    accounts: (accounts || []) as CustomerAccount[],
    workspaces: workspaceError ? [] : workspaces || [],
  }
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { search?: string }
}) {
  const { accounts, workspaces } = await getCustomerAccounts(searchParams.search)
  const workspaceByUser = new Map(workspaces.filter((item: any) => item.user_id).map((item: any) => [item.user_id, item]))

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Accounts</h1>
          <p className="mt-1 text-gray-600">Every base customer account is listed here, whether or not it has a company record or has purchased a service.</p>
        </div>
        <Link href="/admin/clients/new">
          <Button className="bg-navy hover:bg-navy/90">
            <Plus className="mr-2 h-4 w-4" /> Create company record
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Customer accounts</p>
            <p className="mt-1 text-3xl font-bold text-navy">{accounts.length}</p>
            <p className="mt-1 text-xs text-gray-500">Profiles with the base `user` role</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Company / workspace records</p>
            <p className="mt-1 text-3xl font-bold text-navy">{workspaces.length}</p>
            <p className="mt-1 text-xs text-gray-500">Separate records linked to customer accounts</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <form className="flex w-full max-w-md items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input name="search" placeholder="Search name or email..." defaultValue={searchParams.search} className="pl-10" />
            </div>
            <Button type="submit" variant="outline">Search</Button>
          </form>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <p className="font-semibold text-gray-700">No customer accounts found</p>
              <p className="mt-1 text-sm text-gray-500">Newly registered base-role accounts will appear here automatically.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Customer account</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Company / workspace</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Contact</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Account role</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => {
                    const workspace = workspaceByUser.get(account.id) as { company_name?: string | null } | undefined
                    return (
                      <tr key={account.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-4">
                          <p className="font-medium text-navy">{account.full_name || "Unnamed customer"}</p>
                          <p className="text-xs text-gray-500">{account.email || "No email"}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">{workspace?.company_name || <span className="text-gray-400">No company record</span>}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {account.email ? <span className="inline-flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{account.email}</span> : account.phone || "—"}
                        </td>
                        <td className="px-4 py-4"><span className="rounded-full bg-teal/10 px-2.5 py-1 text-xs font-semibold text-teal">Customer</span></td>
                        <td className="px-4 py-4 text-sm text-gray-500">{new Intl.DateTimeFormat("en-ZM", { dateStyle: "medium" }).format(new Date(account.created_at))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
