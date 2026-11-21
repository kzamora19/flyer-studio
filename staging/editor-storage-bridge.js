/* Injected only inside the private MegaFlyer package (STAGING ONLY).
 * It has no PTG bearer, access to parent DOM, or persistent browser storage.
 * An opaque iframe receives one MessagePort whose parent side accepts only
 * encrypted per-account project records (read/write/delete). */
(() => {
 "use strict";
 let port=null,nextId=0;
 const pending=new Map();
 let readyResolve;
 const ready=new Promise(resolve=>{readyResolve=resolve;});
 window.addEventListener("message",event=>{
  if(event.source!==window.parent||!event.data||
     event.data.kind!=="megaflyer-private-storage-port"||
     port||event.ports.length!==1)return;
  port=event.ports[0];
  port.onmessage=({data})=>{
   if(!data||!Number.isSafeInteger(data.id))return;
   const item=pending.get(data.id);
   if(!item)return;
   pending.delete(data.id);clearTimeout(item.timer);
   if(data.ok===true)item.resolve(data.value??null);
   else item.reject(Error("Encrypted project storage is unavailable."));
  };
  port.start();
  readyResolve();
 });
 async function request(action,key,record){
  if(!["read","write","delete"].includes(action)||
     typeof key!=="string"||!/^p:[A-Za-z0-9_-]{1,96}$/.test(key))
    throw Error("Unsupported protected project operation.");
  await Promise.race([
   ready,new Promise((_,reject)=>setTimeout(()=>reject(Error("Protected storage bridge did not connect.")),10000))
  ]);
  return new Promise((resolve,reject)=>{
   const id=++nextId;
   const timer=setTimeout(()=>{pending.delete(id);reject(Error("Protected storage timed out."));},45000);
   pending.set(id,{resolve,reject,timer});
   try {port.postMessage({id,action,key,record:action==="write"?record:undefined});}
   catch{clearTimeout(timer);pending.delete(id);reject(Error("Cannot send protected draft record."));}
  });
 }
 function database(){
  return Object.freeze({transaction(storeName,mode="readonly"){
   if(storeName!=="projects"||!["readonly","readwrite"].includes(mode))
    throw Error("Unsupported private project store.");
   const transaction={oncomplete:null,onerror:null,onabort:null};
   function run(action,key,record){
    const req={result:undefined,error:null,onsuccess:null,onerror:null};
    // Schedule the result after the caller has installed IDBRequest handlers.
    Promise.resolve().then(()=>request(action,"p:"+key,record)).then(value=>{
     req.result=value;req.onsuccess?.({target:req});
     transaction.oncomplete?.({target:transaction});
    },error=>{
     req.error=error;req.onerror?.({target:req});
     transaction.onerror?.({target:transaction});
    });
    return req;
   }
   transaction.objectStore=name=>{
    if(name!=="projects")throw Error("Unsupported private project store.");
    return Object.freeze({
     get(key){return run("read",key);},
     put(value,key){
      if(mode!=="readwrite")throw Error("Private project store is readonly.");
      return run("write",key,structuredClone(value));
     },
     delete(key){
      if(mode!=="readwrite")throw Error("Private project store is readonly.");
      return run("delete",key);
     },
    });
   };
   return transaction;
  }});
 }
 window.__MEGAFLYER_PRIVATE_DB__=Object.freeze({request,database});
})();
