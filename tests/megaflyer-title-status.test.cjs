'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','site','index.html'),'utf8');
const heading='<h1>MegaFlyer Studio</h1>';
assert.equal(html.split(heading).length-1,2,
 'Both initial and dynamically rebuilt left-panel headings must identify MegaFlyer Studio');
assert.ok(!html.includes('<h1>Sale flyer</h1>'),
 'The obsolete generic left-panel heading is removed');
assert.match(html, /<span class="status" id="status" role="status" aria-live="polite" aria-label="Flyer status: Draft"[^>]*>Flyer Status: Draft<\/span>/,
 'Initial status badge identifies its purpose, with an accessible project status');
assert.match(html,/statusBadge\.textContent='Flyer Status: '\+state\.status;/,
 'Badge always follows actual persisted review status');
assert.match(html,/statusBadge\.setAttribute\('aria-label','Flyer status: '\+state\.status\)/,
 'Badge remains accessible after review status changes');
for(const status of ['Draft','In review','Changes requested','Approved']){
 assert.ok(html.includes("'"+status+"':"),'Help text for '+status+' review state retained');
}
assert.match(html,/\$\('approve'\)\.disabled=reviewActionBusy\|\|reviewPending\|\|blocked\|\|!reviewRights\.canApprove\|\|!\(state\.status==='In review'\|\|state\.status==='Approved'&&!state\.approvalReceipt\)/,
 'Approval requires verified authority, no blocking issues, and a submitted or legacy approved project');
// Exercise the renderer's actual predicate rather than assuming a positive equality spelling.
const watermarkCondition=html.match(/if\((exportMode==='draft'[^\n]+)\) \{\s*ctx\.save\(\);ctx\.translate/);
assert.ok(watermarkCondition,'Renderer must have an explicit draft watermark predicate');
const vm=require('node:vm');
for(const status of ['Draft','In review','Changes requested','Approved']){
 for(const inScope of [false,true]){
  for(const exportMode of ['draft','authorized-final',null]){
   const expected=exportMode==='draft'||(exportMode!=='authorized-final'&&(status!=='Approved'||!inScope));
   assert.equal(vm.runInNewContext(watermarkCondition[1],{exportMode,project:{status},page:'front',reviewPages:()=>inScope?['front']:['back']}),expected,
    'Watermark policy: '+JSON.stringify({status,inScope,exportMode}));
  }
 }
}
assert.match(html,/let renderMode='draft';/,'Every export begins in draft mode');
assert.match(html,/await authorizeReview\('final',snapshot,diagnostics,format,\{approvalId:snapshot\.approvalReceipt\}\);renderMode='authorized-final';/,'Final mode follows trusted receipt verification');
assert.match(html,/await authorizeReview\('override',snapshot,diagnostics,format,\{reason,acknowledged:true\}\);renderMode='authorized-final';/,'Override mode follows trusted authorization and acknowledgment');
assert.match(html,/await render\(snapshot,face,width,undefined,renderMode\)/,'Export passes the verified mode into the renderer');
assert.match(html,/await authorizeReview\('final'/,'Final export verifies an approval receipt');
assert.match(html,/await authorizeReview\('override'/,'Override export requests trusted authorization');
console.log('PASS: MegaFlyer sidebar title and informative, accessible review status badge preserve approvals and watermarking.');
