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
 // Exercise new arrange mode in actual Chromium with a disposable project.
 const arrangementBaseline=await page.evaluate(async()=>{
  const snapshot=structuredClone(state);
  const png=document.createElement('canvas');png.width=80;png.height=80;
  const ctx=png.getContext('2d');ctx.fillStyle='#f000ef';ctx.fillRect(0,0,80,80);
  const freebie=png.toDataURL('image/png');
  const base={brand:'Test',model:'TEST-2026',regular:'',badge:'',items:'',freebieText:'',freebiePhoto:'',photo:''};
  const a={...base,sku:'CARD-A',name:'Test A',section:'front',slot:0,promo:'1000',freebieText:'TEST FREEBIE',freebiePhoto:freebie};
  const b={...base,sku:'CARD-B',name:'Test B',section:'front',slot:1,promo:'2000'};
  state.offers=[a,b];state.status='Draft';side='front';slotTarget.section='front';slotTarget.slot='1';
  setup();showTarget();
  return {snapshot,freebie};
 });
 await page.locator('#arrangeCards').click();
 assert.equal(await page.locator('#arrangeCards').getAttribute('aria-pressed'),'true');
 const frontButtons=page.locator('#slotFields .numberGrid button[title^="Front grid · Card "]');
 await frontButtons.nth(0).click();await frontButtons.nth(1).click();
 assert.equal(await page.evaluate(()=>placement(state.offers,'front').slots[1]?.sku),'CARD-A');
 assert.equal(await page.evaluate(()=>placement(state.offers,'front').slots[1]?.freebiePhoto),arrangementBaseline.freebie);
 await page.locator('#undoCards').click();
 assert.equal(await page.evaluate(()=>placement(state.offers,'front').slots[0]?.sku),'CARD-A');
 await page.locator('#redoCards').click();
 assert.equal(await page.evaluate(()=>placement(state.offers,'front').slots[1]?.sku),'CARD-A');
 await frontButtons.nth(1).click();await page.locator('#back').click();
 const backButtons=page.locator('#slotFields .numberGrid button[title^="Back grid · Card "]');
 await backButtons.nth(0).click();
 assert.equal(await page.evaluate(()=>placement(state.offers,'back').slots[0]?.sku),'CARD-A');
 assert.equal(await page.evaluate(()=>placement(state.offers,'back').slots[0]?.freebiePhoto),arrangementBaseline.freebie);
 const painted=await page.evaluate(async()=>{
  const snapshot=structuredClone(state);snapshot.status='Approved';
  const result=await render(snapshot,'back',1600);
  const {canvas,layout,dimensions:d}=result;
  const card=layout.cards.find(c=>c.key==='back'&&c.index===0);
  const unit=canvas.width/d.pageWidth,scale=unit*d.width/800;
  const x=Math.floor(d.bleed*unit+card.x*scale),y=Math.floor(d.bleed*unit+(card.y+card.height*.7)*scale);
  const w=Math.max(1,Math.floor(card.width*scale)),h=Math.max(1,Math.floor(card.height*.3*scale));
  const bytes=canvas.getContext('2d').getImageData(x,y,w,h).data;
  let matching=0;for(let i=0;i<bytes.length;i+=4)if(bytes[i]>210&&bytes[i+1]<50&&bytes[i+2]>210)matching++;
  return matching;
 });
 assert.ok(painted>20,'Actual export renderer must paint the uploaded freebie in the moved card');
 await page.locator('#arrangeCards').click();
 await page.evaluate(snapshot=>{state=snapshot;side='front';slotTarget.section='front';slotTarget.slot='1';setup();showTarget();},arrangementBaseline.snapshot);
 await page.locator('#front').click();
 console.log('PASS: live browser card swaps, undo/redo, cross-page transfer and actual freebie canvas pixels');
 // Regression: changing section layout must not put the selection toolbar inside the tab strip.
 await page.locator('#arrangeSections').click();
 await page.locator('#selectedSectionControls:visible').waitFor();
 await page.evaluate(()=>document.querySelector('.stage').scrollTop=0);
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
 // The original controls are still wired, but the main menu stays visible as icons.
 await page.locator('#studioChatHeader').waitFor();
 assert.equal(await page.locator('#editorMenuToggle').getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('#studioNav').isVisible(),true,'Compact rail keeps icons visible');
 assert.equal(await page.locator('#studioChatTitle').textContent(),'Edit Flyer Cards');
 const compactWidth=await page.locator('#sidebarFixed').evaluate(el=>el.getBoundingClientRect().width);
 const sidebarSizes=await page.locator('main > aside').evaluate(el=>({
   total:el.getBoundingClientRect().width,
   second:document.querySelector('#sidebarContent').getBoundingClientRect().width,
   preview:document.querySelector('.stage').getBoundingClientRect().width
 }));
 assert.ok(sidebarSizes.total<=305 && sidebarSizes.second<=245,
   'Compact 2nd sidebar must not crowd the flyer: '+JSON.stringify(sidebarSizes));
 assert.ok(sidebarSizes.preview>=650,
   'Flyer canvas retains ample desktop width: '+JSON.stringify(sidebarSizes));
 await page.locator('#editorMenuToggle').click();
 assert.equal(await page.locator('#editorMenuToggle').getAttribute('aria-expanded'),'true');
 const expandedWidth=await page.locator('#sidebarFixed').evaluate(el=>el.getBoundingClientRect().width);
 assert.ok(expandedWidth>compactWidth+70,'Rail can expand to show menu names');
 await page.locator('#editorMenuToggle').click();
 assert.equal(await page.locator('#editorMenuToggle').getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('#studioNav').isVisible(),true);
 await page.locator('#studioNav [data-nav="bulk"]').click();
 assert.equal(await page.locator('#studioChatTitle').textContent(),'Bulk Import');
 assert.equal(await page.locator('#studioSubnav .navChildren[data-submenu="bulk"] button').count(),2);
 await page.locator('#studioNav [data-nav="cards"]').click();
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
