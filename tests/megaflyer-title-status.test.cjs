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
assert.match(html, /<span class="status" id="status" role="status" aria-live="polite" aria-label="Project status: Draft"[^>]*>Status: Draft<\/span>/,
 'Initial status badge identifies its purpose, with an accessible project status');
assert.match(html,/statusBadge\.textContent='Status: '\+state\.status;/,
 'Badge always follows actual persisted review status');
assert.match(html,/statusBadge\.setAttribute\('aria-label','Project status: '\+state\.status\)/,
 'Badge remains accessible after review status changes');
for(const status of ['Draft','In review','Changes requested','Approved']){
 assert.ok(html.includes("'"+status+"':"),'Help text for '+status+' review state retained');
}
assert.ok(html.includes("$('approve').disabled=state.status!=='In review'"),
 'Approval workflow is still restricted to in-review flyers');
assert.ok(html.includes("if(project.status!=='Approved')"),
 'Unapproved flyer DRAFT watermark logic remains intact');
console.log('PASS: MegaFlyer sidebar title and informative, accessible review status badge preserve approvals and watermarking.');
