/* Staged Shared Asset UI: calls dual-auth Edge gateway; NOT deployed. */
(()=>{
'use strict';
// Explicit opt-in release configuration: never enable this feature before
// backend permissions and account pairing are accepted.
const CONFIG=window.FLYER_SHARED_ASSET_CONFIG||null;
const ROOT=CONFIG?.supabaseUrl||'';
const KEY=CONFIG?.publishableKey||'';
const CATEGORIES=['logos','banners','backgrounds','templates','decorations','other'];
const MAX=10*1024*1024;
const TYPES=new Set(['image/png','image/jpeg','image/webp']);
const el=id=>document.getElementById(id);
let rows=[],canManage=false,busy=false,previewURL='',selected=null;
function say(message,ok=false){el('sharedAssetNotice').textContent=message;el('sharedAssetNotice').dataset.ok=String(ok);}
async function gateway(action,fields={}){
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(ROOT)||!KEY)
  throw Error('Shared Asset Library is not enabled on this site.');
 const ptg=typeof ptgSession!=='undefined'?ptgSession:null;
 if(!ptg?.token||!ptg?.id)throw Error('Connect to PTG using a Team Leader or higher account.');
 const response=await fetch(ROOT+'/functions/v1/flyer-shared-assets',{
  method:'POST',cache:'no-store',
  headers:{'Content-Type':'application/json',apikey:KEY,Authorization:'Bearer '+ptg.token,'x-ptg-session-id':ptg.id},
  body:JSON.stringify({action,...fields})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'Asset service unavailable ('+response.status+').');
 return result;
}
function fileCheck(file){
 if(!file||!TYPES.has(file.type)||!file.size||file.size>MAX)throw Error('Use PNG, JPG or WebP up to 10 MB.');
}
async function fileData(file){
 fileCheck(file);
 return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(Error('Could not read image.'));r.readAsDataURL(file);});
}
async function refresh(){
 if(busy)return;
 busy=true;el('sharedAssetRefresh').disabled=true;
 try{
  const perms=await gateway('permissions');canManage=!!perms.canManage;
  el('sharedAssetAdd').hidden=!canManage;
  el('sharedAssetManagerHint').textContent=canManage?'Authorized asset manager':'Read-only shared asset access';
  const result=await gateway('list',{category:el('sharedAssetFilter').value,search:el('sharedAssetSearch').value.trim()});
  rows=result.assets||[];render();
  say(rows.length+' shared asset(s) found.',true);
 }catch(e){rows=[];canManage=false;el('sharedAssetAdd').hidden=true;render();say(e.message);}
 finally{busy=false;el('sharedAssetRefresh').disabled=false;}
}
function button(row,label,fn){
 const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;row.append(b);
}
function render(){
 const list=el('sharedAssetList');list.replaceChildren();
 for(const asset of rows){
  const item=document.createElement('div');item.className='sa-item';
  const detail=document.createElement('div');detail.className='sa-detail';
  const name=document.createElement('strong');name.textContent=asset.name;
  const info=document.createElement('small');info.textContent=asset.category+' · '+Math.ceil(asset.byte_size/1024)+' KB';
  detail.append(name,info);item.append(detail);
  button(item,'Preview',()=>preview(asset));
  button(item,'Use on card',()=>apply(asset));
  if(canManage){button(item,'Rename',()=>rename(asset));button(item,'Replace',()=>replace(asset));button(item,'Delete',()=>remove(asset));}
  list.append(item);
 }
 if(!rows.length){const blank=document.createElement('p');blank.textContent='No shared assets available.';list.append(blank);}
}
async function assetImage(asset){
 const result=await gateway('preview',{id:asset.id});
 const response=await fetch(result.url,{cache:'no-store'});
 if(!response.ok)throw Error('Cannot load asset image.');
 return response.blob();
}
async function preview(asset){
 try{
  const blob=await assetImage(asset);
  if(previewURL)URL.revokeObjectURL(previewURL);
  previewURL=URL.createObjectURL(blob);
  el('sharedAssetPreview').src=previewURL;el('sharedAssetPreview').hidden=false;
  selected=asset;el('sharedAssetSelected').value=asset.name;
  say('Previewing '+asset.name,true);
 }catch(e){say(e.message);}
}
async function apply(asset){
 try{
  const target=el('sharedAssetTarget').value;
  const inputIds={
   card:'cardPhotoUpload',
   logo:'logo',
   front:'frontArtworkUpload',
   back:'backArtworkUpload'
  };
  const input=el(inputIds[target]);
  if(!input)throw Error('The selected image destination is unavailable.');
  if(target==='card'){
   // Existing cardPhotoUpload handler writes to cardPhotoOffer, not merely
   // the visually selected card. Prevent silently applying to the wrong card.
   if(typeof cardPhotoOffer==='undefined'||!cardPhotoOffer)throw Error('Open a product card photo editor and select a filled card first.');
  }
  const blob=await assetImage(asset);
  if(!TYPES.has(blob.type))throw Error('Unsupported stored image type.');
  const suffix={'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[blob.type];
  const file=new File([blob],asset.name+suffix,{type:blob.type});
  const transfer=new DataTransfer();transfer.items.add(file);
  input.files=transfer.files;
  // This triggers Flyer's existing readPhoto/edited pipeline, preserving
  // autosave, photo cropping and export logic.
  input.dispatchEvent(new Event('change',{bubbles:true}));
  selected=asset;el('sharedAssetSelected').value=asset.name;
  say('Sent '+asset.name+' to '+el('sharedAssetTarget').selectedOptions[0].textContent+'. Check the flyer preview.',true);
 }catch(e){say('Could not apply asset: '+e.message);}
}
async function add(){
 if(!canManage)return say('Unauthorized.');
 const file=el('sharedAssetFile').files[0],name=el('sharedAssetName').value.trim(),category=el('sharedAssetCategory').value;
 try{
  if(!name||name.length>120)throw Error('Enter a name between 1 and 120 characters.');
  const base64=await fileData(file);
  await gateway('add',{name,category,mime:file.type,base64});
  el('sharedAssetName').value='';el('sharedAssetFile').value='';await refresh();
 }catch(e){say('Add failed: '+e.message);}
}
async function rename(asset){
 if(!canManage)return;
 const name=prompt('Rename shared asset:',asset.name);
 if(name===null)return;
 try{await gateway('rename',{id:asset.id,name:name.trim()});await refresh();}
 catch(e){say('Rename failed: '+e.message);}
}
async function replace(asset){
 if(!canManage)return;
 const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';
 input.onchange=async()=>{
  try{
   const file=input.files[0],base64=await fileData(file);
   await gateway('replace',{id:asset.id,name:asset.name,category:asset.category,mime:file.type,base64});await refresh();
  }catch(e){say('Replace failed: '+e.message);}
 };input.click();
}
// Optional backup: download an offline package, then save that file to Google Drive.
// This requires no additional account login and never gives Google Drive access
// to the Flyer Studio/ PTG backend. Import restores the assets for TL+ users.
async function exportBackup(){
 try{
  const all=(await gateway('list')).assets||[];
  if(all.length>25)throw Error('Back up in batches: maximum 25 assets per backup file.');
  const files=[],maxBytes=40*1024*1024;
  let total=0;
  for(const asset of all){
   const blob=await assetImage(asset);
   total+=blob.size;if(total>maxBytes)throw Error('The backup exceeds 40 MB. Reduce the asset count.');
   const base64=await fileData(blob);
   files.push({name:asset.name,category:asset.category,mime:blob.type,base64});
  }
  const data={kind:'FlyerStudioSharedAssetBackup',version:1,exportedAt:new Date().toISOString(),assets:files};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='flyer-shared-assets-backup.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  say('Backup file saved. Upload it to your Google Drive for safekeeping.',true);
 }catch(e){say('Backup failed: '+e.message);}
}
async function restoreBackup(file){
 if(!canManage)return say('PTG Team Leader or higher permission required.');
 try{
  if(!file||file.size>55*1024*1024)throw Error('Choose a valid backup up to 55 MB.');
  const json=JSON.parse(await file.text());
  if(json?.kind!=='FlyerStudioSharedAssetBackup'||json?.version!==1||!Array.isArray(json.assets)||json.assets.length>25)
   throw Error('Not a supported Shared Asset Library backup.');
  if(!confirm('Import '+json.assets.length+' assets into the shared library? Existing assets will not be deleted.'))return;
  let count=0;
  for(const a of json.assets){
   if(!a||typeof a.name!=='string'||a.name.length>120||!CATEGORIES.includes(a.category)||!TYPES.has(a.mime)||typeof a.base64!=='string')
    throw Error('Invalid backup asset at position '+(count+1));
   await gateway('add',{name:a.name,category:a.category,mime:a.mime,base64:a.base64});count++;
  }
  await refresh();say('Restored '+count+' shared assets from backup.',true);
 }catch(e){say('Restore failed: '+e.message);}
}
async function remove(asset){
 if(!canManage||!confirm('Permanently delete shared asset "'+asset.name+'"?'))return;
 try{await gateway('delete',{id:asset.id});await refresh();}
 catch(e){say('Delete failed: '+e.message);}
}
function init(){
 if(el('sharedAssetModal'))return;
 const style=document.createElement('style');style.textContent=`#sharedAssetModal[hidden]{display:none!important}#sharedAssetModal{position:fixed;inset:0;z-index:99999;background:#0009;display:flex;align-items:center;justify-content:center;padding:20px}#sharedAssetDialog{width:min(860px,100%);max-height:90vh;overflow:auto;background:white;color:#182333;border-radius:16px;padding:22px;box-shadow:0 20px 65px #0005}#sharedAssetDialog input,#sharedAssetDialog select{padding:9px;max-width:100%}.sa-row{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:12px 0}.sa-row label{display:flex;flex-direction:column;gap:5px}.sa-item{display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid #ddd;flex-wrap:wrap}.sa-detail{flex:1;min-width:170px}.sa-detail small{display:block;color:#667}#sharedAssetNotice{padding:10px;background:#f4f5f8}#sharedAssetNotice[data-ok=true]{background:#e3f4eb}#sharedAssetPreview{max-height:210px;max-width:100%;object-fit:contain}`;
 document.head.append(style);
 const overlay=document.createElement('div');overlay.id='sharedAssetModal';overlay.hidden=true;
 overlay.innerHTML=`<div id="sharedAssetDialog" role="dialog" aria-modal="true" aria-labelledby="sharedAssetTitle">
 <div class="sa-row" style="justify-content:space-between"><h2 id="sharedAssetTitle">Shared Asset Library</h2><button type="button" id="sharedAssetClose">Close</button></div>
 <p id="sharedAssetManagerHint">Sign in with PTG Team Leader or higher. No separate cloud login is required.</p>
 <div class="sa-row"><button type="button" id="sharedAssetConnectPTG">PTG sign-in</button></div>
 <div class="sa-row"><label>Search<input id="sharedAssetSearch" placeholder="Find asset"></label><label>Category<select id="sharedAssetFilter"><option value="">All categories</option>${CATEGORIES.map(c=>'<option value="'+c+'">'+c+'</option>').join('')}</select></label><button type="button" id="sharedAssetRefresh">Refresh</button></div>
 <div id="sharedAssetAdd" hidden><h3>ADD NEW ASSET</h3><div class="sa-row"><label>Name<input id="sharedAssetName" maxlength="120"></label><label>Category<select id="sharedAssetCategory">${CATEGORIES.map(c=>'<option value="'+c+'">'+c+'</option>').join('')}</select></label><label>Image<input type="file" id="sharedAssetFile" accept="image/png,image/jpeg,image/webp"></label><button type="button" id="sharedAssetUpload">ADD</button></div></div>
 <div class="sa-row"><button type="button" id="sharedAssetExport">Export backup for Google Drive</button><label>Restore backup (TL+)<input type="file" id="sharedAssetRestore" accept=".json,application/json"></label></div>\n <p class="sa-hint">Google Drive backup is optional: download this file and upload it to Drive yourself. No Google login is required in Flyer Studio.</p>\n <div id="sharedAssetList"></div><img id="sharedAssetPreview" alt="Shared asset preview" hidden>
 <div class="sa-row"><label>Apply asset to<select id="sharedAssetTarget"><option value="card">Selected product card</option><option value="logo">Campaign logo</option><option value="front">Front sale headline artwork</option><option value="back">Back sale headline artwork</option></select></label><label>Selected asset<input id="sharedAssetSelected" readonly placeholder="None selected"></label></div>
 <p id="sharedAssetNotice" role="status">Open the library to load assets.</p>
 </div>`;
 document.body.append(overlay);
 const launcher=document.createElement('button');launcher.type='button';launcher.id='sharedAssetLauncher';launcher.textContent='+ ADD Assets';launcher.title='Open Shared Asset Library';
 launcher.onclick=()=>{overlay.hidden=false;refresh();};
 (document.querySelector('.stage .toolbar')||document.querySelector('main')||document.body).append(launcher);
 el('sharedAssetClose').onclick=()=>{overlay.hidden=true;launcher.focus();};
 overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.hidden=true;});
 el('sharedAssetConnectPTG').onclick=()=>{
  overlay.hidden=true;
  const user=el('ptgUsername');
  if(user){user.scrollIntoView({block:'center',behavior:'smooth'});user.focus();}
  else say('Open PTG sign-in in the product lookup panel.');
 };
 el('sharedAssetRefresh').onclick=refresh;el('sharedAssetFilter').onchange=refresh;el('sharedAssetSearch').onchange=refresh;el('sharedAssetUpload').onclick=add;
 el('sharedAssetExport').onclick=exportBackup;
 el('sharedAssetRestore').onchange=e=>{const file=e.currentTarget.files[0];e.currentTarget.value='';restoreBackup(file);};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden){overlay.hidden=true;launcher.focus();}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();