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
// Branchline design system from actual Branchline Workspace source:
// navy #1d2836, blue #355ee8, blue-dark #2348c7, soft #eef2ff.
// Apply ONLY to the protected editor interface, never flyer artwork or outputs.
function replaceBrandSingle(from,to,label){
 const count=html.split(from).length-1;
 if(count!==1)throw Error('Unexpected protected '+label+' matches: '+count);
 html=html.replace(from,to);
}
replaceBrandSingle('<title>MegaFlyer Studio · First Megasaver</title>',
 '<title>MegaFlyer Studio · Promotional Flyer &amp; Sale Artwork Generator</title>',
 'document title');
replaceBrandSingle('<strong>MegaFlyer Studio</strong><small>First Megasaver</small>',
 '<strong>MegaFlyer Studio</strong><small>Promotional Flyer &amp; Sale Artwork Generator</small>',
 'approved header/subtitle');
const unifiedStyle=String.raw`
/* BRANCHLINE protected-studio UI only: never style printable flyer canvases. */
:root{
 --branchline-navy:#1d2836;
 --branchline-blue:#355ee8;
 --branchline-blue-dark:#2348c7;
 --branchline-blue-soft:#eef2ff;
 --branchline-line:#e9edf1;
}
body>header{
 height:auto;min-height:70px;
 background:var(--branchline-navy);
 border-bottom:2px solid var(--branchline-blue);
 color:#fff;
}
body>header .brandIdentity strong{
 color:#fff;
 font:800 18px/1.2 "Segoe UI",Arial,sans-serif;
 letter-spacing:-.02em;
}
body>header .brandIdentity small{
 display:block;max-width:43ch;margin-top:4px;
 color:#dce6ff;
 font:700 11px/1.3 "Segoe UI",Arial,sans-serif;
 letter-spacing:.01em;
}
body>header .brandIdentity .brandAppIcon{box-shadow:0 3px 10px #101a3690}
body>main>aside{border-right-color:var(--branchline-line)}
body>main>aside button.primary,
body>main>aside button[aria-pressed="true"]{
 background:var(--branchline-blue);
 border-color:var(--branchline-blue);
 color:#fff;
}
body>main>aside button.primary:hover:not(:disabled){background:var(--branchline-blue-dark)}
body>main>aside button:focus-visible{outline:2px solid var(--branchline-blue);outline-offset:2px}
@media(max-width:720px){
 body>header{min-height:78px;padding:10px 13px;gap:10px}
 body>header .brandIdentity{min-width:0}
 body>header .brandIdentity strong{font-size:16px}
 body>header .brandIdentity small{font-size:10px;max-width:30ch}
}
`;
replaceBrandSingle('</style>',unifiedStyle+'</style>','scoped Branchline UI stylesheet');

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
// The Smart Product Photo Library is private-bundle-only. Do NOT add either
// script to site/index.html, the public Pages artifact, or generic asset uploads.
const matchScript=readFileSync(join(site,'product-photo-match.js'),'utf8');
const photoLibraryScript=readFileSync(join(site,'product-photo-library.js'),'utf8');
if(!html.includes('</body>'))throw Error('Protected MegaFlyer body closing tag missing');
html=html.replace('</body>',
 '<script>window.FLYER_PRODUCT_PHOTO_CONFIG={publishableKey:window.FLYER_SHARED_ASSET_CONFIG?.publishableKey||""};</script>'+
 '<script>'+matchScript.replace(/<\\/script/gi,'<\\\\/script')+'</script>'+
 '<script>'+photoLibraryScript.replace(/<\\/script/gi,'<\\\\/script')+'</script></body>');
originals.push('private Smart Product Photo Library client');
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
