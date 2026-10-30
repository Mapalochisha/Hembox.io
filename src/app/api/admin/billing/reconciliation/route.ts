import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
export const dynamic="force-dynamic"
function json(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}})}
export async function GET(){
 try{
  const authClient=createClient();const {data:{user},error:userError}=await authClient.auth.getUser()
  if(userError||!user)return json({error:"Authentication required."},401)
  const {data:role,error:roleError}=await authClient.rpc("get_user_role",{user_id:user.id})
  if(roleError)return json({error:"Unable to verify administrator access."},503)
  if(role!=="admin")return json({error:"Administrator access required."},403)
  // Authentication and the administrator role are verified above. Use the server-only
  // service client for this admin read so customer-facing RLS policies do not
  // prevent the reconciliation endpoint from reading its authorised datasets.
  const db=createServiceClient() as unknown as SupabaseClient
  const [invoiceResult,paymentResult,allocationResult,eventResult]=await Promise.all([
   db.from("billing_invoices").select("id,invoice_number,customer_id,status,currency,total_minor,issued_at,due_at,source_type,source_id,created_at").order("created_at",{ascending:false}).limit(300),
   db.from("billing_payments").select("id,customer_id,currency,amount_minor,status,source_type,source_reference,verified_by,verified_at,idempotency_key,created_at").order("verified_at",{ascending:false}).limit(300),
   db.from("billing_payment_allocations").select("id,payment_id,invoice_id,amount_minor,currency,allocation_type,reverses_allocation_id,actor_user_id,idempotency_key,reason,created_at").order("created_at",{ascending:false}).limit(1000),
   db.from("billing_events").select("id,invoice_id,payment_id,claim_id,arrangement_request_id,actor_user_id,event_type,details,created_at").order("created_at",{ascending:false}).limit(300),
  ])
  for(const result of [invoiceResult,paymentResult,allocationResult,eventResult])if(result.error)throw result.error
  const ids=Array.from(new Set([...(invoiceResult.data??[]).map(x=>x.customer_id),...(paymentResult.data??[]).map(x=>x.customer_id)]))
  const {data:profiles,error:profileError}=ids.length?await db.from("profiles").select("id,email,full_name").in("id",ids):{data:[],error:null}
  if(profileError)throw profileError
  return json({invoices:invoiceResult.data??[],payments:paymentResult.data??[],allocations:allocationResult.data??[],events:eventResult.data??[],profiles:profiles??[]})
 }catch(error){console.error("[Billing admin] Reconciliation read failed:",error);return json({error:"Unable to load billing reconciliation data."},500)}
}
