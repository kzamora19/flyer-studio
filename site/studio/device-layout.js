/* Deterministic presentation-only overlay for a SHA-256-verified editor.
   Runs inside the existing opaque sandbox; it adds no auth/storage bridge. */
(function(root){
 "use strict";
 const css=`
 @media(max-width:820px){
  body.bl-flyer-mobile-menu header{position:relative!important;height:auto!important;min-height:56px;display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:8px 12px;box-sizing:border-box}
  body.bl-flyer-mobile-menu header .brandIdentity{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:8px}
  body.bl-flyer-mobile-menu header .brandIdentity>.brandAppIcon{display:none!important}
  body.bl-flyer-mobile-menu header #editorMenuToggle{display:inline-grid!important;place-items:center;flex:0 0 44px;width:44px!important;height:44px;min-height:44px;padding:3px!important;border:1px solid #79b9ee;border-radius:9px;color:#fff;background:#14385f;font-size:0!important;overflow:hidden;cursor:pointer}
  body.bl-flyer-mobile-menu header #editorMenuToggle::before{content:""!important;display:block;width:36px;height:36px;border-radius:7px;background-image:url("https://kzamora19.github.io/branchline/icons/official/four-apps.png");background-repeat:no-repeat;background-size:72px 72px;background-position:-36px -36px}
  body.bl-flyer-mobile-menu main{display:flex!important;flex-direction:column!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}
  body.bl-flyer-mobile-menu main>aside{display:flex!important;flex-direction:column!important;width:100%!important;height:auto!important;max-height:none!important;min-height:0!important;flex:none!important;overflow:visible!important;box-sizing:border-box;padding:0!important}
  body.bl-flyer-mobile-menu #sidebarFixed{position:relative!important;top:auto!important;width:100%!important;height:auto!important;max-height:none!important;min-height:0!important;flex:none!important;display:flex!important;flex-direction:column!important;overflow:visible!important;box-sizing:border-box;padding:8px 10px}
  body.bl-flyer-mobile-menu #sidebarFixed .editorMenuHeading,body.bl-flyer-mobile-menu #editorMenuHint{display:none!important}
  body.bl-flyer-mobile-menu #studioNav{display:grid!important;grid-template-columns:minmax(0,1fr)!important;width:100%;min-width:0;max-width:none;overflow:visible!important;gap:4px}
  body.bl-flyer-mobile-menu #studioNav>[data-nav]{width:100%!important;min-height:42px;font-size:13px!important;white-space:normal!important;box-sizing:border-box;text-align:left}
  body.bl-flyer-mobile-menu #sidebarFixed.menuCollapsed #studioNav{display:none!important}
  body.bl-flyer-mobile-menu #sidebarContent{position:relative!important;top:auto!important;width:100%!important;height:auto!important;max-height:none!important;min-height:0!important;flex:none!important;overflow:visible!important;box-sizing:border-box;padding:10px 12px 18px}
  body.bl-flyer-mobile-menu #studioChatHeader{position:relative!important;top:auto!important}
  body.bl-flyer-mobile-menu main>aside.chatMobileClosed #sidebarContent{display:none!important}
  body.bl-flyer-mobile-menu main>aside.chatMobileClosed #studioNav{display:none!important}
  body.bl-flyer-mobile-menu main>aside.chatMobileClosed #sidebarFixed{padding:0!important;border:0}
  body.bl-flyer-mobile-menu .stage{height:auto!important;max-height:none!important;overflow:visible!important}
 }
 `;
 function wire(){
  const query=matchMedia("(max-width:820px)");
  let placeholder=null, toggle=null, heading=null;
  let observer;
  function find(){
   const t=document.getElementById("editorMenuToggle"),h=t?.closest(".editorMenuHeading"),brand=document.querySelector("header .brandIdentity");
   if(!t||!h||!brand||!document.getElementById("sidebarFixed")||!document.getElementById("sidebarContent"))return false;
   toggle=t;heading=h;placeholder=document.createComment("original editor menu position");h.insertBefore(placeholder,t);
   function sync(){
    if(query.matches){brand.prepend(toggle);document.body.classList.add("bl-flyer-mobile-menu");}
    else{heading.insertBefore(toggle,placeholder.nextSibling);document.body.classList.remove("bl-flyer-mobile-menu");}
   }
   query.addEventListener?.("change",sync);
   sync();
   return true;
  }
  if(!find()){observer=new MutationObserver(()=>{if(find())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});}
 }
 function apply(html){
  if(typeof html!=="string"||!html.includes("PRIVATE EDITOR BUNDLE"))return html;
  const at=html.toLowerCase().lastIndexOf("</body>");
  if(at<0||html.includes('id="bl-flyer-device-layout"'))return html;
  const code="("+wire.toString()+")();";
  return html.slice(0,at)+'<style id="bl-flyer-device-layout">'+css+'</style><script>'+code+'<\/script>'+html.slice(at);
 }
 if(typeof module==="object"&&module.exports)module.exports={apply};else root.BranchlineFlyerDeviceLayout=Object.freeze({apply});
})(typeof window!=="undefined"?window:globalThis);
