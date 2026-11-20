'use strict';
// Zero-dependency two-page PDF structure regression test for current Flyer Studio source.
// Run: node tests/shared-flyer-pdf.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','site','index.html'),'utf8');
const start=source.indexOf('const bytes = string => new TextEncoder().encode(string);');
const end=source.indexOf('function canvasBlob(',start);
assert.ok(start>=0&&end>start,'PDF writer located');
const pdfFile=new Function(source.slice(start,end)+';return pdfFile;')();
const front=Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABwj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCWADpZb//Z','base64'));
const back=Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCYQFljr//Z','base64'));
assert.equal(front[0],255,'Front JPEG start');
assert.equal(back[0],255,'Back JPEG start');
(async()=>{
 const d={pageWidth:210,pageHeight:297,bleed:0,width:210,height:297};
 const pdf=pdfFile([{width:4,height:4,data:front},{width:4,height:4,data:back}],d);
 assert.equal(pdf.type,'application/pdf','PDF media type');
 const output=Buffer.from(await pdf.arrayBuffer());
 const text=output.toString('latin1');
 assert.ok(text.startsWith('%PDF-1.4'),'PDF signature');
 assert.ok(text.endsWith('%%EOF\n'),'PDF trailer');
 assert.match(text,/\/Count 2\b/,'Exactly two pages');
 assert.equal((text.match(/\/Type \/Page \/Parent /g)||[]).length,2,'Two page objects');
 assert.equal((text.match(/\/Subtype \/Image/g)||[]).length,2,'Two embedded images');
 assert.equal((text.match(/\/I Do/g)||[]).length,2,'Each page draws its image');
 assert.ok(output.indexOf(Buffer.from(front))>=0,'Unaltered front JPEG embedded');
 assert.ok(output.indexOf(Buffer.from(back))>=0,'Unaltered back JPEG embedded');
 const xref=Number(text.match(/startxref\n(\d+)\n%%EOF/)[1]);
 assert.equal(text.slice(xref,xref+4),'xref','Valid xref address');
 assert.match(text,/\/MediaBox \[0 0 595\.2756 841\.8898\]/,'A4 size in PDF points');
 assert.ok(source.includes("await render(snapshot,face,width)"),'PDF source uses same flyer renderer as preview');
 console.log('PASS: A4 two-page PDF with correct image streams, trim/MediaBox and xref.');
})().catch(err=>{console.error(err);process.exitCode=1;});
