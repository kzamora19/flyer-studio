/* STAGING ONLY. Smart Product Photo Library for the PRIVATE MegaFlyer editor.
 * Product-card imports only. No customer photos, logos or generic assets are
 * scanned or shared. A separate PTG-gated Edge Function owns private storage.
 */
(()=>{'use strict';
const MATCH=window.FLYER_PRODUCT_PHOTO_MATCH;
if(!MATCH)return;
const API='https://tzklsscoiwnmeantcefw.supabase.co/functions/v1/flyer-product-photos';
const KEY=window.FLYER_PRODUCT_PHOTO_CONFIG?.publishableKey||'';
const $=id=>document.getElementById(id);
const TYPES=new Set(['image/png','image/jpeg','image/webp']);
let active=null,records=[],match='none',canManage=false,session='',stamp='',busy=false,allVisible=false;
let requestVersion=0;
function currentSession(){
 const p=typeof ptgSession!=='undefined'?ptgSession:null;
 return p?.token&&p?.id?{token:p.token,id:String(p.id)}:null;
}
function selection(){
 if(typeof targetedOffer!=='function')return null;
 const offer=targetedOffer();
 if(!offer)return null;
 const p=MATCH.product({
  barcode:offer.barcode||offer.sku,brand:offer.brand,model:offer.model,
  description:offer.description||offer.name||offer.title
 });
 return p.barcode||p.brand&&p.model||p.description?{offer,product:p}:null;
}
function notice(text,success=false){$('smartPhotoNotice').textContent=text;$('smartPhotoNotice').dataset.ok=String(success);}
async function request(action,extra={}){
 const account=currentSession();
 if(!account)throw Error('Connect your active PTG Team Leader or higher account.');
 if(!KEY)throw Error('Product Photo Library is not configured for this protected release.');
 const res=await fetch(API,{
  method:'POST',cache:'no-store',referrerPolicy:'no-referrer',
  headers:{'Content-Type':'application/json',apikey:KEY,
   Authorization:'Bearer '+account.token,'x-ptg-session-id':account.id},
  body:JSON.stringify({action,...extra})
 });
 const value=await res.json().catch(()=>null);
 if(currentSession()?.id!==account.id)throw Error('PTG account changed; retry after signing in.');
 if(!res.ok)throw Error(value?.error||'Product photo access unavailable ('+res.status+').');
 return value;
}
function toBase64(blob){return new Promise((resolve,reject)=>{
 const reader=new FileReader();reader.onerror=()=>reject(Error('Cannot read image'));
 reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
 reader.readAsDataURL(blob);
});}
async function optimized(file,limit,quality){
 if(!file||!TYPES.has(file.type)||file.size>12*1024*1024)throw Error('Choose PNG, JPG or WebP under 12 MB.');
 const image=await createImageBitmap(file);
 try{
  const scale=Math.min(1,limit/Math.max(image.width,image.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.width*scale));
  canvas.height=Math.max(1,Math.round(image.height*scale));
  canvas.getContext('2d',{alpha:true}).drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
  if(!blob||blob.type!=='image/webp')throw Error('WebP image compression unavailable.');
  return blob;
 }finally{image.close?.();}
}
async function imageFile(photo,thumbnail=false){
 const result=await request('image',{id:photo.id,thumbnail});
 if(!TYPES.has(result.mime)||typeof result.base64!=='string')throw Error('Invalid saved image');
 const binary=atob(result.base64),data=new Uint8Array(binary.length);
 for(let i=0;i<data.length;i++)data[i]=binary.charCodeAt(i);
 const extension=result.mime==='image/webp'?'webp':result.mime==='image/png'?'png':'jpg';
 return new File([data],'saved-product-'+photo.id+'.'+extension,{type:result.mime});
}
async function apply(photo){
 const selected=selection();
 if(!selected||!active||selected.product.productKey!==active.product.productKey)
  throw Error('Select the same product card before applying this photo.');
 if(typeof attachUploadedPhoto!=='function')throw Error('Product photo editing unavailable.');
 const file=await imageFile(photo);
 const applied=await attachUploadedPhoto(selected.offer,file);
 if(!applied)throw Error('The selected product card changed. Please retry.');
 if(typeof edited==='function')edited('Saved product photo applied to '+(selected.product.barcode||selected.product.model)+'.');
}
async function uploadFile(file,replacing=null){
 const selected=selection();
 if(!selected||!selected.product.productKey)throw Error('Select a product with a barcode or exact brand and model.');
 if(!file||!TYPES.has(file.type)||!file.size||file.size>12*1024*1024)
  throw Error('Upload a product PNG, JPG or WebP under 12 MB.');
 if(!replacing){
  if(typeof attachUploadedPhoto!=='function')throw Error('Product card image editor is not available.');
  if(!await attachUploadedPhoto(selected.offer,file))throw Error('Product selection changed during upload.');
  if(typeof edited==='function')edited('Product photo imported.');
 }
 if(!replacing&&!$('smartPhotoShare').checked){
  notice('Applied to this flyer only — not shared to Product Photo Library.',true);
  return;
 }
 notice('Saving optimized photo to the private shared library…');
 const main=await optimized(file,1600,.84),thumb=await optimized(file,360,.72);
 if(main.size>2*1024*1024||thumb.size>256*1024)
  throw Error('Compressed image exceeds library limits. The flyer image was retained.');
 const payload={product:selected.product,mime:main.type,base64:await toBase64(main),
  thumbnailMime:thumb.type,thumbnailBase64:await toBase64(thumb)};
 const result=await request(replacing?'replace':'upload',{
  ...payload,...(replacing?{id:replacing.id}:{})
 });
 notice(result.reused?'Photo already saved — existing library copy reused.':'Product photo saved in the shared library.',true);
 await sync(true);
}
function button(container,label,handler){
 const b=document.createElement('button');b.type='button';b.textContent=label;
 b.onclick=async()=>{if(busy)return;busy=true;b.disabled=true;
  try{await handler();}catch(e){notice(e.message||'Operation failed');}
  finally{busy=false;b.disabled=false;}
 };
 container.append(b);
 return b;
}
async function loadThumb(photo,img){
 const s=session,version=requestVersion;
 try{const f=await imageFile(photo,true);
  if(s!==session||version!==requestVersion)return;
  const url=URL.createObjectURL(f);
  img.onload=()=>URL.revokeObjectURL(url);
  img.onerror=()=>URL.revokeObjectURL(url);
  img.src=url;
 }catch{img.alt='Thumbnail unavailable';}
}
function render(){
 const gallery=$('smartPhotoGallery');gallery.replaceChildren();
 $('smartPhotoMore').hidden=records.length<=1;
 $('smartPhotoCount').textContent=records.length
  ?records.length+' photo(s) · '+(match==='description'?'Suggested match (confirm before using)':match+' match')
  :'No previously saved product photo';
 const shown=allVisible?records:records.slice(0,1);
 for(const photo of shown){
  const card=document.createElement('div');card.className='spp-card';
  const img=document.createElement('img');img.alt='Saved product photo';img.loading='lazy';
  const actions=document.createElement('div');actions.className='spp-actions';
  const hint=document.createElement('small');
  hint.textContent=photo.is_primary?'Primary photo':match==='description'?'Description suggestion':'Alternative photo';
  button(actions,'Use Saved Photo',async()=>{await apply(photo);notice('Saved photo applied to selected flyer card.',true);});
  button(actions,'Set as Primary',async()=>{
   await request('setPrimary',{id:photo.id});notice('Primary photo updated.',true);await sync(true);
  });
  if(canManage){
   button(actions,'Replace Photo',async()=>{$('smartPhotoReplacement').dataset.id=photo.id;$('smartPhotoReplacement').click();});
   button(actions,'Remove Photo',async()=>{
    if(!confirm('Remove this product photo from the shared library? Saved flyers will not be changed.'))return;
    await request('remove',{id:photo.id});notice('Photo removed from the shared library.',true);await sync(true);
   });
  }
  card.append(img,hint,actions);gallery.append(card);void loadThumb(photo,img);
 }
}
async function sync(force=false){
 const s=currentSession(),selected=selection();
 const key=s&&selected?JSON.stringify([s.id,selected.product.barcode,
  selected.product.brand,selected.product.model,selected.product.description]):'';
 if(!force&&key===stamp)return;
 stamp=key;session=s?.id||'';active=selected;records=[];match='none';
 const version=++requestVersion;
 $('smartPhotoWho').textContent=selected?
  [selected.product.barcode||'',selected.product.brand,selected.product.model,
   selected.product.description].filter(Boolean).join(' · ').slice(0,200):
  'Select a product card to find matching photos.';
 $('smartPhotoUpload').disabled=!selected?.product.productKey;
 $('smartPhotoShare').disabled=!selected?.product.productKey;
 if(!s){notice('PTG sign-in is required before accessing shared product images.');render();return;}
 if(!selected){notice('Choose a product through the PTG lookup or card editor.');render();return;}
 notice('Checking private product photo library…');
 try{
  const [perms,found]=await Promise.all([
   request('permissions'),request('resolve',{product:selected.product})
  ]);
  if(version!==requestVersion||session!==s.id)return;
  canManage=perms.canManage===true;
  records=Array.isArray(found.photos)?found.photos:[];match=found.match||'none';
  render();
  notice(match==='description'?'Possible description matches: select and confirm the correct image.':
   records.length?'Previously saved product photos found.':'No saved photo yet — upload a product photo.',true);
 }catch(e){if(version===requestVersion){
  records=[];canManage=false;render();notice(e.message||'Photo library unavailable.');}}
}
function init(){
 if($('smartPhotoPanel'))return;
 const style=document.createElement('style');
 style.textContent=`#smartPhotoPanel{position:fixed;right:12px;bottom:14px;width:min(440px,calc(100vw - 24px));max-height:80dvh;overflow:auto;background:#fff;color:#1d2836;border:1px solid #e9edf1;box-shadow:0 15px 45px #15223542;z-index:99990;border-radius:16px;padding:16px;font:13px/1.45 "Segoe UI",Arial,sans-serif}
 #smartPhotoPanel[hidden]{display:none!important}#smartPhotoPanel h2{font-size:16px;margin:0 0 5px}
 #smartPhotoPanel button{background:#355ee8;color:#fff;border:0;border-radius:7px;padding:7px 10px;font:600 12px/1.3 inherit;cursor:pointer}
 #smartPhotoPanel button:hover{background:#2348c7}#smartPhotoPanel button:disabled{opacity:.45;cursor:not-allowed}
 #smartPhotoNotice{background:#eef2ff;padding:9px;border-radius:6px}#smartPhotoNotice[data-ok=true]{color:#2348c7}
 .spp-card{display:flex;align-items:center;gap:10px;border-top:1px solid #e9edf1;padding:8px 0;flex-wrap:wrap}
 .spp-card img{width:75px;height:75px;object-fit:contain;background:#f4f5f9}
 .spp-actions{display:flex;gap:6px;flex-wrap:wrap;flex:1}.spp-card small{max-width:120px}
 .spp-top{display:flex;justify-content:space-between;gap:12px;align-items:center}.spp-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}
 #smartPhotoOpen{border:1px solid #355ee8!important;background:#eef2ff!important;color:#2348c7!important;border-radius:8px!important}
 @media(max-width:650px){#smartPhotoPanel{bottom:4px;max-height:60dvh}}`;
 document.head.append(style);
 const panel=document.createElement('section');panel.id='smartPhotoPanel';panel.hidden=true;
 panel.setAttribute('aria-label','Smart Product Photo Library');
 panel.innerHTML=`<div class="spp-top"><h2>Product Photo Library</h2><button id="smartPhotoClose" type="button">Close</button></div>
 <p id="smartPhotoWho">Select a product card.</p>
 <p id="smartPhotoCount"></p><div class="spp-line">
 <button type="button" id="smartPhotoUpload">Upload New Photo</button>
 <button type="button" id="smartPhotoMore">View All Photos</button></div>
 <label><input id="smartPhotoShare" type="checkbox" checked> Save new product photo to shared library</label>
 <input id="smartPhotoFile" type="file" accept="image/png,image/jpeg,image/webp" hidden>
 <input id="smartPhotoReplacement" type="file" accept="image/png,image/jpeg,image/webp" hidden>
 <div id="smartPhotoGallery"></div><p id="smartPhotoNotice" role="status"></p>`;
 document.body.append(panel);
 const launcher=document.createElement('button');
 launcher.id='smartPhotoOpen';launcher.type='button';launcher.textContent='Product Photos';
 (document.querySelector('.stage .toolbar')||document.querySelector('main')||document.body).append(launcher);
 launcher.onclick=()=>{panel.hidden=false;allVisible=false;void sync(true);};
 $('smartPhotoClose').onclick=()=>{panel.hidden=true;launcher.focus();};
 $('smartPhotoUpload').onclick=()=>$('smartPhotoFile').click();
 $('smartPhotoMore').onclick=()=>{allVisible=!allVisible;render();};
 $('smartPhotoFile').onchange=async e=>{
  const file=e.target.files?.[0];e.target.value='';
  if(!file)return;
  try{await uploadFile(file);}catch(err){notice('Flyer import or library save: '+err.message);}
 };
 $('smartPhotoReplacement').onchange=async e=>{
  const file=e.target.files?.[0],id=e.target.dataset.id;e.target.value='';
  if(!file)return;
  const photo=records.find(p=>p.id===id);
  if(!photo)return notice('Select a photo to replace.');
  if(!confirm('Replace this library photo? Existing saved flyer artwork will remain unchanged.'))return;
  try{await uploadFile(file,photo);}catch(err){notice(err.message);}
 };
 window.addEventListener('megaflyer:ptg-session-changed',()=>{stamp='';records=[];session='';void sync(true);});
 // Never block PTG price searches. A separate low-frequency lookup observes
 // the currently selected card and checks saved photos asynchronously.
 setInterval(()=>{if(currentSession()&&selection())void sync();},2000);
 void sync(true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
