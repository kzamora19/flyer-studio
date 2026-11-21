// DEVELOPMENT ONLY: generate the editor-free GitHub Pages cutover artifact.
// The normal deployed site/ directory is NEVER mutated by this script.
import {copyFileSync,mkdirSync,rmSync,writeFileSync,readFileSync} from "node:fs";
import {join,resolve,relative,sep,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const target=resolve(process.argv[2]||join(root,"staging",".cutover-preview"));
const rel=relative(root,target);
if(process.env.PTG_STUDIO_CUTOVER_PREVIEW!=="1")
 throw Error("Cutover preview is not authorized");
if(!rel||rel==="."||rel===".."||rel.startsWith(".."+sep)||
   !rel.startsWith("staging"+sep)||rel==="_site"||rel==="site")
 throw Error("Cutover preview must remain in the staging folder");
const page=String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#1d2836">
<title>MegaFlyer Studio — PTG access</title>
<link rel="icon" type="image/svg+xml" href="./icons/flyer-studio.svg">
<link rel="manifest" href="./manifest.webmanifest">
<style>:root{font-family:"Segoe UI",Arial,sans-serif;color:#1d2836;background:#eef2ff}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:22px}
main{width:min(100%,490px);padding:26px;border-radius:16px;background:#fff;border:1px solid #e9edf1;box-shadow:0 14px 40px #17263b14}
h1{font-size:23px}p{font-size:14px;line-height:1.6;color:#40506b}
img{width:45px;height:45px;border-radius:10px}a{display:inline-block;padding:12px 16px;background:#355ee8;color:white;text-decoration:none;border-radius:8px}
a:hover{background:#2348c7}</style></head><body>
<main><img src="./icons/flyer-studio.svg" alt="MegaFlyer Studio icon">
<h1>MegaFlyer Studio</h1><p>Promotional Flyer &amp; Sale Artwork Generator</p>
<p>The public MegaFlyer editor is retired. Sign in to Branchline PTG with an authorized Team Leader, Branch Admin or System Admin account to open the protected Creative Studio.</p>
<p>Complete backups and device migration before the approved cutover. This entry does not delete any browser projects or customer artwork.</p>
<a href="https://kzamora19.github.io/first-megasaver-ptg/studios/" rel="noreferrer">Open PTG Creative Studios</a>
</main></body></html>`;
const manifest=JSON.stringify({
 id:"./",name:"MegaFlyer Studio — PTG access",short_name:"MegaFlyer Studio",
 description:"Open the protected promotional flyer editor through PTG",
 start_url:"./",scope:"./",display:"standalone",
 background_color:"#1d2836",theme_color:"#1d2836",
 icons:[
  {src:"./icons/flyer-studio-192.png",sizes:"192x192",type:"image/png",purpose:"any"},
  {src:"./icons/flyer-studio-512.png",sizes:"512x512",type:"image/png",purpose:"any"},
  {src:"./icons/flyer-studio.svg",sizes:"any",type:"image/svg+xml",purpose:"any"}
 ]
},null,2)+"\n";
rmSync(target,{recursive:true,force:true});
mkdirSync(join(target,"icons"),{recursive:true});
writeFileSync(join(target,"index.html"),page);
writeFileSync(join(target,"manifest.webmanifest"),manifest);
writeFileSync(join(target,".nojekyll"),"");
for(const file of ["flyer-studio-192.png","flyer-studio-512.png","flyer-studio.svg"])
 copyFileSync(join(root,"site","icons",file),join(target,"icons",file));
// GitHub Pages serves the ticket loader, never the protected Flyer editor.
const publishableKey=process.env.MEGAFLYER_STUDIO_PUBLISHABLE_KEY||"";
if(process.env.PTG_STUDIO_PRODUCTION_RELEASE==="1" &&
 !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(publishableKey))
 throw Error("Production cutover requires explicit MegaFlyer publishable key");
const source=readFileSync(join(root,"staging","studio-access","index.html"),"utf8");
if(!/publishableKey:"sb_publishable_[A-Za-z0-9_-]+"/.test(source))
 throw Error("Protected Flyer launcher configuration drift");
const launcher=source
 .replace("— Protected launch prototype","— protected Branchline access")
 .replace(/publishableKey:"sb_publishable_[A-Za-z0-9_-]+"/,"publishableKey:"+JSON.stringify(publishableKey));
if(/PRIVATE EDITOR BUNDLE|id="quickSaveProject"|id="png"|<canvas/.test(launcher))
 throw Error("Private editor source cannot appear in public launcher");
mkdirSync(join(target,"studio"),{recursive:true});
writeFileSync(join(target,"studio","index.html"),launcher);
for(const asset of ["launch.js","draft-vault.js","central-drive.js"])
 copyFileSync(join(root,"staging","studio-access",asset),join(target,"studio",asset));

console.log("STAGED editor-free Pages cutover preview generated; no production update.");
