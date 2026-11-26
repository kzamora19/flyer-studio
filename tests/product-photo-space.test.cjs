'use strict';
// Regression for MegaFlyer product-photo allocation on small TechZone and front/back cards.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','site/index.html'),'utf8');
const start=html.indexOf('function techCard(ctx,offer,asset,');
const end=html.indexOf('function gridPositions(',start);
assert.ok(start>0&&end>start,'Production canvas card renderers found');
const calls={photos:[],copies:[],prices:[],fills:[]};
const mock={
 // This fixture checks the unchanged no-freebie layout; dedicated tests cover actual freebie geometry.
 freebieArea(){return null},drawFreebiePanel(){},
 cardPrices(){return {promo:'₱9,999.00',secondary:[['SRP ₱12,999.00','#344865'],['SAVE ₱3,000.00','#a02716']]}},
 descriptionIncludesModel(){return false},
 fitCardCopy(ctx,name,model,w,h){
  assert.ok(w>0&&h>0,'Text columns must have positive dimensions');
  return {size:w<58?6.3:8.2,titles:[name],models:[],titleStep:9,modelStep:7,gap:0,modelSize:6.8};
 },
 drawCardCopy(ctx,copy,x,y,w){calls.copies.push({copy,x,y,w})},
 photo(ctx,img,x,y,w,h){calls.photos.push({x,y,w,h})},
 fill(ctx,color,x,y,w,h){calls.fills.push({color,x,y,w,h})},
 line(){},
 fit(ctx,value,x,y,w,size){calls.prices.push({value,x,y,w,size})},
 bundleQuantity(){return null},
 bundleCaption(offer){return offer.name},
 promoBundlePhoto(){},
 clean(x){return String(x||'')}
};
const names=Object.keys(mock);
const tools=new Function(...names,html.slice(start,end)+';return {techCard,card}')( ...names.map(k=>mock[k]));
function ctx(){return {beginPath(){},roundRect(){},stroke(){},save(){},restore(){},measureText(s){return {width:s.length*6}},fill(){},rect(){}}}
function reset(){for(const k of Object.keys(calls))calls[k]=[]}
const asset={image:{width:800,height:800},frame:{width:800,height:800}};
const tech={brand:'XIAOMI',name:'XIAOMI TABLET REDMI PAD SE LTE 4G 8.7 4GB+128GB',model:'PAD SE LTE 4G'};
reset();tools.techCard(ctx(),tech,asset,20,30,160,145,{photoScale:100});
assert.equal(calls.photos.length,1,'One TechZone image drawn');
assert.ok(calls.photos[0].w>=60,'TechZone photo must get at least 60 of 160 canvas units: '+JSON.stringify(calls.photos[0]));
assert.ok(calls.photos[0].h>=60,'TechZone photo must be tall enough to show the product');
const techPrice=calls.prices.find(p=>p.value==='₱9,999.00');
assert.ok(techPrice&&techPrice.w>140,'TechZone price must use full card width, not photo-adjacent narrow text');
assert.ok(calls.photos[0].y+calls.photos[0].h < techPrice.y-techPrice.size+5,'TechZone image must end above price');
assert.ok(calls.copies[0].x>calls.photos[0].x+calls.photos[0].w,'Description must appear beside TechZone photo');

const offer={brand:'SAMPLE',name:'Smart television',model:'LED-2026'};
reset();tools.card(ctx(),offer,asset,10,15,142,102,'front',{photoScale:100});
assert.equal(calls.photos.length,1,'Front grid image drawn');
assert.ok(calls.photos[0].w>=55,'Front card photo is wider than the old miniature image strip');
assert.ok(calls.photos[0].h>=32,'Front card photo has a meaningful height');
assert.ok(calls.copies[0].x>calls.photos[0].x+calls.photos[0].w,'Front card description alongside photo');
const frontPrice=calls.prices.find(p=>p.value==='₱9,999.00');
assert.ok(frontPrice&&frontPrice.w>110,'Front card price stays full-width');
assert.ok(calls.photos[0].y+calls.photos[0].h<frontPrice.y-frontPrice.size+5,'Photo must not cover the price');

reset();tools.card(ctx(),offer,null,10,15,142,102,'front',{photoScale:100});
const placeholder=calls.fills.find(p=>p.color==='#edf2fa');
assert.ok(placeholder&&placeholder.w>=40,'Empty photo placeholder is visible and larger, too');
assert.ok(calls.copies.length===1&&calls.prices.length===1,'Text and price remain on placeholder cards');

reset();tools.card(ctx(),offer,asset,10,15,180,170,'bundles',{photoScale:100});
assert.ok(calls.photos.length===1,'Bundle artwork still draws');
assert.ok(calls.copies[0].x>calls.photos[0].x+calls.photos[0].w,'Tall bundle uses the same image-left description-right geometry');

assert.ok(html.includes('drawSlots(ctx,project,pictures,layout.cards,target,freebies,\'content\')'), 'Preview and exports share card renderer');
console.log('PASS: larger TechZone and front product images; safe prices, descriptions, placeholders and bundle layout.');
