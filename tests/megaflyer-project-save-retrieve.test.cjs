'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../site/index.html'),'utf8');
for(const [,js] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new Function(js);
for(const name of ['quickProjectInit','quickProjectSaveCurrent','quickProjectSaveNew','quickProjectRetrieve','quickProjectOpen','cloudOpenProject','cloudNewCopy']){
 assert.ok(html.includes('function '+name+'('),'Expected '+name+' logic');
}
assert.match(html,/id='quickSaveProject'/,'Save Project toolbar control');
assert.match(html,/id='quickRetrieveProject'/,'Retrieve Project toolbar control');
assert.match(html,/const backupPanel=\$c\('panel-backup'\)/,'Save/Retrieve live in Project Backup');
assert.match(html,/projectInfo\.after\(projectActions\)/,'Cloud actions directly below backup introduction');
assert.doesNotMatch(html,/back\.after\(save,retrieve\)/,'No duplicate Save/Retrieve buttons in top tab bar');
assert.match(html,/id="quickProjectName"/,'Named project input');
assert.match(html,/id="quickProjectList"/,'Saved-project list');
assert.match(html,/id="quickProjectSearch"/,'Project search');
assert.match(html,/id="quickProjectLocalBackup"/,'Offline backup preserved');
assert.match(html,/if\(!ok\|\|cloudDirty\|\|cloudConflict\)/,'Opening must stop after failed pending cloud save');
assert.match(html,/cloudSuspend=true;clearTimeout\(cloudTimer\);cloudBusy\(true\)/,'Save As New pauses old project autosync');
console.log('PASS: MegaFlyer Save/Retrieve control wiring and existing script syntax');
