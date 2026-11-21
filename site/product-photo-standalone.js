/* Standalone MegaFlyer bridge. All cloud photo actions use PTG live-session
 * verification in the private Supabase Edge gateway, not browser role flags.
 * The protected Studio uses its opaque-frame MessagePort bridge instead. */
(()=>{
'use strict';
if(window.__MEGAFLYER_PRIVATE_DB__ || window.__MEGAFLYER_PHOTO_RPC__)return;
const isLive=location.origin==='https://kzamora19.github.io' &&
 location.pathname.startsWith('/flyer-studio/');
if(!isLive && window.MEGAFLYER_SMART_PHOTO_LOCAL_TEST!==true)return;
const cfg=window.FLYER_SHARED_ASSET_CONFIG||{};
const endpoint='https://tzklsscoiwnmeantcefw.supabase.co/functions/v1/flyer-product-photos';
const actions=new Set(['permissions','resolve','search','image','upload','replace','setPrimary','remove']);
window.__MEGAFLYER_PHOTO_RPC__=async(action,fields={},account)=>{
 if(!actions.has(action)||!account||typeof account.token!=='string'||
    account.token.length<24||typeof account.id!=='string'||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(account.id))
  throw Error('PTG Team Leader or higher account required.');
 if(cfg.supabaseUrl!=='https://tzklsscoiwnmeantcefw.supabase.co'||
    typeof cfg.publishableKey!=='string'||!cfg.publishableKey)
  throw Error('Product Photo Library is not configured.');
 const payload=JSON.stringify({action,...fields});
 if(payload.length>3500000)throw Error('Product photo request is too large.');
 const response=await fetch(endpoint,{method:'POST',cache:'no-store',
  credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',
  headers:{'Content-Type':'application/json',apikey:cfg.publishableKey,
   Authorization:'Bearer '+account.token,'x-ptg-session-id':account.id},
  body:payload});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(typeof data?.error==='string'?data.error:
  'Product photo service unavailable.');
 return data;
};
function load(path){
 return new Promise((resolve,reject)=>{
  const node=document.createElement('script');
  node.src=path;node.async=false;node.onload=resolve;node.onerror=()=>reject(Error('Photo library script not available.'));
  document.head.append(node);
 });
}
void load('./product-photo-match.js')
 .then(()=>load('./product-photo-library.js'))
 .catch(()=>{/* Keep the existing flyer editor fully functional offline. */});
})();
