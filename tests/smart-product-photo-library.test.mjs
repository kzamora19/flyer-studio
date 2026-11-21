import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {join,resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
const file=p=>readFileSync(join(root,p),'utf8');
const ctx={};runInNewContext(file('site/product-photo-match.js'),ctx);
const api=ctx.FLYER_PRODUCT_PHOTO_MATCH;

test('barcodes preserve leading zeros and are preferred to model or description',()=>{
 const p=api.product({sku:' 000-123 045 ',brand:'LG',model:'X100',name:'LG X100'});
 assert.equal(p.barcode,'000123045');
 assert.equal(p.productKey,'b:000123045');
 const found=api.matchingPriority(p,[
  {barcode_norm:'000123045',brand_norm:'OTHER',description:'Wrong model'},
  {barcode_norm:'76543',brand_norm:'LG',model_norm:'X100',description:'LG X100'}
 ]);
 assert.equal(found.match,'barcode');
 assert.equal(found.requiresConfirmation,false);
 assert.equal(found.photos.length,1);
});
test('exact normalized brand plus model is secondary when no barcode matches',()=>{
 const p=api.product({sku:'9999',brand:' La Germania ',model:'fs - 650'});
 const result=api.matchingPriority(p,[
  {barcode_norm:'1111',brand_norm:'LA GERMANIA',model_norm:'FS 650'},
  {barcode_norm:'2222',brand_norm:'LA GERMANIA',model_norm:'FS 750'}
 ]);
 assert.equal(result.match,'model');
 assert.equal(result.photos.length,1);
});
test('description is suggestions only and never auto-matches',()=>{
 const result=api.matchingPriority({description:'Tough Mama Industrial Fan'},[
  {description:'Tough Mama Industrial Fan White'},
  {description:'Rice Cooker'}
 ]);
 assert.equal(result.match,'description');
 assert.equal(result.requiresConfirmation,true);
 assert.equal(result.photos.length,1);
});
test('weak descriptions never auto-associate customer photos or unknown products',()=>{
 const result=api.matchingPriority({description:'TV'},[{description:'TV',barcode_norm:'1'}]);
 assert.equal(result.match,'none');
 assert.equal(result.photos.length,0);
});
test('private package is the ONLY editor bundle with smart photo UI',()=>{
 const builder=file('scripts/build-private-flyer.mjs');
 const ui=file('site/product-photo-library.js');
 const publicPage=file('scripts/build-cutover-pages.mjs');
 assert.match(builder,/private Smart Product Photo Library client/);
 assert.match(builder,/product-photo-match\.js/);
 assert.match(builder,/product-photo-library\.js/);
 assert.doesNotMatch(publicPage,/product-photo-library\.js/);
 assert.match(ui,/Use Saved Photo/);
 assert.match(ui,/Upload New Photo/);
 assert.match(ui,/View All Photos/);
 assert.match(ui,/Set as Primary/);
 assert.match(ui,/Replace Photo/);
 assert.match(ui,/Remove Photo/);
 assert.match(ui,/smartPhotoShare/);
 assert.match(ui,/attachUploadedPhoto/);
});
test('backend refuses unverified reads, keeps images private and audits modifications',()=>{
 const server=file('supabase/functions/flyer-product-photos/index.ts');
 const migration=file('supabase/migrations/202611210001_smart_product_photos.sql');
 assert.match(server,/await identity\(req,body\)/);
 assert.match(server,/action==="image"/);
 assert.match(server,/PTG_ORIGIN\+"\/auth\/v1\/user"/);
 assert.match(server,/action==="remove"/);
 assert.match(server,/!user.canManage/);
 assert.match(server,/sha256/);
 assert.doesNotMatch(server,/createSignedUrl|publicUrl/);
 assert.match(migration,/flyer-product-photos','flyer-product-photos',false/);
 assert.match(migration,/enable row level security/g);
 assert.match(migration,/revoke all on public\.flyer_product_photo/);
 assert.match(migration,/flyer_product_photo_audit/);
 assert.match(migration,/unique\(product_key,blob_id\)/);
});


test('opaque-origin editor relays only whitelisted photo operations through PTG launcher',()=>{
 const editor=file('site/product-photo-library.js');
 const bridge=file('staging/editor-storage-bridge.js');
 const launcher=file('staging/studio-access/launch.js');
 const edge=file('supabase/functions/flyer-product-photos/index.ts');
 assert.match(editor,/__MEGAFLYER_PHOTO_RPC__/);
 assert.doesNotMatch(editor,/fetch\(API/);
 assert.match(bridge,/__MEGAFLYER_PHOTO_RPC__=photo/);
 assert.match(bridge,/action:"product-photo"/);
 assert.doesNotMatch(bridge,/token:account.token/);
 assert.match(launcher,/message.action==='product-photo'/);
 assert.match(launcher,/new Set\(\['permissions','resolve','search','image','upload','replace','setPrimary','remove'\]\)/);
 assert.match(launcher,/https:\/\/tzklsscoiwnmeantcefw\.supabase\.co\/functions\/v1\/flyer-product-photos/);
 assert.doesNotMatch(launcher,/Authorization:'Bearer '\+message.token/);
 assert.doesNotMatch(bridge,/appSession:account.id/);
 assert.match(launcher,/withProof/);
 assert.match(launcher,/studioProof:/);
 assert.match(launcher,/proofQueue/);
 assert.match(edge,/validSignedProof\(body.studioProof\)/);
 assert.match(edge,/STUDIO_GATEWAY_SECRET/);
 assert.match(edge,/actorId/);
 assert.match(editor,/ptg-proof-session/);
 assert.match(edge,/origin!==ALLOWED_ORIGIN/);
 assert.doesNotMatch(edge,/origin==='null'|origin === 'null'|Access-Control-Allow-Origin.*\*/);
 assert.doesNotMatch(launcher,/frame\.setAttribute\('sandbox','[^']*allow-same-origin/);
});
