/* Keep the existing preview action buttons; only add a horizontal tab viewport. */
(() => {
  'use strict';
  function initFlyerTabs() {
    const toolbar=document.querySelector('.stage .toolbar');
    if(!toolbar || toolbar.parentElement?.classList.contains('flyer-tab-shell'))return;
    const shell=document.createElement('div');
    shell.className='flyer-tab-shell';
    const arrow=(direction, label, symbol)=>{
      const button=document.createElement('button');
      button.type='button';button.className='flyer-tab-scroll';
      button.textContent=symbol;button.setAttribute('aria-label',label);
      button.title=label;
      button.addEventListener('click',()=>toolbar.scrollBy({
        left:direction*Math.max(180,Math.round(toolbar.clientWidth*0.7)),
        behavior:'smooth'
      }));
      return button;
    };
    const previous=arrow(-1,'Scroll tabs left','‹');
    const next=arrow(1,'Scroll tabs right','›');
    toolbar.before(shell);
    shell.append(previous,toolbar,next);
    toolbar.setAttribute('role','toolbar');
    toolbar.setAttribute('aria-label','Flyer editing, layout and export actions');
    toolbar.tabIndex=0;
    const update=()=>{
      const end=Math.max(0,toolbar.scrollWidth-toolbar.clientWidth);
      previous.disabled=toolbar.scrollLeft<=2;
      next.disabled=toolbar.scrollLeft>=end-2;
    };
    toolbar.addEventListener('scroll',update,{passive:true});
    window.addEventListener('resize',update,{passive:true});
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(update).observe(toolbar);
    if(typeof MutationObserver!=='undefined'){
      const observer=new MutationObserver(()=>requestAnimationFrame(update));
      observer.observe(toolbar,{childList:true});
    }
    requestAnimationFrame(update);
  }
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',initFlyerTabs,{once:true});
  else initFlyerTabs();
})();

/* Public-only optional Smart Product Photo Library. The protected editor
 * injects its private MessagePort client separately and never loads this. */
(()=>{
  if(window.__MEGAFLYER_PRIVATE_DB__ ||
     location.origin!=='https://kzamora19.github.io' ||
     !location.pathname.startsWith('/flyer-studio/'))return;
  const script=document.createElement('script');
  script.src='./product-photo-standalone.js';script.async=false;
  document.head.append(script);
})();
