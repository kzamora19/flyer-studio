// Read-only live security regression for the PTG + protected photo bridge.
// Never send credentials, access user photos, write data or mint a session.
import assert from "node:assert/strict";
const endpoint="https://tzklsscoiwnmeantcefw.supabase.co/functions/v1/flyer-product-photos";
const pub="sb_publishable_djhRIa3KhHbG0tOzQnXrIA_Ou-fJnmK";
async function post(origin,body,extraHeaders={}){
 const r=await fetch(endpoint,{method:"POST",cache:"no-store",redirect:"error",
  headers:{Origin:origin,apikey:pub,"Content-Type":"application/json",...extraHeaders},
  body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 const j=await r.json().catch(()=>({}));
 return {status:r.status,body:j,headers:r.headers};
}
// Existing unsigned standalone clients must not be granted access.
const noSession=await post("https://kzamora19.github.io",{action:"permissions"});
assert.equal(noSession.status,401,"Unsigned standalone requests must be denied");
assert.equal(noSession.headers.get("access-control-allow-origin"),"https://kzamora19.github.io");
console.log("PASS: legacy standalone route still rejects unsigned requests HTTP 401");
// The new signed proof path fails closed for a fabricated signature. Never
// fall back to conventional bearer auth when the proof property is present.
const forged=await post("https://kzamora19.github.io",
 {action:"permissions",studioProof:{sessionId:"00000000-0000-4000-8000-000000000000",challenge:"fake",signature:"fake"}});
assert.equal(forged.status,403,"Forged PTG protected proof must be denied");
assert.ok(!forged.body?.studioProof,"A failed proof must not return a fresh continuation challenge");
console.log("PASS: forged protected photo proof denied HTTP 403");
// Cross-origin website never sees authorization or photo content.
const other=await post("https://invalid.example",{action:"permissions"});
assert.equal(other.status,403);
assert.equal(other.headers.get("access-control-allow-origin"),null);
console.log("PASS: untrusted origin denied HTTP 403");
const preflight=await fetch(endpoint,{method:"OPTIONS",headers:{
 Origin:"https://kzamora19.github.io","Access-Control-Request-Method":"POST",
 "Access-Control-Request-Headers":"content-type,apikey"
},signal:AbortSignal.timeout(10000)});
assert.equal(preflight.status,200);
assert.equal(preflight.headers.get("access-control-allow-origin"),"https://kzamora19.github.io");
console.log("PASS: allowed same-origin protected Studio preflight");
