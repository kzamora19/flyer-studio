/* PTG-only Shared Asset UI on feature branch; public website NOT deployed. */
(()=>{
'use strict';
// Explicit opt-in release configuration: never enable this feature before
// backend permissions are accepted.
const CONFIG=window.FLYER_SHARED_ASSET_CONFIG||null;
const ROOT=CONFIG?.supabaseUrl||'';
const KEY=CONFIG?.publishableKey||'';
const CATEGORIES=['logos','banners','backgrounds','templates','decorations','other'];
const MAX=10*1024*1024;
const TYPES=new Set(['image/png','image/jpeg','image/webp']);
const el=id=>document.getElementById(id);
let rows=[],canManage=false,busy=false,previewURL='',selected=null,lastSessionId=null;
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
function clearPreview(){
 if(previewURL){URL.revokeObjectURL(previewURL);previewURL='';}
 const image=el('sharedAssetPreview');
 if(image){image.hidden=true;image.removeAttribute('src');}
 const label=el('sharedAssetSelected');if(label)label.value='';
 selected=null;
}
// Prevent a previous PTG account's cached asset list/preview from remaining
// visible when the connection changes, including while a request is pending.
function handleSessionChange(){
 lastSessionId=null;
 clearPreview();
 rows=[];canManage=false;
 el('sharedAssetAdd').hidden=true;
 el('sharedAssetManagerHint').textContent='PTG account changed. Check asset permissions.';
 render();
 say('PTG account changed. Refresh the Shared Asset Library.');
 if(!el('sharedAssetModal').hidden&&!busy)void refresh();
}
async function refresh(){
 if(busy)return;
 const sessionId=typeof ptgSession!=='undefined'&&ptgSession?.id?String(ptgSession.id):'';
 if(sessionId!==lastSessionId){
  clearPreview();lastSessionId=sessionId;
  rows=[];canManage=false;el('sharedAssetAdd').hidden=true;render();
 }
 busy=true;el('sharedAssetRefresh').disabled=true;
 try{
  const perms=await gateway('permissions');
  if(sessionId!==(typeof ptgSession!=='undefined'&&ptgSession?.id?String(ptgSession.id):''))throw Error('PTG session changed while loading assets.');
  canManage=!!perms.canManage;
  el('sharedAssetAdd').hidden=!canManage;
  el('sharedAssetManagerHint').textContent=canManage?'Authorized asset manager':'Read-only shared asset access';
  const result=await gateway('list',{category:el('sharedAssetFilter').value,search:el('sharedAssetSearch').value.trim()});
  if(sessionId!==(typeof ptgSession!=='undefined'&&ptgSession?.id?String(ptgSession.id):''))throw Error('PTG session changed while loading assets.');
  rows=result.assets||[];render();
  say(rows.length+' shared asset(s) found.',true);
 }catch(e){
  clearPreview();rows=[];canManage=false;el('sharedAssetAdd').hidden=true;
  el('sharedAssetManagerHint').textContent='PTG Team Leader or higher sign-in required.';
  render();say(e.message);
 }
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
  button(item,'Use asset',()=>apply(asset));
  if(canManage){button(item,'Rename',()=>rename(asset));button(item,'Replace',()=>replace(asset));button(item,'Delete',()=>remove(asset));}
  list.append(item);
 }
 if(!rows.length){const blank=document.createElement('p');blank.textContent='No shared assets available.';list.append(blank);}
}
async function assetImage(asset){
 const sessionId=typeof ptgSession!=='undefined'&&ptgSession?.id?String(ptgSession.id):'';
 const result=await gateway('preview',{id:asset.id});
 if(sessionId!==(typeof ptgSession!=='undefined'&&ptgSession?.id?String(ptgSession.id):''))throw Error('PTG session changed while loading image.');
 const response=await fetch(result.url,{cache:'no-store'});
 if(!response.ok)throw Error('Cannot load asset image.');
 const blob=await response.blob();
 if(sessionId!==(typeof ptgSession!=='undefined'&&ptgSession?.id?String(ptgSession.id):''))throw Error('PTG session changed while loading image.');
 return blob;
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
  const blob=await assetImage(asset);
  if(!TYPES.has(blob.type))throw Error('Unsupported stored image type.');
  const suffix={'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[blob.type];
  const file=new File([blob],asset.name+suffix,{type:blob.type});
  if(target==='card'){
   // Resolve the currently selected flyer grid slot, not a stale editor photo.
   // This works even when the card editor is closed behind this dialog.
   if(typeof targetedOffer!=='function'||typeof attachUploadedPhoto!=='function')
    throw Error('The product-card editor is unavailable.');
   const offer=targetedOffer();
   if(!offer)throw Error('Select a filled product card before applying a shared photo.');
   if(!await attachUploadedPhoto(offer,file))throw Error('The selected product card changed. Please retry.');
   edited('Shared asset applied to '+offer.sku+'.');
  }else if(target==='logo'){
   if(typeof state==='undefined'||!state.campaign||typeof readPhoto!=='function')
    throw Error('Campaign branding is unavailable.');
   // Classic headers always display the official logo, regardless of the
   // campaign.logo value. Switch to the custom header when a custom asset is
   // explicitly applied so the result is visible in preview and PDF.
   const image=await readPhoto(file);
   state.campaign.logo=image;
   state.campaign.brandHeader='custom';
   edited('Shared logo applied to campaign branding.');
  }else if(target==='front'||target==='back'){
   const input=el(target==='front'?'frontArtworkUpload':'backArtworkUpload');
   if(!input)throw Error('Headline artwork controls are unavailable.');
   const transfer=new DataTransfer();
   transfer.items.add(file);input.files=transfer.files;
   // Reuse the existing image-import listener and its validated save flow.
   input.dispatchEvent(new Event('change',{bubbles:true}));
  }else{
   throw Error('Select a valid asset destination.');
  }
  selected=asset;el('sharedAssetSelected').value=asset.name;
  const destination=el('sharedAssetTarget').selectedOptions[0].textContent;
  say((target==='card'||target==='logo'?'Applied ':'Sent ')+asset.name+' to '+destination+
   '. Check the flyer preview and PDF.',true);
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
// Preflight the entire backup before creating remote assets, so later invalid
// entries cannot cause partially imported libraries.
function validateBackup(data){
 if(data?.kind!=='FlyerStudioSharedAssetBackup'||data?.version!==1||!Array.isArray(data.assets)||data.assets.length>25)
  throw Error('Not a supported Shared Asset Library backup.');
 let total=0;
 for(let i=0;i<data.assets.length;i++){
  const a=data.assets[i];
  if(!a||typeof a.name!=='string'||!a.name.trim()||a.name.trim().length>120||!CATEGORIES.includes(a.category)||!TYPES.has(a.mime)||typeof a.base64!=='string')
   throw Error('Invalid backup asset at position '+(i+1)+'.');
  const value=a.base64;
  if(value.length<12||value.length>Math.ceil(MAX*4/3)+8||value.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))
   throw Error('Invalid encoded image at position '+(i+1)+'.');
  const pad=value.endsWith('==')?2:value.endsWith('=')?1:0;
  const size=value.length/4*3-pad;
  if(size<=0||size>MAX)throw Error('Image at position '+(i+1)+' exceeds the 10 MB limit.');
  total+=size;
  if(total>40*1024*1024)throw Error('Backup exceeds the 40 MB image limit.');
  let signature;
  try{signature=atob(value.slice(0,16));}catch{throw Error('Invalid encoded image at position '+(i+1)+'.');}
  const png=a.mime==='image/png'&&signature.length>=8&&[137,80,78,71,13,10,26,10].every((b,j)=>signature.charCodeAt(j)===b);
  const jpg=a.mime==='image/jpeg'&&signature.length>=3&&signature.charCodeAt(0)===255&&signature.charCodeAt(1)===216&&signature.charCodeAt(2)===255;
  const webp=a.mime==='image/webp'&&signature.startsWith('RIFF')&&signature.slice(8,12)==='WEBP';
  if(!(png||jpg||webp))throw Error('Image signature mismatch at position '+(i+1)+'.');
 }
 return data.assets;
}
async function restoreBackup(file){
 if(!canManage)return say('PTG Team Leader or higher permission required.');
 let imported=0,planned=0;
 try{
  if(!file||file.size>55*1024*1024)throw Error('Choose a valid backup up to 55 MB.');
  const assets=validateBackup(JSON.parse(await file.text()));
  planned=assets.length;
  if(!planned)return say('The backup contains no assets to restore.');
  if(!confirm('Import '+planned+' assets into the shared library? Existing assets will not be deleted.'))return;
  for(const asset of assets){
   await gateway('add',{name:asset.name.trim(),category:asset.category,mime:asset.mime,base64:asset.base64});
   imported++;
  }
  await refresh();say('Restored '+imported+' shared assets from backup.',true);
 }catch(e){
  if(imported){
   await refresh();
   say('Restore interrupted after '+imported+' of '+planned+' assets. The imported items are retained; check the library before retrying. '+e.message);
  }else say('Restore failed: '+e.message);
 }
}
async function remove(asset){
 if(!canManage||!confirm('Permanently delete shared asset "'+asset.name+'"?'))return;
 try{await gateway('delete',{id:asset.id});await refresh();}
 catch(e){say('Delete failed: '+e.message);}
}
function init(){
 if(el('sharedAssetModal'))return;
 const style=document.createElement('style');style.textContent=`#sharedAssetModal[hidden]{display:none!important}#sharedAssetModal{position:fixed;inset:0;z-index:99999;background:transparent;pointer-events:none;display:flex;align-items:flex-start;justify-content:flex-end;padding:12px}#sharedAssetDialog{width:min(550px,100%);max-height:calc(100dvh - 88px);overflow:auto;pointer-events:auto;background:white;color:#182333;border-radius:16px;padding:22px;box-shadow:0 20px 65px #0005}#sharedAssetDialog input,#sharedAssetDialog select{padding:9px;max-width:100%}.sa-row{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:12px 0}.sa-row label{display:flex;flex-direction:column;gap:5px}.sa-item{display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid #ddd;flex-wrap:wrap}.sa-detail{flex:1;min-width:170px}.sa-detail small{display:block;color:#667}#sharedAssetNotice{padding:10px;background:#f4f5f8}#sharedAssetNotice[data-ok=true]{background:#e3f4eb}#sharedAssetPreview{max-height:210px;max-width:100%;object-fit:contain}#sharedAssetDialog .sa-drag-handle{cursor:grab;touch-action:none;user-select:none}#sharedAssetDialog .sa-drag-handle button{cursor:pointer;touch-action:auto}@media(max-width:700px){#sharedAssetModal{align-items:flex-end;padding:8px}#sharedAssetDialog{width:100%;max-height:55dvh;padding:14px}}`;
 document.head.append(style);
 const overlay=document.createElement('div');overlay.id='sharedAssetModal';overlay.hidden=true;
 overlay.innerHTML=`<div id="sharedAssetDialog" role="dialog" aria-modal="false" aria-labelledby="sharedAssetTitle">
 <div class="sa-row sa-drag-handle" style="justify-content:space-between"><h2 id="sharedAssetTitle">Shared Asset Library</h2><button type="button" id="sharedAssetClose">Close</button></div>
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
  if(typeof ptgSession!=='undefined'&&ptgSession?.token){
   say('PTG is already connected. Click Refresh to check asset permissions.',true);return;
  }
  if(typeof ptgLocalOrigin==='function'&&!ptgLocalOrigin()){
   say('For local PTG sign-in, open Flyer Studio on http://127.0.0.1:3000/ instead of port 5500.');return;
  }
  if(typeof openCard!=='function'||typeof switchCardTab!=='function'){
   say('PTG sign-in is not available in this editor.');return;
  }
  overlay.hidden=true;
  openCard(slotTarget.section,Number(slotTarget.slot));
  switchCardTab('lookup');
  const username=el('ptgUsername');
  if(username&&!username.closest('[hidden]'))username.focus();
 };
 window.addEventListener('megaflyer:ptg-session-changed',handleSessionChange);
 el('sharedAssetRefresh').onclick=refresh;el('sharedAssetFilter').onchange=refresh;el('sharedAssetSearch').onchange=refresh;el('sharedAssetUpload').onclick=add;
 el('sharedAssetExport').onclick=exportBackup;
 el('sharedAssetRestore').onchange=e=>{const file=e.currentTarget.files[0];e.currentTarget.value='';restoreBackup(file);};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden){overlay.hidden=true;launcher.focus();}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();