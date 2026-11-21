// Private Smart Product Photo Library (shared PTG TL+).
// Standalone use requires live PTG authentication; private-editor cutover remains separately gated.
import {createClient} from "npm:@supabase/supabase-js@2.49.8";
import {validPtgGatewayUrl,validSignedProof} from "../_shared/studio-private-policy.mjs";

const URL_FLYER=Deno.env.get("SUPABASE_URL")||"";
const SERVICE=Deno.env.get("SUPABASE_SECRET_KEY")||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const PTG_PUBLIC=Deno.env.get("FLYER_PTG_PUBLISHABLE_KEY")||"sb_publishable_kv2q3dnNQt4ij0mgkOLbQQ_S2MO9FvG";
const ALLOWED_ORIGIN=Deno.env.get("FLYER_PRODUCT_PHOTO_ALLOWED_ORIGIN")||"https://kzamora19.github.io";
const PTG_REF="agknxlowackphvwyvxge";
const PTG_ORIGIN="https://"+PTG_REF+".supabase.co";
// Protected editor has an opaque origin and NEVER receives a PTG bearer.
// Only its P-256 proof holder may ask the PTG authority to validate access.
// Standalone MegaFlyer retains the current live PTG bearer + app-session path.
const STUDIO_GATEWAY_SECRET=Deno.env.get("FLYER_PTG_STUDIO_GATEWAY_SECRET")||"";
const STUDIO_GATEWAY_URL=validPtgGatewayUrl(
  Deno.env.get("PTG_STUDIO_GATEWAY_URL")||"",
  Deno.env.get("PTG_STUDIO_DEPLOYMENT_MODE")||"");
const PHOTO_BUCKET="flyer-product-photos";
const MAX_FILE=2*1024*1024,MAX_THUMB=256*1024,MAX_BODY=3_500_000;
const TYPES=new Set(["image/png","image/jpeg","image/webp"]);
const baseHeaders={"Cache-Control":"no-store, private","Pragma":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
const normalize=(value:unknown)=>String(value??"").normalize("NFKC").trim().toUpperCase().replace(/\s+/g," ");
const barcode=(value:unknown)=>normalize(value).replace(/[^A-Z0-9]/g,"").slice(0,100);
const word=(value:unknown)=>normalize(value).replace(/[^A-Z0-9]+/g," ").trim().slice(0,100);
const uuid=(s:unknown)=>typeof s==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x);
const admin=SERVICE&&URL_FLYER?createClient(URL_FLYER,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}}):null;
function response(origin:string,result:unknown,status=200){
 const h:Record<string,string>={...baseHeaders,"Content-Type":"application/json; charset=utf-8"};
 if(origin===ALLOWED_ORIGIN){h["Access-Control-Allow-Origin"]=origin;h["Access-Control-Allow-Headers"]="authorization,apikey,content-type,x-ptg-session-id";h["Access-Control-Allow-Methods"]="POST,OPTIONS";h.Vary="Origin";}
 return new Response(JSON.stringify(result),{status,headers:h});
}
class Denied extends Error{constructor(message:string,readonly status=403){super(message);}}
function configured(){
 return !!admin && PTG_PUBLIC.length>=20 && ALLOWED_ORIGIN==="https://kzamora19.github.io" &&
 /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(URL_FLYER);
}
type Identity={id:string,canManage:boolean};
type StudioContinuation={sessionId:string,challenge:string,expiresAt:string};
async function identity(req:Request,body:Record<string,unknown>):Promise<{user:Identity;proof?:StudioContinuation}>{
 if(Object.prototype.hasOwnProperty.call(body,"studioProof")){
  // Never fall back to client bearer auth on a failed proof request.
  if(!STUDIO_GATEWAY_URL||STUDIO_GATEWAY_SECRET.length<32)
   throw new Denied("Protected Studio photo access is not configured",503);
  if(!validSignedProof(body.studioProof))
   throw new Denied("Invalid signed Studio photo proof",403);
  const p=body.studioProof as Record<string,string>;
  const verified=await fetch(STUDIO_GATEWAY_URL,{method:"POST",cache:"no-store",
   redirect:"error",headers:{"Content-Type":"application/json",
    "x-ptg-studio-secret":STUDIO_GATEWAY_SECRET},
   body:JSON.stringify({action:"prove",studio:"flyer",
    sessionId:p.sessionId,challenge:p.challenge,signature:p.signature}),
   signal:AbortSignal.timeout(8000)});
  if(!verified.ok)throw new Denied("PTG Studio session expired or revoked",401);
  const data=await verified.json().catch(()=>null);
  if(!data?.ok||!uuid(data.actorId)||data.sessionId!==p.sessionId||
     !/^[A-Za-z0-9_-]{43}$/.test(String(data.challenge||""))||
     !Number.isFinite(Date.parse(String(data.expiresAt||"")))||
     Date.parse(data.expiresAt)<=Date.now()||
     typeof data.canManage!=="boolean")
   throw new Denied("Unverified PTG Studio photo permission",401);
  return {user:{id:data.actorId,canManage:data.canManage},
    proof:{sessionId:data.sessionId,challenge:data.challenge,expiresAt:data.expiresAt}};
 }

 const bearer=req.headers.get("authorization")||"",session=req.headers.get("x-ptg-session-id")||"";
 if(!bearer.startsWith("Bearer ")||bearer.length<32||!uuid(session))throw new Denied("PTG login required",401);
 // Both checks are server-to-server and are repeated for every action,
 // including thumbnail reads, rather than trusting browser role flags.
 const [sessionResponse,authResponse]=await Promise.all([
  fetch(PTG_ORIGIN+"/functions/v1/ptg-auth",{method:"POST",headers:{
   "Content-Type":"application/json","Origin":"https://kzamora19.github.io",
   Authorization:bearer,"x-ptg-session-id":session,apikey:PTG_PUBLIC},
   body:JSON.stringify({action:"session"}),signal:AbortSignal.timeout(8000)}),
  fetch(PTG_ORIGIN+"/auth/v1/user",{headers:{Authorization:bearer,apikey:PTG_PUBLIC},
   signal:AbortSignal.timeout(8000)})
 ]);
 if(!sessionResponse.ok||!authResponse.ok)throw new Denied("PTG session revoked or unavailable",401);
 const [s,u]=await Promise.all([sessionResponse.json().catch(()=>null),authResponse.json().catch(()=>null)]);
 if(!s?.ok||!obj(s.account)||!uuid(u?.id)||s.account.mustChangePassword ||
    s.account.isActive===false||s.account.active===false)throw new Denied("PTG access denied",403);
 const role=normalize(s.account.role),legacy=normalize(s.account.legacyRole);
 const canManage=role==="SYSTEM_ADMIN"||role==="BRANCH_ADMIN";
 if(!canManage && !(role==="BRANCH_USER"&&legacy==="TEAM LEADER"))
  throw new Denied("PTG Team Leader or higher required",403);
 return {user:{id:u.id,canManage}};
}
function product(value:unknown){
 if(!obj(value))throw new Denied("Select a product card first",400);
 const b=barcode(value.barcode||value.sku),brand=word(value.brand),model=word(value.model);
 const description=String(value.description||"").trim().replace(/\s+/g," ").slice(0,180);
 if(!b && !(brand&&model) && !description)throw new Denied("A barcode, model, or description is required",400);
 return {barcode_norm:b,brand_norm:brand,model_norm:model,description,
  product_key:b?"b:"+b:"m:"+brand+"|"+model};
}
function fileFromBase64(input:unknown,mime:unknown,limit:number){
 if(!TYPES.has(String(mime))||typeof input!=="string"||!input.length||input.length>Math.ceil(limit*4/3)+8||
   !/^[A-Za-z0-9+/]+={0,2}$/.test(input))throw new Denied("Invalid image",400);
 let bytes:Uint8Array;
 try{bytes=Uint8Array.from(atob(input),x=>x.charCodeAt(0));}
 catch{throw new Denied("Invalid image encoding",400);}
 if(bytes.length<16||bytes.length>limit)throw new Denied("Image exceeds size limit",413);
 const png=mime==="image/png"&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x);
 const jpg=mime==="image/jpeg"&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=mime==="image/webp"&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&
   String.fromCharCode(...bytes.slice(8,12))==="WEBP";
 if(!(png||jpg||webp))throw new Denied("Image signature mismatch",415);
 return bytes;
}
async function hash(bytes:Uint8Array){
 const safeBuffer=new ArrayBuffer(bytes.byteLength);
 new Uint8Array(safeBuffer).set(bytes);
 return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",safeBuffer)),x=>x.toString(16).padStart(2,"0")).join("");
}
async function audit(action:string,user:Identity,photoId:string,before:unknown,after:unknown){
 const {error}=await admin!.from("flyer_product_photo_audit").insert({
  photo_id:photoId,action,actor_ptg:user.id,before_state:before,after_state:after
 });
 if(error)throw error;
}
const cols="id,product_key,barcode_norm,brand_norm,model_norm,description,is_primary,uploaded_at,flyer_product_photo_blobs(id,mime_type,byte_size)";
async function list(productValue:unknown,search=false){
 const p=product(productValue);
 const q=()=>admin!.from("flyer_product_photos").select(cols).is("deleted_at",null).limit(search?60:20);
 let rows:any[]=[],match="none";
 if(p.barcode_norm){
  const {data,error}=await q().eq("barcode_norm",p.barcode_norm).order("is_primary",{ascending:false});
  if(error)throw error;rows=data||[];if(rows.length)match="barcode";
 }
 if(!rows.length&&p.brand_norm&&p.model_norm){
  const {data,error}=await q().eq("brand_norm",p.brand_norm).eq("model_norm",p.model_norm)
    .order("is_primary",{ascending:false});
  if(error)throw error;rows=data||[];if(rows.length)match="model";
 }
 if(!rows.length&&p.description){
  // Description is suggestions ONLY: never silently bind or auto-apply.
  const fragment=p.description.replace(/[%_,()\\]/g,"").trim().slice(0,60);
  if(fragment.length>=4){
   const {data,error}=await q().ilike("description","%"+fragment+"%");
   if(error)throw error;rows=data||[];if(rows.length)match="description";
  }
 }
 return {photos:rows,match,requiresConfirmation:match==="description",product:p};
}
async function record(photoId:unknown){
 if(!uuid(photoId))throw new Denied("Invalid photo",400);
 const {data,error}=await admin!.from("flyer_product_photos")
  .select("*,flyer_product_photo_blobs(*)").eq("id",photoId).is("deleted_at",null).maybeSingle();
 if(error)throw error;if(!data)throw new Denied("Photo not found",404);
 return data;
}
async function storeBlob(body:Record<string,unknown>,user:Identity){
 const mime=String(body.mime||""),bytes=fileFromBase64(body.base64,mime,MAX_FILE);
 const thumbMime=String(body.thumbnailMime||"image/webp");
 const thumb=fileFromBase64(body.thumbnailBase64,thumbMime,MAX_THUMB);
 const sha=await hash(bytes),thumbSha=await hash(thumb);
 const ext=(type:string)=>type==="image/png"?"png":type==="image/jpeg"?"jpg":"webp";
 const path="images/"+sha.slice(0,2)+"/"+sha+"."+ext(mime);
 const thumbnailPath="thumbs/"+thumbSha.slice(0,2)+"/"+thumbSha+"."+ext(thumbMime);
 const {data:known,error:lookupError}=await admin!.from("flyer_product_photo_blobs")
   .select("id").eq("sha256",sha).maybeSingle();
 if(lookupError)throw lookupError;
 if(known)return {id:known.id,sha,reused:true};
 const bucket=admin!.storage.from(PHOTO_BUCKET);
 for(const [key,value,type] of [[path,bytes,mime],[thumbnailPath,thumb,thumbMime]] as [string,Uint8Array,string][]){
  const result=await bucket.upload(key,value,{contentType:type,upsert:false,cacheControl:"0"});
  // Immutable content addressed uploads: a concurrent identical upload may win.
  if(result.error && String((result.error as any).statusCode)!=="409")throw result.error;
 }
 const {data,error}=await admin!.from("flyer_product_photo_blobs").upsert({
   sha256:sha,storage_path:path,thumbnail_path:thumbnailPath,mime_type:mime,
   byte_size:bytes.length,thumbnail_bytes:thumb.length,uploaded_by_ptg:user.id
  },{onConflict:"sha256",ignoreDuplicates:true}).select("id").maybeSingle();
 if(error)throw error;
 if(data?.id)return {id:data.id,sha,reused:false};
 const {data:reused,error:readError}=await admin!.from("flyer_product_photo_blobs")
  .select("id").eq("sha256",sha).single();
 if(readError||!reused)throw readError||Error("Deduplicated photo not available");
 return {id:reused.id,sha,reused:true};
}
async function upload(body:Record<string,unknown>,user:Identity,replaceId?:string){
 const p=product(body.product);
 if(!p.product_key)throw new Denied("Saving needs a barcode or exact brand and model",400);
 const existing=replaceId?await record(replaceId):null;
 if(existing && (existing.product_key!==p.product_key||!user.canManage))
  throw new Denied("Only admins can replace a photo of the same product");
 if(!existing){
  const {count,error}=await admin!.from("flyer_product_photos")
   .select("id",{count:"exact",head:true}).eq("product_key",p.product_key).is("deleted_at",null);
  if(error)throw error;if((count||0)>=20)throw new Denied("Maximum 20 photos per product",409);
 }
 const blob=await storeBlob(body,user);
 if(existing){
  if(existing.blob_id===blob.id)return {ok:true,photoId:existing.id,reused:true};
  const {data,error}=await admin!.from("flyer_product_photos").update({
    blob_id:blob.id,updated_by_ptg:user.id,updated_at:new Date().toISOString()
   }).eq("id",existing.id).eq("blob_id",existing.blob_id).select("id").maybeSingle();
  if(error||!data)throw error||new Denied("Photo changed while replacing. Retry.",409);
  await audit("replace",user,existing.id,{blob_id:existing.blob_id},{blob_id:blob.id});
  return {ok:true,photoId:existing.id,reused:blob.reused};
 }
 // Ignore duplicate links instead of overwriting the original uploader,
 // timestamps and audit identity when another employee reuses the same image.
 const {data:inserted,error:insertError}=await admin!.from("flyer_product_photos").upsert({
   ...p,blob_id:blob.id,uploaded_by_ptg:user.id,updated_by_ptg:user.id
  },{onConflict:"product_key,blob_id",ignoreDuplicates:true}).select("id").maybeSingle();
 if(insertError)throw insertError;
 let photo=inserted;
 if(!photo){
  const {data:previous,error:existingError}=await admin!.from("flyer_product_photos")
   .select("id,deleted_at").eq("product_key",p.product_key).eq("blob_id",blob.id).maybeSingle();
  if(existingError||!previous)throw existingError||Error("Existing product photo not available");
  if(previous.deleted_at){
   // Explicitly reintroducing the same image restores its association, but
   // keeps the original provenance rather than impersonating its uploader.
   const {data:restored,error:restoreError}=await admin!.from("flyer_product_photos")
    .update({deleted_at:null,updated_by_ptg:user.id,updated_at:new Date().toISOString()})
    .eq("id",previous.id).not("deleted_at","is",null).select("id").maybeSingle();
   if(restoreError)throw restoreError;
   if(!restored)throw new Denied("Product photo changed during restore",409);
  }
  photo={id:previous.id};
 }
 const {count}=await admin!.from("flyer_product_photos").select("id",{count:"exact",head:true})
   .eq("product_key",p.product_key).eq("is_primary",true).is("deleted_at",null);
 if(!count)await admin!.rpc("flyer_product_photo_set_primary",{p_product_key:p.product_key,p_photo_id:photo.id});
 await audit(blob.reused?"reuse":"upload",user,photo.id,null,{product_key:p.product_key,sha256:blob.sha});
 return {ok:true,photoId:photo.id,reused:blob.reused};
}
async function execute(body:Record<string,unknown>,user:Identity){
 const action=String(body.action||"");
 if(action==="permissions")return {canView:true,canUpload:true,canManage:user.canManage};
 if(action==="resolve"||action==="search")return await list(body.product,action==="search");
 if(action==="image"){
  const photo=await record(body.id);
  const thumbnail=body.thumbnail===true;
  const b=photo.flyer_product_photo_blobs;
  const key=thumbnail?b.thumbnail_path:b.storage_path;
  const {data,error}=await admin!.storage.from(PHOTO_BUCKET).download(key);
  if(error||!data)throw error||Error("Photo unavailable");
  const bytes=new Uint8Array(await data.arrayBuffer());
  if(bytes.length>(thumbnail?MAX_THUMB:MAX_FILE))throw Error("Stored photo is too large");
  let raw="";for(let start=0;start<bytes.length;start+=8192)
    raw+=String.fromCharCode(...bytes.slice(start,start+8192));
  return {mime:thumbnail?"image/webp":b.mime_type,base64:btoa(raw)};
 }
 if(action==="upload")return await upload(body,user);
 if(action==="replace"){
  if(!user.canManage)throw new Denied("Branch Admin or System Admin required");
  return await upload(body,user,String(body.id||""));
 }
 if(action==="setPrimary"){
  const p=await record(body.id);
  const {data,error}=await admin!.rpc("flyer_product_photo_set_primary",
    {p_product_key:p.product_key,p_photo_id:p.id});
  if(error||data!==true)throw error||new Denied("Photo not available",409);
  await audit("set_primary",user,p.id,null,{product_key:p.product_key});
  return {ok:true};
 }
 if(action==="remove"){
  if(!user.canManage)throw new Denied("Branch Admin or System Admin required");
  const p=await record(body.id);
  const {error}=await admin!.from("flyer_product_photos").update({
   deleted_at:new Date().toISOString(),is_primary:false,updated_by_ptg:user.id,
   updated_at:new Date().toISOString()
  }).eq("id",p.id).is("deleted_at",null);
  if(error)throw error;
  await audit("remove",user,p.id,{blob_id:p.blob_id,product_key:p.product_key},null);
  if(p.is_primary){
   const {data}=await admin!.from("flyer_product_photos").select("id")
    .eq("product_key",p.product_key).is("deleted_at",null).order("uploaded_at").limit(1);
   if(data?.length)await admin!.rpc("flyer_product_photo_set_primary",
    {p_product_key:p.product_key,p_photo_id:data[0].id});
  }
  // Do not purge referenced immutable photo bytes: old flyer exports and
  // restores may still contain them. GC is a separate reviewed operation.
  return {ok:true};
 }
 throw new Denied("Unknown photo-library operation",400);
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 if(origin!==ALLOWED_ORIGIN||!ALLOWED_ORIGIN)return response(origin,{error:"Forbidden origin"},403);
 if(req.method==="OPTIONS")return response(origin,{ok:true});
 if(req.method!=="POST")return response(origin,{error:"Method not allowed"},405);
 if(!configured())return response(origin,{error:"Photo library unavailable"},503);
 let rotated:StudioContinuation|undefined;
 try{
  const declared=Number(req.headers.get("content-length")||"0");
  if(declared>MAX_BODY)throw new Denied("Upload is too large",413);
  if(!(req.headers.get("content-type")||"").toLowerCase().includes("application/json"))
   throw new Denied("JSON required",415);
  const raw=await req.text();
  if(raw.length>MAX_BODY)throw new Denied("Upload is too large",413);
  const body=JSON.parse(raw);
  if(!obj(body))throw new Denied("Invalid payload",400);
  const credential=await identity(req,body);
  rotated=credential.proof;
  const result=await execute(body,credential.user);
  return response(origin,rotated?{result,studioProof:rotated}:result);
 }catch(error){
  const status=error instanceof Denied?error.status:503;
  if(status===503)console.error("Smart photo gateway failed:",error instanceof Error?error.name:"unknown");
  // A valid proof is consumed even if image storage/DB subsequently errors.
  // Return its NEW challenge so the parent can still retry safely.
  return response(origin,{error:error instanceof Denied?error.message:"Photo library temporarily unavailable",
    ...(rotated?{studioProof:rotated}:{})},status);
 }
});
