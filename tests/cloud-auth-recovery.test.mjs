import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Script } from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)), '..');
const source=readFileSync(join(root,'site/index.html'),'utf8');
const first=source.indexOf('async function cloudRecoverSession(){');
const last=source.indexOf('function cloudBootstrap(){',first);
assert.ok(first>0 && last>first,'Cannot find cloud session recovery');
const recovery=source.slice(first,last);
const harness=[
  "let cloudSession=null,cloudUser=null;",
  "const location=env.location,history=function history(){},window={history:env.history},localStorage=env.localStorage,CLOUD_AUTH_STORE='auth-test';",
  "const cloudInfo=(msg,good)=>env.messages.push({msg,good});",
  "const cloudRenderAuth=()=>env.renders.push(!!cloudUser);",
  "const cloudStoreSession=value=>{if(value)localStorage.setItem(CLOUD_AUTH_STORE,JSON.stringify(value));else localStorage.removeItem(CLOUD_AUTH_STORE);};",
  "const cloudApplySession=result=>{if(!result.access_token||!result.refresh_token)throw Error('Missing session');cloudSession={...result,user:result.user??null};cloudUser=cloudSession.user;cloudStoreSession(cloudSession);cloudRenderAuth();};",
  "const cloudErr=e=>e.message||String(e);",
  "const cloudRequest=(...args)=>env.request(...args);",
  "const cloudAuthRaw=(...args)=>env.authRaw(...args);",
  "const cloudRefreshToken=async()=>{const next=await env.authRaw('token?grant_type=refresh_token',{refresh_token:cloudSession.refresh_token});cloudApplySession(next);return next.access_token;};",
  "const cloudRefreshList=()=>env.list();",
  "const cloudListPhotos=()=>env.photos();",
  recovery,
  "return {run:cloudRecoverSession,status:()=>({cloudSession,cloudUser})};",
].join('\n');
const setup=new Function('env',harness);

async function run(options={}){
 const actions=[],messages=[],renders=[],values=new Map();
 if(options.saved)values.set('auth-test',JSON.stringify(options.saved));
 const env={
  actions,messages,renders,
  location:{hash:options.hash||'',pathname:'/flyer-studio/',search:''},
  history:{state:null,replaceState:()=>actions.push('scrub')},
  localStorage:{
   getItem:key=>values.get(key)||null,
   setItem:(key,value)=>values.set(key,value),
   removeItem:key=>values.delete(key),
  },
  request:options.request||(async()=>{actions.push('fetch-user');return {id:'user-1',email:'test@example.com'};}),
  authRaw:options.authRaw||(async()=>({access_token:'refreshed-token',refresh_token:'refreshed-refresh',user:null})),
  list:options.list||(async()=>actions.push('projects-loaded')),
  photos:options.photos||(async()=>actions.push('photos-loaded')),
 };
 const instance=setup(env);
 await instance.run();
 return {...instance.status(),actions,messages,renders,values};
}

test('OAuth callback scrubs URL before fetching user and signs in',async()=>{
 const result=await run({hash:'#access_token=example&refresh_token=example-refresh&expires_in=3600'});
 assert.deepEqual(result.actions.slice(0,2),['scrub','fetch-user']);
 assert.equal(result.cloudUser.id,'user-1');
 assert.ok(result.values.has('auth-test'));
});
test('optional cloud project load failure does not sign out',async()=>{
 const result=await run({hash:'#access_token=example&refresh_token=example-refresh',list:async()=>{throw Error('not ready');}});
 assert.equal(result.cloudUser.id,'user-1');
 assert.ok(result.values.has('auth-test'));
});
test('temporary network issue preserves saved session',async()=>{
 const result=await run({saved:{access_token:'existing',refresh_token:'existing-refresh'},request:async()=>{throw Error('offline');}});
 assert.equal(result.cloudUser,null);
 assert.ok(result.values.has('auth-test'));
 assert.match(result.messages.at(-1).msg,/remains saved/);
});
test('401 response refreshes and revalidates session',async()=>{
 let count=0;
 const result=await run({
  saved:{access_token:'old',refresh_token:'valid'},
  request:async()=>{if(++count===1)throw Object.assign(Error('expired'),{status:401});return {id:'user-1'};},
 });
 assert.equal(count,2);
 assert.equal(result.cloudUser.id,'user-1');
 assert.equal(JSON.parse(result.values.get('auth-test')).access_token,'refreshed-token');
});
test('revoked refresh token ends session',async()=>{
 const result=await run({
  saved:{access_token:'old',refresh_token:'revoked'},
  request:async()=>{throw Object.assign(Error('expired'),{status:401});},
  authRaw:async()=>{throw Object.assign(Error('invalid refresh'),{status:400});},
 });
 assert.equal(result.cloudUser,null);
 assert.equal(result.values.has('auth-test'),false);
 assert.match(result.messages.at(-1).msg,/could not be completed/);
});
test('incomplete OAuth callback is scrubbed and rejected',async()=>{
 const result=await run({hash:'#access_token=only-one-token'});
 assert.equal(result.actions[0],'scrub');
 assert.equal(result.cloudUser,null);
 assert.equal(result.values.has('auth-test'),false);
});
test('OAuth provider error removes callback fragment',async()=>{
 const result=await run({hash:'#error=access_denied'});
 assert.equal(result.actions[0],'scrub');
 assert.match(result.messages.at(-1).msg,/not completed/);
});
test('embedded JavaScript syntax is valid',()=>{
 const scripts=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
 assert.ok(scripts.length>=1);
 for(const script of scripts)new Script(script);
});

test('Flyer audit history helper does not overwrite the native browser History API',()=>{
 assert.match(source,/function recordFlyerHistory\(/);
 assert.doesNotMatch(source,/function history\s*\(/);
 assert.match(source,/window\.history\.replaceState/);
});
