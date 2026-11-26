'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const policy=import('../supabase/functions/flyer-studio-operations/policy.mjs');
const projectId='16a3aadd-52fe-4d12-80af-43369cafbc78';
const approvalId='16a3aadd-52fe-4d12-80af-43369cafbc79';
const base={projectId,digest:'a'.repeat(64),scope:'both',warnings:[],blocking:[]};
test('canonical roles, no display-name authority',async()=>{
 const {validRole,permissions}=await policy;
 for(const role of ['SYSTEM_ADMIN','BRANCH_ADMIN','BRANCH_USER'])assert.ok(validRole(role));
 for(const role of ['Team Leader','System Admin','admin','system_admin','',null,undefined,{}]){
  assert.equal(validRole(role),false);
  assert.deepEqual(permissions(role),{canApprove:false,canOverride:false});
 }
 assert.deepEqual(permissions('SYSTEM_ADMIN'),{canApprove:true,canOverride:true});
 assert.deepEqual(permissions('BRANCH_ADMIN'),{canApprove:true,canOverride:false});
 assert.deepEqual(permissions('BRANCH_USER'),{canApprove:false,canOverride:false});
});
test('review scope, blocking errors and authorization request validation',async()=>{
 const {validReviewPayload:valid}=await policy;
 for(const scope of ['front','back','both']){
  const approve={...base,scope,action:'approve',format:'approval'};
  assert.ok(valid(approve));
  for(const format of ['png','pdf']){
   const final={...base,scope,action:'final',format,approvalId};
   assert.ok(valid(final));
   assert.equal(valid({...final,blocking:['Unresolved product']}),false);
   assert.equal(valid({...final,approvalId:'fake'}),false);
   const override={...base,scope,action:'override',format,reason:'Approved exception for missing photo',acknowledged:true,blocking:['Missing photo']};
   assert.ok(valid(override));
   for(const bad of [{acknowledged:false},{reason:'short'},{reason:' '.repeat(12)},{reason:'x'.repeat(1001)}])assert.equal(valid({...override,...bad}),false);
  }
  for(const bad of [{scope:'all'},{projectId:'bad'},{digest:'f'.repeat(63)},{digest:'z'.repeat(64)},{blocking:['x']},{warnings:['x'.repeat(401)]},{warnings:Array(101).fill('x')},{format:'png'}])assert.equal(valid({...approve,...bad}),false);
 }
});
test('asset requests accept only known categories and UUID identifiers',async()=>{
 const {validReviewPayload:valid}=await policy;
 for(const category of ['','logos','banners','backgrounds','templates','decorations','other'])assert.ok(valid({action:'assets-list',category}));
 for(const category of ['../private','unknown',null,undefined])assert.equal(valid({action:'assets-list',category}),false);
 assert.ok(valid({action:'asset-image',assetId:projectId}));
 assert.equal(valid({action:'asset-image',assetId:'../secret.png'}),false);
 for(const bad of [null,[],{},'approve',{action:'unknown'}])assert.equal(valid(bad),false);
});

test('verified Santiago branch contact defaults are isolated to exact branch code',async()=>{
 const {footerContactForBranch}=await policy;
 assert.equal(footerContactForBranch('STG'),'0919-081-7993 / 0919-079-5426');
 for(const code of ['STG001','SANTIAGO','stg','',null,undefined,{},'CAU'])assert.equal(footerContactForBranch(code),'');
});
test('fresh footer defaults never overwrite restored or concurrently edited projects',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'../site/index.html'),'utf8');
 const start=source.indexOf('async function applyNewProjectBranchFooter(project)');
 const end=source.indexOf('async function verifyReviewPermissions()',start);
 assert.ok(start>=0&&end>start);
 const create=()=>({status:'Draft',campaign:{footerDesign:{front:{mode:'standard',right:''},back:{mode:'standard',right:''}}}});
 let state=create(),finish,editedCount=0;
 const context={state,branchFooterContact:'',window:{__MEGAFLYER_OPERATIONS_RPC__:()=>{}},protectedOperation:()=>new Promise(resolve=>{finish=resolve;}),edited:()=>editedCount++,currentMenu:'cards',currentSub:''};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 const contact='0919-081-7993 / 0919-079-5426';
 const p=context.applyNewProjectBranchFooter(state);
 state.campaign.footerDesign.back={mode:'standard',right:'Custom number'};
 finish({footerContact:contact});await p;
 assert.equal(state.campaign.footerDesign.front.right,contact);
 assert.equal(state.campaign.footerDesign.back.right,'Custom number');assert.equal(editedCount,1);
 const old=state, pending=context.applyNewProjectBranchFooter(old);
 context.state=create();finish({footerContact:contact});await pending;
 assert.equal(context.state.campaign.footerDesign.front.right,'');
 assert.equal(old.campaign.footerDesign.back.right,'Custom number');assert.equal(editedCount,1);
 assert.ok(source.includes('if(newProject)void applyNewProjectBranchFooter(state)'),'Stored projects are excluded from startup defaults');
});
