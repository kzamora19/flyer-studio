/* Staged Shared Asset UI: calls dual-auth Edge gateway; NOT deployed. */
(()=>{
'use strict';
// Explicit opt-in staging configuration: never direct this unreleased feature
// at production Supabase merely because the main app is configured for it.
const CONFIG=window.FLYER_SHARED_ASSET_CONFIG||null;
const ROOT=CONFIG?.supabaseUrl||'';
const KEY=CONFIG?.publishableKey||'';
const AUTH_STORE='flyer-studio-cloud-auth-v1';
const CATEGORIES=['logos','banners','backgrounds','templates','decorations','other'];
const MAX=10*1024*1024;
const TYPES=new Set(['image/png','image/jpeg','image/webp']);
const el=id=>document.getElementById(id);
let rows=[],canManage=false,busy=false,previewURL='',selected=null;
function say(message,ok=false){el('sharedAssetNotice').textContent=message;el('sharedAssetNotice').dataset.ok=String(ok);}
function cloudSession(){try{return JSON.parse(localStorage.getItem(AUTH_STORE)||'null');}catch{return null;}}
async function cloudAccessToken(){
 let session=cloudSession();
 if(!session?.access_token)throw Error('Sign in to Flyer Studio Cloud first.');
 if((session.expires_at||0)*1000<Date.now()+60000){
  const res=await fetch(ROOT+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
  if(!res.ok)throw Error('Cloud session expired. Sign in again.');
  const refreshed=await res.json();
  session={...session,...refreshed,expires_at:refreshed.expires_at||Math.floor(Date.now()/1000)+(refreshed.expires_in||3600)};
  localStorage.setItem(AUTH_STORE,JSON.stringify(session));
 }
 return session.access_token;
}
async function gateway(action,fields={}){
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(ROOT)||!KEY)throw Error('Shared Asset Library is not configured for an isolated test environment.');
 const ptg=typeof ptgSession!=='undefined'?ptgSession:null;
 if(!ptg?.token||!ptg?.id)throw Error('Connect to PTG with an active account first.');
 const cloud=await cloudAccessToken();
 const response=await fetch(ROOT+'/functions/v1/flyer-shared-assets',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:'Bearer '+cloud,'x-ptg-access-token':ptg.token,'x-ptg-session-id':ptg.id},body:JSON.stringify({action,...fields})});
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
  const blob=await assetImage(asset);
  const input=el('cardPhotoUpload');
  if(!input)throw Error('Card photo upload field is unavailable.');
  const file=new File([blob],asset.name+({'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[blob.type]||'.png'),{type:blob.type});
  const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  selected=asset;el('sharedAssetSelected').value=asset.name;
  say('Image submitted to the current product card. Verify its appearance in preview.',true);
 }catch(e){say(e.message);}
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
 <p id="sharedAssetManagerHint">Connect to PTG and Flyer Studio Cloud to access shared assets.</p>
 <div class="sa-row"><label>Search<input id="sharedAssetSearch" placeholder="Find asset"></label><label>Category<select id="sharedAssetFilter"><option value="">All categories</option>${CATEGORIES.map(c=>'<option value="'+c+'">'+c+'</option>').join('')}</select></label><button type="button" id="sharedAssetRefresh">Refresh</button></div>
 <div id="sharedAssetAdd" hidden><h3>ADD NEW ASSET</h3><div class="sa-row"><label>Name<input id="sharedAssetName" maxlength="120"></label><label>Category<select id="sharedAssetCategory">${CATEGORIES.map(c=>'<option value="'+c+'">'+c+'</option>').join('')}</select></label><label>Image<input type="file" id="sharedAssetFile" accept="image/png,image/jpeg,image/webp"></label><button type="button" id="sharedAssetUpload">ADD</button></div></div>
 <div id="sharedAssetList"></div><img id="sharedAssetPreview" alt="Shared asset preview" hidden>
 <label>Selected asset<input id="sharedAssetSelected" readonly placeholder="None selected"></label>
 <p id="sharedAssetNotice" role="status">Open the library to load assets.</p>
 </div>`;
 document.body.append(overlay);
 const launcher=document.createElement('button');launcher.type='button';launcher.id='sharedAssetLauncher';launcher.textContent='+ ADD Assets';launcher.title='Open Shared Asset Library';
 launcher.onclick=()=>{overlay.hidden=false;refresh();};
 (document.querySelector('.stage .toolbar')||document.querySelector('main')||document.body).append(launcher);
 el('sharedAssetClose').onclick=()=>{overlay.hidden=true;launcher.focus();};
 overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.hidden=true;});
 el('sharedAssetRefresh').onclick=refresh;el('sharedAssetFilter').onchange=refresh;el('sharedAssetSearch').onchange=refresh;el('sharedAssetUpload').onclick=add;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();