'use strict';
// Non-blocking editor regression. Run: node tests/flyer-icons-floating-panels.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..','site');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const shared=fs.readFileSync(path.join(root,'shared-asset-ui.js'),'utf8');
const float=fs.readFileSync(path.join(root,'floating-panels.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
const svg=fs.readFileSync(path.join(root,'icons','flyer-studio.svg'),'utf8');
const png=fs.readFileSync(path.join(root,'icons','flyer-studio-192.png'));
assert.ok(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'PNG fallback has valid signature');
assert.equal(png.readUInt32BE(16),192,'PNG width 192');
assert.equal(png.readUInt32BE(20),192,'PNG height 192');
assert.match(svg,/<svg[^>]*viewBox="0 0 256 256"/,'Vector icon valid');
assert.match(svg,/<clipPath id="badgeClip"><circle cx="192" cy="188" r="30"\/><\/clipPath>/,'Megasaver logo clipped to circular badge');
assert.doesNotMatch(svg,/data:image\/png;base64,/,"Vector logo has no low-resolution raster");
assert.match(svg,/>MEGA<\/text>/,"Vector Mega wordmark");
assert.match(svg,/>SAVER<\/text>/,"Vector Saver wordmark");
assert.ok(!svg.includes('fill="#9f4700"'),'Old gold star artwork removed');

assert.match(html,/<link rel="icon" type="image\/svg\+xml" href="\.\/icons\/flyer-studio\.svg">/,'Browser favicon set');
assert.match(html,/<link rel="apple-touch-icon" sizes="192x192"/,'Apple shortcut fallback set');
assert.match(html,/<link rel="manifest" href="\.\/manifest\.webmanifest">/,'Web-app manifest linked');
assert.ok(manifest.icons.some(i=>i.sizes==='192x192'&&i.type==='image/png'),'Install icon PNG fallback');
assert.ok(manifest.icons.some(i=>i.sizes==='any'&&i.type==='image/svg+xml'),'Install icon SVG');
assert.match(html,/<img src="\.\/icons\/flyer-studio\.svg" class="brandAppIcon"/,'Header shows new app symbol');
assert.match(html,/\.uiModalBackdrop\{background:transparent!important;pointer-events:none!important/,'Editor backdrops do not block application');
assert.match(html,/\.uiModalBackdrop \.uiModalBox\{pointer-events:auto!important/,'Editor controls remain interactive');
assert.match(html,/#powerModal\{background:transparent!important;pointer-events:none!important/,'Studio+ backdrop is transparent/pass-through');
assert.match(html,/#powerModal \.powerDialog\{pointer-events:auto!important/,'Studio+ controls interactive');
assert.match(shared,/#sharedAssetModal\{position:fixed;inset:0;z-index:99999;background:transparent;pointer-events:none/,'Shared Asset Library backdrop is pass-through');
assert.match(shared,/#sharedAssetDialog\{[^}]*pointer-events:auto/,'Shared Asset controls interactive');
assert.equal((shared.match(/aria-modal="false"/g)||[]).length,1,'Shared Asset dialog is nonmodal to assistive tech');
assert.ok((html.match(/aria-modal="false"/g)||[]).length>=5,'Flyer editor dialogs are nonmodal');
assert.ok(!html.includes("document.body.classList.add('modalOpen')"),'Editor no longer locks page scrolling');
for(const [,code] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new Function(code);
new Function(shared);new Function(float);
const docEvents={};const winEvents={};
class El{}
const classes=new Set();
const handle={classList:{add(x){classes.add(x)},remove(x){classes.delete(x)}},
 setPointerCapture(){},releasePointerCapture(){},closest(){return panel}};
const panel={dataset:{},style:{},parentElement:{hidden:false},
 getBoundingClientRect(){return {left:700,right:1000,top:100,bottom:500,width:300,height:400}}};
const target=new El();target.closest=selector=>selector.includes('button,a,input')?null:handle;
const document={addEventListener:(type,fn)=>{docEvents[type]=fn},
 querySelectorAll:()=>[panel]};
const window={addEventListener:(type,fn)=>{winEvents[type]=fn}};
new Function('document','window','Element','innerWidth','innerHeight',float)(document,window,El,1280,800);
assert.ok(docEvents.pointerdown&&docEvents.pointermove&&docEvents.pointerup,'Pointer handlers installed');
docEvents.pointerdown({button:0,isPrimary:true,target,pointerId:2,clientX:750,clientY:130,preventDefault(){}});
assert.ok(classes.has('panelDragging'),'Panel drag starts on heading');
docEvents.pointermove({pointerId:2,clientX:810,clientY:180,preventDefault(){}});
assert.equal(panel.style.transform,'translate(60px,50px)','Dragging repositions panel');
docEvents.pointerup({pointerId:2});
assert.ok(!classes.has('panelDragging'),'Dragging ends cleanly');
const button=new El();button.closest=()=>({tagName:'BUTTON'});
docEvents.pointerdown({button:0,isPrimary:true,target:button,pointerId:3,clientX:700,clientY:100});
docEvents.pointermove({pointerId:3,clientX:800,clientY:200});
assert.equal(panel.style.transform,'translate(60px,50px)','Dragging a button does not move the panel');
winEvents.resize();
assert.equal(panel.style.transform,'','Resize resets panel position safely');
console.log('PASS: branded icon, SVG/PNG manifest, interactive underlay, nonmodal dialogs and draggable panels.');
