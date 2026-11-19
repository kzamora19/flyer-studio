/* Flyer Studio Shared Assets — staged feature (not deployed).
   Permission is enforced by Supabase RLS; no PTG role is trusted from local UI.
   PTG membership provisioning must happen server-side before rollout. */
(() => {
'use strict';
const ROOT='https://tzklsscoiwnmeantcefw.supabase.co';
const KEY='sb_publishable_djhRIa3KhHbG0tOzQnXrIA_Ou-fJnmK';
const AUTH_KEY='flyer-studio-cloud-auth-v1';
const BUCKET='flyer-shared-assets';
const CATEGORIES=['logos','banners','backgrounds','templates','decorations','other'];
const MIME={'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'};
const MAX_BYTES=10*1024*1024;
let selected=null,assetRows=[],access=null,loading=false;

const el=id=>document.getElementById(id);
function announce(message,ok=false){const node=el('sharedAssetNotice');node.textContent=message;node.dataset.ok=String(ok);}
function session(){try {return JSON.parse(localStorage.getItem(AUTH_KEY)||'null');}catch{return null;}}
async function request(path,{method='GET',body,raw=false,headers={}}={}){
 let credentials=session();
 if(!credentials?.access_token)throw Error('Sign in to Flyer Studio Cloud first, then reopen Shared Assets.');
 if((credentials.expires_at||0)*1000<Date.now()+60000){
  const res=await fetch(ROOT+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:credentials.refresh_token})});
  if(!res.ok)throw Error('Cloud session expired. Sign in again.');
  const refreshed=await res.json();
  credentials={...credentials,...refreshed,expires_at:refreshed.expires_at||Math.floor(Date.now()/1000)+(refreshed.expires_in||3600)};
  localStorage.setItem(AUTH_KEY,JSON.stringify(credentials));
 }
 const token=credentials.access_token;
 const h={apikey:KEY,Authorization:'Bearer '+token,...headers};
 if(body!==undefined && !(body instanceof Blob))h['Content-Type']='application/json';
 const r=await fetch(ROOT+path,{method,headers:h,body:body===undefined?undefined:body instanceof Blob?body:JSON.stringify(body),cache:'no-store'});
 if(!r.ok){let reason='Request failed ('+r.status+').';try{const x=await r.json();reason=x.message||x.error_description||x.error||reason;}catch{}throw Error(reason);}
 if(raw)return r;
 const txt=await r.text();return txt?JSON.parse(txt):null;
}
const esc=s=>encodeURIComponent(s);
async function account(){
 const user=await request('/auth/v1/user');
 const list=await request('/rest/v1/flyer_asset_memberships?select=can_view,can_manage&user_id=eq.'+esc(user.id));
 if(!list?.[0]?.can_view)throw Error('Your cloud account is not authorized for the Shared Library.');
 return {id:user.id,...list[0]};
}
async function refresh(){
 if(loading)return;
 loading=true;
 try {
  access=await account();
  el('sharedAssetAdd').hidden=!access.can_manage;
  el('sharedAssetManagerHint').textContent=access.can_manage?'You can add and manage shared assets.':'Read-only: shared assets are available for reuse.';
  const category=el('sharedAssetFilter').value,query=el('sharedAssetSearch').value.trim();
  let p='select=id,name,category,storage_path,mime_type,byte_size,created_at&order=name.asc&limit=200';
  if(category)p+='&category=eq.'+esc(category);
  if(query)p+='&name=ilike.'+esc('*'+query.replace(/[*,()]/g,'')+'*');
  assetRows=await request('/rest/v1/flyer_shared_assets?'+p)||[];
  draw();
  announce(assetRows.length+' shared asset(s) found.',true);
 }catch(e){access=null;assetRows=[];draw();announce(e.message);}
 finally{loading=false;}
}
function draw(){
 const list=el('sharedAssetList');list.replaceChildren();
 for(const asset of assetRows){
  const row=document.createElement('div');row.className='sa-item';
  const detail=document.createElement('div');detail.className='sa-detail';
  const title=document.createElement('strong');title.textContent=asset.name;
  const small=document.createElement('small');small.textContent=asset.category+' · '+Math.ceil(asset.byte_size/1024)+' KB';
  detail.append(title,small);row.append(detail);
  const btn=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;row.append(b);};
  btn('Preview',()=>preview(asset));
  btn('Select',()=>use(asset));
  btn('Apply to card',()=>applyToCard(asset));
  if(access?.can_manage){btn('Rename',()=>rename(asset));btn('Replace',()=>replace(asset));btn('Delete',()=>remove(asset));}
  list.append(row);
 }
 if(!assetRows.length){const p=document.createElement('p');p.textContent='No assets in this category.';list.append(p);}
}
async function urlFor(asset){
 const r=await request('/storage/v1/object/sign/'+BUCKET+'/'+asset.storage_path.split('/').map(esc).join('/'),{
  method:'POST',body:{expiresIn:300}
 });
 if(!r?.signedURL && !r?.signedUrl)throw Error('Could not create a private preview URL.');
 const value=r.signedURL||r.signedUrl;
 return value.startsWith('http')?value:ROOT+'/storage/v1'+(value.startsWith('/')?value:'/'+value);
}
async function preview(asset){
 try{const url=await urlFor(asset);el('sharedAssetPreview').src=url;el('sharedAssetPreview').hidden=false;selected=asset;announce('Previewing '+asset.name,true);}
 catch(e){announce(e.message);}
}
async function use(asset){
 try {
  const url=await urlFor(asset);
  const response=await fetch(url);
  if(!response.ok)throw Error('Could not read this asset.');
  const blob=await response.blob();
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
  // Asset selection deliberately does not alter any flyer automatically.
  // Existing photo import workflows can consume this data URL.
  window.dispatchEvent(new CustomEvent('flyerstudio:shared-asset-selected',{detail:{id:asset.id,name:asset.name,category:asset.category,dataUrl:data}}));
  const copy=el('sharedAssetSelected');copy.value=asset.name;
  window.flyerSelectedSharedAsset={id:asset.id,name:asset.name,category:asset.category,dataUrl:data};
  announce('Selected '+asset.name+'. Use the existing image import workflow to place it on a flyer.',true);
 }catch(e){announce(e.message);}
}
function fileCheck(file){
 if(!file||!(file.type in MIME)||file.size<1||file.size>MAX_BYTES)throw Error('Choose PNG, JPG or WebP up to 10 MB.');
}
async function applyToCard(asset){
 try{
  const url=await urlFor(asset);
  const response=await fetch(url);if(!response.ok)throw Error('Cannot retrieve the selected image.');
  const blob=await response.blob();
  const input=el('cardPhotoUpload');
  if(!input)throw Error('Product card photo editor was not found.');
  const file=new File([blob],asset.name+MIME[blob.type],{type:blob.type});
  const transfer=new DataTransfer();transfer.items.add(file);
  input.files=transfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  announce('Sent '+asset.name+' to the current card photo editor. Check the card preview.',true);
 }catch(e){announce('Could not apply asset: '+e.message);}
}
async function uploadFile(file){
 fileCheck(file);
 const user=await account();
 if(!user.can_manage)throw Error('Asset manager permission required.');
 const path=user.id+'/'+crypto.randomUUID()+MIME[file.type];
 await request('/storage/v1/object/'+BUCKET+'/'+path,{method:'POST',body:file,headers:{'Content-Type':file.type,'x-upsert':'false'}});
 return path;
}
async function add(){
 try{
  const file=el('sharedAssetFile').files[0],name=el('sharedAssetName').value.trim(),category=el('sharedAssetCategory').value;
  fileCheck(file);
  if(!name||name.length>120||!CATEGORIES.includes(category))throw Error('Enter a name (1–120 characters) and category.');
  const path=await uploadFile(file);
  try{
   await request('/rest/v1/flyer_shared_assets',{method:'POST',headers:{Prefer:'return=representation'},body:{name,category,storage_path:path,mime_type:file.type,byte_size:file.size,created_by:access.id,updated_by:access.id}});
  }catch(e){await request('/storage/v1/object/'+BUCKET,{method:'DELETE',body:{prefixes:[path]}}).catch(()=>{});throw e;}
  el('sharedAssetName').value='';el('sharedAssetFile').value='';
  await refresh();
 }catch(e){announce('Add failed: '+e.message);}
}
async function rename(asset){
 const name=prompt('Rename shared asset:',asset.name)?.trim();
 if(name===undefined)return;
 if(!name||name.length>120)return announce('Name must be 1–120 characters.');
 try{
  await request('/rest/v1/flyer_shared_assets?id=eq.'+esc(asset.id),{method:'PATCH',body:{name,updated_by:access.id,updated_at:new Date().toISOString()}});
  await refresh();
 }catch(e){announce('Rename failed: '+e.message);}
}
async function replace(asset){
 const fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='image/png,image/jpeg,image/webp';
 fileInput.onchange=async()=>{
  let path;
  try{
   const file=fileInput.files[0];fileCheck(file);path=await uploadFile(file);
   await request('/rest/v1/flyer_shared_assets?id=eq.'+esc(asset.id),{method:'PATCH',body:{storage_path:path,mime_type:file.type,byte_size:file.size,updated_by:access.id,updated_at:new Date().toISOString()}});
   await request('/storage/v1/object/'+BUCKET,{method:'DELETE',body:{prefixes:[asset.storage_path]}}).catch(()=>{});
   await refresh();
  }catch(e){if(path)await request('/storage/v1/object/'+BUCKET,{method:'DELETE',body:{prefixes:[path]}}).catch(()=>{});announce('Replace failed: '+e.message);}
 };
 fileInput.click();
}
async function remove(asset){
 if(!confirm('Permanently delete shared asset "'+asset.name+'"?'))return;
 try{
  await request('/rest/v1/flyer_shared_assets?id=eq.'+esc(asset.id),{method:'DELETE'});
  await request('/storage/v1/object/'+BUCKET,{method:'DELETE',body:{prefixes:[asset.storage_path]}}).catch(()=>{});
  await refresh();
 }catch(e){announce('Delete failed: '+e.message);}
}
function init(){
 if(el('sharedAssetModal'))return;
 const style=document.createElement('style');
 style.textContent=`#sharedAssetModal[hidden]{display:none!important}#sharedAssetModal{position:fixed;inset:0;z-index:99999;background:#0009;display:flex;align-items:center;justify-content:center;padding:20px}#sharedAssetDialog{width:min(860px,100%);max-height:90vh;overflow:auto;background:white;color:#182333;border-radius:16px;padding:22px;box-shadow:0 20px 65px #0005}#sharedAssetDialog input,#sharedAssetDialog select{padding:9px;max-width:100%}.sa-row{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:12px 0}.sa-row label{display:flex;flex-direction:column;gap:5px}.sa-item{display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid #ddd;flex-wrap:wrap}.sa-detail{flex:1;min-width:170px}.sa-detail small{display:block;color:#667}#sharedAssetNotice{padding:10px;background:#f4f5f8}#sharedAssetNotice[data-ok=true]{background:#e3f4eb}#sharedAssetPreview{max-height:210px;max-width:100%;object-fit:contain}`;
 document.head.append(style);
 const overlay=document.createElement('div');overlay.id='sharedAssetModal';overlay.hidden=true;
 overlay.innerHTML=`<div id="sharedAssetDialog" role="dialog" aria-modal="true" aria-labelledby="sharedAssetTitle">
 <div class="sa-row" style="justify-content:space-between"><h2 id="sharedAssetTitle">Shared Asset Library</h2><button id="sharedAssetClose" type="button">Close</button></div>
 <p id="sharedAssetManagerHint">Sign in to Flyer Studio Cloud to access shared assets.</p>
 <div class="sa-row"><label>Search<input id="sharedAssetSearch" placeholder="Find asset"></label><label>Category<select id="sharedAssetFilter"><option value="">All categories</option>${CATEGORIES.map(c=>'<option value="'+c+'">'+c+'</option>').join('')}</select></label><button type="button" id="sharedAssetRefresh">Refresh</button></div>
 <div id="sharedAssetAdd" hidden><h3>ADD NEW ASSET</h3><div class="sa-row"><label>Name<input id="sharedAssetName" maxlength="120"></label><label>Category<select id="sharedAssetCategory">${CATEGORIES.map(c=>'<option value="'+c+'">'+c+'</option>').join('')}</select></label><label>Image<input type="file" id="sharedAssetFile" accept="image/png,image/jpeg,image/webp"></label><button id="sharedAssetUpload" type="button">ADD</button></div></div>
 <div id="sharedAssetList"></div><img id="sharedAssetPreview" alt="Selected asset preview" hidden>
 <label>Selected asset<input id="sharedAssetSelected" readonly placeholder="None selected"></label>
 <p id="sharedAssetNotice" role="status">Open the library to load assets.</p></div>`;
 document.body.append(overlay);
 const launcher=document.createElement('button');launcher.type='button';launcher.id='sharedAssetLauncher';launcher.textContent='+ ADD Assets';launcher.title='Open shared asset library';
 launcher.onclick=()=>{overlay.hidden=false;refresh();};
 (document.querySelector('.stage .toolbar')||document.querySelector('main')||document.body).append(launcher);
 el('sharedAssetClose').onclick=()=>{overlay.hidden=true;launcher.focus();};
 overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.hidden=true;});
 el('sharedAssetRefresh').onclick=refresh;
 el('sharedAssetFilter').onchange=refresh;
 el('sharedAssetSearch').addEventListener('change',refresh);
 el('sharedAssetUpload').onclick=add;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
