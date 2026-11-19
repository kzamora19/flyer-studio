// Headless-browser smoke test with deterministic fake OAuth, Supabase and Google Drive.
// No real credentials, private projects, external writes or production deployments.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const index=readFileSync(join(dirname(fileURLToPath(import.meta.url)),'../site/index.html'));
const server=createServer((req,res)=>{
 if(req.url?.split('?')[0]!=='/'){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
 res.end(index);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
const user={id:'00000000-0000-4000-8000-000000000001',email:'flyer-browser-test@example.invalid'};
let project=null,folderCreated=false;
const backups=[],uploads=[];
const cors={
 'access-control-allow-origin':'*',
 'access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS',
 'access-control-allow-headers':'authorization,apikey,content-type,x-client-info,prefer,x-upsert',
};
const reply=(route,body,status=200)=>route.fulfill({status,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(body)});
async function supabase(route){
 const request=route.request(),url=new URL(request.url()),method=request.method();
 if(method==='OPTIONS')return route.fulfill({status:204,headers:cors});
 if(url.pathname==='/auth/v1/user')return reply(route,user);
 if(url.pathname==='/auth/v1/token')return reply(route,{
  access_token:'fixture-new-access',refresh_token:'fixture-new-refresh',expires_in:3600,user
 });
 if(url.pathname==='/auth/v1/logout')return reply(route,{},204);
 if(url.pathname==='/rest/v1/flyer_cloud_projects'){
  if(method==='POST'){
   const body=request.postDataJSON();
   project={id:'11111111-1111-4111-8111-111111111111',owner_id:user.id,
    name:body.name,revision:1,status:body.status||'Draft',
    updated_at:'2026-11-19T09:00:00Z',document:body.document};
   return reply(route,[project],201);
  }
  if(method==='PATCH'){
   const body=request.postDataJSON();
   if(!project||!url.searchParams.get('revision')?.includes('eq.'+project.revision))return reply(route,[]);
   project={...project,...body,revision:body.revision};
   return reply(route,[project]);
  }
  if(method==='GET')return reply(route,project?[project]:[]);
 }
 if(url.pathname==='/rest/v1/flyer_cloud_versions')return reply(route,[]);
 if(url.pathname==='/rest/v1/flyer_cloud_photos')return reply(route,[]);
 if(url.pathname==='/rest/v1/flyer_cloud_templates')return reply(route,[]);
 return reply(route,{message:'Unexpected Supabase mock request: '+method+' '+url.pathname},404);
}
async function googleDrive(route){
 const request=route.request(),url=new URL(request.url()),method=request.method();
 if(method==='OPTIONS')return route.fulfill({status:204,headers:cors});
 if(url.pathname==='/upload/drive/v3/files'&&method==='POST'){
  const raw=request.postData()||'';
  assert.match(raw,/FlyerStudioGoogleDriveBackup/,'Uploaded backup must have expected kind');
  assert.match(raw,/"revision":2/,'Backup must use committed revision 2');
  uploads.push(raw);
  backups.push({id:'drive-backup-1',name:'Flyer Studio - CI Flyer - r2.json',
   createdTime:'2026-11-19T09:00:00Z'});
  return reply(route,{id:'drive-backup-1',name:backups[0].name});
 }
 if(url.pathname==='/drive/v3/files'&&method==='GET'){
  const q=url.searchParams.get('q')||'';
  if(q.includes('in parents'))return reply(route,{files:backups,nextPageToken:null});
  return reply(route,{files:folderCreated?[{id:'drive-folder-1',name:'Flyer Studio Backups'}]:[],nextPageToken:null});
 }
 if(url.pathname==='/drive/v3/files'&&method==='POST'){
  folderCreated=true;return reply(route,{id:'drive-folder-1',name:'Flyer Studio Backups'},201);
 }
 if(url.pathname==='/drive/v3/files/drive-backup-1'&&url.searchParams.get('alt')==='media')
  return reply(route,{kind:'FlyerStudioGoogleDriveBackup',version:1,
   project:{id:project.id,name:project.name,revision:project.revision},document:project.document});
 return reply(route,{error:{message:'Unexpected Drive mock request: '+method+' '+url.pathname}},404);
}

try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage();
 const errors=[],warnings=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(['warning','error'].includes(msg.type()))warnings.push(msg.text());});
 page.on('dialog',d=>d.accept());
 await page.route('https://tzklsscoiwnmeantcefw.supabase.co/**',supabase);
 await page.route('https://www.googleapis.com/**',googleDrive);
 await page.addInitScript(()=>{
  localStorage.setItem('flyer-studio-google-client-id-v1','123456789-ci.apps.googleusercontent.com');
  window.google={accounts:{oauth2:{initTokenClient({callback}){
   return {requestAccessToken(){callback({access_token:'fixture-drive-token',expires_in:3600});}};
  }}}};
 });
 // This fragment uses obvious fake credentials; the browser must scrub it before fetching the user.
 await page.goto(origin+'/#access_token=fixture-access&refresh_token=fixture-refresh&expires_in=3600',{waitUntil:'domcontentloaded'});
 await page.locator('#cloudToolbar').waitFor({timeout:20000});
 await page.locator('#cloudToolbar').click();
 await page.locator('#cloudSignedIn:not([hidden])').waitFor({timeout:10000});
 assert.equal(await page.locator('#cloudAccount').innerText(),user.email);
 const hash=await page.evaluate(()=>location.hash);
 if(hash)console.log('OAUTH DIAGNOSTIC',JSON.stringify({
   hashPresent:!!hash,
   connected:await page.evaluate(()=>window.flyerCloud?.getStatus()),
   notice:await page.locator('#cloudNotice').innerText(),
   warnings,errors
 }));
 assert.equal(hash,'','OAuth tokens must be removed from address bar');

 await page.locator('#cloudProjectName').fill('CI Flyer');
 await page.locator('#cloudNew').click();
 await page.waitForFunction(()=>window.flyerCloud.getStatus().revision===1,{timeout:10000});
 assert.equal(project.name,'CI Flyer');
 await page.locator('#cloudSave').click();
 await page.waitForFunction(()=>window.flyerCloud.getStatus().revision===2,{timeout:10000});
 assert.equal(project.revision,2);

 // Persistent authentication and project reopen after reload.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#cloudToolbar').waitFor({timeout:20000});
 await page.locator('#cloudToolbar').click();
 await page.locator('#cloudSignedIn:not([hidden])').waitFor();
 await page.locator('#cloudProjects button').filter({hasText:'Open'}).first().click();
 await page.waitForFunction(()=>window.flyerCloud.getStatus().project==='CI Flyer',{timeout:10000});

 // Run real Canvas/PDF rendering on both sides; inspect actual downloaded filenames.
 await page.locator('#powerButton-quality').click();
 for(const selectedSide of ['front','back']){
  await page.evaluate(value=>{side=value;},selectedSide);
  const download=page.waitForEvent('download',{timeout:30000});
  await page.locator('#powerExportSide').click();
  const file=await download;
  assert.ok(file.suggestedFilename().includes(selectedSide),selectedSide+' PDF not generated');
 }
 await page.locator('#powerButton-cloud').click();

 // Drive OAuth is simulated at the Google Identity Services callback boundary.
 await page.locator('#driveConnect').click();
 await page.waitForFunction(()=>window.flyerCloud.getStatus().driveAuthorized===true,{timeout:10000});
 await page.locator('#driveBackup').click();
 await page.waitForFunction(()=>window.flyerCloud.getStatus().driveLastBackupRevision===2,{timeout:10000});
 assert.equal(uploads.length,1,'Google Drive should receive exactly one manual backup');

 await page.locator('#driveBrowse').click();
 await page.locator('#driveBackupList button').filter({hasText:'Open a local copy'}).first().click();
 await page.waitForFunction(()=>window.flyerCloud.getStatus().project===null,{timeout:10000});

 await page.locator('#cloudSignOut').click();
 await page.locator('#cloudSignedOut:not([hidden])').waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('flyer-studio-cloud-auth-v1')),null);
 assert.deepEqual(errors,[],'Unexpected app JavaScript errors: '+errors.join('; '));
 console.log('PASS: Browser OAuth callback, cloud save/reopen/revision, front/back PDF, Drive backup/restore, sign-out');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
