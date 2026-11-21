// Full MegaFlyer bundle in the non-deployed protected frame, with all network access mocked.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {createProofMock} from './staged-proof-mock.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temp=mkdtempSync(join(tmpdir(),'megaflyer-secure-frame-'));
let server,browser;
try{
 execFileSync(process.execPath,[join(root,'scripts/build-private-flyer.mjs'),temp],{cwd:root,stdio:'pipe'});
 const privateHtml=readFileSync(join(temp,'private/studio.html'),'utf8');
 const manifest=JSON.parse(readFileSync(join(temp,'manifest.json'),'utf8'));
 const staging=join(root,'staging/studio-access');
 const landing=readFileSync(join(staging,'index.html'),'utf8');
 server=createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname;
  if(p==='/'||p==='/index.html'){
   res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
   res.end(landing);return;
  }
  if(p==='/launch.js'){
   res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});
   res.end(readFileSync(join(staging,'launch.js')));return;
  }
  if(p==='/draft-vault.js'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});res.end(readFileSync(join(staging,'draft-vault.js')));return;}
 res.writeHead(404);res.end();
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const errors=[],calls=[],photoCalls=[];
 const miniPng='iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGPcIqfMAANMDEgANwcAMW8A/bn8wfEAAAAASUVORK5CYII=';
 let savedProductPhoto=null;
 const proof=createProofMock();
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin===origin)return route.continue();
  if(url.hostname==='tzklsscoiwnmeantcefw.supabase.co'&&url.pathname==='/functions/v1/flyer-editor-delivery'){
   const payload=route.request().postDataJSON();calls.push(payload.action);
   const result=await proof.handle(payload);
   return route.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':origin,'access-control-allow-headers':'*'},
    body:JSON.stringify(payload.action==='load'?
      {...result,html:privateHtml,sha256:manifest.sha256}:result)});
  }
  if(url.hostname==='tzklsscoiwnmeantcefw.supabase.co'&&url.pathname==='/functions/v1/flyer-product-photos'){
   const payload=route.request().postDataJSON();photoCalls.push(payload.action);
   assert.equal(route.request().headers().authorization,undefined,
    'Opaque editor photo requests cannot carry the user's PTG bearer');
   assert.equal(route.request().headers()['x-ptg-session-id'],undefined,
    'Opaque editor photo requests cannot carry the PTG app-session ID');
   assert.equal(payload.studioProof?.sessionId?.length,36);
   assert.equal(typeof payload.studioProof?.signature,'string');
   const next=await proof.handle({action:'check',...payload.studioProof});
   assert.equal(next.ok,true,'Every photo operation must independently verify P-256 proof');
   let value={ok:true};
   if(payload.action==='permissions')value={canView:true,canUpload:true,canManage:true};
   if(payload.action==='resolve')value={photos:savedProductPhoto?[savedProductPhoto]:[],
     match:savedProductPhoto?'barcode':'none'};
   if(payload.action==='upload'){
    assert.equal(payload.product.barcode,'0000012345');
    assert.equal(payload.mime,'image/webp');
    assert.ok(payload.base64.length>20);
    savedProductPhoto={id:'11111111-2222-4333-8444-555555555555',
     barcode_norm:'0000012345',product_key:'b:0000012345',
     is_primary:true,description:'LG T123 TV'};
    value={ok:true,photoId:savedProductPhoto.id,reused:false};
   }
   if(payload.action==='image')value={mime:'image/png',base64:miniPng};
   return route.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':origin,'access-control-allow-headers':'*'},
    body:JSON.stringify({result:value,studioProof:next})});
  }
  return route.fulfill({status:404,body:'External service disabled in offline QA'});
 });
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/#ptg_studio_ticket='+'R'.repeat(43),{waitUntil:'domcontentloaded'});
 await page.locator('#studio-editor-frame').waitFor({timeout:30000});
 const frame=page.frameLocator('#studio-editor-frame');
 await frame.locator('#sharedAssetLauncher').waitFor({timeout:30000});
 await frame.locator('#smartPhotoOpen').waitFor({timeout:15000});
 await frame.locator('#smartPhotoOpen').click();
 await frame.locator('#smartPhotoPanel').waitFor({state:'visible'});
 assert.equal(await frame.locator('#smartPhotoShare').isChecked(),true);
 assert.equal(await frame.locator('#smartPhotoNativeShare').count(),1,'Native card photo import requires a clear shared-library opt-out');
 assert.equal(await frame.locator('#smartPhotoNativeShare').isChecked(),true);
 assert.equal(await frame.locator('#smartPhotoNativeShareLabel').count(),1);
 assert.ok(await frame.locator('#smartPhotoCount').count()===1);
 const photoHooks=await frame.locator('body').evaluate(()=>({
  attach:typeof attachUploadedPhoto,
  select:typeof targetedOffer,
  inputs:[...document.querySelectorAll('input[type=file]')].map(e=>({
   id:e.id,accept:e.accept,near:e.parentElement?.id||e.parentElement?.className||''
  })).slice(0,20)
 }));
 assert.equal(photoHooks.attach,'function');
 assert.equal(photoHooks.select,'function');
 console.log('SMART_PRODUCT_PHOTO_CARD_HOOKS',JSON.stringify(photoHooks));
 const smartState=await frame.locator('body').evaluate(()=>({
  accountType:typeof ptgSession,
  accountPresent:typeof ptgSession!=='undefined'&&!!ptgSession,
  firstOfferKeys:Object.keys(state.offers?.[0]||{}).slice(0,35),
  slotTarget:typeof slotTarget==='undefined'?null:slotTarget,
  offerSelected:typeof targetedOffer==='function'?!!targetedOffer():false,
  photoInputExists:!!document.getElementById('cardPhotoUpload')
 }));
 console.log('SMART_PRODUCT_PHOTO_RUNTIME',JSON.stringify(smartState));
 await frame.locator('#smartPhotoClose').click();
 assert.equal(await frame.locator('#smartPhotoPanel').isHidden(),true);

 assert.match(await frame.locator('title').textContent(),/MegaFlyer Studio/);
 assert.equal((await frame.locator('body>header .brandIdentity strong').textContent()).trim(),'MegaFlyer Studio');
 assert.equal((await frame.locator('body>header .brandIdentity small').textContent()).trim(),
  'Promotional Flyer & Sale Artwork Generator');
 const ui=await frame.locator('body>header').evaluate(el=>({
  color:getComputedStyle(el).backgroundColor,
  subtitle:getComputedStyle(el.querySelector('.brandIdentity small')).color
 }));
 assert.equal(ui.color,'rgb(29, 40, 54)','Header must use actual Branchline navy');
 assert.equal(ui.subtitle,'rgb(220, 230, 255)');

 assert.equal(new URL(page.url()).hash,'');
 assert.equal(await frame.locator('#printPdf').count(),1);
 assert.equal(await frame.locator('#png').count(),1);
 const routing=await frame.locator('body').evaluate(()=>({
  catalogURL:catalogImageURL('https://example.invalid/image.png'),
  ptgConnectAllowed:ptgLocalOrigin()
 }));
 assert.match(routing.catalogURL,/\/functions\/v1\/flyer-catalog\?mode=image/);
 assert.equal(routing.ptgConnectAllowed,true,'Protected editor PTG login should be available');

 await frame.locator('#sharedAssetLauncher').click({timeout:20000});
 await frame.locator('#sharedAssetModal').waitFor({state:'visible',timeout:10000});
 await frame.locator('#sharedAssetClose').click();
 assert.equal(await frame.locator('#sharedAssetModal').isHidden(),true);
 // Verify the latest Project Backup controls are actually usable in srcdoc.
 await frame.locator('#studioNav [data-nav="backup"]').click();
 await frame.locator('#quickSaveProject').click({timeout:12000});
 await frame.locator('#quickProjectSignedOut').waitFor({state:'visible',timeout:12000});
 await frame.locator('#quickProjectClose').click();
 // Create a real print-resolution PNG from the protected editor.
 await frame.locator('#studioNav [data-nav="review"]').click();
 const [pngDownload]=await Promise.all([
  page.waitForEvent('download',{timeout:90000}),
  frame.locator('#png').click({timeout:16000})
 ]);
 const png=readFileSync(await pngDownload.path());
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.ok(png.readUInt32BE(16)>=2000&&png.readUInt32BE(20)>=2800,'A4 PNG must be 300-ppi sized');
 // A second authorised load isolates the heavyweight PDF export from PNG buffers.
 await page.goto(origin+'/#ptg_studio_ticket='+'S'.repeat(43),{waitUntil:'domcontentloaded'});
 await page.locator('#studio-editor-frame').waitFor({timeout:30000});
 await frame.locator('#printPdf').waitFor({state:'attached',timeout:30000});
 await frame.locator('#studioNav [data-nav="review"]').click();
 const [pdfDownload]=await Promise.all([
  page.waitForEvent('download',{timeout:100000}),
  frame.locator('#printPdf').click({timeout:20000})
 ]);
 const pdf=readFileSync(await pdfDownload.path()).toString('latin1');
 assert.match(pdf,/^%PDF-1\.4/);
 assert.match(pdf,/\/Count 2\b/);
 assert.equal((pdf.match(/\/Subtype \/Image/g)||[]).length,2);

 await page.setViewportSize({width:390,height:800});
 const narrow=await frame.locator('body>header').evaluate(el=>({
  subtitle:el.querySelector('.brandIdentity small')?.textContent?.trim(),
  width:el.getBoundingClientRect().width,
  viewport:document.documentElement.clientWidth,
 }));
 assert.equal(narrow.subtitle,'Promotional Flyer & Sale Artwork Generator');
 assert.ok(narrow.width<=narrow.viewport+2,'MegaFlyer mobile header must not overflow');
 assert.deepEqual(errors,[],errors.join('; '));
 // Photo-library integration is tested with a fully mocked Edge endpoint.
 // The iframe must send only a named operation over its MessagePort; the
 // protected parent signs each photo call without an editor-visible PTG bearer.
 await frame.locator('body').evaluate(()=>{
  ptgSession=null;
  // Always edit the ACTUAL targeted product card, not the first state row.
  // Some editor templates keep the selected slot away from index zero.
  slotTarget.section='front';slotTarget.slot='1';
  const product=targetedOffer();
  if(!product)throw Error('No selected product offer');
  product.sku='0000012345';
  product.brand='LG';
  product.model='T123';
  product.name='LG T123 TV';
  window.dispatchEvent(new Event('megaflyer:ptg-session-changed'));
 });
 await frame.locator('#smartPhotoOpen').click();
 await frame.locator('#smartPhotoFile').setInputFiles({
  name:'test-product.png',mimeType:'image/png',buffer:Buffer.from(miniPng,'base64')});
 try{await frame.locator('.spp-card').first().waitFor({timeout:8000});}
 catch(error){
  const diagnostic=await frame.locator('body').evaluate(()=>({
   notice:document.getElementById('smartPhotoNotice')?.textContent,
   selection:typeof targetedOffer==='function'?{
    sku:targetedOffer()?.sku,name:targetedOffer()?.name,brand:targetedOffer()?.brand,
    model:targetedOffer()?.model,photo:!!targetedOffer()?.photo,
    sameAsFirst:targetedOffer()===state.offers?.[0]
   }:null,
   share:document.getElementById('smartPhotoShare')?.checked,
   galleryCount:document.querySelectorAll('.spp-card').length,
   account:typeof ptgSession==='undefined'?null:{id:ptgSession?.id,hasToken:!!ptgSession?.token}
  }));
  console.log('SMART_PRODUCT_PHOTO_FAILURE_DIAGNOSTIC',JSON.stringify({diagnostic,photoCalls,pageErrors:errors}));
  throw error;
 }
 assert.ok(photoCalls.includes('upload'),'Saved product photo must cross protected launcher bridge.');
 assert.ok(photoCalls.includes('resolve'),'Photo matching must work without a PTG bearer in the iframe.');
 assert.equal(await frame.locator('body').evaluate(()=>window.__MEGAFLYER_PRIVATE_DB__!==undefined),true);
 assert.equal(savedProductPhoto?.barcode_norm,'0000012345');
 await frame.locator('.spp-card button').first().click();
 await frame.locator('#smartPhotoNotice').getByText('Saved photo applied',{exact:false}).waitFor({timeout:15000});
 assert.ok(photoCalls.includes('image'),'Saved photo must be reloaded through authenticated parent proxy.');
 const uploadsBefore=photoCalls.filter(x=>x==='upload').length;
 await frame.locator('#smartPhotoShare').uncheck();
 await frame.locator('#smartPhotoFile').setInputFiles({
  name:'private-product.png',mimeType:'image/png',buffer:Buffer.from(miniPng,'base64')});
 await frame.locator('#smartPhotoNotice').getByText('not shared',{exact:false}).waitFor({timeout:15000});
 assert.equal(photoCalls.filter(x=>x==='upload').length,uploadsBefore,
  'Explicit opt-out must not contact shared image upload backend.');
 // The native product-card importer must auto-save ONLY after its ordinary
 // editor listener applies the image. This never touches customer #photos.
 await frame.locator('body').evaluate(()=>{
   const input=document.getElementById('smartPhotoNativeShare');
   input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await frame.locator('body').evaluate(()=>{targetedOffer().photo='';});
 const nativeUploadsBefore=photoCalls.filter(x=>x==='upload').length;
 const secondPng='iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGOUNLrEAANMDEgANwcAN/UBJXjVRskAAAAASUVORK5CYII=';
 await frame.locator('#cardPhotoUpload').setInputFiles({
   name:'native-card-product.png',mimeType:'image/png',buffer:Buffer.from(secondPng,'base64')
 });
 await frame.locator('#smartPhotoNativeSaved').getByText('saved in shared library',{exact:false}).waitFor({state:'attached',timeout:12000});
 assert.equal(photoCalls.filter(x=>x==='upload').length,nativeUploadsBefore+1,
   'A successful native product-card photo import should be shared exactly once');
 // The UI must separately allow exclusion of the next native upload.
 await frame.locator('body').evaluate(()=>{
   const input=document.getElementById('smartPhotoNativeShare');
   input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 const thirdPng='iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGPcIqfMAANMDEgANwcAMW8A/bn8wfEAAAAASUVORK5CYII=';
 await frame.locator('#cardPhotoUpload').setInputFiles({
   name:'excluded-native.png',mimeType:'image/png',buffer:Buffer.from(thirdPng,'base64')
 });
 await frame.locator('#smartPhotoNativeSaved').getByText('not added to shared library',{exact:false}).waitFor({state:'attached',timeout:5000});
 assert.equal(photoCalls.filter(x=>x==='upload').length,nativeUploadsBefore+1,
   'Native product-card opt-out cannot save into shared library');
 console.log('PASS: actual protected editor product image upload, barcode recall, reuse and opt-out using synthetic PTG and cloud responses.');

 assert.ok(calls.includes('load'));
 console.log('PASS: full 1MB+ MegaFlyer bundle loads in ticket-gated srcdoc; editor controls and asset dialog work under mock gateway.');
}finally{
 await browser?.close();
 if(server)await new Promise(ok=>server.close(ok));
 rmSync(temp,{recursive:true,force:true});
}