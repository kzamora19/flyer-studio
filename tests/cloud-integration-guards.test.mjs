import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const source=readFileSync(join(dirname(fileURLToPath(import.meta.url)),'../site/index.html'),'utf8');
function slice(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,'Missing production functions: '+start);
 return source.slice(a,b);
}
const authCode=slice('async function cloudRefreshToken(){','function cloudTable(');
function authHarness(overrides={}){
 const env={refreshCalls:0,fetchCalls:0,storageCleared:0,...overrides};
 const code=[
  "let cloudSession={access_token:'old',refresh_token:'valid',expires_at:1,user:{id:'owner'}};",
  "let cloudUser=cloudSession.user,cloudProject={id:'p'},cloudRevision=3,cloudLastDocument={},cloudConflict=false,cloudTimer=null,cloudRefreshPromise=null;",
  "let driveToken='old-drive',driveTokenExpiry=1,driveFolderId='';",
  "const CLOUD_ROOT='https://test.invalid';",
  "const cloudCreds=()=>({apikey:'publishable'});",
  "const cloudRenderAuth=()=>{};const driveRender=()=>{};const cloudStoreSession=value=>{if(!value)env.storageCleared++;};",
  "const clearTimeout=()=>{};",
  "const cloudAuthRaw=async()=>{env.refreshCalls++;if(env.refreshError)throw env.refreshError;await Promise.resolve();return {access_token:'new',refresh_token:'new-refresh',expires_in:3600,user:{id:'owner'}};};",
  "const cloudApplySession=next=>{cloudSession={...next,expires_at:Math.floor(Date.now()/1000)+3600};cloudUser=next.user;};",
  "const fetch=async(...args)=>{env.fetchCalls++;return env.onFetch?env.onFetch(...args):{ok:true,status:200,text:async()=>'{\\\"ok\\\":true}'};};",
  authCode,
  "return {token:cloudToken,request:cloudRequest,status:()=>({cloudSession,cloudUser,cloudProject})};"
 ].join('\n');
 return {api:new Function('env',code)(env),env};
}
test('concurrent token requests use only one rotating refresh token',async()=>{
 const {api,env}=authHarness();
 const tokens=await Promise.all(Array.from({length:7},()=>api.token()));
 assert.equal(env.refreshCalls,1);
 assert.deepEqual(tokens,Array(7).fill('new'));
});
test('invalid refresh revokes cloud credentials without modifying local flyer state',async()=>{
 const {api,env}=authHarness({refreshError:Object.assign(Error('revoked'),{status:400})});
 await assert.rejects(api.token(),e=>e.isRefreshFailure===true);
 assert.equal(api.status().cloudSession,null);
 assert.equal(env.storageCleared,1);
});
test('401 retries exactly once after token refresh',async()=>{
 let calls=0;
 const {api,env}=authHarness({onFetch:async()=>{
  calls++;return calls===1?{ok:false,status:401,json:async()=>({message:'expired'})}:{ok:true,status:200,text:async()=>'{\"ok\":true}'};
 }});
 // Start with an expired token: a single proactive refresh; the 401 needs a separate retry.
 const value=await api.request('/rest/v1/example');
 assert.deepEqual(value,{ok:true});
 assert.equal(env.fetchCalls,2);
 assert.equal(env.refreshCalls,2);
});
const driveCode=slice('function driveQueueBackup(','async function driveBrowseBackups(){');
function driveHarness(overrides={}){
 const env={uploads:[],statuses:[],timers:[],saveCalls:0,...overrides};
 const code=[
  "let cloudUser={id:'owner'},cloudProject={id:'project',name:'Flyer'},cloudRevision=2,cloudDirty=false,cloudSaving=false,cloudConflict=false;",
  "let cloudLastDocument={format:'json-v1',data:{saved:true}};",
  "let driveAuto=true,driveUploading=false,driveToken='test',driveTokenExpiry=Date.now()+3600000;",
  "let driveLastProjectId='',driveLastBackedRevision=0,driveLastBackupAt=0,drivePendingBackup=null,drivePendingTimer=null;",
  "const DRIVE_AUTO_INTERVAL=900000;",
  "const clearTimeout=()=>{};const setTimeout=(f,ms)=>{env.timers.push({f,ms});return env.timers.length;};",
  "const driveStatus=(msg)=>env.statuses.push(msg);const driveRender=()=>{};const cloudErr=e=>e.message;",
  "const cloudSaveNow=async()=>{env.saveCalls++;cloudDirty=false;};",
  "const driveEnsureFolder=async()=> 'folder';",
  "const driveUploadFile=async(name,record)=>{env.uploads.push({name,record});return {id:'file'};};",
  "const driveBrowseBackups=async()=>{};",
  driveCode,
  "return {backup:driveBackupNow,markDirty:()=>{cloudDirty=true;},status:()=>({cloudDirty,drivePendingBackup,driveLastBackedRevision})};"
 ].join('\n');
 return {api:new Function('env',code)(env),env};
}
test('manual Drive backup uses the committed Supabase snapshot and revision',async()=>{
 const {api,env}=driveHarness();
 await api.backup({force:true});
 assert.equal(env.uploads.length,1);
 assert.equal(env.uploads[0].record.project.revision,2);
 assert.deepEqual(env.uploads[0].record.document,{format:'json-v1',data:{saved:true}});
});
test('manual Drive backup saves pending cloud edits before snapshot',async()=>{
 const {api,env}=driveHarness();
 api.markDirty();
 await api.backup({force:true});
 assert.equal(env.saveCalls,1);
 assert.equal(env.uploads.length,1);
});
test('rapid consecutive auto backups preserve the later revision for deferred upload',async()=>{
 const {api,env}=driveHarness();
 await api.backup({project:{id:'project',name:'Flyer'},revision:2,packed:{format:'json-v1',data:{r:2}}});
 await api.backup({project:{id:'project',name:'Flyer'},revision:3,packed:{format:'json-v1',data:{r:3}}});
 assert.equal(env.uploads.length,1);
 assert.equal(api.status().drivePendingBackup.revision,3);
 assert.equal(env.timers.length,1);
 assert.ok(env.timers[0].ms>0);
});

const restoreCode=slice('async function driveRestoreBackup(file){','function driveMakeUI(){');
function restoreHarness(overrides={}){
 const env={localSaveCalls:0,cloudSaveCalls:0,notices:[],...overrides};
 const parts=[
  "let state={campaign:{old:true},offers:[{sku:'OLD'}]},cloudProject={id:'existing'},cloudDirty=false,cloudSaving=false,cloudConflict=false,cloudSuspend=false;",
  "let selected='',cloudRevision=1,cloudLastDocument={};",
  "const confirm=()=>true;const cloudErr=e=>e.message;",
  "const driveFetch=async()=>({kind:'FlyerStudioGoogleDriveBackup',version:1,document:{format:'json-v1',data:{campaign:{restored:true},offers:[{sku:'RESTORED'}]}}});",
  "const cloudUnpack=async doc=>doc.data;const cloudCheckFlyer=x=>x;",
  "const defaultCampaign={};const brandHeaderChoice=()=>'';const headlineDesignChoice=()=>'';",
  "const registerCustomSections=()=>{};const sanitizeSectionLayout=x=>x;",
  "const offerKey=x=>x?.sku;const save=()=>{env.localSaveCalls++;};const setup=()=>{};const refresh=()=>{};",
  "const cloudSaveNow=async()=>{env.cloudSaveCalls++;cloudDirty=false;};",
  "const cloudDetach=()=>{cloudProject=null;};",
  "const cloudInfo=msg=>env.notices.push(msg);const driveStatus=msg=>env.notices.push(msg);",
  restoreCode,
  "return {restore:driveRestoreBackup,status:()=>({state,cloudProject,cloudSuspend})};"
 ].join('\n');
 return {api:new Function('env',parts)(env),env};
}
test('Drive restore changes only the local editor and detaches cloud sync',async()=>{
 const {api,env}=restoreHarness();
 await api.restore({id:'backup-id',name:'sample.json'});
 assert.equal(api.status().state.offers[0].sku,'RESTORED');
 assert.equal(api.status().cloudProject,null);
 assert.equal(env.localSaveCalls,1);
 assert.equal(env.cloudSaveCalls,0);
 assert.equal(api.status().cloudSuspend,false);
});

const saveCode=slice('async function cloudSaveNow(interactive=true){','async function cloudNewCopy(){');
function saveHarness(options={}){
 const env={calls:[],notices:[],backups:[],queued:0,...options};
 const parts=[
  "let cloudUser={id:'owner'},cloudProject={id:'project',name:'Sample'},cloudRevision=1,cloudLastDocument={format:'json-v1',data:{old:true}},cloudDirty=true,cloudConflict=false,cloudSaving=false,cloudTimer=null,cloudRetryDelay=3500;",
  "const state={campaign:{name:'Test'},offers:[],status:'Draft'};",
  "const cloudStatus=msg=>env.notices.push(msg);const cloudInfo=msg=>env.notices.push(msg);const cloudErr=e=>e.message;const cloudRenderAuth=()=>{};",
  "const clearTimeout=()=>{};const cloudQueue=()=>{env.queued++;};",
  "const cloudPack=async value=>({format:'json-v1',data:value});",
  "const cloudTable=(name,params='')=>name+'?'+params;",
  "const cloudRequest=async(path,options)=>{env.calls.push({path,...options});if(env.fail)throw Error('offline');if(env.conflict)return [];return [{id:'project',name:'Sample',revision:options.data.revision,updated_at:'2026-11-19'}];};",
  "const driveBackupNow=async arg=>{env.backups.push(arg);};",
  saveCode,
  "return {save:cloudSaveNow,status:()=>({cloudRevision,cloudConflict,cloudDirty,cloudRetryDelay})};"
 ].join('\n');
 return {api:new Function('env',parts)(env),env};
}
test('successful cloud save uses one atomic database update without client-side archive race',async()=>{
 const {api,env}=saveHarness();
 await api.save();
 assert.equal(env.calls.length,1);
 assert.equal(env.calls[0].method,'PATCH');
 assert.match(env.calls[0].path,/flyer_cloud_projects/);
 assert.equal(env.calls[0].data.revision,2);
 assert.equal(api.status().cloudRevision,2);
 assert.equal(env.backups[0].revision,2);
});
test('failed network save retains dirty flyer and schedules backoff',async()=>{
 const {api,env}=saveHarness({fail:true});
 await api.save();
 assert.equal(api.status().cloudDirty,true);
 assert.equal(api.status().cloudRetryDelay,15000);
 assert.equal(env.queued,1);
});
test('revision conflict never silently overwrites remote changes',async()=>{
 const {api,env}=saveHarness({conflict:true});
 await api.save();
 assert.equal(api.status().cloudConflict,true);
 assert.equal(api.status().cloudRevision,1);
 assert.equal(env.queued,0);
});
test('opening a different project refuses unsaved edits before any API operation',async()=>{
 const sourceOpen=slice('async function cloudOpenProject(id){','async function cloudDeleteProject(p){');
 const env={status:[],queries:0};
 const run=new Function('env',[
  "let cloudUser={id:'owner'},cloudSaving=false,cloudDirty=true;",
  "const confirm=()=>true;const cloudInfo=message=>env.status.push(message);",
  "const cloudRequest=()=>{env.queries++;throw Error('unexpected');};",
  sourceOpen,
  "return cloudOpenProject;"
 ].join('\n'))(env);
 await run('other-project');
 assert.equal(env.queries,0);
 assert.match(env.status[0],/Unsaved cloud changes/);
});
