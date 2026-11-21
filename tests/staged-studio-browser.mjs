// Staged launcher browser test. Every PTG/Supabase request is mocked.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createProofMock} from './staged-proof-mock.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../staging/studio-access');
const pageHTML=readFileSync(resolve(root,'index.html'),'utf8');
const marker='publishableKey:"sb_publishable_djhRIa3KhHbG0tOzQnXrIA_Ou-fJnmK"';
assert.ok(pageHTML.includes(marker));
const html=pageHTML.replace(marker,marker+',checkIntervalMs:500');
const server=createServer((req,res)=>{
 const p=new URL(req.url,'http://localhost').pathname;
 if(p==='/'||p==='/index.html'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;
 }
 if(p==='/launch.js'){
  res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});
  res.end(readFileSync(resolve(root,'launch.js')));return;
 }
 if(p==='/draft-vault.js'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});res.end(readFileSync(resolve(root,'draft-vault.js')));return;}
 res.writeHead(404);res.end();
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:1200,height:800}});
 const requests=[],errors=[];
 let tamperPackage=false;
 const mockEditor='<!-- PRIVATE EDITOR BUNDLE. -->\\n<!doctype html><button id="editor-ready">Mock protected editor</button>';
 const genuineHash=createHash('sha256').update(mockEditor).digest('hex');
 const proof=createProofMock();
 await ctx.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin===origin){await route.continue();return;}
  if(url.host==='tzklsscoiwnmeantcefw.supabase.co'&&url.pathname==='/functions/v1/flyer-editor-delivery'){
   const body=route.request().postDataJSON();
   requests.push(body);
   const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'*'};
   const result=await proof.handle(body,{denyOnCheck:true,expireMs:60_000});
   return route.fulfill({status:result.ok?200:403,contentType:'application/json',headers,
    body:JSON.stringify(body.action==='load'?{...result,
      html:mockEditor,
      sha256:tamperPackage?'0'.repeat(64):genuineHash}:result)});
  }
  return route.abort();
 });
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/#ptg_studio_ticket='+'T'.repeat(43),{waitUntil:'domcontentloaded'});
 await page.locator('#studio-editor-frame').waitFor({timeout:15000});
 assert.equal(new URL(page.url()).hash,'');
 await page.frameLocator('#studio-editor-frame').locator('#editor-ready').waitFor({timeout:15000});
 assert.equal(await page.locator('#studio-editor-frame').getAttribute('sandbox'),
   'allow-scripts allow-downloads allow-modals','Editor must have an opaque origin (never allow-same-origin)');
 const access=await page.frameLocator('#studio-editor-frame').locator('body').evaluate(()=>{
   try{window.parent.localStorage.getItem('ptg-session');return 'EXPOSED';}
   catch(error){return error.name;}
 });
 assert.equal(access,'SecurityError','Protected editor must not read parent PTG/Branchline storage');
 await page.waitForFunction(()=>document.getElementById('studio-editor-frame')===null,{timeout:15000});
 assert.ok((await page.locator('#status').textContent()).includes('been revoked'));
 assert.ok(requests.some(x=>x.action==='load'));
 assert.ok(requests.some(x=>x.action==='check'));
 assert.ok(requests.filter(x=>x.action==='load').every(x=>x.ticket==='T'.repeat(43)));
 assert.ok(requests.filter(x=>x.action==='check').every(x=>!('ticket' in x)));
 assert.ok(requests.filter(x=>x.action==='check').every(x=>typeof x.signature==='string'));
 const noTicket=await ctx.newPage();
 await noTicket.goto(origin,{waitUntil:'domcontentloaded'});
 await noTicket.getByText('A valid PTG authorization is required.').waitFor({timeout:8000});
 assert.equal(await noTicket.locator('#studio-editor-frame').count(),0);
 tamperPackage=true;
 const forged=await ctx.newPage();
 await forged.goto(origin+'/#ptg_studio_ticket='+'Z'.repeat(43),{waitUntil:'domcontentloaded'});
 await forged.getByText('Could not verify PTG access to MegaFlyer Studio.').waitFor({timeout:15000});
 assert.equal(await forged.locator('#studio-editor-frame').count(),0,
   'Hash-mismatched protected package must never execute');
 await forged.close();
 assert.deepEqual(errors,[]);
 console.log('PASS: mock ticket login, URL fragment removal, protected iframe and revoked-session lock.');
}finally{
 await browser?.close();
 await new Promise(ok=>server.close(ok));
}