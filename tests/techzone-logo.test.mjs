import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const site=join(dirname(fileURLToPath(import.meta.url)),'../site');
const html=readFileSync(join(site,'index.html'),'utf8');
const logo=readFileSync(join(site,'assets/techzone-official-logo.png'));
test('official polished TechZone PNG is intact and high resolution',()=>{
 assert.equal(logo.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(logo.readUInt32BE(16),2172);
 assert.equal(logo.readUInt32BE(20),724);
 assert.ok(logo.length>30000);
});
test('one built-in official Brand Assets menu and exact reusable PNG link',()=>{
 assert.equal((html.match(/id="powerTab-brands"/g)||[]).length,1);
 assert.match(html,/\['brands','Brand Assets'\]/);
 assert.match(html,/id="powerTechzoneLogo" src="assets\/techzone-official-logo\.png"/);
 assert.match(html,/id="powerTechzoneDownload"[^>]*href="assets\/techzone-official-logo\.png"/);
 assert.match(html,/width="2172" height="724"/);
});
test('logo-only release does not bring unrelated cloud-auth branch code',()=>{
 assert.doesNotMatch(html,/function cloudReadRotatedSession\s*\(/);
 assert.match(html,/function history\s*\(/);
 assert.match(html,/\['quality','Pre-Print'\]/);
});
