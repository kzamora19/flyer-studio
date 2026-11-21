// Real MegaFlyer local draft recovery across simulated PTG ticket expiry and relaunch.
// Entire browser and backend are isolated: no live PTG, Supabase, or Drive access.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,rmSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {createProofMock} from './staged-proof-mock.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const tmp=mkdtempSync(join(tmpdir(),'megaflyer-local-expiry-'));
let server,browser;
try{
 execFileSync(process.execPath,[join(root,'scripts/build-private-flyer.mjs'),tmp],{cwd:root,stdio:'pipe'});
 const bundle=readFileSync(join(tmp,'private/studio.html'),'utf8');
 const sha=JSON.parse(readFileSync(join(tmp,'manifest.json'),'utf8')).sha256;
 const html=readFileSync(join(root,'staging/studio-access/index.html'),'utf8');
 const script=readFileSync(join(root,'staging/studio-access/launch.js'),'utf8');
 server=createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname;
  if(p==='/'||p==='/index.html'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(html);return;}
  if(p==='/launch.js'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});res.end(script);return;}
  if(p==='/draft-vault.js'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});res.end(readFileSync(join(root,'staging/studio-access/draft-vault.js')));return;}
 res.writeHead(404);res.end();
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1260,height:900}});
 const calls=[];
 const proof=createProofMock();
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin===origin)return route.continue();
  if(u.hostname==='tzklsscoiwnmeantcefw.supabase.co'&&u.pathname==='/functions/v1/flyer-editor-delivery'){
   const req=route.request().postDataJSON();
   calls.push({action:req.action,token:req.ticket?.[0]});
   const result=await proof.handle(req,{expireMs:req.ticket?.[0]==='E'?8000:600000});
   return route.fulfill({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':origin,'access-control-allow-headers':'*'},
     body:JSON.stringify(req.action==='load'?{...result,html:bundle,sha256:sha}:result)});
  }
  return route.fulfill({status:404,body:'All external access is blocked during QA'});
 });
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/#ptg_studio_ticket='+'E'.repeat(43),{waitUntil:'domcontentloaded'});
 await page.locator('#studio-editor-frame').waitFor({timeout:20000});
 const frame=page.frameLocator('#studio-editor-frame');
 await frame.locator('#quickSaveProject').waitFor({state:'attached',timeout:24000});
 const expected='QA draft is safe after PTG expiry';
 const stored=await frame.locator('body').evaluate(async (_body,label)=>{
  state.campaign.subtitle=label;
  save();
  return await new Promise((resolve,reject)=>{
   const open=indexedDB.open('megasaver-flyer-studio',1);
   open.onerror=()=>reject(open.error);
   open.onsuccess=()=>{
    const get=open.result.transaction('projects').objectStore('projects').get('current');
    get.onsuccess=()=>resolve(get.result?.campaign?.subtitle);
    get.onerror=()=>reject(get.error);
   };
  });
 },expected);
 assert.equal(stored,expected,'Draft must be written to IndexedDB before expiry');
 await page.waitForFunction(()=>!document.querySelector('#studio-editor-frame'),{timeout:20000});
 assert.match(await page.locator('#status').textContent(),/PTG access expired/);
 assert.equal(new URL(page.url()).hash,'');
 await page.goto(origin+'/?relaunch=1#ptg_studio_ticket='+'N'.repeat(43),{waitUntil:'domcontentloaded'});
 await page.locator('#studio-editor-frame').waitFor({timeout:20000});
 await frame.locator('#quickSaveProject').waitFor({state:'attached',timeout:24000});
 await page.waitForTimeout(450);
 const actual=await frame.locator('body').evaluate(()=>state.campaign.subtitle);
 assert.equal(actual,expected,'Editor must restore local IndexedDB draft on authorized relaunch');
 assert.equal(new URL(page.url()).hash,'');
 assert.equal(errors.length,0,errors.join('; '));
 assert.ok(calls.some(x=>x.action==='load'&&x.token==='E'));
 assert.ok(calls.some(x=>x.action==='load'&&x.token==='N'));
 assert.ok(calls.filter(x=>x.action==='check').every(x=>!x.token));
 console.log('PASS: protected editor expires locally and restores saved IndexedDB draft on a fresh mock PTG login.');
}finally{
 await browser?.close();
 if(server)await new Promise(ok=>server.close(ok));
 rmSync(tmp,{recursive:true,force:true});
}