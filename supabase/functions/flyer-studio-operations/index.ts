// Development candidate. Deploy only with the canonical PTG proof-role contract and review audit migration.
import {createClient} from "npm:@supabase/supabase-js@2.49.8";
import {validRole,permissions,validReviewPayload,uuid,footerContactForBranch} from "./policy.mjs";
const url=Deno.env.get("SUPABASE_URL")||"";
function serviceKey(){
 const direct=Deno.env.get("SUPABASE_SECRET_KEY");if(direct)return direct;
 try{const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");if(typeof keys?.default==="string"&&keys.default)return keys.default;}catch{/* legacy compatibility */}
 return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
}
const key=serviceKey();
const secret=Deno.env.get("FLYER_PTG_STUDIO_GATEWAY_SECRET")||"";
const gateway=Deno.env.get("PTG_STUDIO_GATEWAY_URL")||"";
function exactHttpsOrigin(value:string){
 if(!value.trim())return "";
 try{
  const u=new URL(value);
  if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.pathname!=="/"||!/^[a-z0-9.-]+$/i.test(u.hostname)||u.hostname.includes("..")||(value.trim()!==u.origin&&value.trim()!==u.origin+"/"))return "";
  return u.origin;
 }catch{return "";}
}
const origin=exactHttpsOrigin(Deno.env.get("FLYER_STUDIO_ALLOWED_ORIGIN")||"");
const mode=Deno.env.get("PTG_STUDIO_DEPLOYMENT_MODE")||"";
const prodRefs=new Set(["agknxlowackphvwyvxge","vmyoxoiygfcecgkbavgg","tzklsscoiwnmeantcefw","psoopubvdpwztzkdyifa"]);
const types=new Set(["image/png","image/jpeg","image/webp"]);
function configured(){
 try{
  const u=new URL(gateway),ref=/^([a-z0-9]{20})\.supabase\.co$/.exec(u.hostname)?.[1];
  return !!ref&&u.href===gateway&&u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&u.pathname==="/functions/v1/ptg-studio-access"&&secret.length>=32&&key.length>=32&&
   (mode==="production"?ref==="agknxlowackphvwyvxge"&&url==="https://tzklsscoiwnmeantcefw.supabase.co":mode==="staging"&&!prodRefs.has(ref)&&!Array.from(prodRefs).some(r=>url==="https://"+r+".supabase.co"));
 }catch{return false;}
}
const db=key&&url?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;
function respond(status:number,value:unknown,allowed=false){
 const h:Record<string,string>={"Content-Type":"application/json","Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
 if(allowed){h["Access-Control-Allow-Origin"]=origin;h["Access-Control-Allow-Headers"]="authorization,apikey,content-type";h["Access-Control-Allow-Methods"]="POST,OPTIONS";h.Vary="Origin";}
 return new Response(JSON.stringify(value),{status,headers:h});
}
Deno.serve(async(req)=>{
 if(!origin||req.headers.get("origin")!==origin)return respond(403,{error:"Forbidden origin"});
 if(req.method==="OPTIONS")return respond(200,{ok:true},true);
 if(req.method!=="POST"||!configured()||!db)return respond(503,{error:"Review authorization unavailable."},true);
 let body:any;
 try{const raw=await req.text();if(raw.length>100000)return respond(413,{error:"Request too large."},true);body=JSON.parse(raw);}catch{return respond(400,{error:"Invalid request."},true);}
 const p=body?.studioProof;
 if(!validReviewPayload(body)||!p||!uuid(p.sessionId)||! /^[A-Za-z0-9_-]{43}$/.test(p.challenge||"")||! /^[A-Za-z0-9_-]{80,96}$/.test(p.signature||""))return respond(400,{error:"Invalid request."},true);
 let proof:any;
 try{
  const res=await fetch(gateway,{method:"POST",headers:{"Content-Type":"application/json","x-ptg-studio-secret":secret},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000),body:JSON.stringify({action:"prove",studio:"flyer",sessionId:p.sessionId,challenge:p.challenge,signature:p.signature})});
  if(!res.ok)throw Error();
  proof=await res.json();
  if(!proof?.ok||proof.sessionId!==p.sessionId||!uuid(proof.actorId)||! /^[A-Za-z0-9_-]{43}$/.test(proof.challenge||"")||!(Date.parse(proof.expiresAt)>Date.now()))throw Error();
 }catch{return respond(401,{error:"PTG proof rejected."},true);}
 const continuation={sessionId:proof.sessionId,challenge:proof.challenge,expiresAt:proof.expiresAt};
 const done=(status:number,result:unknown)=>respond(status,{studioProof:continuation,...(status===200?{result}:{error:result})},true);
 // Canonical role from the server-only proof authority. Never trust workspaceIdentity.role or user-supplied labels.
 if(!validRole(proof.roleKey))return done(503,"PTG canonical role authority is not enabled.");
 const rights=permissions(proof.roleKey);
 if(body.action==="permissions"){const footerContact=footerContactForBranch(proof.branchCode);return done(200,footerContact?{...rights,footerContact}:rights); }
 try{
  if(body.action==="assets-list"){
   let q=db.from("flyer_shared_assets").select("id,name,category,mime_type,byte_size").order("name").limit(200);
   if(body.category)q=q.eq("category",body.category);
   const {data,error}=await q;if(error)throw error;return done(200,{assets:data||[]});
  }
  if(body.action==="asset-image"){
   const {data:asset,error}=await db.from("flyer_shared_assets").select("storage_path,mime_type,byte_size").eq("id",body.assetId).maybeSingle();
   if(error||!asset||!types.has(asset.mime_type)||asset.byte_size>10*1024*1024)return done(404,"Shared artwork unavailable.");
   const download=await db.storage.from("flyer-shared-assets").download(asset.storage_path);
   if(download.error||!download.data||download.data.size>10*1024*1024)throw Error();
   const bytes=new Uint8Array(await download.data.arrayBuffer());let raw="";
   for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.slice(i,i+8192));
   return done(200,{mime:asset.mime_type,base64:btoa(raw)});
  }
  if(body.action==="approve"&&!rights.canApprove||body.action==="override"&&!rights.canOverride)return done(403,"This account is not authorized for the requested action.");
  if(body.action==="final"){
   const {data,error}=await db.from("flyer_review_audit").select("id").eq("id",body.approvalId).eq("action","approve").eq("project_id",body.projectId).eq("digest",body.digest).eq("scope",body.scope).maybeSingle();
   if(error||!data)return done(403,"A current matching approval is required.");
  }
  const {data,error}=await db.from("flyer_review_audit").insert({actor_ptg:proof.actorId,actor_role:proof.roleKey,action:body.action,project_id:body.projectId,digest:body.digest,scope:body.scope,format:body.format,reason:body.action==="override"?body.reason.trim():null,warnings:body.warnings,blocking:body.blocking,approval_id:body.action==="final"?body.approvalId:null}).select("id,created_at").single();
  if(error||!data)throw Error();
  return done(200,{authorized:true,receiptId:data.id,at:data.created_at});
 }catch{return done(503,"Protected operation could not be completed.");}
});
