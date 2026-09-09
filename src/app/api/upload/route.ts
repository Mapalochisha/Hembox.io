import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cloudinary } from "@/lib/cloudinary"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: role } = await supabase.rpc("get_user_role", { user_id: user.id })

    if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()
    const entry = formData.get("file")

    if (!(entry instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(entry.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, and GIF images are allowed." },
        { status: 415 }
      )
    }

    if (entry.size <= 0 || entry.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image must be between 1 byte and 5 MB." },
        { status: 413 }
      )
    }

    const bytes = await entry.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = `data:${entry.type};base64,${buffer.toString("base64")}`

    const result = await cloudinary.uploader.upload(base64, {
      folder: "Hembox.io",
      resource_type: "image",
    })

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    )
  }
}
