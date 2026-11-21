// Synthetic GitHub Pages preview: refuse all old editor sources post-cutover.
// This runs a local test site, never production Pages.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFileSync,rmSync} from "node:fs";
import {resolve,join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {chromium} from "playwright";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const target=join(root,"staging",".cutover-browser-output");
let server,browser;
try{
 execFileSync(process.execPath,[join(root,"scripts","build-cutover-pages.mjs"),target],{
  cwd:root,stdio:"pipe",env:{...process.env,PTG_STUDIO_CUTOVER_PREVIEW:"1"}
 });
 server=createServer((req,res)=>{
  const pathname=new URL(req.url,"http://localhost").pathname;
  if(!pathname.startsWith("/flyer-studio/")){res.writeHead(404);res.end();return}
  const path=pathname.slice("/flyer-studio/".length)||"index.html";
  if(!["index.html","manifest.webmanifest","icons/flyer-studio.svg",
   "icons/flyer-studio-192.png","icons/flyer-studio-512.png"].includes(path)){
   res.writeHead(404,{"Cache-Control":"no-store"});res.end("Legacy editor not published");return
  }
  const type=path.endsWith(".svg")?"image/svg+xml":path.endsWith(".png")?"image/png":
   path.endsWith(".webmanifest")?"application/manifest+json":"text/html";
  res.writeHead(200,{"Content-Type":type,"Cache-Control":"no-store"});
  res.end(readFileSync(join(target,path)));
 });
 await new Promise(done=>server.listen(0,"127.0.0.1",done));
 const origin="http://127.0.0.1:"+server.address().port;
 browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:390,height:800}});
 const page=await context.newPage();
 const errs=[];page.on("pageerror",err=>errs.push(err.message));
 await page.goto(origin+"/flyer-studio/");
 await page.getByRole("heading",{name:"MegaFlyer Studio"}).waitFor();
 assert.match(await page.locator("body").textContent(),/Promotional Flyer & Sale Artwork Generator/);
 const link=page.getByRole("link",{name:"Open PTG Creative Studios"});
 assert.equal(await link.getAttribute("href"),"https://kzamora19.github.io/first-megasaver-ptg/studios/");
 assert.ok(await page.locator("img").evaluate(img=>img.complete&&img.naturalWidth>0),"Approved MegaFlyer app icon must remain visible");
 assert.equal(await page.locator("canvas, #sharedAssetLauncher, #png, #printPdf").count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,
  "The retired Pages access notice should fit mobile viewports");
 for(const legacy of ["shared-asset-ui.js","toolbar-tabs.js","floating-panels.js","private/studio.html"]){
  const r=await context.request.get(origin+"/flyer-studio/"+legacy);
  assert.equal(r.status(),404,"Historical editor file must no longer be served: "+legacy);
 }
 const r=await context.request.get(origin+"/flyer-studio/index.html");
 assert.equal(r.status(),200);
 assert.doesNotMatch(await r.text(),/<script|sharedAssetLauncher|printPdf/);
 assert.deepEqual(errs,[],"Cutover preview must have no browser runtime errors");
 console.log("PASS: MegaFlyer editor-free Pages preview serves only the approved identity and PTG link, denies historical editor URLs, and fits mobile.");
}finally{
 await browser?.close();
 if(server)await new Promise(done=>server.close(done));
 rmSync(target,{recursive:true,force:true});
}
