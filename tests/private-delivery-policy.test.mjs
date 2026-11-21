import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {studioTicketOk,releasePathOk,sha256Ok,exactHttpsOrigin,deliveryConfigured}
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
 assert.match(source,/action:"verify",studio:"flyer",ticket/);
 assert.match(source,/if\(!expiresAt\)return json/);
 assert.match(source,/if\(body\.action==="check"\)/);
 assert.match(source,/admin\.storage\.from\(BUNDLE_BUCKET\)\.download\(BUNDLE_PATH\)/);
 assert.match(source,/if\(hash!==BUNDLE_SHA\)/);
 assert.match(source,/private,?\/?/i);
 assert.doesNotMatch(source,/createSignedUrl\(/);
 assert.doesNotMatch(source,/text\/html/);
});
