import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
export const dynamic="force-dynamic"
const sendSchema=z.object({conversationId:z.string().uuid(),body:z.string().trim().min(1).max(5000)}).strict()
function json(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}})}
async function currentCustomer(){
 const client=createClient()
 const {data:{user},error}=await client.auth.getUser()
 if(error||!user||!user.email)return null
 return user
}
async function ownedConversation(db:SupabaseClient,conversationId:string,customerId:string){
 const {data,error}=await db.from("inquiries").select("id,email,source,customer_id").eq("id",conversationId).eq("source","billing").eq("customer_id",customerId).maybeSingle()
 if(error)throw error
 return data
}
export async function GET(request:Request){
 try{
  const user=await currentCustomer()
  if(!user)return json({error:"Sign in to view this conversation."},401)
  const id=new URL(request.url).searchParams.get("conversationId")
  if(!id||!/^[0-9a-f-]{36}$/i.test(id))return json({error:"Provide a valid conversation."},400)
  const db=createClient() as unknown as SupabaseClient
  const conversation=await ownedConversation(db,id,user.id)
  if(!conversation)return json({error:"Conversation not found."},404)
  const {data,error}=await db.from("inquiry_messages").select("id,inquiry_id,sender_role,body,created_at").eq("inquiry_id",id).order("created_at",{ascending:true}).limit(200)
  if(error)throw error
  return json({messages:data??[]})
 }catch(error){console.error("[Billing] Conversation read failed:",error);return json({error:"Unable to load this billing conversation."},500)}
}
export async function POST(request:Request){
 const body=await request.json().catch(()=>null)
 const parsed=sendSchema.safeParse(body)
 if(!parsed.success)return json({error:"Enter a message of up to 5,000 characters."},400)
 try{
  const user=await currentCustomer()
  if(!user)return json({error:"Sign in to send a message."},401)
  const db=createClient() as unknown as SupabaseClient
  const conversation=await ownedConversation(db,parsed.data.conversationId,user.id)
  if(!conversation)return json({error:"Conversation not found."},404)
  const {data,error}=await db.from("inquiry_messages").insert({inquiry_id:conversation.id,sender_role:"customer",sender_id:user.id,body:parsed.data.body.trim()}).select("id,inquiry_id,sender_role,body,created_at").single()
  if(error)throw error
  return json({message:data},201)
 }catch(error){console.error("[Billing] Conversation send failed:",error);return json({error:"Unable to send this message right now."},500)}
}
