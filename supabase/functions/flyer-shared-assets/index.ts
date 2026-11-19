// Staging only. Do NOT deploy until identity-link provisioning and tests are approved.
// All operations require TWO independently verified accounts (Flyer Cloud + PTG)
// and a valid, currently active PTG app session. No role comes from the browser.
import { createClient } from "npm:@supabase/supabase-js@2.49.8";

const FLYER_URL=Deno.env.get("SUPABASE_URL")!;
const FLYER_SERVICE=Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if(!FLYER_SERVICE)throw Error("Missing Supabase server secret.");
const FLYER_PUBLIC=Deno.env.get("SUPABASE_ANON_KEY")!;
const PTG_URL="https://agknxlowackphvwyvxge.supabase.co/functions/v1/ptg-auth";
// Publishable keys are public credentials; prefer an Edge secret when available.
const PTG_PUBLIC=Deno.env.get("FLYER_PTG_PUBLISHABLE_KEY") ?? "sb_publishable_kv2q3dnNQt4ij0mgkOLbQQ_S2MO9FvG";
const allowedOrigins=new Set(["https://kzamora19.github.io","http://localhost:3000","http://127.0.0.1:3000"]);
const admin=createClient(FLYER_URL,FLYER_SERVICE,{auth:{autoRefreshToken:false,persistSession:false}});
const bucket=admin.storage.from("flyer-shared-assets");
const types=new Set(["image/png","image/jpeg","image/webp"]);
const categories=new Set(["logos","banners","backgrounds","templates","decorations","other"]);
const MAX=10*1024*1024;
const ok=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null&&!Array.isArray(value);
function response(origin:string,result:unknown,status=200){
 return new Response(JSON.stringify(result),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-ptg-access-token,x-ptg-session-id","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"}});
}
function expected(error:unknown){return error instanceof Error?error.message:"Unexpected failure";}
class Denied extends Error {status:number;constructor(message:string,status=403){super(message);this.status=status;}}
async function identity(req:Request, allowPairing=false){
 const flyerBearer=req.headers.get("authorization")||"";
 const ptgBearer=req.headers.get("x-ptg-access-token")||"";
 const ptgSession=req.headers.get("x-ptg-session-id")||"";
 if(!flyerBearer.startsWith("Bearer ")||!ptgBearer||!ptgSession||ptgSession.length>100)throw new Denied("Both verified cloud and PTG sign-ins are required.",401);
 const userClient=createClient(FLYER_URL,FLYER_PUBLIC,{auth:{autoRefreshToken:false,persistSession:false},global:{headers:{Authorization:flyerBearer}}});
 const {data:{user},error}=await userClient.auth.getUser();
 if(error||!user)throw new Denied("Invalid Flyer Cloud session.",401);
 const authResult=await fetch(PTG_URL,{method:"POST",headers:{"Content-Type":"application/json","Origin":"https://kzamora19.github.io","Authorization":"Bearer "+ptgBearer,"x-ptg-session-id":ptgSession,"apikey":PTG_PUBLIC},body:JSON.stringify({action:"session"}),signal:AbortSignal.timeout(8000)});
 if(!authResult.ok)throw new Denied("PTG session is inactive or unavailable.",401);
 const json=await authResult.json().catch(()=>null);
 if(!json?.ok||!ok(json.account)||json.account.mustChangePassword)throw new Denied("PTG account cannot access shared assets.");
 const account=json.account;
 // PTG's auth endpoint verifies the immutable subject of the same bearer token.
 // The PTG action=session call above already checks the app session, account status,
 // revocation and current role; do not trust client-supplied username for linking.
 const ptgAuth=await fetch("https://agknxlowackphvwyvxge.supabase.co/auth/v1/user",{
  headers:{"apikey":PTG_PUBLIC,"Authorization":"Bearer "+ptgBearer},
  signal:AbortSignal.timeout(8000)
 });
 if(!ptgAuth.ok)throw new Denied("Could not verify PTG identity.",401);
 const ptgIdentity=await ptgAuth.json().catch(()=>null);
 const ptgUserId=String(ptgIdentity?.id||"");
 if(!/^[a-f0-9-]{36}$/i.test(ptgUserId))throw new Denied("Invalid PTG account identity.",401);
 const role=String(account.role||"").toUpperCase(),legacy=String(account.legacyRole||"").toUpperCase();
 const manager=role==="SYSTEM_ADMIN"||role==="BRANCH_ADMIN"||(role==="BRANCH_USER"&&legacy==="TEAM LEADER");
 if(!manager)throw new Denied("PTG role is not authorized.");
 const {data:link,error:linkError}=await admin.from("flyer_ptg_identity_links")
  .select("flyer_user_id").eq("flyer_user_id",user.id).eq("ptg_user_id",ptgUserId).maybeSingle();
 if(linkError)throw new Denied("Could not validate account pairing.");
 if(!link&&!allowPairing)throw new Denied("Flyer Cloud user is not linked to this PTG identity.");
 return {userId:user.id,ptgUserId,manager,linked:Boolean(link)};
}
function ensureManager(user:{manager:boolean}){if(!user.manager)throw new Denied("Only Team Leader and higher accounts can manage shared assets.");}
function pathOk(path:string){return /^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(path);}
async function ownedAsset(id:unknown){
 if(typeof id!=="string"||!/^[a-f0-9-]{36}$/.test(id))throw new Denied("Invalid asset ID.",400);
 const {data,error}=await admin.from("flyer_shared_assets").select("*").eq("id",id).maybeSingle();
 if(error)throw error;if(!data)throw new Denied("Asset not found.",404);return data;
}
async function run(body:Record<string,unknown>,user:{userId:string,ptgUserId:string,manager:boolean,linked:boolean}){
 const action=String(body.action||"");
 if(action==="pair"){
  ensureManager(user);
  if(user.linked)return {ok:true,linked:true};
  // The two bearer tokens are validated independently and bound by immutable
  // Auth UUIDs; no IDs may be submitted by the browser for pairing.
  const {error}=await admin.from("flyer_ptg_identity_links")
   .insert({flyer_user_id:user.userId,ptg_user_id:user.ptgUserId});
  if(error)throw new Denied("Account pairing could not be completed. Existing links cannot be overwritten.",409);
  return {ok:true,linked:true};
 }
 if(!user.linked)throw new Denied("Link both verified accounts before using the library.");
 if(action==="permissions")return {canView:true,canManage:user.manager};
 if(action==="list"){
  let query=admin.from("flyer_shared_assets").select("id,name,category,storage_path,mime_type,byte_size,created_at,updated_at").order("name").limit(200);
  if(typeof body.category==="string"&&categories.has(body.category))query=query.eq("category",body.category);
  const search=String(body.search||"").trim().slice(0,120).replace(/[%_,()\\]/g,"");
  if(search)query=query.ilike("name","%"+search+"%");
  const {data,error}=await query;if(error)throw error;return {assets:data||[]};
 }
 if(action==="preview"){
  const asset=await ownedAsset(body.id);
  const {data,error}=await bucket.createSignedUrl(asset.storage_path,60);
  if(error)throw error;return {url:data.signedUrl};
 }
 ensureManager(user);
 if(action==="rename"){
  const asset=await ownedAsset(body.id),name=String(body.name||"").trim();
  if(!name||name.length>120)throw new Denied("Name must be 1–120 characters.",400);
  const {error}=await admin.from("flyer_shared_assets").update({name,updated_by:user.userId,updated_at:new Date().toISOString()}).eq("id",asset.id);
  if(error)throw error;return {ok:true};
 }
 if(action==="delete"){
  const asset=await ownedAsset(body.id);
  const {error}=await admin.from("flyer_shared_assets").delete().eq("id",asset.id);
  if(error)throw error;
  const removal=await bucket.remove([asset.storage_path]);
  return {ok:true,cleanupWarning:removal.error?.message||null};
 }
 if(action==="add"||action==="replace"){
  const name=String(body.name||"").trim(),category=String(body.category||"");
  const mime=String(body.mime||""),base64=body.base64;
  if(!types.has(mime)||typeof base64!=="string"||base64.length>Math.ceil(MAX*4/3)+8||!/^[a-zA-Z0-9+/]*={0,2}$/.test(base64))throw new Denied("Invalid image format or size.",400);
  let bytes:Uint8Array;
  try {
   bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
  } catch {
   throw new Denied("Invalid base64 image data.",400);
  }
  if(!bytes.length||bytes.length>MAX)throw new Denied("Image exceeds 10 MB.",400);
  if(!name||name.length>120||!categories.has(category))throw new Denied("Invalid name or category.",400);
  const isPng=mime==="image/png"&&bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
  const isJpg=mime==="image/jpeg"&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const isWebp=mime==="image/webp"&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
  if(!(isPng||isJpg||isWebp))throw new Denied("Image file signature does not match its type.",400);
  const previous=action==="replace"?await ownedAsset(body.id):null;
  const path=user.userId+"/"+crypto.randomUUID()+({["image/png"]:".png",["image/jpeg"]:".jpg",["image/webp"]:".webp"} as Record<string,string>)[mime];
  if(!pathOk(path))throw new Denied("Invalid storage path.",400);
  const uploaded=await bucket.upload(path,bytes,{contentType:mime,upsert:false});
  if(uploaded.error)throw uploaded.error;
  let dbError:unknown=null;
  try{
   if(previous){
    const {error}=await admin.from("flyer_shared_assets").update({name,category,mime_type:mime,byte_size:bytes.length,storage_path:path,updated_by:user.userId,updated_at:new Date().toISOString()}).eq("id",previous.id);
    if(error)throw error;
   }else{
    const {error}=await admin.from("flyer_shared_assets").insert({name,category,mime_type:mime,byte_size:bytes.length,storage_path:path,created_by:user.userId,updated_by:user.userId});
    if(error)throw error;
   }
  }catch(e){dbError=e;}
  if(dbError){await bucket.remove([path]);throw dbError;}
  if(previous)await bucket.remove([previous.storage_path]);
  return {ok:true};
 }
 throw new Denied("Unknown asset action.",400);
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 if(!allowedOrigins.has(origin))return new Response("Forbidden origin",{status:403});
 if(req.method==="OPTIONS")return response(origin,{ok:true});
 if(req.method!=="POST")return response(origin,{error:"Method not allowed"},405);
 try{
  const type=req.headers.get("content-type")||"";
  if(!type.toLowerCase().includes("application/json"))throw new Denied("JSON required.",415);
  const declaredLength=Number(req.headers.get("content-length")||"0");
  if(declaredLength>14_500_000)throw new Denied("Request exceeds the maximum asset size.",413);
  const body=await req.json();
  if(!ok(body))throw new Denied("Invalid request.",400);
  const user=await identity(req,body.action==="pair");
  return response(origin,await run(body,user));
 }catch(e){
  const status=e instanceof Denied?e.status:500;
  if(status===500)console.error("Shared assets gateway failure",e);
  return response(origin,{error:status===500?"Shared asset operation failed.":expected(e)},status);
 }
});
