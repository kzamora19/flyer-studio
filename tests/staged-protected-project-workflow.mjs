import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {dirname,resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createProofMock} from './staged-proof-mock.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temp=mkdtempSync(join(tmpdir(),'megaflyer-secure-cloud-'));
execFileSync(process.execPath,[join(root,'scripts/build-private-flyer.mjs'),temp],{cwd:root,stdio:'pipe'});
const privateHtml=readFileSync(join(temp,'private/studio.html'),'utf8');
const privateManifest=JSON.parse(readFileSync(join(temp,'manifest.json'),'utf8'));
const originHTML=readFileSync(join(root,'staging/studio-access/index.html'),'utf8');
const server=createServer((req,res)=>{
 const p=new URL(req.url,'http://localhost').pathname;
 if(p==='/'||p==='/index.html'){
  res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
  res.end(originHTML);return;
 }
 if(p==='/launch.js'){
  res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});
  res.end(readFileSync(join(root,'staging/studio-access/launch.js')));return;
 }
 res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const user={id:'11111111-2222-4333-8444-555555555555',email:'flyer-test@example.invalid'};
const projects=[],revisions=[];
const proof=createProofMock();
let conflictNextPatch=false;
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l6cAAAAASUVORK5CYII=';
let browserInstance;
const status=(route,data,httpStatus=200)=>route.fulfill({
 status:httpStatus,contentType:'application/json',
 headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS',
 'access-control-allow-headers':'authorization,content-type,apikey,x-client-info,x-ptg-session-id'},
 body:JSON.stringify(data)});
const unpack=doc=>doc.format==='gzip-base64-v1'
 ?JSON.parse(gunzipSync(Buffer.from(doc.data,'base64')).toString('utf8')):doc.data;
try{
 browserInstance=await chromium.launch({headless:true});
 const context=await browserInstance.newContext({viewport:{width:1280,height:850}});
 // The sandbox must NOT inherit login tokens from the parent origin.
 // Exercise an explicit in-editor Supabase Cloud sign-in instead.
 await context.route('https://tzklsscoiwnmeantcefw.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method(),path=url.pathname;
  if(path==='/functions/v1/flyer-editor-delivery'){
   const body=req.postDataJSON();
   const result=await proof.handle(body);
   if(body.action==='load')return status(route,{...result,html:privateHtml,sha256:privateManifest.sha256});
   if(body.action==='check')return status(route,result);
   throw Error('Unexpected protected delivery action: '+body.action);
  }
  if(path==='/auth/v1/user')return status(route,user);
  if(path==='/auth/v1/token')return status(route,{
    access_token:'offline-test-access-token',refresh_token:'offline-test-refresh-token',
    expires_at:Math.floor(Date.now()/1000)+3600,user
  });
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
 const origin='http://127.0.0.1:'+server.address().port;
 await page.goto(origin+'/#ptg_studio_ticket='+'P'.repeat(43),{waitUntil:'domcontentloaded'});
 await page.locator('#studio-editor-frame').waitFor({timeout:30000});
 const editor=page.frames().find(f=>f.url()==='about:srcdoc');
 assert.ok(editor,'Private editor iframe must exist');
 await editor.locator('#quickSaveProject').waitFor({state:'attached',timeout:30000});
 await editor.locator('#quickSaveProject').waitFor({state:'attached',timeout:20000});
 assert.equal(await editor.locator('.flyer-tab-shell #quickSaveProject, .flyer-tab-shell #quickRetrieveProject').count(),0,
   'Save/Retrieve should not appear in top tab toolbar');
 await editor.locator('#studioNav [data-nav="backup"]').click();
 assert.equal(await editor.locator('#panel-backup #projectCloudActions #quickSaveProject:visible').count(),1);
 // An explicit sign-in inside the opaque sandbox replaces the previous
 // insecure test that injected a token into shared parent localStorage.
 await editor.locator('#quickSaveProject').click();
 await editor.locator('#quickProjectSignedOut').waitFor({state:'visible',timeout:12000});
 await editor.locator('#quickProjectSignIn').click();
 await editor.locator('#cloudEmail').fill(user.email);
 await editor.locator('#cloudPassword').fill('staged-non-production-password');
 await editor.locator('#cloudSignIn').click();
 await editor.waitForFunction(()=>document.getElementById('cloudAccount')?.textContent.includes('flyer-test@example.invalid'));
 await editor.evaluate(()=>powerClose());
 await editor.locator('#quickSaveProject').click();
 assert.equal(await editor.locator('#panel-backup #projectCloudActions #quickRetrieveProject:visible').count(),1);
 await editor.waitForFunction(()=>!!document.getElementById('cloudAccount')?.textContent.includes('flyer-test@example.invalid'));
 assert.equal(await editor.locator('#quickRetrieveProject').count(),1);
 await editor.locator('#quickSaveProject').click();
 await editor.locator('#quickProjectModal:visible').waitFor();
 assert.equal(await editor.locator('#quickProjectSaveCurrent').isDisabled(),true);
 await editor.locator('#quickProjectName').fill('Unfinished Promo A');
 await editor.locator('#quickProjectSaveNew').click();
 await editor.getByText('Saved as new project: Unfinished Promo A.',{exact:false}).waitFor();
 assert.equal(projects.length,1);
 assert.equal(projects[0].name,'Unfinished Promo A');
 assert.equal(unpack(projects[0].document).campaign.subtitle,'Bigger & Brighter Deals');

 await editor.evaluate(photo=>{
  state.campaign.subtitle='Version A - edited later';
  state.offers[0].photo=photo;
  save();refresh();
 },image);
 await editor.locator('#quickProjectSaveCurrent').click();
 await editor.getByText('Saved Unfinished Promo A · revision 2.',{exact:false}).waitFor();
 assert.equal(projects[0].revision,2);
 assert.equal(unpack(projects[0].document).offers[0].photo,image,'Photo preserved in saved snapshot');
 await editor.evaluate(()=>{state.campaign.subtitle='A different campaign';save();refresh()});
 await editor.locator('#quickProjectName').fill('Unfinished Promo B');
 await editor.locator('#quickProjectSaveNew').click();
 await editor.getByText('Saved as new project: Unfinished Promo B.',{exact:false}).waitFor();
 assert.equal(projects.length,2);
 assert.equal(unpack(projects[0].document).campaign.subtitle,'Version A - edited later',
  'Save As New must NOT overwrite the original project');
 assert.equal(unpack(projects[1].document).campaign.subtitle,'A different campaign');
 await editor.locator('#quickProjectClose').click();

 await editor.locator('#quickRetrieveProject').click();
 await editor.locator('#quickProjectModal:visible').waitFor();
 await editor.locator('#quickProjectSearch').fill('Unfinished Promo A');
 assert.equal(await editor.locator('.quickProjectItem').count(),1,'Project search filters by name');
 page.once('dialog',dlg=>dlg.accept());
 await editor.locator('.quickProjectItem button').click();
 await editor.waitForFunction(()=>window.flyerCloud.getStatus().project==='Unfinished Promo A');
 assert.equal(await editor.evaluate(()=>state.campaign.subtitle),'Version A - edited later');
 assert.equal(await editor.evaluate(()=>state.offers[0].photo),image,'Retrieved project restores product photo');

 // Simulate an actual revision conflict and confirm retrieval never discards unsaved changes.
 await editor.evaluate(()=>{state.campaign.subtitle='Local unsaved change';save()});
 conflictNextPatch=true;
 await editor.locator('#quickRetrieveProject').click();
 await editor.locator('#quickProjectSearch').fill('Unfinished Promo B');
 await editor.locator('.quickProjectItem button').click();
 await editor.getByText('Project was not opened.',{exact:false}).waitFor();
 assert.equal(await editor.evaluate(()=>state.campaign.subtitle),'Local unsaved change');
 assert.equal(await editor.evaluate(()=>window.flyerCloud.getStatus().project),'Unfinished Promo A');
 assert.equal(await editor.locator('#quickProjectModal').isVisible(),true);
 assert.deepEqual(pageErrors,[],'No uncaught errors in browser');

 console.log('PASS: named cloud Save, Save Changes, Save As New isolation, photo round-trip, retrieval, search and conflict protection');

 await editor.locator('#quickProjectClose').click();
 await editor.locator('#studioNav [data-nav="review"]').click();
 const [pngDownload]=await Promise.all([
  page.waitForEvent('download',{timeout:90000}),
  editor.locator('#png').click({timeout:18000})
 ]);
 const png=readFileSync(await pngDownload.path());
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.ok(png.readUInt32BE(16)>=2000&&png.readUInt32BE(20)>=2800);
 console.log('PASS: protected frame cloud Save/Retrieve and full-resolution PNG export');
 await context.close();

} finally {
 await browserInstance?.close();
 await new Promise(resolve=>server.close(resolve));
 rmSync(temp,{recursive:true,force:true});
}
