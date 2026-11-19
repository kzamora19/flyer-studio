import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const site=join(dirname(fileURLToPath(import.meta.url)),'../site');
const html=readFileSync(join(site,'index.html'));
const logo=readFileSync(join(site,'assets/techzone-official-logo.png'));
const server=createServer((req,res)=>{
 const path=(req.url||'').split('?')[0];
 if(path==='/assets/techzone-official-logo.png'){
  res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});res.end(logo);return;
 }
 if(path==='/'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;
 }
 res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage();
 const origin='http://127.0.0.1:'+server.address().port;
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 await page.locator('#powerLauncher').waitFor({timeout:20000});
 await page.locator('#powerLauncher').click();
 await page.locator('#powerButton-brands').click();
 await page.locator('#powerTab-brands:not([hidden])').waitFor({timeout:5000});
 const image=page.locator('#powerTechzoneLogo');
 await page.waitForFunction(()=>document.querySelector('#powerTechzoneLogo')?.naturalWidth===2172);
 const dims=await image.evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight,complete:img.complete}));
 assert.deepEqual(dims,{width:2172,height:724,complete:true});
 const result=page.waitForEvent('download',{timeout:15000});
 await page.locator('#powerTechzoneDownload').click();
 const download=await result;
 assert.equal(download.suggestedFilename(),'TechZone-Official-Logo.png');
 assert.deepEqual(readFileSync(await download.path()),logo);
 await page.locator('#powerButton-templates').click();
 await page.locator('#powerTab-templates:not([hidden])').waitFor();
 await page.locator('#powerButton-quality').click();
 await page.locator('#powerTab-quality:not([hidden])').waitFor();
 assert.equal(await page.locator('#powerRunAudit').count(),1);
 console.log('PASS: TechZone Brand Assets tab, polished 2172x724 PNG, byte-perfect download, and existing Studio+ tabs');
} finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
