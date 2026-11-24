"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const {inspect,restartPath}=require("../site/studio/updates/check.js");
const release=JSON.parse(read("site/studio/updates/release.json"));
test("module release is production-only, scoped and monotonic",()=>{
 assert.equal(inspect(release,release.sequence),"current");
 assert.equal(inspect({...release,sequence:release.sequence+1},release.sequence),"available");
 for(const data of [null,{}, {...release,app:"sales"}, {...release,channel:"staging"}, {...release,sequence:release.sequence-1}, {...release,sequence:""+release.sequence}])assert.equal(inspect(data,release.sequence),"invalid");
 assert.equal(restartPath("/branchline/"),null);
 assert.equal(restartPath("/flyer-studio/studio/"),"/flyer-studio/studio/");
});
test("protected entry stamps match and fresh authorization is required after restart",()=>{
 const html=read("site/studio/index.html");
 assert.ok(html.includes('data-sequence="'+release.sequence+'"'));
 assert.ok(html.includes('src="/flyer-studio/studio/updates/check.js?v='+release.sequence+'"'));
 const code=read("site/studio/updates/check.js");
 assert.ok(code.includes('root.location.assign("/first-megasaver-ptg/studios/?studio=flyer")'));
 assert.ok(!code.includes("location.hash"));
 assert.ok(!code.includes("contentWindow"));
});

test("protected mobile MegaFlyer uses its original menu control inside its icon and removes clipping",()=>{
 const {apply}=require("../site/studio/device-layout.js");
 const raw='<!doctype html><body><!-- PRIVATE EDITOR BUNDLE --><button id="editorMenuToggle">Hide menu</button></body></html>';
 const patched=apply(raw);assert.ok(patched.includes('id="bl-flyer-device-layout"'));assert.equal(apply(patched),patched);assert.ok(patched.includes('<button id="editorMenuToggle">Hide menu</button>'));assert.equal(apply("<body>unrecognized</body>"),"<body>unrecognized</body>");
 const launch=read("site/studio/launch.js");
 const integrityCheck=launch.indexOf("if(hash!==data.sha256)");
 const installLayout=launch.indexOf("frame.srcdoc=deviceLayout.apply(data.html)");
 assert.ok(integrityCheck>=0 && installLayout>integrityCheck,"Install the sidebar only after checking the editor digest");
 assert.ok(!launch.includes('allow-same-origin allow-scripts'));assert.ok(patched.includes("brand.prepend(toggle)"));
});
