const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function fixture(overrides={}){
 const created=[],calls=[];
 const window={FLYER_SHARED_ASSET_CONFIG:{
  supabaseUrl:'https://tzklsscoiwnmeantcefw.supabase.co',
  publishableKey:'sb_publishable_public_test_key'},...overrides};
 const sandbox={window,location:{origin:'https://kzamora19.github.io',
   pathname:'/flyer-studio/'},document:{head:{append(n){created.push(n)}},
  createElement(name){return {tagName:name}}},fetch:async(url,args)=>{
   calls.push({url,args});
   return {ok:true,json:async()=>({canView:true,canManage:false})};
 }};
 vm.runInNewContext(src('site/product-photo-standalone.js'),sandbox);
 return {window,created,calls,sandbox};
}
const identity={id:'b7777777-1111-4111-8111-777777777777',
 token:'synthetic-test-token-never-use-in-production-1234567'};
test('standalone bridge uses existing PTG account and fixed private endpoint',async()=>{
 const {window,created,calls}=fixture();
 assert.equal(created.length,1);
 assert.equal(created[0].src,'./product-photo-match.js');
 const found=await window.__MEGAFLYER_PHOTO_RPC__('permissions',{},identity);
 assert.equal(found.canView,true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://tzklsscoiwnmeantcefw.supabase.co/functions/v1/flyer-product-photos');
 assert.equal(calls[0].args.headers.Authorization,'Bearer '+identity.token);
 assert.equal(calls[0].args.headers['x-ptg-session-id'],identity.id);
 assert.equal(calls[0].args.credentials,'omit');
});
test('bridge rejects arbitrary operations and absent PTG session',async()=>{
 const {window,calls}=fixture();
 await assert.rejects(window.__MEGAFLYER_PHOTO_RPC__('fetch',{url:'https://evil.example'},identity));
 await assert.rejects(window.__MEGAFLYER_PHOTO_RPC__('image',{id:'1'},{}));
 await assert.rejects(window.__MEGAFLYER_PHOTO_RPC__('upload',{base64:'a'.repeat(3500000)},identity));
 assert.equal(calls.length,0);
});
test('a private-frame or unrelated origin never loads standalone client',()=>{
 for(const privateFrame of [true,false]){
  const {window,sandbox}=fixture(privateFrame?{__MEGAFLYER_PRIVATE_DB__:{}}:{});
  if(privateFrame)assert.equal(window.__MEGAFLYER_PHOTO_RPC__,undefined);
  else{
   sandbox.location.origin='https://unknown.example';
   delete window.__MEGAFLYER_PHOTO_RPC__;
   const created=[];
   sandbox.document.head.append=n=>created.push(n);
   vm.runInNewContext(src('site/product-photo-standalone.js'),sandbox);
   assert.deepEqual(created,[]);
  }
 }
});
test('new UI does not change production flyer editor pricing or public asset login',()=>{
 const loader=src('site/toolbar-tabs.js');
 const library=src('site/product-photo-library.js');
 const edge=src('supabase/functions/flyer-product-photos/index.ts');
 const migration=src('supabase/migrations/202611210001_smart_product_photos.sql');
 assert.match(loader,/product-photo-standalone\.js/);
 assert.match(loader,/__MEGAFLYER_PRIVATE_DB__/);
 assert.match(library,/__MEGAFLYER_PHOTO_RPC__/);
 assert.match(library,/smartPhotoNativeShare/);
 assert.match(library,/attachUploadedPhoto/);
 assert.doesNotMatch(library,/SRP\s*=|promoPrice\s*=/);
 assert.match(edge,/await identity\(req,body\)/);
 // Protected Studio operations use a signed server-only PTG proof. Standalone
 // operations continue their existing live PTG bearer + app-session check.
 assert.match(edge,/validSignedProof\(body.studioProof\)/);
 assert.match(edge,/STUDIO_GATEWAY_SECRET/);
 assert.match(edge,/actorId/);
 assert.match(edge,/PTG_ORIGIN\+"\/auth\/v1\/user"/);
 assert.match(edge,/!user.canManage/);
 assert.match(edge,/action==="image"/);
 assert.doesNotMatch(edge,/createSignedUrl|publicUrl/);
 assert.match(migration,/enable row level security/g);
 assert.match(migration,/revoke all on public\.flyer_product_photo/);
 assert.match(migration,/flyer-product-photos','flyer-product-photos',false/);
});
