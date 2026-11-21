// Full MegaFlyer bundle in the non-deployed protected frame, with all network access mocked.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temp=mkdtempSync(join(tmpdir(),'megaflyer-secure-frame-'));
let server,browser;
try{
 execFileSync(process.execPath,[join(root,'scripts/build-private-flyer.mjs'),temp],{cwd:root,stdio:'pipe'});
 const privateHtml=readFileSync(join(temp,'private/studio.html'),'utf8');
 const manifest=JSON.parse(readFileSync(join(temp,'manifest.json'),'utf8'));
 const staging=join(root,'staging/studio-access');
 const landing=readFileSync(join(staging,'index.html'),'utf8');
 server=createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname;
  if(p==='/'||p==='/index.html'){
   res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
   res.end(landing);return;
  }
  if(p==='/launch.js'){
   res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});
   res.end(readFileSync(join(staging,'launch.js')));return;
  }
  res.writeHead(404);res.end();
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const errors=[],calls=[];
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin===origin)return route.continue();
  if(url.hostname==='tzklsscoiwnmeantcefw.supabase.co'&&url.pathname==='/functions/v1/flyer-editor-delivery'){
   const payload=route.request().postDataJSON();calls.push(payload.action);
   return route.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':origin,'access-control-allow-headers':'*'},
    body:JSON.stringify(payload.action==='load'?
      {ok:true,html:privateHtml,sha256:manifest.sha256,expiresAt:new Date(Date.now()+600_000).toISOString()}:
      {ok:true,expiresAt:new Date(Date.now()+600_000).toISOString()})});
  }
  return route.fulfill({status:404,body:'External service disabled in offline QA'});
 });
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/#ptg_studio_ticket='+'R'.repeat(43),{waitUntil:'domcontentloaded'});
 await page.locator('#studio-editor-frame').waitFor({timeout:30000});
 const frame=page.frameLocator('#studio-editor-frame');
 await frame.locator('#sharedAssetLauncher').waitFor({timeout:30000});
 assert.match(await frame.locator('title').textContent(),/MegaFlyer Studio/);
 assert.equal(new URL(page.url()).hash,'');
 assert.equal(await frame.locator('#printPdf').count(),1);
 assert.equal(await frame.locator('#png').count(),1);
 await frame.locator('#sharedAssetLauncher').click({timeout:20000});
 await frame.locator('#sharedAssetModal').waitFor({state:'visible',timeout:10000});
 await frame.locator('#sharedAssetClose').click();
 assert.equal(await frame.locator('#sharedAssetModal').isHidden(),true);
 assert.deepEqual(errors,[],errors.join('; '));
 assert.ok(calls.includes('load'));
 console.log('PASS: full 1MB+ MegaFlyer bundle loads in ticket-gated srcdoc; editor controls and asset dialog work under mock gateway.');
}finally{
 await browser?.close();
 if(server)await new Promise(ok=>server.close(ok));
 rmSync(temp,{recursive:true,force:true});
}