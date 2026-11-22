// Safe production smoke checks: no login, no customer data, no files written.
import assert from "node:assert/strict";
const flyer="https://tzklsscoiwnmeantcefw.supabase.co/functions/v1/flyer-editor-delivery";
const ptg="https://agknxlowackphvwyvxge.supabase.co/functions/v1/ptg-studio-access";
const pages="https://kzamora19.github.io/flyer-studio/studio/launch.js";
async function post(url,origin,body){
 const r=await fetch(url,{method:"POST",cache:"no-store",redirect:"error",
   headers:{"Content-Type":"application/json",...(origin?{Origin:origin}:{})},
   body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 return {status:r.status,data:await r.json().catch(()=>({}))};
}
const foreign=await post(flyer,"https://invalid.example",{action:"lookup",q:"0000012345",page:1});
assert.equal(foreign.status,403,"Foreign origin cannot query protected Flyer delivery");
const noProof=await post(flyer,"https://kzamora19.github.io",
  {action:"lookup",q:"0000012345",page:1});
assert.ok([400,403].includes(noProof.status),"Unsigned barcode lookup must be rejected");
const forged=await post(flyer,"https://kzamora19.github.io",{
 action:"lookup",q:"0000012345",page:1,
 sessionId:"00000000-0000-4000-8000-000000000000",
 challenge:"A".repeat(43),signature:"B".repeat(86)
});
assert.equal(forged.status,403,"A forged one-use proof must not authorize barcode search");
const direct=await post(ptg,"https://kzamora19.github.io",{action:"lookup",studio:"flyer",
 q:"0000012345",page:1,
 sessionId:"00000000-0000-4000-8000-000000000000",
 challenge:"A".repeat(43),signature:"B".repeat(86)});
assert.equal(direct.status,403,"PTG signed lookup must require server-to-server secret");
let launch=null;
for(let n=0;n<8;n++){
 const r=await fetch(pages,{cache:"no-store",signal:AbortSignal.timeout(20000)});
 if(r.ok){const t=await r.text();
  if(t.includes("message.action==='ptg-search'")&&
    t.includes("allow-scripts allow-forms allow-downloads allow-modals")){launch=t;break;}
 }
 if(n<7)await new Promise(resolve=>setTimeout(resolve,4000));
}
assert.ok(launch,"Deployed protected MegaFlyer launcher must contain signed barcode bridge");
assert.doesNotMatch(launch,/frame\.setAttribute\(\x27sandbox\x27,\x27[^\x27]*allow-same-origin/,"Never enable inherited PTG origin in sandbox attribute");
console.log("PASS: live protected MegaFlyer PTG lookup is deployed and refuses foreign origin, unsigned, forged and direct calls.");
