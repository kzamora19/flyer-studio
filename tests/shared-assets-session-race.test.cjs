'use strict';
// Run: node tests/shared-assets-session-race.test.cjs
// No network: simulate PTG session changes while async requests are outstanding.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..','site');
const shared=fs.readFileSync(path.join(root,'shared-asset-ui.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function extract(source,start,end){
 const i=source.indexOf(start),j=source.indexOf(end,i+start.length);
 assert.ok(i>=0&&j>i,'Find '+start);
 return source.slice(i,j);
}
function pending(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}
const refreshSource=extract(shared,'async function refresh(){','\nfunction button(row,label,fn){');
const imageSource=extract(shared,'async function assetImage(asset){','\nasync function preview(asset){');
const eventSource=extract(html,'function ptgConnected(session,message) {','\nasync function signInPTG(event) {');
const logoutEvents=[];
{
 const nodes={ptgLogin:{hidden:false},ptgDisconnect:{hidden:false},ptgConnection:{textContent:''}};
 const factory=new Function('window','Event','$','invalidateLookup','powerStatus',
  eventSource+';return ptgConnected;');
 const callback=factory({dispatchEvent:e=>logoutEvents.push(e.type)},
  class Event{constructor(type){this.type=type}},
  name=>nodes[name],()=>{},()=>{});
 callback(null,'Disconnected from PTG');
 assert.deepEqual(logoutEvents,['megaflyer:ptg-session-changed']);
}
let cases=1;
function mockRefresh(delays){
 const session={id:'session-a'};
 const elements={
   sharedAssetRefresh:{disabled:false},sharedAssetAdd:{hidden:false},
   sharedAssetManagerHint:{textContent:''},sharedAssetFilter:{value:''},
   sharedAssetSearch:{value:''}
 };
 let rows=[],canManage=false,lastSessionId='session-a',busy=false;
 const calls=[],notices=[],renders=[],clear=[];
 const gateway=async action=>{
   calls.push(action);
   if(action==='permissions')return delays.permissions?delays.permissions.promise:{canManage:true};
   if(action==='list')return delays.list?delays.list.promise:{assets:[{id:'a'}]};
   throw Error('Unexpected action');
 };
 const make=new Function('ptgSession','el','gateway','render','clearPreview','say','busy','rows','canManage','lastSessionId',
  refreshSource+';return {refresh,inspect:()=>({rows,canManage})};');
 const obj=make(session,id=>elements[id],gateway,()=>renders.push(true),
  ()=>clear.push(true),(message,ok)=>notices.push({message,ok}),
  busy,rows,canManage,lastSessionId);
 return {session,elements,calls,notices,renders,clear,...obj};
}
(async()=>{
 {
  const p=pending(),t=mockRefresh({permissions:p});
  const task=t.refresh();
  t.session.id='session-b';p.resolve({canManage:true});
  await task;
  assert.deepEqual(t.calls,['permissions'],'Do not proceed to old session list');
  assert.deepEqual(t.inspect().rows,[]);
  assert.equal(t.inspect().canManage,false);
  assert.equal(t.elements.sharedAssetAdd.hidden,true);
  cases++;
 }
 {
  const p=pending(),t=mockRefresh({list:p});
  const task=t.refresh();
  await Promise.resolve();await Promise.resolve();
  t.session.id='session-b';p.resolve({assets:[{id:'old-account'}]});
  await task;
  assert.deepEqual(t.inspect().rows,[],'Do not render a stale asset');
  assert.equal(t.inspect().canManage,false);
  assert.ok(!t.notices.some(n=>n.message.includes('shared asset(s) found.')));
  cases++;
 }
 {
  const signed=pending(),session={id:'session-a'},calls=[];
  const image=new Function('ptgSession','gateway','fetch',imageSource+';return assetImage;')(
   session,()=>signed.promise,()=>{calls.push('fetch');return Promise.resolve({ok:true,blob:async()=>({type:'image/png'})})});
  const task=image({id:'asset-a'});
  session.id='session-b';signed.resolve({url:'https://example.test/expired'});
  await assert.rejects(task,/PTG session changed while loading image/);
  assert.equal(calls.length,0,'Do not fetch signed image after session switch');
  cases++;
 }
 {
  const downloaded=pending(),session={id:'session-a'};
  const image=new Function('ptgSession','gateway','fetch',imageSource+';return assetImage;')(
   session,async()=>({url:'https://example.test/signed'}),async()=>({ok:true,blob:()=>downloaded.promise}));
  const task=image({id:'asset-a'});
  await Promise.resolve();await Promise.resolve();
  session.id='session-b';downloaded.resolve({type:'image/png'});
  await assert.rejects(task,/PTG session changed while loading image/);
  cases++;
 }
 console.log('PASS:',cases,'PTG event, stale-list and stale-preview race checks.');
})().catch(error=>{console.error(error);process.exitCode=1;});
