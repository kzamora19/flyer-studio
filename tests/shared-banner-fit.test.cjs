'use strict';
// Run in the downloaded development branch: node tests/shared-banner-fit.test.cjs
// Inspects the actual functions embedded in site/index.html, without a browser.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','site','index.html'),'utf8');
const begin=src.indexOf('function artworkNeedsBackdrop(');
const end=src.indexOf('async function render(',begin);
assert.ok(begin>=0&&end>begin,'Shared banner fit helpers found');
let foreground=[];
const fill=()=>{};
const photo=(ctx,image,x,y,w,h)=>foreground.push({image,x,y,w,h});
const helpers=new Function('fill','photo','artworkBackground',
  src.slice(begin,end)+';return {artworkNeedsBackdrop,artworkSoftBackdrop,banner}')(fill,photo,()=> '#c62820');

const cases=[
  [{width:1600,height:400},475,330,true,'Wide banner needs background continuation'],
  [{width:400,height:400},330,330,false,'Square image does not need continuation'],
  [{width:1440,height:1000},475,330,false,'Nearly matching image is not altered'],
  [{width:200,height:800},475,330,true,'Portrait in wide space needs continuation'],
  [{width:1600,height:500},768,240,false,'Matching wide back banner stays unchanged'],
  [{width:0,height:400},475,330,false,'Invalid image is rejected by geometry guard']
];
for(const [image,w,h,expected,label] of cases)assert.equal(helpers.artworkNeedsBackdrop(image,w,h),expected,label);
function fakeContext(){
  return {filter:'none',globalAlpha:1,draws:[],clipped:0,
   save(){this.saved={filter:this.filter,globalAlpha:this.globalAlpha}},
   restore(){this.filter=this.saved.filter;this.globalAlpha=this.saved.globalAlpha},
   beginPath(){},rect(){},clip(){this.clipped++},
   drawImage(...args){this.draws.push(args)},
   createLinearGradient(){return {addColorStop(){}}}
  };
}
const wide={width:1600,height:400};const ctx=fakeContext();
helpers.banner(ctx,{red:'#c62820'}, {x:16,y:83,width:475,height:330},null,wide);
assert.equal(ctx.draws.length,1,'One cropped background image is drawn');
assert.equal(ctx.clipped,1,'Background stays inside panel');
assert.equal(ctx.filter,'none','Canvas filter resets after background');
assert.equal(ctx.globalAlpha,1,'Alpha resets after background');
assert.equal(foreground.length,1,'Full original artwork is placed once on foreground');
assert.equal(foreground[0].image,wide,'Foreground uses original image');
assert.equal(foreground[0].w,475,'Foreground stays inside original left panel');
assert.equal(foreground[0].h,330,'Foreground keeps original panel bounds');
foreground=[];const squareCtx=fakeContext();
helpers.banner(squareCtx,{red:'#c62820'}, {x:16,y:83,width:330,height:330},null,{width:400,height:400});
assert.equal(squareCtx.draws.length,0,'No needless background for matching artwork');
assert.equal(foreground.length,1,'One foreground image for square artwork');
assert.ok(src.includes('banner(ctx,c,layout.headline,parts,artwork)'),'Live preview uses common banner renderer');
const exportStart=src.indexOf('async function exportFile(format)');
const exportEnd=src.indexOf('async function transition(',exportStart);
assert.ok(exportStart>=0&&exportEnd>exportStart,'Unified export function found');
const exporter=src.slice(exportStart,exportEnd);
assert.match(exporter,/for\(const face of faces\)\{\s*const \{canvas,layout\}=await render\(snapshot,face,width,undefined,renderMode\);/,'All selected faces use the common renderer and verified render mode');
assert.match(exporter,/if\(format==='png'\)files\.push\(\{face,blob:await png300\(await canvasBlob\(canvas,'image\/png'\)\)\}\)/,'PNG uses the common rendered canvas');
assert.match(exporter,/else \{const jpeg=await canvasBlob\(canvas,'image\/jpeg'\);pages\.push/,'PDF uses the common rendered canvas');
console.log('PASS: banner geometry, background clipping, canvas state and shared PNG/PDF rendering.');
