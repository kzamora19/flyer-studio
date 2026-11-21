import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {extname,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../site');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{
 const raw=(req.url||'/').split('?')[0];
 const file=resolve(root,'.'+(raw==='/'?'/index.html':decodeURIComponent(raw)));
 if(!file.startsWith(root+'/')||!existsSync(file)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
 res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const user={id:'11111111-2222-4333-8444-555555555555',email:'flyer-test@example.invalid'};
const projects=[],revisions=[];
let conflictNextPatch=false;
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l6cAAAAASUVORK5CYII=';
let browserInstance;
const status=(route,data,httpStatus=200)=>route.fulfill({
 status:httpStatus,contentType:'application/json',body:JSON.stringify(data)});
const unpack=doc=>doc.format==='gzip-base64-v1'
 ?JSON.parse(gunzipSync(Buffer.from(doc.data,'base64')).toString('utf8')):doc.data;
try{
 browserInstance=await chromium.launch({headless:true});
 const context=await browserInstance.newContext({viewport:{width:1280,height:850}});
 await context.addInitScript(({user})=>{
  localStorage.setItem('flyer-studio-cloud-auth-v1',JSON.stringify({
   access_token:'offline-test-access-token',refresh_token:'offline-test-refresh-token',
   expires_at:Math.floor(Date.now()/1000)+3600,user}));
 },{user});
 await context.route('https://tzklsscoiwnmeantcefw.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method(),path=url.pathname;
  if(path==='/auth/v1/user')return status(route,user);
  if(path.endsWith('/flyer_cloud_projects')){
   if(method==='GET'){
    const id=(url.searchParams.get('id')||'').replace(/^eq\./,'');
    const rows=id?projects.filter(p=>p.id===id):projects;
    return status(route,rows.map(p=>id?{...p}:{id:p.id,name:p.name,revision:p.revision,status:p.status,updated_at:p.updated_at}));
   }
   if(method==='POST'){
    const data=JSON.parse(req.postData()||'{}');
    assert.equal(data.owner_id,user.id,'Project owner must match authenticated user');
    const record={...data,id:'10000000-0000-4000-8000-'+String(projects.length+1).padStart(12,'0'),
      revision:1,updated_at:new Date().toISOString()};
    projects.push(record);
    return status(route,[record],201);
   }
   if(method==='PATCH'){
    const id=(url.searchParams.get('id')||'').replace(/^eq\./,'');
    const prevRevision=Number((url.searchParams.get('revision')||'').replace(/^eq\./,''));
    const current=projects.find(p=>p.id===id);
    if(conflictNextPatch){conflictNextPatch=false;return status(route,[]);}
    if(!current||current.revision!==prevRevision)return status(route,[]);
    const body=JSON.parse(req.postData()||'{}');Object.assign(current,body);
    return status(route,[{id:current.id,name:current.name,revision:current.revision,updated_at:current.updated_at}]);
   }
   if(method==='DELETE'){const id=(url.searchParams.get('id')||'').replace(/^eq\./,'');const i=projects.findIndex(p=>p.id===id);if(i>=0)projects.splice(i,1);return status(route,[]);}
  }
  if(path.endsWith('/flyer_cloud_versions')){
   if(method==='POST'){revisions.push(JSON.parse(req.postData()||'{}'));return status(route,null,201);}
   return status(route,[]);
  }
  if(path.endsWith('/flyer_cloud_photos'))return status(route,[]);
  return status(route,[]);
 });
 const page=await context.newPage();
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
 await page.locator('#quickSaveProject').waitFor({timeout:20000});
 await page.waitForFunction(()=>!!document.getElementById('cloudAccount')?.textContent.includes('flyer-test@example.invalid'));
 assert.equal(await page.locator('#quickRetrieveProject').count(),1);
 await page.locator('#quickSaveProject').click();
 await page.locator('#quickProjectModal:visible').waitFor();
 assert.equal(await page.locator('#quickProjectSaveCurrent').isDisabled(),true);
 await page.locator('#quickProjectName').fill('Unfinished Promo A');
 await page.locator('#quickProjectSaveNew').click();
 await page.getByText('Saved as new project: Unfinished Promo A.',{exact:false}).waitFor();
 assert.equal(projects.length,1);
 assert.equal(projects[0].name,'Unfinished Promo A');
 assert.equal(unpack(projects[0].document).campaign.subtitle,'Bigger & Brighter Deals');

 await page.evaluate(photo=>{
  state.campaign.subtitle='Version A - edited later';
  state.offers[0].photo=photo;
  save();refresh();
 },image);
 await page.locator('#quickProjectSaveCurrent').click();
 await page.getByText('Saved Unfinished Promo A · revision 2.',{exact:false}).waitFor();
 assert.equal(projects[0].revision,2);
 assert.equal(unpack(projects[0].document).offers[0].photo,image,'Photo preserved in saved snapshot');
 await page.evaluate(()=>{state.campaign.subtitle='A different campaign';save();refresh()});
 await page.locator('#quickProjectName').fill('Unfinished Promo B');
 await page.locator('#quickProjectSaveNew').click();
 await page.getByText('Saved as new project: Unfinished Promo B.',{exact:false}).waitFor();
 assert.equal(projects.length,2);
 assert.equal(unpack(projects[0].document).campaign.subtitle,'Version A - edited later',
  'Save As New must NOT overwrite the original project');
 assert.equal(unpack(projects[1].document).campaign.subtitle,'A different campaign');
 await page.locator('#quickProjectClose').click();

 await page.locator('#quickRetrieveProject').click();
 await page.locator('#quickProjectModal:visible').waitFor();
 await page.locator('#quickProjectSearch').fill('Unfinished Promo A');
 assert.equal(await page.locator('.quickProjectItem').count(),1,'Project search filters by name');
 page.once('dialog',dlg=>dlg.accept());
 await page.locator('.quickProjectItem button').click();
 await page.waitForFunction(()=>window.flyerCloud.getStatus().project==='Unfinished Promo A');
 assert.equal(await page.evaluate(()=>state.campaign.subtitle),'Version A - edited later');
 assert.equal(await page.evaluate(()=>state.offers[0].photo),image,'Retrieved project restores product photo');

 // Simulate an actual revision conflict and confirm retrieval never discards unsaved changes.
 await page.evaluate(()=>{state.campaign.subtitle='Local unsaved change';save()});
 conflictNextPatch=true;
 await page.locator('#quickRetrieveProject').click();
 await page.locator('#quickProjectSearch').fill('Unfinished Promo B');
 await page.locator('.quickProjectItem button').click();
 await page.getByText('Project was not opened.',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>state.campaign.subtitle),'Local unsaved change');
 assert.equal(await page.evaluate(()=>window.flyerCloud.getStatus().project),'Unfinished Promo A');
 assert.equal(await page.locator('#quickProjectModal').isVisible(),true);
 assert.deepEqual(pageErrors,[],'No uncaught errors in browser');

 console.log('PASS: named cloud Save, Save Changes, Save As New isolation, photo round-trip, retrieval, search and conflict protection');
 await context.close();
 const signedOut=await browserInstance.newContext();
 const p=await signedOut.newPage();
 await p.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
 await p.locator('#quickSaveProject').click();
 assert.equal(await p.locator('#quickProjectSignedOut').isVisible(),true,'Sign-in guidance for cloud projects');
 await p.locator('#quickProjectSignIn').click();
 assert.equal(await p.locator('#powerModal').isVisible(),true,'Sign-in leads to existing Cloud Workspace');
 await signedOut.close();
 console.log('PASS: signed-out guidance and safe Cloud sign-in route');
} finally {
 await browserInstance?.close();
 await new Promise(resolve=>server.close(resolve));
}
