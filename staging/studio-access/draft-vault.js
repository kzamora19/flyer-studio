/* STAGING ONLY. Encrypted local MegaFlyer records are owned by the protected
 * launcher, never by the opaque-origin editor iframe.
 * PTG issues stable per-account, per-Studio recovery material ONLY on one-use
 * ticket exchange. Do not deploy or use before real PTG account verification. */
(() => {
 "use strict";
 const NAME="megaflyer-protected-draft-v1", STORE="drafts", LIMIT=96*1024*1024;
 const encoder=new TextEncoder(),decoder=new TextDecoder();
 const validKey=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{43}$/.test(x);
 const validRecord=x=>typeof x==="string"&&/^p:[A-Za-z0-9_-]{1,96}$/.test(x);
 const decode=x=>{
  if(!validKey(x))throw Error("Invalid PTG recovery key.");
  const raw=atob(x.replaceAll("-","+").replaceAll("_","/")+"=");
  if(raw.length!==32)throw Error("Invalid PTG recovery key length.");
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
 };
 const open=()=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(NAME,1);
  req.onupgradeneeded=()=>{
   if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(Error("Private local vault unavailable."));
 });
 async function operation(kind,id,record){
  const db=await open();
  try {
   return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,kind==="read"?"readonly":"readwrite");
    const store=tx.objectStore(STORE);
    const req=kind==="read"?store.get(id):kind==="write"?store.put(record,id):store.delete(id);
    req.onerror=()=>reject(Error("Private local vault operation failed."));
    tx.onabort=()=>reject(Error("Private local vault transaction aborted."));
    tx.oncomplete=()=>resolve(kind==="read"?(req.result??null):true);
   });
  }finally{db.close();}
 }
 function session(scope,secret){
  if(!validKey(scope))throw Error("Invalid PTG account recovery scope.");
  const bytes=decode(secret);
  const key=crypto.subtle.importKey("raw",bytes,{name:"AES-GCM"},false,["encrypt","decrypt"]);
  bytes.fill(0);
  function id(recordKey){
   if(!validRecord(recordKey))throw Error("Forbidden MegaFlyer record name.");
   return scope+":"+recordKey;
  }
  function aad(recordKey){return encoder.encode(NAME+":"+scope+":"+recordKey);}
  // Cloud backups are manual and remain AES-GCM encrypted in the existing
  // PTG project's RLS-denied archive. Neither backend receives the AES key.
  const b64=buffer=>btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
  const unb64=value=>{
   if(typeof value!=="string"||!value.length||!/^[A-Za-z0-9_-]+$/.test(value))
    throw Error("Invalid encrypted cloud record.");
   return Uint8Array.from(atob(value.replaceAll("-","+").replaceAll("_","/")+
    "=".repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
  };
  async function cloudExport(recordKey){
   const stored=await operation("read",id(recordKey));
   if(!stored)return null;
   if(stored.format!=="AES-GCM-v1"||!(stored.iv instanceof Uint8Array)||
      stored.iv.byteLength!==12||!(stored.encrypted instanceof ArrayBuffer))
    throw Error("Invalid encrypted local project.");
   const encrypted=b64(stored.encrypted);
   if(encrypted.length>1_200_000)throw Error("Cloud archive size limit exceeded; keep the project local or use backup export.");
   return {iv:b64(stored.iv),encrypted};
  }
  async function cloudImport(recordKey,record){
   if(!record||typeof record!=="object"||typeof record.iv!=="string"||record.iv.length!==16||
      typeof record.encrypted!=="string"||record.encrypted.length>1_200_000)
    throw Error("Invalid cloud project envelope.");
   const keyName=id(recordKey),iv=unb64(record.iv),encrypted=unb64(record.encrypted);
   if(iv.length!==12||encrypted.length<16)throw Error("Invalid AES-GCM archive.");
   const plaintext=await crypto.subtle.decrypt({name:"AES-GCM",iv,
     additionalData:aad(recordKey)},await key,encrypted);
   const decoded=JSON.parse(decoder.decode(plaintext));
   if(!decoded||typeof decoded!=="object"||Array.isArray(decoded))
    throw Error("Cloud project content is invalid.");
   return operation("write",keyName,{format:"AES-GCM-v1",iv,
      encrypted:encrypted.buffer,updatedAt:Date.now()});
  }
  return Object.freeze({
   cloudExport,cloudImport,
   async read(recordKey){
    const record=await operation("read",id(recordKey));
    if(record===null)return null;
    if(record.format!=="AES-GCM-v1"||!(record.iv instanceof Uint8Array)||
       !(record.encrypted instanceof ArrayBuffer))throw Error("Invalid encrypted MegaFlyer draft.");
    const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:record.iv,
      additionalData:aad(recordKey)},await key,record.encrypted);
    return JSON.parse(decoder.decode(plain));
   },
   async write(recordKey,value){
    id(recordKey);
    const plain=encoder.encode(JSON.stringify(value));
    if(plain.byteLength>LIMIT)throw Error("Draft is too large to save locally.");
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv,
      additionalData:aad(recordKey)},await key,plain);
    return operation("write",id(recordKey),{format:"AES-GCM-v1",iv,encrypted,updatedAt:Date.now()});
   },
   async delete(recordKey){return operation("delete",id(recordKey));},
  });
 }
 window.MEGAFLYER_LOCAL_DRAFT_VAULT=Object.freeze({session});
})();
