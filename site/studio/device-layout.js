/* Deterministic presentation-only overlay for a SHA-256-verified editor.
   Runs inside the existing opaque sandbox; it adds no auth/storage bridge. */
(function(root){
 "use strict";
 const css=`

 @media(min-width:821px){
body.frameChatLayout #pinNav,body:has(#sidebarFixed #studioNav) #sidebarFixed{background:#102b4d!important;background-image:none!important;border-color:#315675!important;color:#eff7ff!important;box-shadow:none!important;filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}body.frameChatLayout #pinNav .pinNavTitle,body:has(#sidebarFixed #studioNav) #sidebarFixed .editorMenuHeading,body:has(#sidebarFixed #studioNav) #sidebarFixed .editorMenuHeading h1{color:#e9f4ff!important;background:transparent!important}body.frameChatLayout #pinNav button[data-panel],body:has(#sidebarFixed #studioNav) #studioNav>[data-nav],body:has(#sidebarFixed #studioNav) #studioNav #sidebarActions button,body.frameChatLayout #mfRailToggle,body:has(#sidebarFixed #studioNav) #editorMenuToggle{color:#edf6ff!important;background:transparent!important;box-shadow:none!important;border-color:transparent!important;filter:none!important}body.frameChatLayout #pinNav button[data-panel]:hover,body:has(#sidebarFixed #studioNav) #studioNav>[data-nav]:hover,body:has(#sidebarFixed #studioNav) #studioNav #sidebarActions button:hover{background:#184d83!important}body.frameChatLayout #pinNav button[data-panel].active,body:has(#sidebarFixed #studioNav) #studioNav>[data-nav].active{background:#1557a0!important;color:#fff!important;box-shadow:inset 3px 0 #12d3e4!important}body:has(#sidebarFixed #studioNav) #studioNav #sidebarActions{border-color:#315675!important}body.frameChatLayout #mfChatNav,body:has(#sidebarFixed #studioNav) #studioChatHeader,body:has(#sidebarFixed #studioNav) #studioSubnav{background:#102b4d!important;color:#eaf5ff!important;border-color:#315675!important;box-shadow:none!important;backdrop-filter:none!important;filter:none!important}body.frameChatLayout #mfChatTitle,body:has(#sidebarFixed #studioNav) #studioChatTitle{color:#f3faff!important}body.frameChatLayout #mfChatItems button,body:has(#sidebarFixed #studioNav) #studioSubnav .navChildren button{color:#e6f2ff!important;background:transparent!important;border:0!important;box-shadow:none!important}body.frameChatLayout #mfChatItems button:hover,body:has(#sidebarFixed #studioNav) #studioSubnav .navChildren button:hover{background:#184d83!important}body.frameChatLayout #mfChatItems button.is-current,body:has(#sidebarFixed #studioNav) #studioSubnav .navChildren button.active{background:#1557a0!important;color:#fff!important;box-shadow:inset 3px 0 #11d2e4!important}body:has(#sidebarFixed #studioNav) #studioChatHeader button,body.frameChatLayout #mfMobileClose{background:#184d83!important;color:#fff!important}@media(min-width:721px){body.frameChatLayout .appbody,body.frameChatLayout.frameRailWide .appbody{grid-template-columns:clamp(355px,30vw,415px) minmax(0,1fr) clamp(195px,20vw,285px)!important}body.frameChatLayout .sidebar,body.frameChatLayout .sidebar.railWide{display:grid!important;grid-template-columns:64px minmax(0,1fr)!important;grid-template-rows:auto 1fr!important;height:calc(100dvh - 74px)!important;max-height:calc(100dvh - 74px)!important;overflow-y:auto!important;min-width:0!important;background:#fff!important}body.frameChatLayout #pinNav,body.frameChatLayout .sidebar.railWide #pinNav{display:flex!important;flex-direction:column!important;grid-column:1!important;grid-row:1 / span 3!important;position:sticky!important;top:0!important;width:64px!important;height:calc(100dvh - 74px)!important;min-height:0!important;max-height:calc(100dvh - 74px)!important;padding:10px 6px!important;overflow-y:auto!important;overflow-x:hidden!important;border-right:1px solid #315675!important;border-bottom:0!important}body.frameChatLayout #pinNav .pinNavGrid{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:4px!important}body.frameChatLayout #pinNav button[data-panel]{min-width:0!important;width:100%!important;min-height:44px!important;justify-content:center!important;gap:0!important;padding:8px!important;font-size:0!important}body.frameChatLayout #pinNav button[data-panel] .mfName,body.frameChatLayout .sidebar.railWide #pinNav button[data-panel] .mfName{display:none!important}body.frameChatLayout #pinNav button[data-panel] .mfIcon{width:24px!important;min-width:24px!important;font-size:20px!important}body.frameChatLayout #mfRailToggle{display:none!important}body.frameChatLayout #mfChatNav{grid-column:2!important;grid-row:1!important;display:block!important;padding:13px 12px!important;min-width:0!important;position:relative!important;top:0!important}body.frameChatLayout #mfChatItems button{min-height:38px!important;text-align:left!important;padding:9px 11px!important}body.frameChatLayout .sidebar>.section.activePanel{grid-column:2!important;grid-row:2!important;width:100%!important;min-width:0!important;background:#fff!important}body:has(#sidebarFixed #studioNav) main,body:has(#sidebarFixed #studioNav).chatRailWide main{grid-template-columns:clamp(355px,30vw,415px) minmax(0,1fr)!important}body:has(#sidebarFixed #studioNav) main>aside{display:flex!important;flex-direction:row!important;min-width:0!important;overflow:hidden!important;background:#fff!important}body:has(#sidebarFixed #studioNav) #sidebarFixed,body:has(#sidebarFixed #studioNav) #sidebarFixed.menuCollapsed{flex:0 0 64px!important;width:64px!important;height:100%!important;min-height:0!important;padding:10px 6px!important;overflow-y:auto!important;overflow-x:hidden!important;border-right:1px solid #315675!important;border-bottom:0!important}body:has(#sidebarFixed #studioNav) #sidebarFixed .editorMenuHeading h1,body:has(#sidebarFixed #studioNav) #sidebarFixed #editorMenuHint{display:none!important}body:has(#sidebarFixed #studioNav) #studioNav,body:has(#sidebarFixed #studioNav) #sidebarFixed.menuCollapsed #studioNav{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:4px!important;width:100%!important}body:has(#sidebarFixed #studioNav) #studioNav>[data-nav],body:has(#sidebarFixed #studioNav) #sidebarFixed.menuCollapsed #studioNav>[data-nav],body:has(#sidebarFixed #studioNav) #studioNav #sidebarActions button{display:flex!important;justify-content:center!important;width:100%!important;min-height:44px!important;padding:8px!important;gap:0!important;font-size:0!important;white-space:nowrap!important;overflow:hidden!important}body:has(#sidebarFixed #studioNav) #studioNav>[data-nav]::before,body:has(#sidebarFixed #studioNav) #studioNav #sidebarActions button::before{font-size:21px!important;min-width:22px!important}body:has(#sidebarFixed #studioNav) #sidebarContent{flex:1 1 0!important;min-width:0!important;width:auto!important;overflow-y:auto!important;background:#fff!important;padding:0 10px 24px!important}body:has(#sidebarFixed #studioNav) #studioChatHeader,body:has(#sidebarFixed #studioNav) #studioSubnav{background:#102b4d!important}}html[data-bl-native-menu="closed"] body:has(#sidebarFixed #studioNav) main{grid-template-columns:minmax(0,1fr)!important}html[data-bl-native-menu="closed"] body:has(#sidebarFixed #studioNav) main>aside{display:none!important}html[data-bl-native-menu="closed"] body.frameChatLayout .appbody{grid-template-columns:minmax(0,1fr) clamp(210px,22vw,305px)!important}html[data-bl-native-menu="closed"] body.frameChatLayout .appbody>.sidebar{display:none!important}html[data-bl-native-menu="closed"] body.frameChatLayout .appbody>.workspace{grid-column:1!important}html[data-bl-native-menu="closed"] body.frameChatLayout .appbody>.photoQueueSidebar{grid-column:2!important}@media (max-width:720px){html[data-bl-native-menu="closed"] body.frameChatLayout .appbody>.sidebar,html[data-bl-native-menu="closed"] body:has(#sidebarFixed #studioNav) main>aside{display:none!important}}@media print{html[data-bl-native-menu="closed"] body.frameChatLayout .appbody>.sidebar,html[data-bl-native-menu="closed"] body:has(#sidebarFixed #studioNav) main>aside{display:initial!important}}body:has(#sidebarFixed #studioNav) #sidebarFixed{display:flex!important;flex-direction:column!important;box-sizing:border-box!important}body:has(#sidebarFixed #studioNav) #studioChatHeader{padding:14px 12px!important;margin:0 -10px!important;position:relative!important}body:has(#sidebarFixed #studioNav) #studioSubnav{margin:0 -10px 10px!important;padding:0 10px 10px!important}body:has(#sidebarFixed #studioNav) #studioNav>[data-nav]::before,body:has(#sidebarFixed #studioNav) #studioNav #sidebarActions button::before{content:"◫";font:20px/1 'Segoe UI Symbol',sans-serif}body:has(#sidebarFixed #studioNav) #studioNav [data-nav="campaign"]::before{content:"✎"}body:has(#sidebarFixed #studioNav) #studioNav [data-nav="cards"]::before{content:"▦"}body:has(#sidebarFixed #studioNav) #studioNav [data-nav="bulk"]::before{content:"⇧"}body:has(#sidebarFixed #studioNav) #studioNav [data-nav="review"]::before{content:"✓"}body:has(#sidebarFixed #studioNav) #studioNav [data-nav="backup"]::before{content:"▣"}body:has(#sidebarFixed #studioNav) #studioNav #sidebarActions button::before{content:"⚙"}body:has(#sidebarFixed #studioNav) #studioNav #sidebarActions{display:block!important;margin:0!important;padding:6px 0!important}body:has(#sidebarFixed #studioNav) #studioSubnav:not([hidden])>.navChildren:not([hidden]){display:flex!important;flex-direction:column!important}body:has(#sidebarFixed #studioNav) #studioSubnav .navChildren button{display:block;text-align:left;min-height:38px;width:100%}}

 header{background:#102847!important;color:#fff!important}
 @media(min-width:821px){#sidebarFixed{background:#102847!important;color:#fff!important}#sidebarFixed .editorMenuHeading,#editorMenuHint{color:#d6e5f7!important}#studioNav>[data-nav]{color:#fff!important}#studioNav>[data-nav]:hover,#studioNav>[data-nav].active{background:#1858a0!important;color:white!important}}

 @media(max-width:820px){
  body.bl-flyer-mobile-menu header{position:relative!important;height:auto!important;min-height:56px;display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:8px 12px;box-sizing:border-box}
  body.bl-flyer-mobile-menu header .brandIdentity{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:8px}
  body.bl-flyer-mobile-menu header .brandIdentity>.brandAppIcon{display:none!important}
  body.bl-flyer-mobile-menu header .brandIdentity>strong,body.bl-flyer-mobile-menu header .brandIdentity .brandTitle{display:none!important}
  body.bl-flyer-mobile-menu header #editorMenuToggle{display:inline-grid!important;place-items:center;flex:0 0 44px;width:44px!important;height:44px;min-height:44px;padding:3px!important;border:1px solid #79b9ee;border-radius:9px;color:#fff;background:#14385f;font-size:0!important;overflow:hidden;cursor:pointer}
  body.bl-flyer-mobile-menu header #editorMenuToggle::before{content:""!important;display:block;width:36px;height:36px;border-radius:7px;background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHAAAABwCAMAAADxPgR5AAAAwFBMVEUNneYI4+IebNdgj+KZruHK0OMKXrVTardNbMew3PTvGRlQ5fgANNPuYmGlpqnxn59dZGwIlbtwhbEnSWsACY9OMJGOG1SIgn3wQT/AuuHOx78BKagDMrL6+/wAAAAASugAOcoDQ9UBUvEAGprL1++HmM4FZuQnR60AG6Jyh8oE+/yWptVKZbg2VbQPQ7Lm6vK1xOerttnX4/Iw5PwDI5wr1vwB6skLeOsGZs4rYtRXdsuYtOlrmOYJxeoRVtEGh9GxT/iaAAAAQHRSTlP///////////////////////////////////////8A////////////////////////////////////////////4VbhigAAEUxJREFUeNrNm3t7m7qyxsXN2E3SldV9PUdSDEEEsLiHNjbG9vf/Vnt0AYTttF3nj/2caVPbWNJPM7og3knRy2T1MDg/teHIXm5tMyD77dbsN1sZvA71XBzpVzYctr+2V/t4hTvar9vX0cyShsHHuZ4GDssin1aHqkZvX1r7ut4dnq63MYBQ7zPU9hq73Q5zNF+3t9VejaIGers9TkDN237Genx81O3IBibi5jc6OfdWEwXQ3n5SPAi24dm2Ybas0ffDXFUR29ftPdRQs7q/316tgMNnPHs41qyiwjbf0avRWTmO/T1eWMvybnDXSwlk23vxCLePtmJJ3vvD+tHsilhFst6ibhgGrq7hQHBC2Y4ZsUEAnVsHQ7DAbnXd1t18f6DHwByP4/VABGBQ6Tx2kck25EWT2b6g9vUWJsqGTFetg/37A10AhYv1ghc6de0EYbCegnKGRob6eAhUe5OLyL2FLXi0f0RoEECz5pY5t5E8BiZQN7EOxjZF0cMLcm5pgreZamaPYZDNQI10baNecFBFD0ZIg2DQb8yGQ4bsG+eE1ROPVn14aE2gJDpmN0WHZN+CwBnjEuj5U4VqIHXjR3RejJwy4lLTKhWvMDCcPBi4aeiAEsR6ko4Tluk2Vd1gkMAFDXhHemvHAKH9hAwOE26OiGwbH1w3TjC8s0evDaQAhtslLsCc3gUGaIfGrgaHZUxCcMcVH4gdYoxt2Y7NaJuRwLAwcND5ChfgmN4HhsFpImrgXImAhcAAV726FSAShOIiXgIzdA5M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");background-repeat:no-repeat;background-size:72px 72px;background-position:-36px -36px}
  body.bl-flyer-mobile-menu main{display:flex!important;flex-direction:column!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}
  body.bl-flyer-mobile-menu main>aside{display:flex!important;flex-direction:column!important;width:100%!important;height:auto!important;max-height:none!important;min-height:0!important;flex:none!important;overflow:visible!important;box-sizing:border-box;padding:0!important}
  body.bl-flyer-mobile-menu #sidebarFixed{position:relative!important;top:auto!important;width:100%!important;height:auto!important;max-height:none!important;min-height:0!important;flex:none!important;display:flex!important;flex-direction:column!important;overflow:visible!important;box-sizing:border-box;padding:8px 10px}
  body.bl-flyer-mobile-menu #sidebarFixed .editorMenuHeading,body.bl-flyer-mobile-menu #editorMenuHint{display:none!important}
  body.bl-flyer-mobile-menu #studioNav{position:fixed!important;left:0;top:var(--bl-editor-header-height,64px);bottom:0;z-index:90;display:grid!important;align-content:start;grid-template-columns:minmax(0,1fr)!important;width:min(85vw,320px)!important;min-width:0;max-width:none;overflow:auto!important;gap:5px;background:#102847;color:#fff;padding:12px;box-sizing:border-box;box-shadow:8px 0 24px #071a3970}
  body.bl-flyer-mobile-menu #studioNav>[data-nav]{width:100%!important;min-height:42px;font-size:13px!important;white-space:normal!important;box-sizing:border-box;text-align:left;color:white!important;background:#17395e!important}
  body.bl-flyer-mobile-menu #sidebarFixed.menuCollapsed #studioNav{display:none!important}
  body.bl-flyer-mobile-menu #sidebarFixed{padding:0!important;border:0!important}
  body.bl-flyer-mobile-menu header{position:sticky!important;top:0!important;z-index:100}
  body.bl-flyer-mobile-menu #sidebarContent{position:relative!important;top:auto!important;width:100%!important;height:auto!important;max-height:none!important;min-height:0!important;flex:none!important;overflow:visible!important;box-sizing:border-box;padding:10px 12px 18px}
  body.bl-flyer-mobile-menu #studioChatHeader{position:relative!important;top:auto!important}
  body.bl-flyer-mobile-menu main>aside.chatMobileClosed #sidebarContent{display:none!important}
  body.bl-flyer-mobile-menu main>aside.chatMobileClosed #studioNav{display:none!important}
  body.bl-flyer-mobile-menu main>aside.chatMobileClosed #sidebarFixed{padding:0!important;border:0}
  body.bl-flyer-mobile-menu .stage{height:auto!important;max-height:none!important;overflow:visible!important}
 }
 @media(min-width:821px){
  body:has(#sidebarFixed #studioNav) #editorMenuToggle{display:grid!important;place-items:center;width:100%;min-height:42px;padding:0!important;font-size:0!important;color:white!important;border:0!important;background:transparent!important}
  body:has(#sidebarFixed #studioNav) #editorMenuToggle::before{content:"☰";font-size:22px;line-height:1}
  body:has(#sidebarFixed #studioNav) #editorMenuToggle:focus-visible{outline:2px solid #12d3e4;outline-offset:-3px}
 }
 @media(min-width:821px){
  body:has(#sidebarFixed #studioNav) #studioNav > [data-nav],
  body:has(#sidebarFixed #studioNav) #studioNav #sidebarActions button{position:relative;display:grid!important;place-items:center!important;padding:0!important}
  body:has(#sidebarFixed #studioNav) #studioNav > [data-nav]::before,
  body:has(#sidebarFixed #studioNav) #studioNav #sidebarActions button::before{position:absolute;inset:0;display:grid;place-items:center;margin:0!important;line-height:1}
 }
 @media(min-width:821px){body:has(#sidebarFixed #studioNav) #sidebarFixed.menuCollapsed #studioNav{display:none!important}}
 @media(min-width:821px){
  body:has(#sidebarFixed #studioNav) #studioNav>[data-nav],
  body:has(#sidebarFixed #studioNav) #sidebarFixed.menuCollapsed #studioNav>[data-nav],
  body:has(#sidebarFixed #studioNav) #studioNav #sidebarActions button{
    position:relative!important;justify-content:center!important;align-items:center!important;padding:0!important;text-align:center!important;
  }
  body:has(#sidebarFixed #studioNav) #studioNav>[data-nav]::before,
  body:has(#sidebarFixed #studioNav) #studioNav #sidebarActions button::before{
    position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:24px!important;min-width:24px!important;text-align:center!important;line-height:1!important;
  }
  body:has(#sidebarFixed #studioNav) #editorMenuToggle{position:relative!important;padding:0!important;justify-content:center!important;align-items:center!important;}
  body:has(#sidebarFixed #studioNav) #editorMenuToggle::before{position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;text-align:center!important;line-height:1!important;}
 }
 @media(max-width:820px){
  body.bl-flyer-mobile-menu #studioNav>[data-nav]::before,
  body.bl-flyer-mobile-menu #studioNav #sidebarActions button::before{position:static!important;transform:none!important;}
 }

 /* Real SVG artwork eliminates invisible text and pseudo-glyph offsets. */
 @media(min-width:821px){
  body:has(#sidebarFixed #studioNav) #sidebarFixed #studioNav>[data-nav],
  body:has(#sidebarFixed #studioNav) #sidebarFixed #sidebarActions button,
  body:has(#sidebarFixed #studioNav) #sidebarFixed #editorMenuToggle{
   display:grid!important;place-items:center!important;position:relative!important;
   padding:0!important;gap:0!important;text-indent:0!important;font-size:0!important;
   box-sizing:border-box!important;
  }
  body:has(#sidebarFixed #studioNav) #sidebarFixed #studioNav>[data-nav]::before,
  body:has(#sidebarFixed #studioNav) #sidebarFixed #sidebarActions button::before,
  body:has(#sidebarFixed #studioNav) #sidebarFixed #editorMenuToggle::before{content:none!important;display:none!important;}
  body:has(#sidebarFixed #studioNav) #sidebarFixed .bl-centered-menu-icon{
   display:block!important;position:absolute!important;inset:0!important;margin:auto!important;
   width:22px!important;height:22px!important;min-width:22px!important;max-width:none!important;
   transform:none!important;flex:none!important;pointer-events:none!important;
  }
 }
 @media(max-width:820px){.bl-centered-menu-icon{display:none!important;}}

 `;
 function wire(){
  const shapes={
   menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
   campaign:'<path d="m5 19 4-1 10-10-4-4L5 14l-1 6zM13 6l4 4"/>',
   cards:'<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M9.33 4v16M14.67 4v16M4 9.33h16M4 14.67h16"/>',
   bulk:'<path d="M12 20V4m-6 6 6-6 6 6"/>',
   review:'<path d="m5 12 5 5 9-11"/>',
   backup:'<rect x="5" y="5" width="14" height="14" rx="1"/><rect x="8" y="8" width="8" height="8" rx=".5"/>',
   settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/><circle cx="12" cy="12" r="7"/>'
  };
  function installCenteredIcons(){
   const fixed=document.getElementById("sidebarFixed");if(!fixed)return false;
   for(const button of fixed.querySelectorAll("#studioNav>[data-nav],#sidebarActions button,#editorMenuToggle")){
    if(button.querySelector(".bl-centered-menu-icon"))continue;
    const name=button.id==="editorMenuToggle"?"menu":button.dataset.nav||"settings";
    const span=document.createElement("span");span.className="bl-centered-menu-icon";span.setAttribute("aria-hidden","true");
    span.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+(shapes[name]||shapes.settings)+'</svg>';
    button.append(span);
   }
   return true;
  }
  window.addEventListener("flyerstudio:ready",installCenteredIcons,{once:true});
  const centeredObserver=new MutationObserver(()=>installCenteredIcons());
  centeredObserver.observe(document.body,{childList:true,subtree:true});
  installCenteredIcons();
  const query=matchMedia("(max-width:820px)");
  let placeholder=null, toggle=null, heading=null;
  let observer;
  function find(){
   const t=document.getElementById("editorMenuToggle"),h=t?.closest(".editorMenuHeading"),brand=document.querySelector("header .brandIdentity");
   if(!t||!h||!brand||!document.getElementById("sidebarFixed")||!document.getElementById("sidebarContent"))return false;
   const syncToggleLabel=()=>{
    const label=toggle.getAttribute("aria-expanded")==="true"?"Hide editing menu":"Show editing menu";
    toggle.title=label;
    toggle.setAttribute("aria-label",label);
   };
   toggle=t;heading=h;
   syncToggleLabel();
   new MutationObserver(syncToggleLabel).observe(toggle,{attributes:true,attributeFilter:["aria-expanded"]});placeholder=document.createComment("original editor menu position");h.insertBefore(placeholder,t);
   function sync(){
    if(query.matches){brand.prepend(toggle);document.body.classList.add("bl-flyer-mobile-menu");const header=brand.closest("header");if(header)document.body.style.setProperty("--bl-editor-header-height",header.getBoundingClientRect().height+"px");}
    else{heading.insertBefore(toggle,placeholder.nextSibling);document.body.classList.remove("bl-flyer-mobile-menu");}
   }
   query.addEventListener?.("change",sync);
   sync();
   if(query.matches&&toggle.getAttribute("aria-expanded")==="true")toggle.click();
   const nav=document.getElementById("studioNav");
   nav?.addEventListener("click",e=>{if(query.matches&&e.target.closest("[data-nav]")&&toggle.getAttribute("aria-expanded")==="true")toggle.click();});
   document.addEventListener("keydown",e=>{if(query.matches&&e.key==="Escape"&&toggle.getAttribute("aria-expanded")==="true")toggle.click();});
   const header=brand.closest("header");if(header&&typeof ResizeObserver!=="undefined")new ResizeObserver(()=>document.body.style.setProperty("--bl-editor-header-height",header.getBoundingClientRect().height+"px")).observe(header);
   return true;
  }
  function initializeDesktop() {
   const nav=document.getElementById("studioNav");
   const content=document.getElementById("sidebarContent");
   if(!nav||!content)return false;
   if(document.getElementById("studioChatHeader"))return true;
   const heading=document.createElement("div");
   heading.id="studioChatHeader";
   const title=document.createElement("strong");
   title.id="studioChatTitle";
   heading.append(title);
   const sync=()=>{
    if(query.matches){heading.remove();return;}
    if(!heading.isConnected)content.prepend(heading);
    const label=nav.querySelector('[data-nav].active,[data-nav][aria-current="page"]')?.textContent.trim()||"MegaFlyer Studio";
    if(title.textContent!==label)title.textContent=label;
   };
   for(const button of nav.querySelectorAll("[data-nav],#sidebarActions button")){
    const label=button.getAttribute("aria-label")||button.textContent.trim();
    if(label){button.title=label;button.setAttribute("aria-label",label); }
   }
   query.addEventListener("change",sync);
   new MutationObserver(sync).observe(nav,{subtree:true,attributes:true,attributeFilter:["class","aria-current"]});
   sync();
   return true;
  }
  if(!initializeDesktop()){
   const desktopObserver=new MutationObserver(()=>{if(initializeDesktop())desktopObserver.disconnect();});
   desktopObserver.observe(document.body,{childList:true,subtree:true});
  }
  if(!find()){observer=new MutationObserver(()=>{if(find())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});}
 }
 function wireWorkspaceMenu(){
  window.addEventListener("message",event=>{
   if(event.source!==window.parent||event.origin!=="https://kzamora19.github.io"||event.data?.kind!=="branchline-workspace-menu"||typeof event.data.open!=="boolean")return;
   document.documentElement.dataset.blNativeMenu=event.data.open?"open":"closed";
  });
 }
 function apply(html){
  if(typeof html!=="string"||!(html.includes("PRIVATE EDITOR BUNDLE")||(html.includes("editorMenuToggle")&&html.includes("sidebarFixed")&&html.includes("studioNav"))))return html;
  if(html.includes('id="bl-flyer-device-layout"'))return html;
  // HTML permits an omitted body end tag. Protected bundles may also append
  // scripts after the editor markup, so only match document-ending tags.
  const closing=html.match(/(?:<\/body\s*>\s*)?<\/html\s*>\s*$/i)
    ||html.match(/<\/body\s*>\s*$/i);
  const at=closing?.index??html.length;
  const code="("+wire.toString()+")();("+wireWorkspaceMenu.toString()+")();";
  return html.slice(0,at)+'<style id="bl-flyer-device-layout">'+css+'</style><script>'+code+'<\/script>'+html.slice(at);
 }
 if(typeof module==="object"&&module.exports)module.exports={apply};else root.BranchlineFlyerDeviceLayout=Object.freeze({apply});
})(typeof window!=="undefined"?window:globalThis);
