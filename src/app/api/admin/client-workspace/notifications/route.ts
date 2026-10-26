import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createAuthClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic="force-dynamic"
const schema=z.object({customerId:z.string().uuid(),category:z.enum(["project","service","billing","domain","message","system"]),title:z.string().trim().min(2).max(180),body:z.string().trim().min(1).max(1000),href:z.string().regex(/^\/portal\/(?!\/).*/).optional().nullable()}).strict()
function json(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}})}

export async function POST(request:Request){
 const body=await request.json().catch(()=>null)
 const parsed=schema.safeParse(body)
 if(!parsed.success)return json({error:"Provide valid notification details."},400)
 const auth=createAuthClient()
 const {data:{user},error:userError}=await auth.auth.getUser()
 if(userError||!user)return json({error:"Authentication required."},401)
 const {data:role,error:roleError}=await auth.rpc("get_user_role",{user_id:user.id})
 if(roleError)return json({error:"Unable to verify administrator access."},503)
 if(role!=="admin")return json({error:"Administrator access required."},403)
 try{
  const db=createServiceClient() as unknown as SupabaseClient
  const {data:client,error:clientError}=await db.from("clients").select("user_id").eq("user_id",parsed.data.customerId).maybeSingle()
  if(clientError)throw clientError
  // Customer IDs are auth user IDs; only notify accounts represented by an owned client record.
  if(!client)return json({error:"Customer account not found."},404)
  const {data,error}=await db.from("client_notifications").insert({customer_id:parsed.data.customerId,category:parsed.data.category,title:parsed.data.title,body:parsed.data.body,href:parsed.data.href||null}).select("id").single()
  if(error)throw error
  return json({notification:{id:data.id}},201)
 }catch(error){console.error("[Admin client workspace] Notification creation failed:",error);return json({error:"Notifications are not available in this environment yet."},503)}
}
