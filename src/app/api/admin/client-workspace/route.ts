import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createAuthClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
function json(body: unknown,status=200){return NextResponse.json(body,status===200?{headers:{"Cache-Control":"no-store"}}:{status,headers:{"Cache-Control":"no-store"}})}
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("create_client"),userId:z.string().uuid(),companyName:z.string().trim().min(2).max(180),industry:z.string().trim().max(120).optional().default(""),website:z.string().trim().max(255).optional().default("")}).strict(),
 z.object({action:z.literal("create_project"),clientId:z.string().uuid(),category:z.enum(["brand_identity","graphic_design","website","web_application","mobile_app","software","ui_ux","custom"]).default("custom"),name:z.string().trim().min(2).max(160),description:z.string().trim().max(4000).optional().default(""),status:z.enum(["draft","in_progress","review"]).default("draft"),deadline:z.string().datetime().nullable().optional()}).strict(),
 z.object({action:z.literal("create_service"),clientId:z.string().uuid(),projectId:z.string().uuid().nullable().optional(),serviceType:z.string().trim().min(2).max(80),name:z.string().trim().min(2).max(160),description:z.string().trim().max(2000).optional().default(""),status:z.enum(["pending","active","paused"]).default("active"),startsAt:z.string().datetime().nullable().optional(),renewsAt:z.string().datetime().nullable().optional(),currency:z.enum(["ZMW","USD"]).nullable().optional()}).strict(),
 z.object({action:z.literal("create_milestone"),projectId:z.string().uuid(),title:z.string().trim().min(2).max(180),description:z.string().trim().max(2000).optional().default(""),status:z.enum(["pending","in_progress","ready_for_review","blocked"]).default("pending"),dueAt:z.string().datetime().nullable().optional(),sortOrder:z.number().int().min(0).max(10000).default(0)}).strict(),
 z.object({action:z.literal("review_change_request"),changeRequestId:z.string().uuid(),status:z.enum(["under_review","approved","declined","completed"]),decisionNote:z.string().trim().max(2000).optional().default("")}).strict(),
])
async function adminContext(){
 const auth=createAuthClient()
 const {data:{user},error:userError}=await auth.auth.getUser()
 if(userError||!user)return {status:401 as const}
 const {data:role,error:roleError}=await auth.rpc("get_user_role",{user_id:user.id})
 if(roleError)return {status:503 as const}
 if(role!=="admin")return {status:403 as const}
 return {status:200 as const,user}
}

export async function GET(){
 const context=await adminContext()
 if(context.status!==200)return json({error:context.status===401?"Authentication required.":context.status===403?"Administrator access required.":"Unable to verify administrator access."},context.status)
 try{
  const db=createServiceClient() as unknown as SupabaseClient
  const [clientsResult,projectsResult,servicesResult,milestonesResult,deliverablesResult,changeRequestsResult,accountsResult]=await Promise.all([
   db.from("clients").select("id,user_id,company_name,status,created_at").order("created_at",{ascending:false}).limit(500),
   db.from("projects").select("id,client_id,name,description,status,deadline,created_at,updated_at").order("updated_at",{ascending:false}).limit(500),
   db.from("client_services").select("id,client_id,project_id,customer_id,service_type,name,status,renews_at,currency,created_at").order("created_at",{ascending:false}).limit(500),
   db.from("project_milestones").select("id,project_id,title,status,due_at,sort_order").order("sort_order").limit(1000),
   db.from("project_deliverables").select("id,project_id,title,status,filename,created_at").neq("status","draft").order("created_at",{ascending:false}).limit(1000),
   db.from("project_change_requests").select("id,project_id,customer_id,title,description,status,decision_note,created_at").order("created_at",{ascending:false}).limit(1000),
   db.from("profiles").select("id,email,full_name,role").neq("role","admin").order("email").limit(500),
  ])
  if(clientsResult.error||projectsResult.error||accountsResult.error)throw clientsResult.error||projectsResult.error||accountsResult.error
  const missing=(error: {code?:string;message?:string}|null,table:string)=>Boolean(error&&(error.code==="PGRST205"||error.code==="42P01"||String(error.message||"").toLowerCase().includes(table)))
  const serviceMissing=missing(servicesResult.error,"client_services")
  const milestonesMissing=missing(milestonesResult.error,"project_milestones")
  const deliverablesMissing=missing(deliverablesResult.error,"project_deliverables")
  const changeRequestsMissing=missing(changeRequestsResult.error,"project_change_requests")
  if((servicesResult.error&&!serviceMissing)||(milestonesResult.error&&!milestonesMissing)||(deliverablesResult.error&&!deliverablesMissing)||(changeRequestsResult.error&&!changeRequestsMissing))throw servicesResult.error||milestonesResult.error||deliverablesResult.error||changeRequestsResult.error
  const clients=clientsResult.data??[]
  const userIds=Array.from(new Set(clients.map((client)=>client.user_id).filter(Boolean)))
  const profilesResult=userIds.length?await db.from("profiles").select("id,email,full_name").in("id",userIds):{data:[],error:null}
  if(profilesResult.error)throw profilesResult.error
  const profiles=new Map((profilesResult.data??[]).map((profile)=>[profile.id,profile]))
  return json({clients:clients.map((client)=>({...client,profile:client.user_id?profiles.get(client.user_id)??null:null})),availableAccounts:accountsResult.data??[],projects:projectsResult.data??[],services:serviceMissing?[]:servicesResult.data??[],milestones:milestonesMissing?[]:milestonesResult.data??[],deliverables:deliverablesMissing?[]:deliverablesResult.data??[],changeRequests:changeRequestsMissing?[]:changeRequestsResult.data??[],servicesAvailable:!serviceMissing,milestonesAvailable:!milestonesMissing,deliverablesAvailable:!deliverablesMissing,changeRequestsAvailable:!changeRequestsMissing})
 }catch(error){console.error("[Admin client workspace] Read failed:",error);return json({error:"Client workspace management data is unavailable."},503)}
}

export async function POST(request:Request){
 const body=await request.json().catch(()=>null)
 const parsed=schema.safeParse(body)
 if(!parsed.success)return json({error:"Provide valid project, service, or milestone details."},400)
 const context=await adminContext()
 if(context.status!==200)return json({error:context.status===401?"Authentication required.":context.status===403?"Administrator access required.":"Unable to verify administrator access."},context.status)
 try{
  const db=createServiceClient() as unknown as SupabaseClient
  if(parsed.data.action==="create_client"){
   const {data:account,error:accountError}=await db.from("profiles").select("id,role").eq("id",parsed.data.userId).maybeSingle()
   if(accountError)throw accountError
   if(!account||account.role==="admin")return json({error:"Choose an existing customer account, not an administrator."},400)
   const {data:existing,error:existingError}=await db.from("clients").select("id").eq("user_id",account.id).limit(1).maybeSingle()
   if(existingError)throw existingError
   if(existing)return json({error:"This account already has a client record. Use that record to manage its projects and services."},409)
   const {data:client,error}=await db.from("clients").insert({user_id:account.id,company_name:parsed.data.companyName,industry:parsed.data.industry||null,website:parsed.data.website||null,status:"active"}).select("id,user_id,company_name,status,created_at").single()
   if(error)throw error
   return json({client,message:"Client workspace created and linked to the selected account."},201)
  }
  if(parsed.data.action==="review_change_request"){
   const {data:changeRequest,error:changeError}=await db.from("project_change_requests").select("id,project_id,customer_id,title").eq("id",parsed.data.changeRequestId).maybeSingle()
   if(changeError)throw changeError
   if(!changeRequest)return json({error:"Change request not found."},404)
   const now=new Date().toISOString()
   const {error:updateError}=await db.from("project_change_requests").update({status:parsed.data.status,decision_note:parsed.data.decisionNote||null,reviewed_by:context.user.id,reviewed_at:now,updated_at:now}).eq("id",changeRequest.id)
   if(updateError)throw updateError
   try{await db.from("project_activity").insert({project_id:changeRequest.project_id,actor_id:context.user.id,actor_role:"admin",event_type:"change_request_"+parsed.data.status,title:"Change request "+parsed.data.status+": "+changeRequest.title,details:{change_request_id:changeRequest.id}})}catch(activityError){console.error("[Admin client workspace] Change request activity failed:",activityError)}
   try{await db.from("client_notifications").insert({customer_id:changeRequest.customer_id,category:"project",title:"Change request updated",body:"HEMBOX updated the status of your request: "+changeRequest.title+".",href:"/portal/projects/"+changeRequest.project_id})}catch(notificationError){console.error("[Admin client workspace] Change request notification failed:",notificationError)}
   return json({success:true,message:"Change request updated."},200)
  }
  if(parsed.data.action==="create_project"){
   const {data:client,error:clientError}=await db.from("clients").select("id,user_id").eq("id",parsed.data.clientId).maybeSingle()
   if(clientError)throw clientError
   if(!client)return json({error:"Client not found."},404)
   let result=await db.from("projects").insert({client_id:client.id,category:parsed.data.category,name:parsed.data.name,description:parsed.data.description||null,status:parsed.data.status,deadline:parsed.data.deadline||null}).select("id,client_id,name,description,category,status,deadline,created_at").single()
   if(result.error&&(result.error.code==="PGRST204"||result.error.code==="42703"||String(result.error.message||"").toLowerCase().includes("category"))){
    result=await db.from("projects").insert({client_id:client.id,name:parsed.data.name,description:parsed.data.description||null,status:parsed.data.status,deadline:parsed.data.deadline||null}).select("id,client_id,name,description,status,deadline,created_at").single()
   }
   if(result.error)throw result.error
   const project={...result.data,category:result.data.category||"custom"}
   if(client.user_id){
    try{await db.from("client_notifications").insert({customer_id:client.user_id,category:"project",title:"New project added",body:"HEMBOX added "+project.name+" to your workspace.",href:"/portal/projects/"+project.id})}catch(notificationError){console.error("[Admin client workspace] Project notification failed:",notificationError)}
   }
   return json({project,message:"Project created."},201)
  }
  if(parsed.data.action==="create_service"){
   const {data:client,error:clientError}=await db.from("clients").select("id,user_id").eq("id",parsed.data.clientId).maybeSingle()
   if(clientError)throw clientError
   if(!client||!client.user_id)return json({error:"This client record must be linked to a customer account before services can be assigned."},409)
   if(parsed.data.projectId){
    const {data:project,error}=await db.from("projects").select("id,client_id").eq("id",parsed.data.projectId).maybeSingle()
    if(error)throw error
    if(!project||project.client_id!==client.id)return json({error:"Choose a project belonging to the selected client."},400)
   }
   const {data:service,error}=await db.from("client_services").insert({customer_id:client.user_id,client_id:client.id,project_id:parsed.data.projectId||null,service_type:parsed.data.serviceType,name:parsed.data.name,description:parsed.data.description||null,status:parsed.data.status,starts_at:parsed.data.startsAt||null,renews_at:parsed.data.renewsAt||null,currency:parsed.data.currency||null,created_by:context.user.id}).select("id,name,status,service_type,renews_at,currency").single()
   if(error)throw error
   try{await db.from("client_notifications").insert({customer_id:client.user_id,category:"service",title:"Service added to your workspace",body:"HEMBOX added "+service.name+" to your services.",href:"/portal/services"})}catch(notificationError){console.error("[Admin client workspace] Service notification failed:",notificationError)}
   if(parsed.data.projectId){try{await db.from("project_activity").insert({project_id:parsed.data.projectId,actor_id:context.user.id,actor_role:"admin",event_type:"service_created",title:"Service added: "+service.name,details:{service_id:service.id}})}catch(activityError){console.error("[Admin client workspace] Service activity failed:",activityError)}}
   return json({service,message:"Service record created."},201)
  }
  const {data:project,error:projectError}=await db.from("projects").select("id,client_id,name").eq("id",parsed.data.projectId).maybeSingle()
  if(projectError)throw projectError
  if(!project)return json({error:"Project not found."},404)
  const {data:milestone,error}=await db.from("project_milestones").insert({project_id:project.id,title:parsed.data.title,description:parsed.data.description||null,status:parsed.data.status,due_at:parsed.data.dueAt||null,sort_order:parsed.data.sortOrder,created_by:context.user.id}).select("id,title,status,due_at").single()
  if(error)throw error
  try{await db.from("project_activity").insert({project_id:project.id,actor_id:context.user.id,actor_role:"admin",event_type:"milestone_created",title:"Milestone added: "+milestone.title,details:{milestone_id:milestone.id}})}catch(activityError){console.error("[Admin client workspace] Milestone activity failed:",activityError)}
  try{const {data:client}=await db.from("clients").select("user_id").eq("id",project.client_id).maybeSingle();if(client?.user_id)await db.from("client_notifications").insert({customer_id:client.user_id,category:"project",title:"Project milestone updated",body:"A new milestone was added to "+project.name+": "+milestone.title+".",href:"/portal/projects/"+project.id})}catch(notificationError){console.error("[Admin client workspace] Milestone notification failed:",notificationError)}
  return json({milestone,message:"Milestone added to the project."},201)
 }catch(error){console.error("[Admin client workspace] Save failed:",error);return json({error:"Unable to save this workspace record. Confirm the client portal migration is applied in this environment."},503)}
}
