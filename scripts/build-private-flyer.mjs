// Staging-only packaging proof. Never deploy the output to GitHub Pages.
// Usage: node scripts/build-private-flyer.mjs [output-directory]
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,relative,sep,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const site=join(root,'site');
const output=resolve(process.argv[2]||join(root,'.studio-private-build'));
const inside=relative(site,output);
if(inside===''||(!inside.startsWith('..'+sep)&&inside!=='..')||!relative(root,output).startsWith('..')&&output===root)
  throw Error('Private package output must not be inside the public site or repository root.');
const sha=value=>createHash('sha256').update(value).digest('hex');
let html=readFileSync(join(site,'index.html'),'utf8');
const originals=[];
function replaceOne(from,to,label){
 const count=html.split(from).length-1;
 if(count!==1)throw Error('Unexpected '+label+' matches: '+count);
 html=html.replace(from,to);originals.push(label);
}
const media={
 './icons/flyer-studio.svg':'image/svg+xml',
 './icons/flyer-studio-192.png':'image/png',
 'assets/techzone-official-logo.png':'image/png'
};
for(const [file,type] of Object.entries(media)){
 const bytes=readFileSync(join(site,file));
 const uri='data:'+type+';base64,'+bytes.toString('base64');
 if(!html.includes(file))throw Error('Missing local image '+file);
 html=html.split(file).join(uri);
 originals.push(file);
}
// Replace the opaque-origin editor's IndexedDB dependency with an explicit
// MessagePort adapter. PTG account-scoped AES-GCM persistence stays only in
// the protected launcher, not the editor or shared github.io browser storage.
const draftBridge=readFileSync(join(root,'staging/editor-storage-bridge.js'),'utf8');
replaceOne('<meta charset="utf-8">',
 '<meta charset="utf-8">\n<script>'+draftBridge+'</script>',
 'private encrypted storage bridge');
const databaseStart=html.indexOf('function loadDatabase() {');
const databaseEnd=html.indexOf('function readReference() {',databaseStart);
if(databaseStart<0||databaseEnd<=databaseStart)
 throw Error('MegaFlyer local draft implementation changed: review before private packaging.');
html=html.slice(0,databaseStart)+
 `function loadDatabase() {
  return window.__MEGAFLYER_PRIVATE_DB__.request('read','p:current').then(record=>{
   database=window.__MEGAFLYER_PRIVATE_DB__.database();return record;
  });
}
`+html.slice(databaseEnd);
originals.push('private IndexedDB replacement');

// srcdoc has an about:srcdoc URL even on GitHub Pages; keep catalog lookups
// on the existing Supabase Edge endpoint and allow the PTG connection form.
replaceOne("const onGitHubFlyer=()=>location.origin==='https://kzamora19.github.io'&&location.pathname.startsWith('/flyer-studio/');",
  "const onGitHubFlyer=()=>true; // Protected bundle always uses Supabase flyer-catalog.",
  'private catalog endpoint resolver');
replaceOne("const ptgLocalOrigin=()=>ptgProxyOrigin()||location.origin==='https://kzamora19.github.io';",
  "const ptgLocalOrigin=()=>true; // PTG Edge login is supported in private srcdoc.",
  'private PTG login resolver');
replaceOne('<link rel="manifest" href="./manifest.webmanifest">','','PWA manifest (no private offline install)');
replaceOne('<link rel="stylesheet" href="./toolbar-tabs.css">',
  '<style>'+readFileSync(join(site,'toolbar-tabs.css'),'utf8')+'</style>','toolbar stylesheet');
for(const name of ['floating-panels.js','shared-asset-ui.js','toolbar-tabs.js']){
 const target='<script src="./'+name+'" defer></script>';
 const code=readFileSync(join(site,name),'utf8');
 // Escape a literal closing script sequence if a future JS module contains one.
 replaceOne(target,'<script>'+code.replace(/<\/script/gi,'<\\/script')+'</script>',name);
}
if(/<(script|link|img)[^>]+(?:src|href)="(?:\.\/|assets\/)/i.test(html))
 throw Error('Protected HTML still references a local public script/image/stylesheet.');
if(!html.includes('MegaFlyer Studio')||!html.includes('sharedAssetLauncher'))
 throw Error('Private package does not contain the expected complete editor.');
html='<!-- PRIVATE EDITOR BUNDLE. NEVER PUBLISH VIA GITHUB PAGES. -->\n'+html;
const privateDir=join(output,'private'),publicDir=join(output,'public');
mkdirSync(privateDir,{recursive:true});mkdirSync(publicDir,{recursive:true});
writeFileSync(join(privateDir,'studio.html'),html);
const publicEntry=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>MegaFlyer Studio — PTG access</title><main style="max-width:35rem;margin:12vh auto;font:16px/1.5 system-ui;padding:24px"><h1>MegaFlyer Studio</h1><p>Open MegaFlyer Studio using an authorized PTG Team Leader, Branch Admin, or System Admin account.</p><p>This preview entry does not provide access to the editor. The protected delivery gateway is not deployed.</p><a href="https://kzamora19.github.io/first-megasaver-ptg/studios/" rel="noreferrer">Open PTG Creative Studios</a></main></html>`;
writeFileSync(join(publicDir,'index.html'),publicEntry);
const manifest={kind:'MegaFlyerPrivateEditorBuild',version:1,bytes:Buffer.byteLength(html),sha256:sha(html),inlined:originals,publicBytes:Buffer.byteLength(publicEntry),publicSha256:sha(publicEntry)};
writeFileSync(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Private Editor packaging check complete: bundle bytes',manifest.bytes,'digest',manifest.sha256.slice(0,16));
console.log('Public entry bytes',manifest.publicBytes,'(not deployed)');
