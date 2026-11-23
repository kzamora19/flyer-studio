// A narrowly scoped compatibility patch applied ONLY after the immutable
// private MegaFlyer release has passed its original SHA-256 check.
// This keeps the editor byte-pinned at rest, does not touch GitHub Pages,
// and replaces the broken sandboxed PTG password form with a signed,
// parent-mediated PTG product lookup. No PTG password/token enters the frame.
export function enableProtectedPtgLookup(verifiedHtml) {
  if(typeof verifiedHtml!=="string"||!verifiedHtml.startsWith("<!-- PRIVATE EDITOR BUNDLE"))
    throw Error("Verified private MegaFlyer editor required");
  let html=verifiedHtml;
  function replaceOne(oldText,newText,label){
    const count=html.split(oldText).length-1;
    if(count!==1)throw Error("Protected PTG compatibility anchor invalid: "+label);
    html=html.replace(oldText,newText);
  }
  // Reuse the EXISTING transferred MessagePort. Opening another channel or
  // accepting arbitrary postMessages would compromise the isolated frame.
  replaceOne(' window.__MEGAFLYER_PHOTO_RPC__=photo;',
  String.raw`
  async function ptgCatalog(action,fields={}) {
    if(action!=="search"||typeof fields.q!=="string"||
       !fields.q.trim()||fields.q.length>100||
       !Number.isInteger(Number(fields.page||1))||
       Number(fields.page||1)<1||Number(fields.page||1)>20)
      throw Error("Enter a valid barcode for live PTG lookup.");
    await Promise.race([ready,new Promise((_,reject)=>setTimeout(()=>
      reject(Error("Protected PTG lookup bridge did not connect.")),10000))]);
    return new Promise((resolve,reject)=>{
      const id=++nextId;
      const timer=setTimeout(()=>{pending.delete(id);
        reject(Error("PTG product lookup timed out."));},25000);
      pending.set(id,{resolve,reject,timer,kind:"ptg"});
      try{port.postMessage({id,action:"ptg-search",q:fields.q.trim(),
        page:Number(fields.page||1)});}
      catch{clearTimeout(timer);pending.delete(id);
        reject(Error("Could not send protected PTG lookup."));}
    });
  }
  window.__MEGAFLYER_PTG_RPC__=ptgCatalog;
  window.__MEGAFLYER_PHOTO_RPC__=photo;`, "MessagePort PTG lookup adapter");
  replaceOne('item.kind==="photo"&&typeof data.error==="string"?',
    '(item.kind==="photo"||item.kind==="ptg")&&typeof data.error==="string"?',
    "PTG error display");
  replaceOne('const sequence=lookupSequence, session=ptgSession;',
    "const sequence=lookupSequence, session=window.__MEGAFLYER_PTG_RPC__?{id:'ptg-proof-session'}:ptgSession;",
    "scoped barcode lookup authority (no bearer)");
  replaceOne('async function ptgRequest(endpoint,body,session) {',
  String.raw`async function ptgRequest(endpoint,body,session) {
  if(window.__MEGAFLYER_PTG_RPC__) {
    if(endpoint!=="ptg-products"||body?.action!=="search")
      throw Error("PTG account access is managed by the protected Studio launcher.");
    return window.__MEGAFLYER_PTG_RPC__("search",{q:body.q,page:body.page});
  }`, "parent-signed barcode lookup");
  replaceOne('<form id="ptgLogin">',
    '<p id="protectedPtgConnected" class="muted" role="status">PTG account verified through Branchline. Enter a barcode below to search live products; no second password is needed.</p><form id="ptgLogin" hidden>',
    "remove redundant password form");
  replaceOne("Sign in with your existing PTG username and password. No CSV is needed for live lookup.",
    "Connected through your PTG Studio session. Enter a barcode to use live product prices.",
    "PTG status text");
  replaceOne('<button id="backup">Download project</button>',
    '<button id="backup">Download project backup (.json)</button>',
    "distinguish editable project backup from PNG/PDF exports");
  return html;
}
