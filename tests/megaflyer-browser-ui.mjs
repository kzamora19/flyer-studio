import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {extname,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../site');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png',
 '.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{
 const raw=(req.url||'/').split('?')[0];
 const dest=resolve(root,'.'+(raw==='/'?'/index.html':decodeURIComponent(raw)));
 if(!dest.startsWith(root+'/')||!existsSync(dest)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':types[extname(dest)]||'application/octet-stream',
   'Cache-Control':'no-store'});
 res.end(readFileSync(dest));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--disable-web-security']});
 const page=await browser.newPage({viewport:{width:1250,height:900}});
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
 await page.locator('#sharedAssetLauncher').waitFor({timeout:20000});
 await page.locator('.flyer-tab-shell').waitFor();
 assert.equal(await page.locator('.flyer-tab-shell').count(),1);
 const buttons=await page.locator('.flyer-tab-shell>.toolbar>button').allTextContents();
 for(const label of ['Front','Back','Arrange rows','Arrange sections',
  '+ Add Section','+ Add Header','Manage sections','PNG · current side',
  'PDF · both sides','✦ Studio+ Tools','○ Connect PTG','☁ Cloud','+ ADD Assets']){
  assert.ok(buttons.some(text=>text.trim()===label),'Missing tab '+label);
 }
 const tabBar=await page.locator('.flyer-tab-shell>.toolbar').evaluate(el=>({
   scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,wrap:getComputedStyle(el).flexWrap
 }));
 assert.equal(tabBar.wrap,'nowrap');
 assert.ok(tabBar.scrollWidth>tabBar.clientWidth,'Tabs should overflow horizontally at desktop size');
 await page.locator('.flyer-tab-scroll[aria-label="Scroll tabs right"]').click();
 await page.waitForFunction(()=>document.querySelector('.flyer-tab-shell>.toolbar').scrollLeft>35);
 await page.locator('#back').click();
 assert.equal(await page.locator('#back').getAttribute('aria-pressed'),'true');
 await page.locator('#front').click();
 assert.equal(await page.locator('#front').getAttribute('aria-pressed'),'true');
 // Regression: changing section layout must not put the selection toolbar inside the tab strip.
 await page.locator('#arrangeSections').click();
 await page.locator('#selectedSectionControls:visible').waitFor();
 assert.equal(await page.locator('.flyer-tab-shell #selectedSectionControls').count(),0,
   'Section actions must not become a child of the horizontal tab bar');
 assert.equal(await page.locator('.stage > #selectedSectionControls').count(),1,
   'Section actions occupy their own row underneath the tabs');
 const placement=await page.evaluate(()=>{
   const bar=document.querySelector('.flyer-tab-shell').getBoundingClientRect();
   const panel=document.querySelector('#selectedSectionControls').getBoundingClientRect();
   const help=document.querySelector('#arrangeHelp').getBoundingClientRect();
   return {tabHeight:bar.height,tabBottom:bar.bottom,panelTop:panel.top,panelBottom:panel.bottom,helpTop:help.top};
 });
 assert.ok(placement.tabHeight<65,
   'Toolbar must remain compact even when section arrangement is active: '+JSON.stringify(placement));
 assert.ok(placement.panelTop>=placement.tabBottom,
   'Selection actions appear below the tab strip: '+JSON.stringify(placement));
 assert.ok(placement.helpTop>=placement.panelBottom,
   'Arrangement guidance appears below selection actions: '+JSON.stringify(placement));
 await page.locator('#arrangeSections').click();
 assert.equal(await page.locator('#selectedSectionControls').isVisible(),false);
 assert.equal(await page.locator('#studioNav [data-sub="front"], #studioNav [data-sub="back"]').count(),0);
 const navLabels=await page.locator('#studioNav>[data-nav]').allTextContents();
 assert.deepEqual(navLabels.map(x=>x.trim()),[
   'Campaign & Branding','Edit Flyer Cards','Bulk Import','Review & Approval','Project Backup']);
 await page.locator('#editorMenuToggle').click();
 assert.equal(await page.locator('#editorMenuToggle').getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('#studioNav').isVisible(),false);
 await page.locator('#editorMenuToggle').click();
 assert.equal(await page.locator('#studioNav').isVisible(),true);
 assert.equal(await page.locator('#studioNav #layoutSettings').count(),1,'Settings belongs in menu');

 await page.locator('#powerLauncher').click();
 assert.equal(await page.locator('#powerModal').isVisible(),true);
 assert.equal(await page.locator('#powerModal .powerDialog').getAttribute('aria-modal'),'false');
 const powerPointers=await page.locator('#powerModal').evaluate(el=>({
   outer:getComputedStyle(el).pointerEvents,
   inner:getComputedStyle(el.querySelector('.powerDialog')).pointerEvents
 }));
 assert.deepEqual(powerPointers,{outer:'none',inner:'auto'});
 // Toolbar remains usable behind the nonblocking Studio+ panel.
 await page.locator('#back').click();
 assert.equal(await page.locator('#back').getAttribute('aria-pressed'),'true');
 await page.locator('#powerClose').click();
 await page.locator('#front').click();

 await page.locator('#sharedAssetLauncher').click();
 assert.equal(await page.locator('#sharedAssetModal').isVisible(),true);
 assert.equal(await page.locator('#sharedAssetDialog').getAttribute('aria-modal'),'false');
 const assetPointers=await page.locator('#sharedAssetModal').evaluate(el=>({
   outer:getComputedStyle(el).pointerEvents,
   inner:getComputedStyle(el.querySelector('#sharedAssetDialog')).pointerEvents
 }));
 assert.deepEqual(assetPointers,{outer:'none',inner:'auto'});
 await page.locator('#sharedAssetClose').click();
 await page.setViewportSize({width:600,height:800});
 const mobile=await page.locator('.flyer-tab-shell>.toolbar').evaluate(el=>({
   wrap:getComputedStyle(el).flexWrap,
   scrollWidth:el.scrollWidth,clientWidth:el.clientWidth
 }));
 assert.equal(mobile.wrap,'nowrap');
 assert.ok(mobile.scrollWidth>mobile.clientWidth,'Mobile tabs remain horizontally scrollable');
 assert.deepEqual(pageErrors,[],'Page must not throw runtime JS errors');
 console.log('PASS: Chromium toolbar, scrolling arrows, Front/Back, no duplicates, menu Show/Hide, floating Studio+/Assets, mobile layout');
} finally {
 await browser?.close();
 await new Promise(done=>server.close(done));
}
