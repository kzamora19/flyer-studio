'use strict';
// Zero-dependency regression tests for the actual Shared Asset UI source.
// Run: node tests/shared-assets-placement.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','site','shared-asset-ui.js'),'utf8');
const start=source.indexOf('async function apply(asset){');
const end=source.indexOf('\nasync function add(){',start);
assert.ok(start>=0&&end>start,'Find the actual apply() implementation');
const applySource=source.slice(start,end);
class MockFile {
 constructor(chunks,name,opts){this.chunks=chunks;this.name=name;this.type=opts.type;}
}
class MockTransfer {
 constructor(){this.files=[];this.items={add:file=>this.files.push(file)};}
}
class MockEvent {
 constructor(type,options){this.type=type;this.options=options;}
}
function harness(target,options={}){
 const emitted=[],messages=[],edits=[],attachments=[];
 const campaign={brandHeader:options.header||'classic',logo:''};
 const state={campaign};
 const elements={
  sharedAssetTarget:{value:target,selectedOptions:[{textContent:target}]},
  sharedAssetSelected:{value:''},
  frontArtworkUpload:{files:[],dispatchEvent:event=>emitted.push({target:'front',event})},
  backArtworkUpload:{files:[],dispatchEvent:event=>emitted.push({target:'back',event})}
 };
 const el=id=>elements[id];
 const offer=options.offer===undefined?{sku:'TEST-TV'}:options.offer;
 const readPhoto=async file=>{if(options.badDecode)throw Error('Corrupt image');return 'data:image/png;base64,AAA';};
 const attachUploadedPhoto=async (item,file)=>{attachments.push({item,file});return options.attachSuccess!==false;};
 const say=(text,ok)=>messages.push({text,ok});
 const apply=new Function('el','assetImage','TYPES','File','DataTransfer','Event',
    'targetedOffer','attachUploadedPhoto','edited','state','readPhoto','say',
    applySource+';return apply;')(
    el,async()=>{if(options.badFetch)throw Error('Access denied');return {type:options.mime||'image/png',size:128}},
    new Set(['image/png','image/jpeg','image/webp']),MockFile,MockTransfer,MockEvent,
    ()=>offer,attachUploadedPhoto,text=>edits.push(text),state,readPhoto,say
   );
 return {apply,offer,state,elements,emitted,messages,edits,attachments};
}
const asset={id:'TEST-ASSET',name:'Test Banner'};
(async()=>{
 const card=harness('card');
 await card.apply(asset);
 assert.equal(card.attachments.length,1,'One image applied to the selected card');
 assert.equal(card.attachments[0].item,card.offer,'Correct currently selected card');
 assert.equal(card.edits.length,1,'Card change persists through edited()');
 assert.equal(card.elements.sharedAssetSelected.value,asset.name,'Selected asset shown');
 const noCard=harness('card',{offer:null});
 await noCard.apply(asset);
 assert.equal(noCard.edits.length,0,'No changes to empty cards');
 assert.match(noCard.messages.at(-1).text,/Select a filled product card/);
 const changedCard=harness('card',{attachSuccess:false});
 await changedCard.apply(asset);
 assert.equal(changedCard.edits.length,0,'Do not save a card that changed during load');
 const logo=harness('logo',{header:'classic'});
 await logo.apply(asset);
 assert.equal(logo.state.campaign.logo,'data:image/png;base64,AAA','Logo stored');
 assert.equal(logo.state.campaign.brandHeader,'custom','Classic header becomes custom so logo is visible');
 assert.equal(logo.edits.length,1,'Logo autosaves');
 const damagedLogo=harness('logo',{badDecode:true});
 await damagedLogo.apply(asset);
 assert.equal(damagedLogo.state.campaign.brandHeader,'classic','Decode failure preserves existing brand header');
 assert.equal(damagedLogo.edits.length,0,'Corrupt logo never saves');
 const front=harness('front');
 await front.apply(asset);
 assert.equal(front.emitted.length,1,'Front upload handler triggered');
 assert.equal(front.emitted[0].target,'front','Front image is not sent to back');
 assert.equal(front.emitted[0].event.type,'change','Existing upload handler receives change event');
 assert.equal(front.elements.frontArtworkUpload.files.length,1,'File passed into existing upload handler');
 const back=harness('back');
 await back.apply(asset);
 assert.equal(back.emitted.length,1,'Back upload handler triggered');
 assert.equal(back.emitted[0].target,'back','Back image is not sent to front');
 const invalid=harness('unknown');
 await invalid.apply(asset);
 assert.equal(invalid.emitted.length,0,'Unknown targets never change a flyer');
 assert.equal(invalid.edits.length,0);
 const invalidType=harness('front',{mime:'application/pdf'});
 await invalidType.apply(asset);
 assert.equal(invalidType.emitted.length,0,'Invalid MIME never goes to image upload listener');
 const denied=harness('front',{badFetch:true});
 await denied.apply(asset);
 assert.equal(denied.emitted.length,0,'Failed secured preview causes no placement');
 console.log('PASS: shared assets apply to card, custom campaign logo, front/back artwork; failures leave layout untouched.');
})().catch(error=>{console.error(error);process.exitCode=1;});
