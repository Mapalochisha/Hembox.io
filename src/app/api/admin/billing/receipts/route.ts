import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
export const dynamic = "force-dynamic"
function json(body: unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}})}
export async function GET(request:Request){
 try{
  const authClient=createClient()
  const {data:{user},error:userError}=await authClient.auth.getUser()
  if(userError||!user)return json({error:"Authentication required."},401)
  const {data:role,error:roleError}=await authClient.rpc("get_user_role",{user_id:user.id})
  if(roleError)return json({error:"Unable to verify administrator access."},503)
  if(role!=="admin")return json({error:"Administrator access required."},403)
  const claimId=new URL(request.url).searchParams.get("claimId")
  if(!claimId||!/^[0-9a-f-]{36}$/i.test(claimId))return json({error:"Provide a valid claim ID."},400)
  const db=createServiceClient() as unknown as SupabaseClient
  const {data:claim,error}=await db.from("billing_payment_claims").select("id,receipt_object_key,receipt_mime_type").eq("id",claimId).maybeSingle()
  if(error)throw error
  if(!claim)return json({error:"Payment claim not found."},404)
  if(!claim.receipt_object_key)return json({error:"No receipt was attached to this claim."},404)
  const {data:signed,error:signedError}=await db.storage.from("billing-receipts").createSignedUrl(claim.receipt_object_key,60,{download:true})
  if(signedError)throw signedError
  return NextResponse.redirect(signed.signedUrl, { status: 302, headers: { "Cache-Control": "no-store" } })
 }catch(error){console.error("[Billing admin] Receipt access failed:",error);return json({error:"Unable to securely open this receipt."},500)}
}
