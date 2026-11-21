import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(new URL('..',import.meta.url).pathname);
const script=join(root,'scripts/build-private-flyer.mjs');
const sha=data=>createHash('sha256').update(data).digest('hex');

test('private/editor split contains complete artwork only in private package',()=>{
 const out=mkdtempSync(join(tmpdir(),'megaflyer-private-'));
 try{
   execFileSync(process.execPath,[script,out],{cwd:root,stdio:'pipe'});
   const html=readFileSync(join(out,'private','studio.html'),'utf8');
   const publicHtml=readFileSync(join(out,'public','index.html'),'utf8');
   const manifest=JSON.parse(readFileSync(join(out,'manifest.json'),'utf8'));
   assert.match(html,/MegaFlyer Studio/);
   assert.match(html,/sharedAssetLauncher/);
   assert.match(html,/data:image\/svg\+xml;base64,/);
   assert.match(html,/data:image\/png;base64,/);
   assert.match(html,/PRIVATE EDITOR BUNDLE/);
   assert.doesNotMatch(html,/<script src="\.\/(?:shared-asset-ui|floating-panels|toolbar-tabs)\.js"/);
   assert.doesNotMatch(html,/<link rel="manifest"/);
   assert.ok(html.length>1000000,'Full app source only in private package');
   assert.ok(publicHtml.length<2500);
   assert.doesNotMatch(publicHtml,/sharedAssetLauncher|function render\(|PTG_STUDIO_GATEWAY_SECRET|STATE_MASTER/);
   assert.match(publicHtml,/protected delivery gateway is not deployed/);
   assert.equal(manifest.sha256,sha(html));
   assert.equal(manifest.publicSha256,sha(publicHtml));
   assert.equal(manifest.inlined.length,12);
   assert.match(html,/__MEGAFLYER_PRIVATE_DB__/);
   assert.doesNotMatch(html,/indexedDB.open\('megasaver-flyer-studio'/);
   assert.match(html,/megaflyer-private-storage-port/);
   assert.match(html,/const onGitHubFlyer=\(\)=>true/);
   assert.match(html,/const ptgLocalOrigin=\(\)=>true/);
 }finally{rmSync(out,{recursive:true,force:true});}
});

test('do not generate private content into GitHub Pages publish folder',()=>{
 assert.throws(()=>execFileSync(process.execPath,[script,join(root,'site','private-test')],{
   cwd:root,encoding:'utf8',stdio:'pipe'
 }),error=>/Private package output must not be inside/.test(error.stderr||''));
});
