import { NextResponse } from "next/server"
import { Buffer } from "node:buffer"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createAuthClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic="force-dynamic"
const BUCKET="client-deliverables"
const MAX_BYTES=20*1024*1024
const ALLOWED:Record<string,string>={"image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/svg+xml":"svg","application/pdf":"pdf","application/zip":"zip","text/plain":"txt","text/markdown":"md","application/json":"json","application/octet-stream":"bin"}
function json(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}})}
async function adminContext(){const auth=createAuthClient();const {data:{user},error:userError}=await auth.auth.getUser();if(userError||!user)return {status:401 as const};const {data:role,error:roleError}=await auth.rpc("get_user_role",{user_id:user.id});if(roleError)return {status:503 as const};if(role!=="admin")return {status:403 as const};return {status:200 as const,user}}

export async function POST(request:Request){
 const context=await adminContext()
 if(context.status!==200)return json({error:context.status===401?"Authentication required.":context.status===403?"Administrator access required.":"Unable to verify administrator access."},context.status)
 try{
  const form=await request.formData()
  const projectId=String(form.get("projectId")??"")
  const milestoneId=String(form.get("milestoneId")??"").trim()
  const title=String(form.get("title")??"").trim()
  const description=String(form.get("description")??"").trim().slice(0,2000)
  const candidate=form.get("file")
  if(!/^[0-9a-f-]{36}$/i.test(projectId)||title.length<2||title.length>180||!(candidate instanceof File))return json({error:"Provide a project, deliverable title and file."},400)
  if(candidate.size<1||candidate.size>MAX_BYTES)return json({error:"Files must be between 1 byte and 20 MB."},400)
  if(!ALLOWED[candidate.type])return json({error:"This file type is not supported."},400)
  const db=createServiceClient() as unknown as SupabaseClient
  const {data:project,error:projectError}=await db.from("projects").select("id,client_id").eq("id",projectId).maybeSingle()
  if(projectError)throw projectError
  if(!project)return json({error:"Project not found."},404)
  const {data:client,error:clientError}=await db.from("clients").select("id,user_id").eq("id",project.client_id).maybeSingle()
  if(clientError)throw clientError
  if(!client?.user_id)return json({error:"Link the project client to a customer account before sharing deliverables."},409)
  if(milestoneId){const {data:milestone,error}=await db.from("project_milestones").select("id").eq("id",milestoneId).eq("project_id",projectId).maybeSingle();if(error)throw error;if(!milestone)return json({error:"Milestone does not belong to this project."},400)}
  const {data:previousVersions,error:versionError}=await db.from("project_deliverables").select("id,version,status").eq("project_id",projectId).eq("title",title).order("version",{ascending:false}).limit(1)
  if(versionError)throw versionError
  const previous=previousVersions?.[0]??null
  const version=Number(previous?.version||0)+1
  const path=client.user_id+"/deliverables/"+crypto.randomUUID()+"."+ALLOWED[candidate.type]
  const {error:uploadError}=await db.storage.from(BUCKET).upload(path,Buffer.from(await candidate.arrayBuffer()),{contentType:candidate.type,upsert:false})
  if(uploadError)throw uploadError
  const now=new Date().toISOString()
  const {data:deliverable,error:insertError}=await db.from("project_deliverables").insert({project_id:projectId,milestone_id:milestoneId||null,title,description:description||null,storage_bucket:BUCKET,storage_path:path,filename:candidate.name.slice(0,255),mime_type:candidate.type,size_bytes:candidate.size,version,status:"shared",shared_at:now,uploaded_by:context.user.id}).select("id,title,filename,status,version,shared_at").single()
  if(insertError){await db.storage.from(BUCKET).remove([path]);throw insertError}
  const {error:fileError}=await db.from("client_files").insert({customer_id:client.user_id,project_id:projectId,storage_bucket:BUCKET,storage_path:path,filename:candidate.name.slice(0,255),mime_type:candidate.type,size_bytes:candidate.size,category:"deliverable",description:description||null,visibility:"client",uploader_role:"admin",uploaded_by:context.user.id})
  if(fileError){await db.from("project_deliverables").delete().eq("id",deliverable.id);await db.storage.from(BUCKET).remove([path]);throw fileError}
  if(previous){await db.from("project_deliverables").update({status:"superseded",updated_at:now}).eq("id",previous.id)}
  await db.from("project_activity").insert({project_id:projectId,actor_id:context.user.id,actor_role:"admin",event_type:"deliverable_shared",title:"Deliverable shared: "+title,details:{deliverable_id:deliverable.id,version}})
  await db.from("client_notifications").insert({customer_id:client.user_id,category:"project",title:"New deliverable shared",body:"HEMBOX shared "+title+" with you for review.",href:"/portal/projects/"+projectId})
  return json({deliverable,message:"Deliverable uploaded and shared with the client."},201)
 }catch(error){console.error("[Admin client workspace] Deliverable upload failed:",error);return json({error:"Unable to share this deliverable. Confirm the client portal migration is applied."},503)}
}
