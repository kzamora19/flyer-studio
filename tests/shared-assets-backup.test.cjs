'use strict';
// No network, no Supabase writes. Run: node tests/shared-assets-backup.test.cjs
// Exercises the exact preflight and restore function bodies in the editor.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','site','shared-asset-ui.js'),'utf8');
function segment(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Find original editor function: '+start);
 return source.slice(a,b);
}
const allowed=['logos','banners','backgrounds','templates','decorations','other'];
const allowedTypes=new Set(['image/png','image/jpeg','image/webp']);
const MAX=10*1024*1024;
const validate=new Function('CATEGORIES','TYPES','MAX','atob',
 segment('function validateBackup(data){','\nasync function restoreBackup(file){')+';return validateBackup;')(
 allowed,allowedTypes,MAX,s=>Buffer.from(s,'base64').toString('latin1'));
const restoreSource=segment('async function restoreBackup(file){','\nasync function remove(asset){');
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64');
const jpg=Buffer.from([255,216,255,0,1,2,3,4,5,6,7,8]).toString('base64');
const webp=Buffer.from([82,73,70,70,0,0,0,0,87,69,66,80,1,2,3,4]).toString('base64');
const asset=(name,mime,base64,category='logos')=>({name,mime,base64,category});
const backup=assets=>({kind:'FlyerStudioSharedAssetBackup',version:1,assets});
const fileOf=data=>({size:JSON.stringify(data).length,text:async()=>JSON.stringify(data)});
let checks=0;
function success(label,fn){fn();checks++;console.log('PASS:',label);}
success('PNG accepted',()=>assert.equal(validate(backup([asset('A','image/png',png)])).length,1));
success('JPEG accepted',()=>assert.equal(validate(backup([asset('A','image/jpeg',jpg)])).length,1));
success('WebP accepted',()=>assert.equal(validate(backup([asset('A','image/webp',webp)])).length,1));
success('empty valid backup accepted',()=>assert.deepEqual(validate(backup([])),[]));
success('mislabeled PNG refused',()=>assert.throws(()=>validate(backup([asset('A','image/png',jpg)])),/signature/));
success('second invalid asset blocks whole backup',()=>assert.throws(()=>validate(backup([asset('A','image/png',png),asset('B','image/png',jpg)])),/position 2/));
success('blank name refused',()=>assert.throws(()=>validate(backup([asset(' ','image/png',png)])),/position 1/));
success('unsupported category refused',()=>assert.throws(()=>validate(backup([asset('A','image/png',png,'untrusted')])),/position 1/));
success('unsupported MIME refused',()=>assert.throws(()=>validate(backup([asset('A','image/svg+xml',png)])),/position 1/));
success('bad base64 padding refused',()=>assert.throws(()=>validate(backup([asset('A','image/png',png+'===')])),/encoded/));
success('26 assets refused',()=>assert.throws(()=>validate(backup(Array.from({length:26},()=>asset('A','image/png',png)))),/supported/));
success('wrong backup version refused',()=>assert.throws(()=>validate({...backup([]),version:2}),/supported/));
success('oversized individual image refused',()=>{
 const big=Buffer.alloc(MAX+1);Buffer.from([137,80,78,71,13,10,26,10]).copy(big);
 assert.throws(()=>validate(backup([asset('large','image/png',big.toString('base64'))])),/size|10 MB|encoded/);
});
function harness({manager=true,denyAt=0,confirmValue=true}={}){
 const sent=[],notices=[],refreshed=[];
 const gateway=async(action,fields)=>{
  if(denyAt&&sent.length===denyAt)throw Error('Network unavailable');
  sent.push({action,fields});return {ok:true};
 };
 const restore=new Function('canManage','say','validateBackup','gateway','confirm','refresh',
  restoreSource+';return restoreBackup;')(
  manager,(message,ok)=>notices.push({message,ok}),validate,gateway,
  ()=>confirmValue,async()=>{refreshed.push(true);});
 return {restore,sent,notices,refreshed};
}
(async()=>{
 const good=backup([asset('A','image/png',png),asset('B','image/jpeg',jpg)]);
 const invalid=backup([asset('A','image/png',png),asset('bad','image/png',jpg)]);
 {
  const t=harness();await t.restore(fileOf(invalid));
  assert.equal(t.sent.length,0,'A corrupt later image cannot trigger earlier writes');
  assert.match(t.notices.at(-1).message,/Restore failed/);checks++;
 }
 {
  const t=harness({manager:false});await t.restore(fileOf(good));
  assert.equal(t.sent.length,0);assert.match(t.notices.at(-1).message,/permission required/);checks++;
 }
 {
  const t=harness({confirmValue:false});await t.restore(fileOf(good));
  assert.equal(t.sent.length,0);checks++;
 }
 {
  const t=harness({denyAt:1});await t.restore(fileOf(good));
  assert.equal(t.sent.length,1);assert.equal(t.refreshed.length,1);
  assert.match(t.notices.at(-1).message,/interrupted after 1 of 2/);checks++;
 }
 {
  const t=harness();await t.restore(fileOf(good));
  assert.equal(t.sent.length,2);assert.equal(t.refreshed.length,1);
  assert.match(t.notices.at(-1).message,/Restored 2 shared assets/);checks++;
 }
 console.log('PASS:',checks,'shared asset backup preflight and restore assertions. No network calls made.');
})().catch(error=>{console.error(error);process.exitCode=1;});
