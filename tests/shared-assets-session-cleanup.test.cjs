'use strict';
// Repeatable, no-network session cleanup regression.
// Run: node tests/shared-assets-session-cleanup.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','site','shared-asset-ui.js'),'utf8');
function extract(begin,end){
 const i=src.indexOf(begin),j=src.indexOf(end,i+begin.length);
 assert.ok(i>=0&&j>i,'Expected editor function '+begin);
 return src.slice(i,j);
}
const cleanup=extract('function clearPreview(){','\nasync function refresh(){');
const refreshSource=extract('async function refresh(){','\nfunction button(row,label,fn){');
let passes=0;
{
 const revoked=[],image={hidden:false,removed:[],removeAttribute(key){this.removed.push(key)}};
 const chosen={value:'Private asset'};
 const el=id=>id==='sharedAssetPreview'?image:chosen;
 const clear=new Function('el','URL','previewURL','selected',cleanup+';clearPreview();return {previewURL,selected};');
 const result=clear(el,{revokeObjectURL:url=>revoked.push(url)},'blob:private', {id:'old'});
 assert.equal(result.previewURL,'');assert.equal(result.selected,null);
 assert.deepEqual(revoked,['blob:private']);assert.equal(image.hidden,true);
 assert.deepEqual(image.removed,['src']);assert.equal(chosen.value,'');
 passes++;
}
function makeRefresh({session='new',previous='old',fail=false}={}){
 const elements={
  sharedAssetRefresh:{disabled:false},sharedAssetAdd:{hidden:false},
  sharedAssetManagerHint:{textContent:'Authorized asset manager'},
  sharedAssetFilter:{value:''},sharedAssetSearch:{value:'',trim(){return ''}}
 };
 const calls={cleanup:0,render:0,requests:[],notice:[]};
 const gateway=async action=>{
  calls.requests.push(action);
  if(fail)throw Error('PTG session inactive');
  if(action==='permissions')return {canManage:true};
  return {assets:[{name:'asset'}]};
 };
 const factory=new Function('busy','ptgSession','lastSessionId','clearPreview','rows','canManage','el','render','gateway','say',
  refreshSource+';return refresh;');
 const refresh=factory(false,{id:session},previous,()=>calls.cleanup++,[],true,
  id=>elements[id],()=>calls.render++,gateway,
  (message,ok)=>calls.notice.push({message,ok}));
 return {refresh,elements,calls};
}
(async()=>{
 let t=makeRefresh();await t.refresh();
 assert.equal(t.calls.cleanup,1,'Session switch clears preview before listing');
 assert.deepEqual(t.calls.requests,['permissions','list']);
 assert.equal(t.elements.sharedAssetManagerHint.textContent,'Authorized asset manager');
 passes++;
 t=makeRefresh({session:'same',previous:'same'});await t.refresh();
 assert.equal(t.calls.cleanup,0,'Unchanged session preserves current preview');
 passes++;
 t=makeRefresh({session:'same',previous:'same',fail:true});await t.refresh();
 assert.equal(t.calls.cleanup,1,'Authorization failure clears preview');
 assert.equal(t.elements.sharedAssetAdd.hidden,true);
 assert.equal(t.elements.sharedAssetManagerHint.textContent,'PTG Team Leader or higher sign-in required.');
 assert.match(t.calls.notice.at(-1).message,/inactive/);
 passes++;
 console.log('PASS:',passes,'session/authorization preview-cleanup checks. No network calls made.');
})().catch(e=>{console.error(e);process.exitCode=1;});
