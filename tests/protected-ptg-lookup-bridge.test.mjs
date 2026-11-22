import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {enableProtectedPtgLookup} from "../supabase/functions/_shared/flyer-protected-ptg-compat.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const sha=s=>createHash("sha256").update(s).digest("hex");
test("private release is verified before scoped PTG compatibility patch and browser can verify delivered bytes",()=>{
 const dir=mkdtempSync(join(tmpdir(),"flyer-protected-ptg-"));
 try{
  execFileSync(process.execPath,[join(root,"scripts/build-private-flyer.mjs"),dir],{cwd:root,timeout:45000});
  const original=readFileSync(join(dir,"private/studio.html"),"utf8");
  const manifest=JSON.parse(readFileSync(join(dir,"manifest.json"),"utf8"));
  assert.equal(sha(original),manifest.sha256);
  const patched=enableProtectedPtgLookup(original);
  assert.notEqual(sha(patched),manifest.sha256,"The delivery digest must be re-computed");
  assert.match(patched,/window.__MEGAFLYER_PTG_RPC__=ptgCatalog/);
  assert.match(patched,/id="protectedPtgConnected"/);
  assert.match(patched,/<form id="ptgLogin" hidden>/);
  assert.match(patched,/id="backup">Download project backup \(\.json\)/);
  assert.match(patched,/let ptgSession=window.__MEGAFLYER_PTG_RPC__\?/);
  assert.match(patched,/action:"ptg-search"/);
  assert.match(patched,/PTG account access is managed by the protected Studio launcher/);
  assert.doesNotMatch(patched,/<form id="ptgLogin">/);
  assert.equal(patched.split("window.__MEGAFLYER_PTG_RPC__=ptgCatalog;").length-1,1);
  const chunk=patched.match(/<script>(\/\* Injected only inside the private MegaFlyer package[\s\S]*?)<\/script>/)?.[1];
  assert.ok(chunk,"Private MessagePort bridge must remain executable");
  assert.doesNotThrow(()=>new Function(chunk));
  assert.throws(()=>enableProtectedPtgLookup(patched),/compatibility anchor/,"Patch must not be applied twice");
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test("signed-parent lookup is allowed only for branch-filtered, one-use proof search",()=>{
 const parent=readFileSync(join(root,"site/studio/launch.js"),"utf8");
 const server=readFileSync(join(root,"supabase/functions/flyer-editor-delivery/index.ts"),"utf8");
 assert.match(parent,/message.action==='ptg-search'/);
 assert.match(parent,/withProof\(async\(\)=>/);
 assert.match(parent,/action:'lookup'/);
 assert.match(server,/validSignedProof\(body\)/);
 assert.match(server,/ptg\("lookup"/);
 assert.match(server,/enableProtectedPtgLookup\(html\)/);
 assert.match(server,/if\(hash!==BUNDLE_SHA\)/);
 assert.ok(server.indexOf("if(hash!==BUNDLE_SHA)")<server.indexOf("enableProtectedPtgLookup(html)"));
 assert.doesNotMatch(parent,/allow-same-origin/);
});
