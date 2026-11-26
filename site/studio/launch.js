/* STAGING ONLY — non-deployed proof-of-possession PTG Studio launcher. */
(()=>{'use strict';
const cfg=window.STUDIO_ACCESS_CONFIG||{};
const status=document.getElementById('status'),mount=document.getElementById('mount');
const cloudPanel=document.getElementById('cloudPanel'),cloudNote=document.getElementById('cloudMessage');
const portal='https://kzamora19.github.io/first-megasaver-ptg/studios/';
let timer=null,expiryTimer=null,active=false,checking=false,expiresAt=0,absoluteCutoff=0,expiryWarned=false;
let privateKey=null,sessionId='',challenge='',draftPort=null,catalogPort=null;
let proofQueue=Promise.resolve();
// Background revocation checks and protected photo operations consume the
// SAME rotating one-use PTG challenge. Always serialize them in the parent.
function withProof(fn){
 const next=proofQueue.then(fn);
 proofQueue=next.catch(()=>{});
 return next;
}
function note(message,link=false){
 status.removeAttribute("data-loading");
 status.textContent=message;
 if(link){const a=document.createElement('a');a.href=portal;a.rel='noreferrer';a.textContent='Open from PTG Creative Studios';status.append(document.createTextNode(' '),a);}
 status.hidden=false;
}
function renderWorkspaceIdentity(identity) {
  const account = document.getElementById("workspace-account");
  if (!account) return;
  const name = typeof identity?.name === "string" ? identity.name.trim() : "";
  const role = typeof identity?.role === "string" ? identity.role.trim() : "";
  account.querySelector("strong").textContent = name;
  account.querySelector("small").textContent = role;
  account.hidden = !name || !role;
  if (account.hidden) account.open = false;
}
function lock(message){
 renderWorkspaceIdentity(null);
 active=false;checking=false;privateKey=null;sessionId='';challenge='';
 if(timer)clearInterval(timer);if(expiryTimer)clearTimeout(expiryTimer);
 if(draftPort){draftPort.close();draftPort=null;}
 if(catalogPort){catalogPort.close();catalogPort=null;}
 timer=null;expiryTimer=null;
 // The editor is origin-isolated: never reach into its DOM or storage.
 // Local backup must be completed before expiry, or via a future scoped bridge.
 mount.replaceChildren();if(cloudPanel)cloudPanel.hidden=true;
 window.BRANCHLINE_CENTRAL_DRIVE?.lock();note(message,true);
}
function validSession(data){
 return data?.ok===true && typeof data.sessionId==='string' &&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.sessionId) &&
 typeof data.challenge==='string'&&/^[A-Za-z0-9_-]{43}$/.test(data.challenge);
}
function recordAuth(data){
 if(!validSession(data)||sessionId&&sessionId!==data.sessionId)throw Error('Invalid PTG signed session.');
 const when=Date.parse(data.expiresAt),now=Date.now();
 if(!Number.isFinite(when)||when<=now||when-now>2*60*60*1000+10000)throw Error('PTG session has expired or is invalid.');
 if(!absoluteCutoff)absoluteCutoff=when;
 expiresAt=Math.min(when,absoluteCutoff);
 sessionId=data.sessionId;challenge=data.challenge;
 if(expiryTimer)clearTimeout(expiryTimer);
 expiryTimer=setTimeout(()=>lock('PTG access expired. Your locally saved projects may still be available when you sign in again.'),Math.max(1,expiresAt-Date.now()));
}
function warnIfExpiring(){
 const remaining=expiresAt-Date.now();
 if(active&&remaining>0&&remaining<=2*60*1000&&!expiryWarned){
  expiryWarned=true;note('PTG session is about to expire. Save your project and reopen it from PTG.',true);
 }
}
const params=new URLSearchParams(location.hash.startsWith('#')?location.hash.slice(1):'');
// Strip launch ticket before any remote request, images or editor content are loaded.
try{history.replaceState(null,'',location.pathname+location.search)}catch{location.hash='';}
let ticket=params.get('ptg_studio_ticket')||'';
if(!/^[A-Za-z0-9_-]{43}$/.test(ticket)){lock('A valid PTG authorization is required.');return;}
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/flyer-editor-delivery$/.test(String(cfg.endpoint||''))){
 lock('The protected Studio service is not configured.');return;
}
const deviceLayout=window.BranchlineFlyerDeviceLayout;
if(typeof deviceLayout?.apply!=='function'){
 lock('MegaFlyer workspace layout could not load. Reopen the Studio from PTG.');return;
}
function base64url(array){
 let raw='';for(const byte of new Uint8Array(array))raw+=String.fromCharCode(byte);
 return btoa(raw).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
async function gateway(payload){
 const headers={'Content-Type':'application/json'};
 if(cfg.publishableKey)headers.apikey=cfg.publishableKey;
 const response=await fetch(cfg.endpoint,{method:'POST',headers,cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',
  body:JSON.stringify(payload)});
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.ok!==true)throw Error('Authorization unavailable or expired.');
 return data;
}
async function signedRequest(){
 if(!privateKey||!sessionId||!challenge)throw Error('PTG proof is unavailable.');
 const message='ptg-studio-v1|flyer|'+sessionId+'|'+challenge;
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,new TextEncoder().encode(message));
 return {action:'check',sessionId,challenge,signature:base64url(signature)};
}
async function check(){
 if(!active||checking)return;
 if(Date.now()>=expiresAt){lock('PTG access expired. Open the Studio again from PTG.');return;}
 checking=true;
 try{
  await withProof(async()=>{
   if(!active||Date.now()>=expiresAt)return;
   const result=await gateway(await signedRequest());
   if(!active)return;
   recordAuth(result);renderWorkspaceIdentity(result.workspaceIdentity);warnIfExpiring();
  });
 }catch{lock('PTG access has expired, been revoked, or cannot be verified. Open the Studio again from PTG.');}
 finally{checking=false;}
}
document.addEventListener('visibilitychange',()=>{
 if(!active||document.visibilityState!=='visible')return;
 if(Date.now()>=expiresAt)lock('PTG access expired. Open the Studio again from PTG.');
 else void check();
});
// Manual PTG-account AES-GCM cloud backup. Never automatically synchronize
// customer photos; the protected parent signs every cloud call in memory.
async function cloudOperation(operation,fields={}){
 return withProof(async()=>{
  if(!active||Date.now()>=expiresAt)throw Error('PTG Studio session expired.');
  try{
   const signed=await signedRequest();
   const data=await gateway({...signed,action:'cloud',operation,...fields});
   recordAuth(data);
   if(!data.cloud||typeof data.cloud.status!=='string')
    throw Error('PTG encrypted cloud service unavailable.');
   return data.cloud;
  }catch(error){
   lock('PTG cloud session could not be verified. Reopen the Studio from PTG.');
   throw error;
  }
 });
}
async function centralDriveOperation(operation,fields={}){
 return withProof(async()=>{
  if(!active||Date.now()>=expiresAt)throw Error('PTG Studio session expired.');
  let data;
  try{
   const signed=await signedRequest();
   data=await gateway({...signed,action:'drive',operation,...fields});
   if(!active)throw Error('PTG Studio authorization ended.');
   recordAuth(data);
  }catch(error){
   lock('PTG company Drive authorization could not be verified.');
   throw error;
  }
  if(!data.drive||typeof data.drive.status!=='string')
   throw Error('Invalid central Google Drive response.');
  return data.drive;
 });
}
function setupCloud(vault){
 if(!cloudPanel||!cloudNote)return;
 let busy=false;
 const tell=message=>{cloudNote.textContent=message;};
 const wrap=fn=>async()=>{
  if(busy||!active)return;
  busy=true;
  for(const button of cloudPanel.querySelectorAll('button'))button.disabled=true;
  try{await fn();}catch(error){tell(error?.message||'Encrypted cloud project unavailable.');}
  finally{busy=false;for(const button of cloudPanel.querySelectorAll('button'))button.disabled=false;}
 };
 document.getElementById('cloudBackup').onclick=wrap(async()=>{
  const record=await vault.cloudExport('p:current');
  if(!record)throw Error('Save the current project locally before backing up to cloud.');
  const list=await cloudOperation('list');
  if(list.status!=='ok')throw Error('Encrypted cloud archive unavailable.');
  const found=(list.items||[]).find(x=>x.record_key==='p:current');
  if(found&&!window.confirm('Replace the existing encrypted cloud backup of this project?'))return;
  const response=await cloudOperation('write',{
   recordKey:'p:current',...record,expectedVersion:found?.version||0
  });
  if(response.status==='conflict')throw Error('A different device updated this project. Retrieve or retry after reviewing the cloud version.');
  if(response.status!=='ok')throw Error('Cloud archive could not save this project. Keep your local backup.');
  tell('Encrypted cloud project saved. No automatic customer-photo uploads.');
 });
 document.getElementById('cloudRestore').onclick=wrap(async()=>{
  const local=await vault.read('p:current');
  if(local&&!window.confirm('Replace the current local project with your encrypted cloud version?'))return;
  const response=await cloudOperation('read',{recordKey:'p:current'});
  if(response.status!=='ok'||!response.record)throw Error('No cloud project is available to retrieve.');
  await vault.cloudImport('p:current',response.record);
  tell('Encrypted project retrieved to this device. Reopen MegaFlyer through PTG to load the restored project.');
 });
 cloudPanel.hidden=false;
 tell('Cloud backup is optional and encrypted. Save locally first. Large image projects may require local export.');
}
// The catalog is public, but the opaque private editor cannot call the
// origin-restricted Edge Function directly. Relay only its two fixed operations.
const catalogEndpoint='https://tzklsscoiwnmeantcefw.supabase.co/functions/v1/flyer-catalog';
async function relayStoreCatalog(message){
 const p=new URLSearchParams();
 if(message.mode==='photos'){
  if(typeof message.sku!=='string'||!message.sku.trim()||message.sku.length>100||
     typeof message.model!=='string'||message.model.length>100)throw Error('Invalid store product lookup.');
  p.set('mode','photos');p.set('sku',message.sku.trim());p.set('model',message.model.trim());
 }else if(message.mode==='image'){
  const url=new URL(String(message.url||''));
  if(url.origin!=='https://www.1stmegasaver.com.ph'||url.username||url.password||
     !url.pathname.startsWith('/wp-content/uploads/')||url.href.length>2048)throw Error('Invalid store image URL.');
  p.set('mode','image');p.set('url',url.href);
 }else throw Error('Unsupported store photo action.');
 const response=await fetch(catalogEndpoint+'?'+p,{method:'GET',credentials:'omit',
   redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});
 const type=response.headers.get('content-type')||'';
 if(!response.ok){
  const payload=await response.json().catch(()=>null);
  throw Error(typeof payload?.error==='string'?payload.error:'Store catalog returned HTTP '+response.status+'.');
 }
 if(message.mode==='photos'&&!type.toLowerCase().startsWith('application/json'))throw Error('Unexpected catalog response.');
 if(message.mode==='image'&&!/^image\/(png|jpeg|webp)(?:;|$)/i.test(type))throw Error('Unsupported catalog image.');
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength>(message.mode==='photos'?1024*1024:20*1024*1024))throw Error('Catalog response exceeds size limit.');
 return {type,bytes};
}
function installCatalogRelay(){
 let port=null,sequence=0;
 const pending=new Map();
 let readyResolve;
 const ready=new Promise(resolve=>{readyResolve=resolve;});
 window.addEventListener('message',function receive(event){
  if(event.source!==parent||event.data?.kind!=='megaflyer-public-catalog-port'||!event.ports?.[0])return;
  window.removeEventListener('message',receive);
  port=event.ports[0];
  port.onmessage=({data})=>{
   const request=pending.get(data?.id);if(!request)return;
   pending.delete(data.id);clearTimeout(request.timer);
   if(data.ok)request.resolve(new Response(data.value.bytes,{headers:{'Content-Type':data.value.type}}));
   else request.reject(Error(data.error||'Store catalog unavailable.'));
  };
  port.start();readyResolve();
 });
 window.__MEGAFLYER_CATALOG_RPC__=async function(fields){
  let readyTimer;try{await Promise.race([ready,new Promise((_,reject)=>{readyTimer=setTimeout(()=>reject(Error('Store catalog connection is unavailable. Reopen MegaFlyer.')),5000);})]);}
  finally{clearTimeout(readyTimer);}
  return new Promise((resolve,reject)=>{
   const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Store photo request timed out.'));},25000);
   pending.set(id,{resolve,reject,timer});port.postMessage({...fields,id});
  });
 };
}
function withCatalogRelay(html){
 // Installed locally after the signed editor package has passed verification.
 // Never share credentials, allow arbitrary URLs, or change the sandbox flags.
 const script='<script>('+installCatalogRelay.toString()+')();<\/script>';
 const at=html.search(/<script(?:\s|>)/i);
 return at<0?html+script:html.slice(0,at)+script+html.slice(at);
}
async function open(){
 try{
  // An in-memory non-extractable private key avoids a reusable browser bearer.
  // Refreshing the page requires a fresh PTG launcher ticket.
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
  privateKey=pair.privateKey;
  const publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey);
  const data=await gateway({action:'load',ticket,publicKey});
  ticket=''; // Do not use the redeemed launch ticket for subsequent checks.
  if(typeof data.html!=='string'||!data.html.startsWith('<!-- PRIVATE EDITOR BUNDLE')||
     !/^[a-f0-9]{64}$/.test(String(data.sha256||'')))throw Error('Invalid private editor package');
  // Reject any substituted or corrupted package before running editor code.
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.html));
  const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==data.sha256)throw Error('Protected Studio package integrity failed');
  if(!window.MEGAFLYER_LOCAL_DRAFT_VAULT ||
     !/^[A-Za-z0-9_-]{43}$/.test(String(data.draftScope||'')) ||
     !/^[A-Za-z0-9_-]{43}$/.test(String(data.draftKey||'')))
    throw Error('Verified PTG account encrypted recovery is unavailable.');
  const vault=window.MEGAFLYER_LOCAL_DRAFT_VAULT.session(data.draftScope,data.draftKey);
  recordAuth(data);
  renderWorkspaceIdentity(data.workspaceIdentity);
  const frame=document.createElement('iframe');
  frame.id='studio-editor-frame';frame.referrerPolicy='no-referrer';frame.title='MegaFlyer editor (authorized PTG session)';
  // about:srcdoc WITHOUT an opaque sandbox inherits the shared github.io origin.
  // Disallow allow-same-origin: editor scripts must never read PTG/Branchline storage.
  // Cloud OAuth and IndexedDB require a separate secure compatibility bridge.
  frame.setAttribute('sandbox','allow-scripts allow-forms allow-downloads allow-modals');
  const channel=new MessageChannel();
  draftPort=channel.port1;
  channel.port1.onmessage=async ({data:message})=>{
   if(!active||Date.now()>=expiresAt||mount.querySelector('iframe')!==frame||
      !message||!Number.isSafeInteger(message.id))return;
   if(message.action==='ptg-search'){
    // Only the trusted parent signs a one-use PTG proof. The opaque iframe
    // never receives a PTG token, app session ID, or reusable credentials.
    if(typeof message.q!=='string'||!message.q.trim()||message.q.length>100||
       !Number.isInteger(message.page)||message.page<1||message.page>20){
      channel.port1.postMessage({id:message.id,ok:false,error:'Enter a valid barcode.'});
      return;
    }
    try{
      const catalog=await withProof(async()=>{
        if(!active||Date.now()>=expiresAt)throw Error('Session expired');
        const signed=await signedRequest();
        const response=await gateway({...signed,action:'lookup',
          q:message.q.trim(),page:message.page});
        if(!active)throw Error('Studio session ended');
        recordAuth(response);
        return response.catalog;
      });
      if(active&&Date.now()<expiresAt){
        if(catalog?.status==='ok'&&Array.isArray(catalog.products))
          channel.port1.postMessage({id:message.id,ok:true,value:{
            ok:true,products:catalog.products,total:catalog.total,
            page:catalog.page,pageSize:catalog.pageSize
          }});
        else channel.port1.postMessage({id:message.id,ok:false,
          error:'PTG product search is temporarily unavailable.'});
      }
    }catch{
      // Never fall back to direct Origin:null fetch or an iframe password.
      if(active)lock('PTG lookup authorization could not be verified. Open the Studio from PTG.');
    }
    return;
   }
   if(message.action==='product-photo'){
    const actions=new Set(['permissions','resolve','search','image','upload','replace','setPrimary','remove']);
    try{
     if(typeof message.payload!=='string'||message.payload.length>3500000)
      throw Error('Invalid product photo request');
     const payload=JSON.parse(message.payload);
     if(!payload||typeof payload!=='object'||Array.isArray(payload)||
        !actions.has(payload.action)||Object.hasOwn(payload,'studioProof'))
      throw Error('Invalid photo action');
     // The P-256 signer remains in this parent. An opaque editor never sees
     // either a PTG bearer or the one-use proof. Every photo call independently
     // revalidates PTG account/role/revocation through the server-only gateway.
     const photoResult=await withProof(async()=>{
      if(!active||Date.now()>=expiresAt)throw Error('Session expired');
      const signed=await signedRequest();
      const res=await fetch('https://tzklsscoiwnmeantcefw.supabase.co/functions/v1/flyer-product-photos',{
       method:'POST',cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',
       headers:{'Content-Type':'application/json',apikey:cfg.publishableKey||''},
       body:JSON.stringify({...payload,studioProof:{
        sessionId:signed.sessionId,challenge:signed.challenge,signature:signed.signature
       }})
      });
      const data=await res.json().catch(()=>null);
      // Proofs rotate even when storage operations fail. Missing rotation is
      // an authorization failure, not a signal to reuse a spent challenge.
      if(!data?.studioProof||!validSession({...data.studioProof,ok:true}))
       throw Error('PTG proof was rejected');
      if(!active)throw Error('Studio locked');
      recordAuth({...data.studioProof,ok:true});
      return {ok:res.ok,data};
     });
     if(!active||Date.now()>=expiresAt)return;
     if(photoResult.ok)channel.port1.postMessage({id:message.id,ok:true,
      value:photoResult.data.result});
     else channel.port1.postMessage({id:message.id,ok:false,
      error:typeof photoResult.data?.error==='string'?photoResult.data.error:
       'Product photo access denied.'});
    }catch{
     // An unverifiable proof immediately locks the protected editor. Do not
     // silently fall back to ambient browser tokens or Origin:null CORS.
     if(active)lock('PTG photo authorization expired or was revoked. Reopen the Studio from PTG.');
    }
    return;
   }
   if(!['read','write','delete'].includes(message.action)||
      typeof message.key!=='string'||!/^p:[A-Za-z0-9_-]{1,96}$/.test(message.key))return;
   try{
    const result=message.action==='read'?await vault.read(message.key):
      message.action==='write'?await vault.write(message.key,message.record):
      await vault.delete(message.key);
    if(active&&Date.now()<expiresAt)channel.port1.postMessage({id:message.id,ok:true,value:result});
   }catch{
    if(active&&Date.now()<expiresAt)channel.port1.postMessage({id:message.id,ok:false});
   }
  };
  channel.port1.start();
  const catalogChannel=new MessageChannel();
  catalogPort=catalogChannel.port1;
  let catalogInFlight=0;
  catalogPort.onmessage=async({data:message})=>{
   if(!active||Date.now()>=expiresAt||mount.querySelector('iframe')!==frame||
      !Number.isSafeInteger(message?.id))return;
   const port=catalogChannel.port1;
   if(catalogInFlight>=8){port.postMessage({id:message.id,ok:false,error:'Too many store photo requests. Retry shortly.'});return;}
   catalogInFlight++;
   try{
    const value=await relayStoreCatalog(message);
    if(active&&Date.now()<expiresAt)port.postMessage({id:message.id,ok:true,value},[value.bytes]);
   }catch(error){
    if(active&&Date.now()<expiresAt)port.postMessage({id:message.id,ok:false,error:error.message||'Store catalog unavailable.'});
   }finally{catalogInFlight--;}
  };
  catalogPort.start();
  frame.addEventListener('load',()=>{
   if(active&&Date.now()<expiresAt&&frame.contentWindow){
    frame.contentWindow.postMessage({kind:'megaflyer-private-storage-port'},'*',[channel.port2]);
    frame.contentWindow.postMessage({kind:'megaflyer-public-catalog-port'},'*',[catalogChannel.port2]);
   }
  },{once:true});
  // The original response has passed SHA-256 verification. Apply the local
  // presentation overlay without modifying authorization or sandbox flags.
  frame.srcdoc=withCatalogRelay(deviceLayout.apply(data.html));mount.replaceChildren(frame);active=true;status.hidden=true;
  setupCloud(vault);
  if(window.BRANCHLINE_CENTRAL_DRIVE){
    void window.BRANCHLINE_CENTRAL_DRIVE.setup({
     studio:'flyer',vault,
     request:(operation,fields)=>centralDriveOperation(operation,fields)
    }).catch(()=>{const n=document.getElementById('driveMessage');
     if(n)n.textContent='Company Google Drive could not initialize.';});
   }
   const interval=Number.isInteger(cfg.checkIntervalMs)&&cfg.checkIntervalMs>=100?cfg.checkIntervalMs:30000;
  timer=setInterval(()=>{void check();},interval);warnIfExpiring();
 }catch{ticket='';lock('Could not verify PTG access to MegaFlyer Studio.');}
}
void open();
})();
