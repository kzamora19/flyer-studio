// Full launcher manual cloud Backup/Retrieve via real P-256 signed challenge.
// Every Supabase response is mocked; no account or project is contacted.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {randomUUID,randomBytes,createHash,webcrypto} from "node:crypto";
import {chromium} from "playwright";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../staging/studio-access");
const hash=html=>createHash("sha256").update(html).digest("hex");
const editor="<!-- PRIVATE EDITOR BUNDLE. -->\n<html><body><h1>Authorized editor</h1></body></html>";
const scope="S".repeat(43),key=Buffer.alloc(32,65).toString("base64url");
const entry=readFileSync(resolve(root,"index.html"),"utf8");
const server=createServer((req,res)=>{
 const p=new URL(req.url,"http://127.0.0.1").pathname;
 if(p==="/"){res.writeHead(200,{"Content-Type":"text/html"});res.end(entry);return;}
 if(["/draft-vault.js","/launch.js"].includes(p)){
  res.writeHead(200,{"Content-Type":"text/javascript"});
  res.end(readFileSync(resolve(root,p.slice(1))));return;
 }
 res.writeHead(404);res.end();
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;
try{
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 const origin="http://127.0.0.1:"+server.address().port;
 const sessions=new Map(),backups=new Map(),requests=[];
 await ctx.route("**/*",async route=>{
  const url=route.request().url();
  if(url.startsWith(origin))return route.continue();
  if(url!=="https://tzklsscoiwnmeantcefw.supabase.co/functions/v1/flyer-editor-delivery")return route.abort();
  const headers={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"*",
    "Access-Control-Allow-Methods":"POST, OPTIONS"};
  if(route.request().method()==="OPTIONS")
    return route.fulfill({status:204,headers});
  const body=route.request().postDataJSON();
  requests.push(body);
  if(body.action==="load"){
   const sessionId=randomUUID(),challenge=randomBytes(32).toString("base64url");
   sessions.set(sessionId,{challenge,publicKey:body.publicKey});
   return route.fulfill({status:200,contentType:"application/json",headers,
    body:JSON.stringify({ok:true,html:editor,sha256:hash(editor),draftScope:scope,draftKey:key,
       sessionId,challenge,expiresAt:new Date(Date.now()+900000).toISOString()})});
  }
  if(!["check","cloud"].includes(body.action))return route.abort();
  const found=sessions.get(body.sessionId);
  if(!found||body.challenge!==found.challenge)return route.fulfill({status:403,headers,
    contentType:"application/json",body:JSON.stringify({ok:false})});
  const publicKey=await webcrypto.subtle.importKey("jwk",found.publicKey,
   {name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
  const message="ptg-studio-v1|"+"flyer"+"|"+body.sessionId+"|"+body.challenge;
  const verified=await webcrypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},publicKey,
    Buffer.from(body.signature,"base64url"),new TextEncoder().encode(message));
  if(!verified)return route.fulfill({status:403,headers,contentType:"application/json",
    body:JSON.stringify({ok:false,error:"Bad signature"})});
  found.challenge=randomBytes(32).toString("base64url");
  let cloud;
  if(body.action==="cloud"){
   if(body.operation==="list")cloud={status:"ok",items:[...backups].map(([record_key,r])=>({record_key,version:r.version}))};
   else if(body.operation==="read")cloud=backups.has(body.recordKey)?
    {status:"ok",record:backups.get(body.recordKey)}:{status:"missing",record:null};
   else if(body.operation==="write"){
    const old=backups.get(body.recordKey),version=old?.version||0;
    if(version!==body.expectedVersion)cloud={status:"conflict"};
    else {backups.set(body.recordKey,{iv:body.iv,encrypted:body.encrypted,version:version+1});
     cloud={status:"ok",version:version+1};}
   }else cloud={status:"denied"};
  }
  return route.fulfill({status:200,contentType:"application/json",headers,
   body:JSON.stringify({ok:true,sessionId:body.sessionId,challenge:found.challenge,
    expiresAt:new Date(Date.now()+900000).toISOString(),cloud})});
 });
 const page=await ctx.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("dialog",d=>d.accept());
 await page.goto(origin+"/#ptg_studio_ticket="+"A".repeat(43),{waitUntil:"load"});
 await page.locator("#studio-editor-frame").waitFor({timeout:20000});
 await page.locator("#cloudPanel:visible").waitFor();
 const local=await page.evaluate(async({scope,key})=>{
  const vault=window.MEGAFLYER_LOCAL_DRAFT_VAULT.session(scope,key);
  await vault.write("p:current",{document:{customer:"User's confidential client name",image:"P".repeat(15000)}});
  return true;
 },{scope,key});;
 assert.equal(local,true);
 
 await page.locator("#cloudBackup").click();
 await page.waitForFunction(()=>document.querySelector("#cloudMessage")?.textContent.includes("Encrypted backup saved")||
  document.querySelector("#cloudMessage")?.textContent.includes("Encrypted cloud project saved"),null,{timeout:20000});
 assert.equal(backups.size,1);
 assert.ok(backups.has("p:current"));
 assert.ok(!backups.get("p:current").encrypted.includes("confidential client name"),
  "Server must never receive plaintext customer identity");
 assert.ok(requests.filter(x=>x.action==="cloud").every(x=>
  !("ticket" in x)&&!("actorId" in x)&&!("authorization" in x)),
  "Cloud request carries a signed P-256 proof, not a bearer or caller-supplied actor");
 await page.evaluate(async({scope,key})=>{
  const v=window.MEGAFLYER_LOCAL_DRAFT_VAULT.session(scope,key);
  await v.delete("p:current");
 },{scope,key});
 
 await page.locator("#cloudRestore").click();
 await page.waitForFunction(()=>document.querySelector("#cloudMessage")?.textContent.includes("retrieved"),
   null,{timeout:20000});
 const restored=await page.evaluate(async({scope,key})=>{
  const v=window.MEGAFLYER_LOCAL_DRAFT_VAULT.session(scope,key);
  const r=await v.read("p:current");return r?.document?.image?.length;
 },{scope,key});
 assert.equal(restored,15000);
 assert.ok(requests.filter(x=>x.action==="cloud").every(x=>typeof x.signature==="string"));
 assert.deepEqual(errors,[]);
 console.log("PASS: MegaFlyer manual Backup/Retrieve, real P-256 signature rotation and ciphertext-only cloud response.");
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
