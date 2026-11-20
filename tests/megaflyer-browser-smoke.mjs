// Automated browser smoke test: all remote PTG/Supabase interactions are mocked.
// This does not authenticate real users or modify any production data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../site');
const evidence=resolve(dirname(fileURLToPath(import.meta.url)),'../acceptance-evidence');
mkdirSync(evidence,{recursive:true});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/vncAAAAASUVORK5CYII=','base64');
const contentTypes={'.html':'text/html; charset=utf-8','.js':'application/javascript','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.css':'text/css','.jpg':'image/jpeg'};
const server=createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname);}
 catch{res.writeHead(400);res.end();return;}
 const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+'/')&&!file.startsWith(root+'\\')){res.writeHead(403);res.end();return;}
 if(!existsSync(file)){res.writeHead(404);res.end('Not found');return;}
 try{res.writeHead(200,{'Content-Type':contentTypes[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(file));}
 catch{res.writeHead(500);res.end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
const asset={id:'11111111-1111-4111-8111-111111111111',name:'QA Test Logo',category:'logos',byte_size:png.length};
const actions=[];
const failures=[];
try{
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
 const page=await ctx.newPage();
 page.on('pageerror',error=>failures.push(String(error.message)));
 await page.route('**/*', async route=>{
  const url=new URL(route.request().url());
  if(url.origin===origin){await route.continue();return;}
  const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'*','cache-control':'no-store'};
  if(url.hostname==='qa-assets.test'){
   await route.fulfill({status:200,body:png,contentType:'image/png',headers});return;
  }
  if(url.pathname==='/functions/v1/flyer-shared-assets'&&url.hostname==='tzklsscoiwnmeantcefw.supabase.co'){
   const session=route.request().headers()['x-ptg-session-id']||'';
   const body=route.request().postDataJSON();
   actions.push({action:body.action,session});
   if(session==='session-denied'||!session){
    await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'Team Leader or higher PTG access required.'}),headers});return;
   }
   const data=body.action==='permissions'?{canManage:true}:body.action==='list'?{assets:[asset]}:body.action==='preview'?{url:'https://qa-assets.test/logo.png'}:{ok:true};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data),headers});return;
  }
  // Important: never send mock PTG credentials or library requests to a live host.
  await route.fulfill({status:404,body:'Blocked external service in isolated acceptance test',headers});
 });
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 await page.locator('#sharedAssetLauncher').waitFor({timeout:25000});
 assert.equal(await page.locator('title').textContent(),'MegaFlyer Studio · First Megasaver');
 assert.equal(await page.locator('#sharedAssetLauncher').count(),1);
 await page.locator('#sharedAssetLauncher').click();
 await page.waitForFunction(()=>document.getElementById('sharedAssetNotice')?.textContent.includes('Connect to PTG'),{timeout:15000});
 assert.equal(await page.locator('#sharedAssetAdd').isHidden(),true);
 await page.evaluate(()=>ptgConnected({token:'mock-token-for-smoke-only',id:'session-admin'},'Mock QA account'));
 await page.waitForFunction(()=>document.querySelector('#sharedAssetNotice')?.textContent==='1 shared asset(s) found.',{timeout:15000});
 assert.equal(await page.locator('.sa-item').count(),1);
 assert.equal(await page.locator('#sharedAssetAdd').isVisible(),true);
 await page.locator('.sa-item button').filter({hasText:'Preview'}).click();
 await page.waitForFunction(()=>{const image=document.getElementById('sharedAssetPreview');return !image.hidden&&image.naturalWidth===1},{timeout:15000});
 await page.selectOption('#sharedAssetTarget','logo');
 await page.locator('.sa-item button').filter({hasText:'Use asset'}).click();
 await page.waitForFunction(()=>state.campaign.brandHeader==='custom'&&state.campaign.logo.startsWith('data:image/png'),{timeout:15000});
 for(const face of ['front','back']){
  await page.selectOption('#sharedAssetTarget',face);
  await page.locator('.sa-item button').filter({hasText:'Use asset'}).click();
  const prop=face==='front'?'frontHeadlineImage':'backHeadlineImage';
  await page.waitForFunction(p=>Boolean(state.campaign[p]?.startsWith('data:image/png')),prop,{timeout:15000});
 }
 await page.evaluate(()=>ptgConnected({token:'mock-denied',id:'session-denied'},'Mock ordinary user'));
 assert.equal(await page.locator('#sharedAssetPreview').isHidden(),true);
 await page.waitForFunction(()=>document.querySelector('#sharedAssetNotice')?.textContent.includes('Team Leader or higher'),{timeout:15000});
 assert.equal(await page.locator('.sa-item').count(),0);
 assert.equal(await page.locator('#sharedAssetAdd').isHidden(),true);
 await page.evaluate(()=>ptgConnected(null,'Signed out'));
 await page.waitForFunction(()=>document.querySelector('#sharedAssetNotice')?.textContent.includes('Connect to PTG'),{timeout:15000});
 assert.equal(await page.locator('.sa-item').count(),0);
 await page.screenshot({path:join(evidence,'megaflyer-front-preview.png'),animations:'disabled'});
 const pdfEvent=page.waitForEvent('download',{timeout:90000});
 await page.locator('#pdf').click();
 const pdfDownload=await pdfEvent;
 const pdf=readFileSync(await pdfDownload.path());
 const text=pdf.toString('latin1');
 assert.ok(text.startsWith('%PDF-1.4'));
 assert.match(text,/\\/Count 2\\b/);
 assert.equal((text.match(/\\/Subtype \\/Image/g)||[]).length,2);
 assert.ok(pdf.length>20000,'PDF contains rendered pages');
 const pngEvent=page.waitForEvent('download',{timeout:90000});
 await page.locator('#png').click();
 const pngDownload=await pngEvent;
 const printed=readFileSync(await pngDownload.path());
 assert.equal(printed.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.ok(printed.readUInt32BE(16)>=2000&&printed.readUInt32BE(20)>=2800,'PNG export is high resolution');
 assert.equal(failures.length,0,'No uncaught browser errors: '+failures.join('; '));
 console.log('PASS: mock PTG allowed/denied/sign-out, asset preview, logo/front/back placement, real Chromium PDF+PNG exports');
 console.log('Browser render sizes:',{pdfBytes:pdf.length,pngWidth:printed.readUInt32BE(16),pngHeight:printed.readUInt32BE(20),apiCalls:actions.length});
} finally {
 await browser?.close();
 await new Promise(ok=>server.close(ok));
}
