/* STAGING ONLY — non-deployed proof-of-possession PTG Studio launcher. */
(()=>{'use strict';
const cfg=window.STUDIO_ACCESS_CONFIG||{};
const status=document.getElementById('status'),mount=document.getElementById('mount');
const portal='https://kzamora19.github.io/first-megasaver-ptg/studios/';
let timer=null,expiryTimer=null,active=false,checking=false,expiresAt=0,absoluteCutoff=0,expiryWarned=false;
let privateKey=null,sessionId='',challenge='',draftPort=null;
function note(message,link=false){
 status.textContent=message;
 if(link){const a=document.createElement('a');a.href=portal;a.rel='noreferrer';a.textContent='Open from PTG Creative Studios';status.append(document.createTextNode(' '),a);}
 status.hidden=false;
}
function lock(message){
 active=false;checking=false;privateKey=null;sessionId='';challenge='';
 if(timer)clearInterval(timer);if(expiryTimer)clearTimeout(expiryTimer);
 if(draftPort){draftPort.close();draftPort=null;}
 timer=null;expiryTimer=null;
 // The editor is origin-isolated: never reach into its DOM or storage.
 // Local backup must be completed before expiry, or via a future scoped bridge.
 mount.replaceChildren();note(message,true);
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
  const result=await gateway(await signedRequest());
  if(!active)return;
  recordAuth(result);warnIfExpiring();
 }catch{lock('PTG access has expired, been revoked, or cannot be verified. Open the Studio again from PTG.');}
 finally{checking=false;}
}
document.addEventListener('visibilitychange',()=>{
 if(!active||document.visibilityState!=='visible')return;
 if(Date.now()>=expiresAt)lock('PTG access expired. Open the Studio again from PTG.');
 else void check();
});
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
  const frame=document.createElement('iframe');
  frame.id='studio-editor-frame';frame.referrerPolicy='no-referrer';frame.title='MegaFlyer editor (authorized PTG session)';
  // about:srcdoc WITHOUT an opaque sandbox inherits the shared github.io origin.
  // Disallow allow-same-origin: editor scripts must never read PTG/Branchline storage.
  // Cloud OAuth and IndexedDB require a separate secure compatibility bridge.
  frame.setAttribute('sandbox','allow-scripts allow-downloads allow-modals');
  const channel=new MessageChannel();
  draftPort=channel.port1;
  channel.port1.onmessage=async ({data:message})=>{
   if(!active||Date.now()>=expiresAt||mount.querySelector('iframe')!==frame||
      !message||!Number.isSafeInteger(message.id)||
      !['read','write','delete'].includes(message.action)||
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
  frame.addEventListener('load',()=>{
   if(active&&Date.now()<expiresAt&&frame.contentWindow)
    frame.contentWindow.postMessage({kind:'megaflyer-private-storage-port'},'*',[channel.port2]);
  },{once:true});
  frame.srcdoc=data.html;mount.replaceChildren(frame);active=true;status.hidden=true;
  const interval=Number.isInteger(cfg.checkIntervalMs)&&cfg.checkIntervalMs>=100?cfg.checkIntervalMs:30000;
  timer=setInterval(()=>{void check();},interval);warnIfExpiring();
 }catch{ticket='';lock('Could not verify PTG access to MegaFlyer Studio.');}
}
void open();
})();
