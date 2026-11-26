const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('site/index.html'),launcher=read('site/studio/launch.js');
const slice=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b));
const placementCode=slice(html,'function group(offers','function overflow(');
test('card arrangement preserves photo data, swaps, moves across pages, handles empty slots and undo/redo',()=>{
 const arrangement=slice(html,'function cardMoveEqual','function bindCardArrange').replace(/function updateCardMoveControls\(\)\{[\s\S]*?\n\}/,'function updateCardMoveControls(){}');
 const run=new Function('assert',`
 const sections={front:'Front',back:'Back',bundles:'Bundles'};
 const a={sku:'a',section:'front',slot:0,photo:'main-A',freebiePhoto:'free-A',promo:123},b={sku:'b',section:'front',slot:1},c={sku:'c',section:'back',slot:0};
 let state={offers:[a,b,c],campaign:{}},cardMoveSource=null,highlightSelection=null,selected=null,slotTarget={section:'front',slot:'1'};
 const cardMoveUndo=[],cardMoveRedo=[];function slotCount(){return 3}function targetedOffer(){return null}function offerKey(){return ''}function offerEditor(){}function showTarget(){}function edited(){}function feedback(){}
 ${placementCode}
 ${arrangement}
 moveCard({section:'front',index:0},{section:'front',index:1});
 assert.equal(a.slot,1);assert.equal(b.slot,0);assert.equal(a.freebiePhoto,'free-A');
 moveCard({section:'front',index:1},{section:'back',index:0});
 assert.equal(a.section,'back');assert.equal(c.section,'front');assert.equal(c.slot,1);
 moveCard({section:'back',index:0},{section:'back',index:2});
 assert.equal(a.slot,2);assert.equal(placement(state.offers,'back').slots[0],null);
 restoreCardMove(true);assert.equal(a.slot,0);
 restoreCardMove(false);assert.equal(a.slot,2);
 assert.throws(()=>moveCard({section:'back',index:2},{section:'bundles',index:0}),/Bundle/);
 assert.equal(a.photo,'main-A');assert.equal(a.promo,123);
 `);
 run(assert);
});
test('freebie photo and wording are drawn in reserved card space by shared renderer',()=>{
 const run=new Function('assert',`
 ${placementCode}
 const state={campaign:{}};function slotCount(){return 2}
 const calls=[];const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},strokeRect(){}};
 function fill(){}function photo(ctx,img,x,y,w,h){calls.push(['photo',img,w,h])}
 function line(ctx,t){calls.push(['text',t])}function card(ctx,o,a,x,y,w,h){calls.push(['card',h])}
 ${slice(html,'function drawFreebieBand','function drawBrandHeader')}
 const o={section:'front',slot:0,freebieText:'FREE INSTALLATION'};
 drawSlots(ctx,{offers:[o],campaign:{},status:'Draft'},new Map(),[{key:'front',index:0,x:0,y:0,width:200,height:100}],null,new Map([[o,{image:'freebie',frame:{}}]]));
 assert.ok(calls.some(x=>x[0]==='photo'&&x[1]==='freebie'&&x[2]>0&&x[3]>0));
 assert.ok(calls.some(x=>x[0]==='text'));assert.ok(calls[0][1]<100);
 `);
 run(assert);
 assert.match(html,/drawSlots\(ctx,project,pictures,layout.cards,target,freebies\)/);
});
test('catalog relay targets only the approved edge endpoint and accepts only validated store URLs',async()=>{
 const calls=[];
 const mockedFetch=async(url,opts)=>{calls.push({url,opts});return new Response(JSON.stringify({photos:[]}),{headers:{'content-type':'application/json'}})};
 const relay=new Function('fetch',slice(launcher,"const catalogEndpoint=","function installCatalogRelay")+"\nreturn relayStoreCatalog;")(mockedFetch);
 await relay({mode:'photos',sku:'00060593',model:'AH-X10BEF'});
 assert.equal(calls.length,1);
 const u=new URL(calls[0].url);
 assert.equal(u.origin,'https://tzklsscoiwnmeantcefw.supabase.co');
 assert.equal(u.pathname,'/functions/v1/flyer-catalog');
 assert.equal(u.searchParams.get('sku'),'00060593');
 assert.equal(calls[0].opts.credentials,'omit');
 await assert.rejects(relay({mode:'image',url:'https://evil.example/wp-content/uploads/a.png'}),/Invalid store image/);
 await assert.rejects(relay({mode:'image',url:'https://www.1stmegasaver.com.ph/private/a.png'}),/Invalid store image/);
 await assert.rejects(relay({mode:'other'}),/Unsupported/);
 assert.equal(calls.length,1);
});

test('catalog relay retries a temporary gateway response once and still rejects a persistent outage',async()=>{
 const statuses=[502,200];
 let calls=0;
 const fakeFetch=async()=>{
  calls++;
  const status=statuses.shift()||502;
  return new Response(JSON.stringify(status===200?{photos:[]}:{error:'Catalog unavailable'}),{status,headers:{'content-type':'application/json'}});
 };
 const relay=new Function('fetch','setTimeout',slice(launcher,"const catalogEndpoint=","function installCatalogRelay")+"\nreturn relayStoreCatalog;")(fakeFetch,fn=>fn());
 await relay({mode:'photos',sku:'00060593',model:'AH-X10BEF'});
 assert.equal(calls,2);
 await assert.rejects(relay({mode:'photos',sku:'00060593',model:'AH-X10BEF'}),/Catalog unavailable/);
 assert.equal(calls,4);
});

test('protected photo library uses proof-session markers, not legacy bearer tokens',async()=>{
 const library=read('site/product-photo-library.js');
 const sessionCode=slice(library,'function currentSession(){','function selection(){');
 const requestCode=slice(library,'async function request(action','function toBase64(');
 const calls=[];
 const window={__MEGAFLYER_PRIVATE_DB__:{},__MEGAFLYER_PTG_RPC__:()=>{},__MEGAFLYER_PHOTO_RPC__:async(action,fields,account)=>{calls.push({action,fields,account});return {photos:[{id:'fixture'}]}}};
 const make=new Function('window','ptgSession',sessionCode+requestCode+'return {currentSession,request};');
 const api=make(window,null);
 assert.deepEqual(api.currentSession(),{id:'ptg-proof-session',token:'signed-studio-proof'});
 assert.deepEqual(await api.request('resolve',{product:{barcode:'00060593'}}),{photos:[{id:'fixture'}]});
 assert.equal(calls[0].account.token,'signed-studio-proof');
 assert.equal(make({},null).currentSession(),null);
 assert.deepEqual(make({},{id:'legacy-id',token:'legacy-token'}).currentSession(),{id:'legacy-id',token:'legacy-token'});
});
test('upload success requires an acknowledged photo ID and confirmed recall',async()=>{
 const library=read('site/product-photo-library.js');
 const code=slice(library,'async function uploadFile(','function button(');
 const fixture={offer:{},product:{productKey:'b:60593',barcode:'60593'}};
 let replies=[],notices=[];
 const upload=new Function('selection','TYPES','notice','optimized','toBase64','request','sameSelection','sync','$',code+'return uploadFile;')(
  ()=>fixture,new Set(['image/png']),(m)=>notices.push(m),async()=>({size:10,type:'image/webp'}),async()=> 'AA==',async()=>replies.shift(),()=>true,async()=>{},()=>({checked:true}));
 const file={type:'image/png',size:10};
 replies=[{ok:true,photoId:'fixture'},{photos:[]}];
 await assert.rejects(upload(file,null,true),/recall could not be confirmed/);
 assert.equal(notices.some(n=>n.includes('saved and verified')),false);
 replies=[{ok:true,photoId:'fixture'},{photos:[{id:'fixture'}]}];
 assert.equal((await upload(file,null,true)).photoId,'fixture');
 assert.ok(notices.some(n=>n.includes('saved and verified')));
});
