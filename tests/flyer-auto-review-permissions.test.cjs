'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../site/studio/launch.js'),'utf8');
const start=source.indexOf('function installOperationsRelay(){');
const end=source.indexOf('function withCatalogRelay(',start);
assert.ok(start>=0&&end>start);
function harness(initial=''){
 const listeners=new Map(),reviewer={value:initial},status={textContent:''},parent={},sent=[];
 const window={addEventListener:(type,cb)=>listeners.set(type,cb),removeEventListener:type=>listeners.delete(type)};
 const port={start(){},postMessage(m){sent.push(m);queueMicrotask(()=>this.onmessage({data:{id:m.id,ok:true,value:{canApprove:false,canOverride:false}}}));}};
 let checks=0,rights;
 const context={window,parent,document:{getElementById:id=>id==='reviewer'?reviewer:status},setTimeout,clearTimeout,verifyReviewPermissions:async()=>{checks++;rights=await window.__MEGAFLYER_OPERATIONS_RPC__({action:'permissions'});}};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+'\ninstallOperationsRelay();',context);
 const ready=()=>listeners.get('flyerstudio:ready')?.();
 const connect=(sender=parent)=>listeners.get('message')?.({source:sender,data:{kind:'megaflyer-protected-operations-port',reviewerName:'Verified admin'},ports:[port]});
 return {ready,connect,reviewer,status,sent,get checks(){return checks},get rights(){return rights}};
}
test('automatically requests server permissions once, even if port arrives before editor',async()=>{
 const h=harness();h.connect({});h.ready();assert.equal(h.checks,0);
 h.connect();h.ready();await new Promise(setImmediate);
 assert.equal(h.checks,1);assert.equal(h.reviewer.value,'Verified admin');
 assert.equal(h.sent.length,1);assert.equal(h.sent[0].fields.action,'permissions');
 assert.equal(h.rights.canApprove,false,'display name does not grant authority');
});
test('preserves manually entered reviewer and works with port before ready',async()=>{
 const h=harness('Existing reviewer');h.connect();assert.equal(h.checks,0);
 h.ready();h.ready();await new Promise(setImmediate);
 assert.equal(h.checks,1);assert.equal(h.reviewer.value,'Existing reviewer');
 assert.equal(h.rights.canOverride,false);
});
