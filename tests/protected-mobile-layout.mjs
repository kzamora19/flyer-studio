import assert from "node:assert/strict";import {chromium} from "playwright";import layout from "../site/studio/device-layout.js";
const browser=await chromium.launch({headless:true});
try{
 for(const width of [320,390,600]){
 const page=await browser.newPage({viewport:{width,height:800}});
 await page.route("**/*",r=>r.abort());
 const raw='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}aside{height:220px;overflow:hidden}#sidebarFixed{height:260px}#sidebarContent{height:100px;overflow:hidden}header{background:#123;color:white}.brandIdentity{display:flex}#studioNav button{display:block;width:100%;height:45px}</style><body><!-- PRIVATE EDITOR BUNDLE --><header><div class="brandIdentity"><img class="brandAppIcon" alt="" width="40" height="40"><strong>MegaFlyer Studio</strong></div></header><main><aside><div id="sidebarFixed"><div class="editorMenuHeading"><h1>MegaFlyer Studio</h1><button id="editorMenuToggle" aria-expanded="true">Hide menu</button></div><nav id="studioNav"><button data-nav="campaign">Campaign</button><button data-nav="cards">Cards</button><button data-nav="bulk">Bulk Import</button><button data-nav="review">Review</button><button data-nav="backup">Backup</button></nav></div><div id="sidebarContent"><input aria-label="Editable campaign" value="draft"><button id="last">Last setting</button></div></aside><div class="stage">Preview</div></main><script>const t=document.getElementById("editorMenuToggle");t.onclick=()=>{const c=document.getElementById("sidebarFixed").classList.toggle("menuCollapsed");t.textContent=c?"Show menu":"Hide menu";t.setAttribute("aria-expanded",String(!c));};<\/script></body></html>';
 await page.setContent(layout.apply(raw));
 const toggle=page.locator("header #editorMenuToggle");await toggle.waitFor();
 assert.equal(await page.locator(".editorMenuHeading").isVisible(),false);
 assert.equal(await page.locator("header .brandAppIcon").isVisible(),false);
 assert.equal(await page.locator("#studioNav").isVisible(),false,"Mobile menu begins closed");
 await toggle.click();
 const nav=await page.locator("#studioNav").boundingBox(),content=await page.locator("#sidebarContent").boundingBox(),last=await page.locator("#last").boundingBox();
 assert.ok(nav.width<=width&&nav.x===0,"Menu opens as bounded left drawer");
 assert.ok(last.y+last.height<=content.y+content.height+1,"Last setting fits scroll content");
 await toggle.click();assert.equal(await page.locator("#studioNav").isVisible(),false);
 await toggle.click();assert.equal(await page.locator("#studioNav").isVisible(),true);
 await page.locator("#studioNav [data-nav=campaign]").click();assert.equal(await page.locator("#studioNav").isVisible(),false,"Drawer closes on selection");
 assert.equal(await page.getByRole("textbox",{name:"Editable campaign"}).inputValue(),"draft");
 await page.setViewportSize({width:1200,height:800});await page.locator(".editorMenuHeading #editorMenuToggle").waitFor();
 await page.close();
 }
 console.log("PASS protected MegaFlyer icon menu, no overlapping content, preserved controls, restored desktop");
}finally{await browser.close();}
