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
   assert.match(html,/<title>MegaFlyer Studio · Promotional Flyer &amp; Sale Artwork Generator<\/title>/);
   assert.match(html,/<strong>MegaFlyer Studio<\/strong><small>Promotional Flyer &amp; Sale Artwork Generator<\/small>/);
   assert.match(html,/--branchline-navy:#1d2836/);
   assert.match(html,/--branchline-blue:#355ee8/);
   assert.match(html,/--branchline-blue-dark:#2348c7/);
   assert.match(html,/--branchline-blue-soft:#eef2ff/);
   assert.match(html,/body>main>aside button\.primary/);
   assert.ok(!html.includes('<strong>MegaFlyer Studio</strong><small>First Megasaver</small>'));

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
   assert.equal(manifest.inlined.length,14);
   assert.match(html,/smartPhotoPanel/);
   assert.match(html,/studioChatHeader/,'Current ChatGPT-style menu is bundled');
   assert.match(html,/chatMobileClosed/,'Current mobile sidebar collapse is bundled');
   assert.doesNotMatch(html,/script.src='\.\/chat-sidebar\.js'/,'No public dynamic sidebar script');
   assert.doesNotMatch(html,/css.href='\.\/chat-sidebar\.css'/,'No public dynamic sidebar stylesheet');
   assert.match(html,/FLYER_PRODUCT_PHOTO_CONFIG/);
   assert.doesNotMatch(publicHtml,/smartPhotoPanel|Product Photo Library/);
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

test('current ChatGPT-style MegaFlyer navigation is packaged privately without public asset requests',()=>{
 const source=readFileSync(join(root,'scripts/build-private-flyer.mjs'),'utf8');
 assert.ok(source.includes('chat-sidebar.js'));
 assert.ok(source.includes('chat-sidebar.css'));
 assert.match(source,/already embeds the sidebar stylesheet/);
 assert.match(source,/latest ChatGPT-style two-level sidebar/);
});
