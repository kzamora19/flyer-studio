/* STAGING ONLY — not deployed under site/. No private keys. */
(()=>{'use strict';
const cfg=window.STUDIO_ACCESS_CONFIG||{};
const status=document.getElementById('status'),mount=document.getElementById('mount');
const portal='https://kzamora19.github.io/first-megasaver-ptg/studios/';
let timer=null,expiryTimer=null,active=false,checking=false,expiresAt=0,expiryWarned=false;
function note(message,link=false){
 status.textContent=message;
 if(link){const a=document.createElement('a');a.href=portal;a.rel='noreferrer';a.textContent='Open from PTG Creative Studios';status.append(document.createTextNode(' '),a);}
 status.hidden=false;
}
function lock(message){
 if(!active&&mount.childElementCount===0){note(message,true);return;}
 active=false;checking=false;
 if(timer)clearInterval(timer);
 if(expiryTimer)clearTimeout(expiryTimer);
 timer=null;expiryTimer=null;
 // Make one best-effort local draft write before discarding the authorized view.
 // IndexedDB completion cannot be guaranteed after frame destruction.
 try{const editor=mount.querySelector('iframe')?.contentWindow;if(typeof editor?.save==='function')editor.save();}catch{}
 mount.replaceChildren();note(message,true);
}
function recordExpiry(raw){
 const when=Date.parse(raw);
 const remaining=when-Date.now();
 if(!Number.isFinite(when)||remaining<=0||remaining>12*60*1000)throw Error('PTG ticket has expired or is invalid.');
 expiresAt=expiresAt?Math.min(expiresAt,when):when;
 if(expiryTimer)clearTimeout(expiryTimer);
 expiryTimer=setTimeout(()=>lock('PTG access expired. Your locally saved projects may still be available when you sign in again.'),Math.max(1,expiresAt-Date.now()));
}
function warnIfExpiring(){
 const remaining=expiresAt-Date.now();
 if(active&&remaining>0&&remaining<=2*60*1000&&!expiryWarned){
  expiryWarned=true;note('PTG access is about to expire. Save your current project and reopen from PTG before continuing.',true);
 }
}
document.addEventListener('visibilitychange',()=>{
 if(!active||document.visibilityState!=='visible')return;
 if(Date.now()>=expiresAt)lock('PTG access expired. Open the Studio again from PTG.');
 else void check();
});
const params=new URLSearchParams(location.hash.startsWith('#')?location.hash.slice(1):'');
// Remove ticket fragment before every request, resource load or user interaction.
try{history.replaceState(null,'',location.pathname+location.search)}catch{location.hash='';}
const ticket=params.get('ptg_studio_ticket')||'';
if(!/^[A-Za-z0-9_-]{43}$/.test(ticket)){lock('A valid PTG authorization is required.');return;}
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/flyer-editor-delivery$/.test(String(cfg.endpoint||''))){
 lock('The protected Studio service is not configured.');return;
}
async function gateway(action){
 const headers={'Content-Type':'application/json'};
 if(cfg.publishableKey)headers.apikey=cfg.publishableKey;
 const response=await fetch(cfg.endpoint,{method:'POST',headers,cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',
  body:JSON.stringify({action,ticket})});
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.ok!==true)throw Error('Authorization unavailable or expired.');
 return data;
}
async function check(){
 if(!active||checking)return;
 if(Date.now()>=expiresAt){lock('PTG access expired. Open the Studio again from PTG.');return;}
 checking=true;
 try{
  const result=await gateway('check');
  if(!active)return;
  recordExpiry(result.expiresAt);
  warnIfExpiring();
 }catch{lock('PTG access has expired, been revoked, or cannot be verified. Open the Studio again from PTG.');}
 finally{checking=false;}
}
async function open(){
 try{
  const data=await gateway('load');
  if(typeof data.html!=='string'||!data.html.startsWith('<!-- PRIVATE EDITOR BUNDLE')||
     !/^[a-f0-9]{64}$/.test(String(data.sha256||'')))throw Error('Invalid private editor package');
  recordExpiry(data.expiresAt);
  const frame=document.createElement('iframe');
  frame.id='studio-editor-frame';frame.referrerPolicy='no-referrer';frame.title='MegaFlyer editor (authorized PTG session)';
  frame.srcdoc=data.html;mount.replaceChildren(frame);active=true;status.hidden=true;
  const interval=Number.isInteger(cfg.checkIntervalMs)&&cfg.checkIntervalMs>=100?cfg.checkIntervalMs:30000;
  timer=setInterval(()=>{void check();},interval);
  warnIfExpiring();
 }catch{lock('Could not verify PTG access to MegaFlyer Studio.');}
}
void open();
})();