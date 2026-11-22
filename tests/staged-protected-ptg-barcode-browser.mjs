// Full Chromium regression: a PTG-authorized private MegaFlyer editor can
// search by barcode without collecting a second PTG password, exposing
// reusable credentials to the opaque frame or weakening origin isolation.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {chromium} from "playwright";
import {enableProtectedPtgLookup} from "../supabase/functions/_shared/flyer-protected-ptg-compat.mjs";
import {createProofMock} from "./staged-proof-mock.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const temp=mkdtempSync(join(tmpdir(),"flyer-signed-lookup-"));
let server,browser;
try {
 execFileSync(process.execPath,[join(root,"scripts/build-private-flyer.mjs"),temp],
  {cwd:root,stdio:"pipe",timeout:45000});
 const rawHtml=readFileSync(join(temp,"private/studio.html"),"utf8");
 const html=enableProtectedPtgLookup(rawHtml);
 const sha=createHash("sha256").update(html).digest("hex");
 const landing=readFileSync(join(root,"staging/studio-access/index.html"),"utf8");
 const staging=join(root,"staging/studio-access");
 server=createServer((req,res)=>{
  const p=new URL(req.url,"http://localhost").pathname;
  const mappings={"/":landing,"/index.html":landing,
    "/launch.js":readFileSync(join(staging,"launch.js")),
    "/draft-vault.js":readFileSync(join(staging,"draft-vault.js"))};
  if(!Object.hasOwn(mappings,p)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"Content-Type":p.endsWith(".js")?"text/javascript":"text/html",
    "Cache-Control":"no-store"});res.end(mappings[p]);
 });
 await new Promise(done=>server.listen(0,"127.0.0.1",done));
 const origin="http://127.0.0.1:"+server.address().port;
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:1350,height:850}});
 const proof=createProofMock();
 const requests=[],illegal=[];
 await ctx.route("**/*",async route=>{
  const u=new URL(route.request().url());
  if(u.origin===origin)return route.continue();
  if(u.hostname==="tzklsscoiwnmeantcefw.supabase.co"&&
     u.pathname==="/functions/v1/flyer-editor-delivery"){
   const input=route.request().postDataJSON();
   requests.push(input);
   if(input.action==="lookup"){
     assert.equal(typeof input.signature,"string");
     assert.equal(input.q,"0000012345");
     assert.equal(input.page,1);
     const next=await proof.handle({action:"check",...input});
     return route.fulfill({status:200,contentType:"application/json",
      headers:{"access-control-allow-origin":origin},
      body:JSON.stringify({...next,catalog:{status:"ok",page:1,pageSize:5,total:1,
       products:[{barcode:"0000012345",brand:"LG",model:"T123",description:"Smart television",
        srp:24999,tag_this:19999,cash_payment:24999,campaign:"SALE"}]}})});
   }
   const next=await proof.handle(input);
   const response=input.action==="load"?{...next,html,sha256:sha}:next;
   return route.fulfill({status:200,contentType:"application/json",
     headers:{"access-control-allow-origin":origin},
     body:JSON.stringify(response)});
  }
  if(u.hostname==="agknxlowackphvwyvxge.supabase.co"){
   illegal.push(u.pathname);return route.fulfill({status:403,body:"Direct PTG token call forbidden"});
  }
  return route.fulfill({status:404,body:"Mock external fixture"});
 });
 const page=await ctx.newPage();
 await page.goto(origin+"/#ptg_studio_ticket="+"G".repeat(43),{waitUntil:"domcontentloaded"});
 await page.locator("#studio-editor-frame").waitFor({timeout:30000});
 const frame=page.frameLocator("#studio-editor-frame");
 await frame.locator("#protectedPtgConnected").waitFor({state:"attached",timeout:30000});
 assert.equal(await frame.locator("#ptgLogin").isVisible(),false);
 const marker=await frame.locator("body").evaluate(()=>({
  linked:ptgSession?.token,bridge:typeof window.__MEGAFLYER_PTG_RPC__,
  sandbox:window.frameElement?.getAttribute("sandbox")||"opaque"
 }));
 assert.equal(marker.linked,"signed-studio-proof");
 assert.equal(marker.bridge,"function");
 await frame.locator("body").evaluate(()=>{openCard("front",1);switchCardTab("lookup");});
 await frame.locator("#protectedPtgConnected").waitFor({state:"visible",timeout:15000});
 await frame.locator("#barcode").fill("0000012345");
 await frame.locator("#ptgFind").click({timeout:15000});
 await frame.getByText(/1 PTG result\(s\)/).waitFor({timeout:30000});
 assert.equal(requests.filter(r=>r.action==="lookup").length,1);
 assert.deepEqual(illegal,[]);
 assert.match(await frame.locator("#backup").textContent(),/\.json/);
 assert.equal(await frame.locator("#ptgLogin").isVisible(),false);
 assert.equal(await page.locator("#studio-editor-frame").getAttribute("sandbox"),
   "allow-scripts allow-forms allow-downloads allow-modals");
 await ctx.close();
 console.log("PASS: PTG already authorized; barcode form click performs one signed proof lookup; no password, JWT or app-session ID enters iframe.");
} finally {
 await browser?.close();
 if(server)await new Promise(resolve=>server.close(resolve));
 rmSync(temp,{recursive:true,force:true});
}
