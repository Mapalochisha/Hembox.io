import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: role, error: roleError } = await supabase.rpc("get_user_role", { user_id: user.id })

    if (roleError) {
      console.error("Admin users role lookup error:", roleError)
      return NextResponse.json({ error: "Unable to verify admin access." }, { status: 503 })
    }

    if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const serviceClient = createServiceClient()
    const { data: users, error } = await serviceClient
      .from("profiles")
      .select("id, email, phone, full_name, avatar_url, role, created_at, updated_at")
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Admin users API error:", error)
    return NextResponse.json(
      { error: "Unable to load users." },
      { status: 500 }
    )
  }
}
