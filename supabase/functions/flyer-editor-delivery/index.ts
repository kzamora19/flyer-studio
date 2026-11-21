// STAGING PROOF ONLY. Never deploy without real integration + cutover approval.
// Returns a private editor bundle as JSON after checking a PTG-issued studio ticket.
// GET text/html is not used: default Supabase Edge domains rewrite HTML responses.
import {createClient} from "npm:@supabase/supabase-js@2.49.8";
import {studioTicketOk,deliveryConfigured,exactHttpsOrigin,validProofResponse,validSignedProof,validPtgGatewayUrl,validStudioBackendUrl} from "../_shared/studio-private-policy.mjs";

const FLYER_URL=Deno.env.get("SUPABASE_URL")||"";
const FLYER_SERVICE=Deno.env.get("SUPABASE_SECRET_KEY")||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const VERIFY_SECRET=Deno.env.get("FLYER_PTG_STUDIO_GATEWAY_SECRET")||"";
const ALLOWED_ORIGIN=Deno.env.get("FLYER_STUDIO_ALLOWED_ORIGIN")||"";
const BUNDLE_PATH=Deno.env.get("FLYER_PRIVATE_BUNDLE_PATH")||"";
const BUNDLE_SHA=Deno.env.get("FLYER_PRIVATE_BUNDLE_SHA256")||"";
const BUNDLE_BUCKET="flyer-editor-release"; // Never reuse the live shared-assets bucket.
// Never connect a staging Studio to a live PTG authorization authority.
const DEPLOYMENT_MODE=Deno.env.get("PTG_STUDIO_DEPLOYMENT_MODE")||"";
const PTG_VERIFY_URL=validPtgGatewayUrl(
  Deno.env.get("PTG_STUDIO_GATEWAY_URL")||"",DEPLOYMENT_MODE
);
const NO_CACHE={"Cache-Control":"no-store, private","Pragma":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};

function json(origin:string,value:unknown,status=200){
 const headers:Record<string,string>={"Content-Type":"application/json; charset=utf-8",...NO_CACHE};
 if(origin===exactHttpsOrigin(ALLOWED_ORIGIN)){
  headers["Access-Control-Allow-Origin"]=origin;
  headers["Access-Control-Allow-Methods"]="POST, OPTIONS";
  headers["Access-Control-Allow-Headers"]="content-type, apikey";
  headers["Vary"]="Origin";
 }
 return new Response(JSON.stringify(value),{status,headers});
}
function configReady(){
 return !!PTG_VERIFY_URL && !!validStudioBackendUrl(FLYER_URL,DEPLOYMENT_MODE,"tzklsscoiwnmeantcefw") && deliveryConfigured({
  origin:ALLOWED_ORIGIN,secret:VERIFY_SECRET,serviceKey:FLYER_SERVICE,
  path:BUNDLE_PATH,sha:BUNDLE_SHA,bucket:BUNDLE_BUCKET
 });
}
// Service-only PTG call. A launch ticket is exchanged ONCE; subsequent
// checks must contain a fresh ECDSA signature bound to a single-use challenge.
async function ptg(action:"exchange"|"prove",body:Record<string,unknown>){
 const check=await fetch(PTG_VERIFY_URL,{method:"POST",cache:"no-store",redirect:"error",headers:{
   "Content-Type":"application/json","x-ptg-studio-secret":VERIFY_SECRET,
 },body:JSON.stringify({action,studio:"flyer",...body}),signal:AbortSignal.timeout(8000)});
 if(!check.ok)return null;
 const data=await check.json().catch(()=>null);
 return data?.ok===true&&validProofResponse(data)&&
   Date.parse(data.expiresAt)>Date.now()?data:null;
}

Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 if(!exactHttpsOrigin(ALLOWED_ORIGIN)||origin!==exactHttpsOrigin(ALLOWED_ORIGIN))
  return json(origin,{ok:false,error:"Forbidden origin."},403);
 if(req.method==="OPTIONS")
  return json(origin,{ok:true});
 if(req.method!=="POST")return json(origin,{ok:false,error:"Method not allowed."},405);
 if(!configReady())return json(origin,{ok:false,error:"Protected editor delivery is not configured."},503);
 if(!(req.headers.get("content-type")||"").toLowerCase().includes("application/json"))
  return json(origin,{ok:false,error:"JSON required."},415);
 try{
  const raw=await req.text();
  if(raw.length>3072)return json(origin,{ok:false,error:"Request too large."},413);
  const body=JSON.parse(raw);
  if(!body||typeof body!=="object"||Array.isArray(body)||!["load","check"].includes(body.action))
   return json(origin,{ok:false,error:"Invalid request."},400);
  let auth;
  if(body.action==="load"){
   if(!studioTicketOk(body.ticket)||!body.publicKey||typeof body.publicKey!=="object")
    return json(origin,{ok:false,error:"Invalid launch request."},400);
   auth=await ptg("exchange",{ticket:body.ticket,publicKey:body.publicKey});
  }else{
   if(!validSignedProof(body))
    return json(origin,{ok:false,error:"Invalid signed recheck."},400);
   auth=await ptg("prove",{sessionId:body.sessionId,challenge:body.challenge,signature:body.signature});
  }
  if(!auth)return json(origin,{ok:false,error:"PTG Studio authorization required."},403);
  if(body.action==="load"&&(!studioTicketOk(auth.draftScope)||!studioTicketOk(auth.draftKey)))
    return json(origin,{ok:false,error:"Account-scoped draft recovery unavailable."},503);
  if(body.action==="check")return json(origin,auth);
  const admin=createClient(FLYER_URL,FLYER_SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await admin.storage.from(BUNDLE_BUCKET).download(BUNDLE_PATH);
  if(error||!data)throw Error("Private release object unavailable");
  const html=await data.text();
  if(!html||html.length>5_000_000||!html.includes("PRIVATE EDITOR BUNDLE"))
   throw Error("Invalid private editor bundle");
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(html))),
    b=>b.toString(16).padStart(2,"0")).join("");
  if(hash!==BUNDLE_SHA)throw Error("Private editor bundle hash mismatch");
  return json(origin,{...auth,html,sha256:hash});
 }catch(error){
  console.error("Private Studio delivery blocked:",error instanceof Error?error.name:"unknown");
  return json(origin,{ok:false,error:"Private editor delivery unavailable."},503);
 }
});
