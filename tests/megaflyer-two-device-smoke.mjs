// CI-only two-device backup and shared-library test. All service calls are mocked.
// This validates the browser wiring but is NOT a real PTG, Supabase, or Drive test.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../site');
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/vncAAAAASUVORK5CYII=','base64');
const contentType={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}
 catch{res.writeHead(400);res.end();return;}
 const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+'/')&&!file.startsWith(root+'\\')){res.writeHead(403);res.end();return;}
 if(!existsSync(file)){res.writeHead(404);res.end();return;}
 try{res.writeHead(200,{'Content-Type':contentType[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(file));}
 catch{res.writeHead(500);res.end();}
});
await new Promise(ready=>server.listen(0,'127.0.0.1',ready));
const origin='http://127.0.0.1:'+server.address().port;
const assets=[{id:'11111111-1111-4111-8111-111111111111',name:'Shared Test Logo',category:'logos',byte_size:image.length,mime_type:'image/png'}];
const calls=[];
let seq=2;
const routeHandler=async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.origin===origin){await route.continue();return;}
 const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'*','cache-control':'no-store'};
 if(url.hostname==='qa-assets.test'){
  await route.fulfill({status:200,body:image,contentType:'image/png',headers});return;
 }
 if(url.hostname==='tzklsscoiwnmeantcefw.supabase.co'&&url.pathname==='/functions/v1/flyer-shared-assets'){
  const session=request.headers()['x-ptg-session-id']||'';
  const body=request.postDataJSON();calls.push({session,action:body.action});
  if(!['session-team-leader','session-admin'].includes(session)){
   await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'PTG Team Leader access required.'}),headers});return;
  }
  let data;
  switch(body.action){
   case 'permissions':data={canView:true,canManage:true};break;
   case 'list':data={assets:assets.filter(a=>(!body.category||a.category===body.category)&&(!body.search||a.name.toLowerCase().includes(String(body.search).toLowerCase())))};break;
   case 'preview':data={url:'https://qa-assets.test/mock-image.png'};break;
   case 'rename':{
    const target=assets.find(a=>a.id===body.id);if(!target)throw Error('Unknown asset');
    target.name=body.name;data={ok:true};break;
   }
   case 'add':{
    assert.equal(body.mime,'image/png');assert.equal(body.base64, image.toString('base64'));
    const id=String(seq++).padStart(8,'0')+'-1111-4111-8111-111111111111';
    assets.push({id,name:body.name,category:body.category,byte_size:image.length,mime_type:body.mime});
    data={ok:true};break;
   }
   default:throw Error('Unexpected mock asset action '+body.action);
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data),headers});return;
 }
 await route.fulfill({status:404,body:'Unexpected external request blocked',headers});
};
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 const pages=[];
 for(const [session,role] of [['session-team-leader','TL'],['session-admin','Admin']]){
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1300,height:850}});
  await context.route('**/*',routeHandler);
  const page=await context.newPage();
  page.on('pageerror',err=>{throw Error('Browser page error: '+err.message)});
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.locator('#sharedAssetLauncher').waitFor({timeout:20000});
  await page.evaluate(([id,label])=>ptgConnected({token:'qa-only-token',id},'Mock '+label+' session'),[session,role]);
  await page.locator('#sharedAssetLauncher').click();
  await page.waitForFunction(()=>document.querySelector('#sharedAssetNotice')?.textContent==='1 shared asset(s) found.',{timeout:15000});
  pages.push(page);
 }
 const [A,B]=pages;
 assert.equal(await A.locator('.sa-item').count(),1);
 assert.equal(await B.locator('.sa-item').count(),1);
 // Export an offline JSON asset backup on A and simulate transferring it to B.
 const [download]=await Promise.all([
  A.waitForEvent('download',{timeout:25000}),
  A.locator('#sharedAssetExport').click({timeout:15000})
 ]);
 const raw=readFileSync(await download.path());
 const backup=JSON.parse(raw.toString('utf8'));
 assert.equal(backup.kind,'FlyerStudioSharedAssetBackup');
 assert.equal(backup.version,1);
 assert.equal(backup.assets.length,1);
 assert.equal(backup.assets[0].name,'Shared Test Logo');
 assert.equal(backup.assets[0].base64,image.toString('base64'));
 B.on('dialog',dialog=>dialog.accept());
 await B.locator('#sharedAssetRestore').setInputFiles({name:'offline-asset-backup.json',mimeType:'application/json',buffer:raw});
 await B.waitForFunction(()=>document.querySelector('#sharedAssetNotice')?.textContent==='Restored 1 shared assets from backup.',{timeout:15000});
 assert.equal(assets.length,2);
 assert.equal(await B.locator('.sa-item').count(),2);
 await A.locator('#sharedAssetRefresh').click();
 await A.waitForFunction(()=>document.querySelector('#sharedAssetNotice')?.textContent==='2 shared asset(s) found.',{timeout:15000});
 assert.equal(await A.locator('.sa-item').count(),2);
 // A rename in one isolated browser session must be visible after B refresh.
 A.once('dialog',dialog=>dialog.accept('Renamed On A'));
 await A.locator('.sa-item button').filter({hasText:'Rename'}).first().click();
 await A.waitForFunction(()=>document.querySelector('#sharedAssetNotice')?.textContent==='2 shared asset(s) found.'&&document.querySelector('#sharedAssetList')?.textContent.includes('Renamed On A'),{timeout:15000});
 await B.locator('#sharedAssetRefresh').click();
 await B.waitForFunction(()=>document.querySelector('#sharedAssetList')?.textContent.includes('Renamed On A'),{timeout:15000});
 assert.equal(assets.find(a=>a.name==='Renamed On A')?.id,'11111111-1111-4111-8111-111111111111');
 console.log('PASS: isolated TL and Admin contexts share mocked assets; offline JSON export/import and cross-context refresh work.');
 console.log('Mock asset actions:',JSON.stringify(calls));
} finally {
 await browser?.close();
 await new Promise(ok=>server.close(ok));
}
