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
