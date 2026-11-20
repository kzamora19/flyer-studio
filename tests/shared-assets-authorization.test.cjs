'use strict';
// Tests the EXACT PTG-only identity() function found in the Edge gateway.
// Run: node tests/shared-assets-authorization.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','supabase','functions','flyer-shared-assets','index.ts'),'utf8');
const begin=source.indexOf('async function identity(req:Request){');
const end=source.indexOf('function ensureManager(',begin);
assert.ok(begin>=0&&end>begin,'Find exact live-gateway identity function');
const identitySource=source.slice(begin,end).replace('req:Request','req');
class Denied extends Error{constructor(message,status=403){super(message);this.status=status;}}
const validId='22222222-2222-4222-8222-222222222222';
function makeIdentity(scenario){
 let calls=[];
 const fakeFetch=async (url,options)=>{
  calls.push({url,options});
  if(scenario.networkFailure)throw Error('Network unavailable');
  if(url.includes('/functions/v1/ptg-auth'))
   return {ok:scenario.sessionOk!==false,json:async()=>({
     ok:scenario.payloadOk!==false,account:scenario.malformedAccount?null:{
       role:scenario.role||'BRANCH_ADMIN',legacyRole:scenario.legacyRole||'',
       mustChangePassword:!!scenario.mustChangePassword}})};
  return {ok:scenario.authOk!==false,json:async()=>({id:scenario.authSubject||validId})};
 };
 const identity=new Function('fetch','PTG_URL','PTG_PUBLIC','Denied','ok','AbortSignal',
   identitySource+';return identity;')(
   fakeFetch,'https://ptg.example/functions/v1/ptg-auth','test-publishable-key',
   Denied,value=>typeof value==='object'&&value!==null&&!Array.isArray(value),
   {timeout:()=>null});
 const request={headers:{get(key){
   if(key==='authorization')return scenario.noBearer?'':'Bearer test-access-token';
   if(key==='x-ptg-session-id')return scenario.noAppSession?'':'test-app-session';
   return '';
 }}};
 return {identity,request,calls};
}
(async()=>{
 const cases=[
  ['active Team Leader',{role:'BRANCH_USER',legacyRole:'TEAM LEADER'},true],
  ['active Branch Admin',{role:'BRANCH_ADMIN'},true],
  ['active System Admin',{role:'SYSTEM_ADMIN'},true],
  ['normal Branch User',{role:'BRANCH_USER',legacyRole:'BRANCH USER'},false],
  ['Branch User with wrong legacy role',{role:'BRANCH_USER',legacyRole:'CUSTOMER'},false],
  ['unknown role',{role:'UNKNOWN'},false],
  ['inactive PTG session',{sessionOk:false},false],
  ['revoked PTG session',{sessionOk:false},false],
  ['expired PTG session',{sessionOk:false},false],
  ['PTG session payload not OK',{payloadOk:false},false],
  ['PTG account missing',{malformedAccount:true},false],
  ['forced password change',{mustChangePassword:true},false],
  ['PTG Auth token rejected',{authOk:false},false],
  ['invalid immutable PTG subject',{authSubject:'bad-uuid'},false],
  ['missing bearer token',{noBearer:true},false],
  ['missing app session id',{noAppSession:true},false],
  ['upstream PTG unavailable',{networkFailure:true},false]
 ];
 for(const [label,scenario,expected] of cases){
  const {identity,request,calls}=makeIdentity(scenario);
  let allowed=false;
  try{
   const user=await identity(request);
   allowed=user.manager===true&&user.userId===validId;
  }catch{}
  assert.equal(allowed,expected,label);
  if(scenario.noBearer||scenario.noAppSession)
   assert.equal(calls.length,0,'Missing credentials must reject before remote requests');
 }
 console.log('PASS: 17 PTG identity and denial scenarios, with early rejection of missing credentials.');
})().catch(error=>{console.error(error);process.exitCode=1;});
