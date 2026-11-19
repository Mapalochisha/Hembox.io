import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
const columns = "registrant_type,first_name,last_name,organisation_name,email,phone,address_line1,address_line2,city,region,postal_code,country_code,created_at,updated_at"
const schema = z.object({
 registrant_type:z.enum(["individual","organisation"]), first_name:z.string().trim().min(1).max(60),
 last_name:z.string().trim().min(1).max(60), organisation_name:z.string().trim().max(120).nullable(),
 email:z.string().trim().toLowerCase().email().max(254), phone:z.string().trim().min(7).max(20),
 address_line1:z.string().trim().min(3).max(120), address_line2:z.string().trim().max(120).nullable(),
 city:z.string().trim().min(2).max(80), region:z.string().trim().min(2).max(80),
 postal_code:z.string().trim().max(20).nullable(), country_code:z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
}).strict()
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}})
const phone=(value:string)=>{const cleaned=value.replace(/[\s()-]/g,"");return /^\+[0-9]{7,15}$/.test(cleaned)?cleaned:null}

export async function GET(){
 try{
  const auth=await createClient();const {data:{user},error:authError}=await auth.auth.getUser()
  if(authError||!user)return json({error:"Sign in to view your registrant profile."},401)
  const db=auth as unknown as SupabaseClient
  const {data,error}=await db.from("customer_domain_registrant_profiles").select(columns).eq("customer_id",user.id).maybeSingle()
  if(error)throw error
  return json({profile:data??null})
 }catch(error){console.error("[Portal] Registrant profile read failed:",error instanceof Error?error.name:"unknown");return json({error:"Registrant profile settings are not available. The required database migration may not be applied."},503)}
}
export async function PUT(request:Request){
 const parsed=schema.safeParse(await request.json().catch(()=>null))
 if(!parsed.success)return json({error:"Complete all required registrant profile fields."},400)
 if(parsed.data.registrant_type==="organisation"&&!parsed.data.organisation_name?.trim())return json({error:"Enter the organisation name for an organisation registrant."},400)
 const normalizedPhone=phone(parsed.data.phone)
 if(!normalizedPhone)return json({error:"Enter a phone number in international format, for example +260970000000."},400)
 try{
  const auth=await createClient();const {data:{user},error:authError}=await auth.auth.getUser()
  if(authError||!user)return json({error:"Sign in to save your registrant profile."},401)
  const db=auth as unknown as SupabaseClient
  const {data,error}=await db.from("customer_domain_registrant_profiles").upsert({
   customer_id:user.id,...parsed.data,email:parsed.data.email.toLowerCase(),phone:normalizedPhone,
   country_code:parsed.data.country_code.toUpperCase(),organisation_name:parsed.data.organisation_name?.trim()||null,
   address_line2:parsed.data.address_line2?.trim()||null,postal_code:parsed.data.postal_code?.trim()||null,
   updated_at:new Date().toISOString(),
  },{onConflict:"customer_id"}).select(columns).single()
  if(error)throw error
  return json({profile:data,message:"Your reusable registrant details have been saved."})
 }catch(error){console.error("[Portal] Registrant profile save failed:",error instanceof Error?error.name:"unknown");return json({error:"Registrant profile could not be saved. Please try again."},503)}
}