import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {studioTicketOk,releasePathOk,sha256Ok,exactHttpsOrigin,deliveryConfigured,validProofResponse,validSignedProof,validPtgGatewayUrl,PRODUCTION_PTG_REF,validStudioBackendUrl,KNOWN_PRODUCTION_REFS}
  from '../supabase/functions/_shared/studio-private-policy.mjs';

test('only exact HTTPS delivery origins are accepted',()=>{
 assert.equal(exactHttpsOrigin('https://kzamora19.github.io'),'https://kzamora19.github.io');
 for(const v of ['',undefined,'http://kzamora19.github.io','https://*.github.io',
   'https://kzamora19.github.io/flyer-studio','https://kzamora19.github.io/#key',
   'https://a:b@kzamora19.github.io','https://kzamora19.github.io?x=1'])
   assert.equal(exactHttpsOrigin(v),'',String(v));
});
test('request tickets and private release paths are bounded and immutable',()=>{
 assert.equal(studioTicketOk('A'.repeat(43)),true);
 for(const v of ['','A'.repeat(42),'A'.repeat(44),'A'.repeat(42)+'=','../private'])
   assert.equal(studioTicketOk(v),false);
 assert.equal(releasePathOk('releases/abcdef123456/studio.html'),true);
 for(const v of ['','../site/index.html','releases/x/studio.html','releases/abcdef123456/../index.html'])
   assert.equal(releasePathOk(v),false);
 assert.equal(sha256Ok('a'.repeat(64)),true);
 assert.equal(sha256Ok('x'.repeat(64)),false);
});
test('delivery fails closed without a service-only secret, immutable hash and private bucket',()=>{
 const valid={origin:'https://kzamora19.github.io',secret:'s'.repeat(32),
  serviceKey:'s'.repeat(32),path:'releases/abcdef123456/studio.html',
  sha:'f'.repeat(64),bucket:'flyer-editor-release'};
 assert.equal(deliveryConfigured(valid),true);
 for(const invalid of [
  {secret:''},{origin:'https://*.github.io'},{serviceKey:''},
  {path:'site/index.html'},{sha:''},{bucket:'flyer-shared-assets'}
 ])assert.equal(deliveryConfigured({...valid,...invalid}),false);
});
test('staged server rechecks source PTG ticket before every load or status response',()=>{
 const source=readFileSync(new URL('../supabase/functions/flyer-editor-delivery/index.ts',import.meta.url),'utf8');
 assert.match(source,/PTG_VERIFY_URL/);
 assert.match(source,/action,studio:"flyer",\.\.\.body/);
 assert.match(source,/ptg\("exchange"/);
 assert.match(source,/ptg\("prove"/);
 assert.match(source,/if\(!auth\)return json/);
 assert.match(source,/if\(body\.action==="check"\)/);
 assert.match(source,/admin\.storage\.from\(BUNDLE_BUCKET\)\.download\(BUNDLE_PATH\)/);
 assert.match(source,/if\(hash!==BUNDLE_SHA\)/);
 assert.match(source,/private,?\/?/i);
 assert.equal(validProofResponse({sessionId:'d151a9b1-4c42-4dd2-a20b-4b9cfef1a650',challenge:'X'.repeat(43),expiresAt:new Date().toISOString()}),true);
 assert.equal(validSignedProof({sessionId:'d151a9b1-4c42-4dd2-a20b-4b9cfef1a650',challenge:'X'.repeat(43),signature:'S'.repeat(86)}),true);
 assert.doesNotMatch(source,/createSignedUrl\(/);
 assert.doesNotMatch(source,/["\x27]Content-Type["\x27]\s*:\s*["\x27]text\/html/);
});

test("studio PTG verifier is explicitly configured and never crosses production/staging",()=>{
 const prod="https://"+PRODUCTION_PTG_REF+".supabase.co/functions/v1/ptg-studio-access";
 const stage="https://gmrnzcrxysafqwertyui.supabase.co/functions/v1/ptg-studio-access";
 assert.equal(validPtgGatewayUrl(prod,"production"),prod);
 assert.equal(validPtgGatewayUrl(stage,"staging"),stage);
 assert.equal(validPtgGatewayUrl(prod,"staging"),"","Staging cannot access production PTG");
 assert.equal(validPtgGatewayUrl(stage,"production"),"","Production cannot trust unreviewed PTG");
 for(const invalid of [
   ["", "staging"],[prod,""],[prod,"development"],
   ["http://"+PRODUCTION_PTG_REF+".supabase.co/functions/v1/ptg-studio-access","production"],
   [prod+"/","production"],[prod+"?token=123","production"],
   [prod+"#ticket","production"],[prod.replace(".supabase.co",":444.supabase.co"),"production"],
   [prod.replace("https://","https://attacker.example@"),"production"],
   ["https://localhost/functions/v1/ptg-studio-access","staging"],
   ["https://x.supabase.co/functions/v1/ptg-studio-access","staging"],
 ]){
   assert.equal(validPtgGatewayUrl(...invalid),"",JSON.stringify(invalid));
 }
 const src=readFileSync(new URL("../supabase/functions/flyer-editor-delivery/index.ts",import.meta.url),"utf8");
 assert.match(src,/Deno\.env\.get\("PTG_STUDIO_GATEWAY_URL"\)/);
 assert.match(src,/Deno\.env\.get\("PTG_STUDIO_DEPLOYMENT_MODE"\)/);
 assert.match(src,/return !!PTG_VERIFY_URL && /,"Misconfigured backend must fail closed before ticket redemption");
 assert.doesNotMatch(src,/const PTG_VERIFY_URL="https:/);
 assert.match(src,/redirect:"error"/,"PTG call must reject redirects");
});

test("studio backend cannot accidentally use another production Supabase project",()=>{
 const prod="https://tzklsscoiwnmeantcefw.supabase.co";
 const stage="https://gmrnzcrxysafqwertyui.supabase.co";
 assert.equal(validStudioBackendUrl(prod,"production","tzklsscoiwnmeantcefw"),prod);
 assert.equal(validStudioBackendUrl(stage,"staging","tzklsscoiwnmeantcefw"),stage);
 assert.equal(validStudioBackendUrl(prod,"staging","tzklsscoiwnmeantcefw"),"");
 assert.equal(validStudioBackendUrl(stage,"production","tzklsscoiwnmeantcefw"),"");
 assert.equal(validStudioBackendUrl("http://gmrnzcrxysafqwertyui.supabase.co","staging","tzklsscoiwnmeantcefw"),"");
 for(const ref of KNOWN_PRODUCTION_REFS){
   assert.equal(validStudioBackendUrl("https://"+ref+".supabase.co","staging","tzklsscoiwnmeantcefw"),"");
   assert.equal(validPtgGatewayUrl("https://"+ref+".supabase.co/functions/v1/ptg-studio-access","staging"),"");
 }
 const src=readFileSync(new URL("../supabase/functions/flyer-editor-delivery/index.ts",import.meta.url),"utf8");
 assert.match(src,/!!validStudioBackendUrl\(/);
});
