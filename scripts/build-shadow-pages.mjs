// DEVELOPMENT: preserve current public MegaFlyer editor exactly while staging
// an ADDITIVE /studio/ protected launcher. Never deploy in this script.
import {mkdtempSync,cpSync,rmSync,existsSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve,join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const output=resolve(process.argv[2]||join(root,"staging",".shadow-pages"));
if(process.env.PTG_STUDIO_SHADOW_PREVIEW!=="1")
 throw Error("Shadow build requires explicit PTG_STUDIO_SHADOW_PREVIEW=1");
if(output===root||output===join(root,"site")||output.startsWith(join(root,"site")+"/"))
 throw Error("Refusing to overwrite production MegaFlyer editor source");
if(!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(process.env.MEGAFLYER_STUDIO_PUBLISHABLE_KEY||""))
 throw Error("Shadow launcher requires the actual public MegaFlyer publishable key");
const temp=mkdtempSync(join(root,"staging",".shadow-build-"));
try {
 const preview=join(temp,"cutover");
 execFileSync(process.execPath,[join(root,"scripts/build-cutover-pages.mjs"),preview],{
  cwd:root,stdio:"pipe",env:{...process.env,PTG_STUDIO_CUTOVER_PREVIEW:"1",
    PTG_STUDIO_PRODUCTION_RELEASE:"0"}
 });
 if(!existsSync(join(preview,"studio","launch.js")))throw Error("No private launcher");
 if(existsSync(join(root,"site","studio")))throw Error("Unexpected production studio directory");
 rmSync(output,{recursive:true,force:true});
 cpSync(join(root,"site"),output,{recursive:true});
 cpSync(join(preview,"studio"),join(output,"studio"),{recursive:true});
 const html=readFileSync(join(output,"studio","index.html"),"utf8");
 if(!html.includes("STUDIO_ACCESS_CONFIG")||
   !html.includes(process.env.MEGAFLYER_STUDIO_PUBLISHABLE_KEY)||
   html.includes("<!-- PRIVATE EDITOR BUNDLE"))
  throw Error("Shadow launcher is missing public config or embeds editor source");
 console.log("Shadow-only MegaFlyer artifact created. Original editor remains byte-identical. NOT DEPLOYED.");
} finally {rmSync(temp,{recursive:true,force:true});}
