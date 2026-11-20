'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const site=path.join(__dirname,'..','site');
const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
const css=fs.readFileSync(path.join(site,'toolbar-tabs.css'),'utf8');
const js=fs.readFileSync(path.join(site,'toolbar-tabs.js'),'utf8');
const shared=fs.readFileSync(path.join(site,'shared-asset-ui.js'),'utf8');
assert.match(html,/<link rel="stylesheet" href="\.\/toolbar-tabs\.css">/,'Tab CSS must load');
assert.match(html,/<script src="\.\/toolbar-tabs\.js" defer><\/script>/,'Tab JS must load');
assert.match(html,/<script src="\.\/floating-panels\.js" defer><\/script>/,'Floating editor behavior must load');
assert.ok(html.indexOf('<script src="./toolbar-tabs.js" defer></script>')>html.indexOf('<script src="./shared-asset-ui.js" defer></script>'),'Tab strip script loads after appendable asset controls');
assert.match(html,/\['cards','Edit Flyer Cards',\[\]\]/,'No duplicate pinned side controls');
assert.match(html,/<button id="front" aria-pressed="true">Front<\/button>/,'Front preserved');
assert.match(html,/<button id="back" aria-pressed="false">Back<\/button>/,'Back preserved');
for(const id of ['arrangeRows','png','pdf'])assert.ok(html.includes('id="'+id+'"'),'Toolbar action '+id+' preserved');
for(const id of ['arrangeSections','addSectionQuick','addHeaderQuick','manageSectionsQuick','powerLauncher','powerPTGQuick','cloudToolbar']){
  assert.ok(html.includes("'"+id+"'")||html.includes('id="'+id+'"'),'Dynamic action '+id+' preserved');
}
assert.ok(shared.includes("launcher.id='sharedAssetLauncher'"),'Shared Asset entry preserved');
assert.match(css,/\.flyer-tab-shell\s*>\s*\.toolbar/,'Toolbar CSS scoped');
assert.match(css,/overflow-x:auto/,'Single-row overflow scrolling retained');
assert.match(css,/flex-wrap:nowrap/,'No unwanted second row');
assert.match(js,/MutationObserver/,'Late-added controls trigger arrow refresh');
assert.match(js,/setAttribute\('role','toolbar'\)/,'Toolbar aria semantics');
new Function(js);
for(const [,code] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new Function(code);
console.log('PASS: horizontal toolbar assets, one-line scrolling, dynamic controls, menu duplicate removal, HTML scripts compile.');
