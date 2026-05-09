import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data: users, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ users })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}