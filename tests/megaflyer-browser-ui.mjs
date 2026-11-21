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
  '+ Add Section','+ Add Header','Manage sections',
  '✦ Studio+ Tools','○ Connect PTG','☁ Cloud','+ ADD Assets']){
  assert.ok(buttons.some(text=>text.trim()===label),'Missing tab '+label);
 }
 assert.equal(await page.locator('.flyer-tab-shell #png, .flyer-tab-shell #pdf').count(),0,
   'Export/download buttons must not be duplicated in top tabs');
 await page.locator('#studioNav [data-nav="review"]').click();
 assert.equal(await page.locator('#panel-review #png:visible').count(),1);
 assert.equal(await page.locator('#panel-review #printPdf:visible').count(),1);
 await page.locator('#studioNav [data-nav="cards"]').click();
 const tabBar=await page.locator('.flyer-tab-shell>.toolbar').evaluate(el=>({
   scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,wrap:getComputedStyle(el).flexWrap
 }));
 assert.equal(tabBar.wrap,'nowrap');
 assert.ok(tabBar.scrollWidth>tabBar.clientWidth,'Tabs should overflow horizontally at desktop size');
 // Desktop has its own independently scrolling preview; tabs stay pinned at its top.
 const desktopPin=await page.evaluate(()=>{
   const stage=document.querySelector('.stage'),tabs=document.querySelector('.flyer-tab-shell');
   const max=stage.scrollHeight-stage.clientHeight;
   stage.scrollTop=Math.min(350,max);
   return {max,scrolled:stage.scrollTop,stageTop:stage.getBoundingClientRect().top,
     tabTop:tabs.getBoundingClientRect().top,position:getComputedStyle(tabs).position};
 });
 assert.ok(desktopPin.max>100&&desktopPin.scrolled>100,
   'Desktop flyer preview must be independently scrollable: '+JSON.stringify(desktopPin));
 assert.equal(desktopPin.position,'sticky','Preview tabs use sticky layout');
 assert.ok(desktopPin.tabTop>=desktopPin.stageTop-2 && desktopPin.tabTop<=desktopPin.stageTop+23,
   'Tabs stay pinned near top of desktop preview while scrolling: '+JSON.stringify(desktopPin));
 await page.evaluate(()=>document.querySelector('.stage').scrollTop=0);
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
 // Every editor dialog should open centered, without blocking pointer input behind it.
 async function checkEditorCentered(wrapper,content,label){
  const result=await page.locator(content).evaluate(el=>{
   const rect=el.getBoundingClientRect(),wrapper=el.parentElement;
   return {
    centerX:rect.left+rect.width/2,centerY:rect.top+rect.height/2,
    viewportX:innerWidth/2,viewportY:innerHeight/2,
    outerPointer:getComputedStyle(wrapper).pointerEvents,
    innerPointer:getComputedStyle(el).pointerEvents
   };
  });
  assert.ok(Math.abs(result.centerX-result.viewportX)<=3
      &&Math.abs(result.centerY-result.viewportY)<=3,
      label+' should open centered in the viewport: '+JSON.stringify(result));
  assert.equal(result.outerPointer,'none',label+' must leave the underlying flyer interactive');
  assert.equal(result.innerPointer,'auto',label+' contents must remain interactive');
 }
 const editorCases=[
  ['#layoutSettings','#settingsDialog','#settingsDialog .uiModalBox','#settingsClose','Appearance settings'],
  ['#slotFields .numberGrid button:first-child','#editCardDialog','#editCardDialog .uiModalBox','#cardDialogClose','Product card editor'],
  ['#manageSectionsQuick','#sectionDialog','#sectionDialog .uiModalBox','#closeSectionDialog','Section manager'],
  ['#addHeaderQuick','#headerDialog','#headerDialog .uiModalBox','#closeHeaderDialog','Header editor']
 ];
 for(const [trigger,wrapper,content,close,label] of editorCases){
  await page.locator(trigger).first().click();
  await page.locator(wrapper+':visible').waitFor();
  await checkEditorCentered(wrapper,content,label);
  await page.locator(close).click();
 }
 await page.locator('#powerLauncher').click();
 assert.equal(await page.locator('#powerModal').isVisible(),true);
 assert.equal(await page.locator('#powerModal .powerDialog').getAttribute('aria-modal'),'false');
 const powerPointers=await page.locator('#powerModal').evaluate(el=>({
   outer:getComputedStyle(el).pointerEvents,
   inner:getComputedStyle(el.querySelector('.powerDialog')).pointerEvents
 }));
 assert.deepEqual(powerPointers,{outer:'none',inner:'auto'});
 await checkEditorCentered('#powerModal','#powerModal .powerDialog','Studio+ Tools');
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
 const desktopPopup=await page.locator('#sharedAssetDialog').evaluate(el=>{
   const r=el.getBoundingClientRect();
   return {x:r.left+r.width/2,y:r.top+r.height/2,viewportX:innerWidth/2,viewportY:innerHeight/2};
 });
 assert.ok(Math.abs(desktopPopup.x-desktopPopup.viewportX)<=3
   &&Math.abs(desktopPopup.y-desktopPopup.viewportY)<=3,
   'Shared Asset Library should initially open centered on desktop: '+JSON.stringify(desktopPopup));
 await page.locator('#sharedAssetClose').click();
 await page.setViewportSize({width:600,height:800});
 await page.locator('#sharedAssetLauncher').click();
 const mobilePopup=await page.locator('#sharedAssetDialog').evaluate(el=>{
   const r=el.getBoundingClientRect();
   return {x:r.left+r.width/2,y:r.top+r.height/2,viewportX:innerWidth/2,viewportY:innerHeight/2};
 });
 assert.ok(Math.abs(mobilePopup.x-mobilePopup.viewportX)<=3
   &&Math.abs(mobilePopup.y-mobilePopup.viewportY)<=3,
   'Shared Asset Library should initially open centered on mobile: '+JSON.stringify(mobilePopup));
 await page.locator('#sharedAssetClose').click();
 await page.setViewportSize({width:600,height:800});
 // Mobile panels must be centered as well, not pinned to the bottom/right.
 for(const [trigger,wrapper,content,close,label] of [
  editorCases[0],editorCases[1],editorCases[2],editorCases[3],
  ['#powerLauncher','#powerModal','#powerModal .powerDialog','#powerClose','Studio+ Tools']
 ]){
  await page.locator(trigger).first().click();
  await page.locator(wrapper+':visible').waitFor();
  await checkEditorCentered(wrapper,content,label+' on mobile');
  await page.locator(close).click();
 }
 const mobile=await page.locator('.flyer-tab-shell>.toolbar').evaluate(el=>({
   wrap:getComputedStyle(el).flexWrap,
   scrollWidth:el.scrollWidth,clientWidth:el.clientWidth
 }));
 assert.equal(mobile.wrap,'nowrap');
 assert.ok(mobile.scrollWidth>mobile.clientWidth,'Mobile tabs remain horizontally scrollable');
 // Mobile scrolls the page, not the preview pane. Pin beneath the 60px app header.
 const mobilePin=await page.evaluate(()=>{
   const stage=document.querySelector('.stage'),tabs=document.querySelector('.flyer-tab-shell');
   const stageY=stage.getBoundingClientRect().top+scrollY;
   scrollTo(0,stageY+160);
   return {scrollY,stageY,top:tabs.getBoundingClientRect().top,
     position:getComputedStyle(tabs).position};
 });
 assert.ok(mobilePin.scrollY>100,'Mobile page should scroll: '+JSON.stringify(mobilePin));
 assert.equal(mobilePin.position,'sticky','Mobile tab bar remains sticky');
 assert.ok(Math.abs(mobilePin.top-60)<=4,
   'Tabs pin below 60px app header on mobile: '+JSON.stringify(mobilePin));
 assert.deepEqual(pageErrors,[],'Page must not throw runtime JS errors');
 console.log('PASS: Chromium toolbar, scrolling arrows, Front/Back, no duplicates, menu Show/Hide, floating Studio+/Assets, mobile layout');
} finally {
 await browser?.close();
 await new Promise(done=>server.close(done));
}
