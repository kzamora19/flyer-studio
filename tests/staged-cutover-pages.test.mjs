import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync,rmSync} from "node:fs";
import {resolve,join} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const script=join(root,"scripts","build-cutover-pages.mjs");
const target=join(root,"staging",".cutover-test-output");
const generate=(env,where=target)=>execFileSync(process.execPath,[script,where],{
 cwd:root,stdio:"pipe",timeout:20000,
 env:{...process.env,PTG_STUDIO_CUTOVER_PREVIEW:env}
});
test("cutover artifact generator cannot run by accident or overwrite public site",()=>{
 assert.throws(()=>generate(""),{name:"Error"});
 assert.throws(()=>generate("1",join(root,"site")),{name:"Error"});
 assert.throws(()=>generate("1",join(root,"_site")),{name:"Error"});
});
test("cutover preview publishes only identity assets and one PTG access page",()=>{
 try{
  generate("1");
  assert.deepEqual(readdirSync(target).sort(),[".nojekyll","icons","index.html","manifest.webmanifest"]);
  assert.deepEqual(readdirSync(join(target,"icons")).sort(),[
   "flyer-studio-192.png","flyer-studio-512.png","flyer-studio.svg"
  ]);
  const html=readFileSync(join(target,"index.html"),"utf8");
  assert.match(html,/Promotional Flyer &amp; Sale Artwork Generator/);
  assert.match(html,/first-megasaver-ptg\/studios\//);
  assert.match(html,/MegaFlyer Studio/);
  assert.doesNotMatch(html,/<script|<iframe|sharedAssetLauncher|function render\(|printPdf|id="png"|supabase.*\.co|service_role/i);
  assert.doesNotMatch(readdirSync(target).join(" "),/toolbar-tabs|floating-panels|shared-asset|editor/);
  const original=readFileSync(join(root,"site","index.html"),"utf8");
  assert.match(original,/<title>MegaFlyer Studio · First Megasaver<\/title>/,
   "Live Pages source remains intact until coordinated release");
  const pages=readFileSync(join(root,".github/workflows/pages.yml"),"utf8");
  assert.match(pages,/vars\.MEGAFLYER_CUTOVER_APPROVED == 'true'/);
  assert.match(pages,/github\.event_name == 'workflow_dispatch'/);
  assert.match(pages,/github\.ref == 'refs\/heads\/main'/);
  assert.match(pages,/PTG_STUDIO_CUTOVER_PREVIEW=1 node scripts\/build-cutover-pages\.mjs staging\/\.cutover-release/);
  assert.match(pages,/path: \.\/staging\/\.cutover-release/);
  assert.doesNotMatch(pages,/path: \.\/site/,"Approved cutover may never publish full editor source");
  assert.match(pages,/if: vars\.MEGAFLYER_CUTOVER_APPROVED/,
   "No ordinary main branch push may redeploy the public editing source");
 }finally{rmSync(target,{recursive:true,force:true});}
});
