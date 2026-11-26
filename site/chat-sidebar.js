/* MegaFlyer: ChatGPT-style navigation facade.
   The original studioNav buttons retain all editor event handlers; this code
   only changes presentation and adds compact/mobile controls. */
(()=>{
 'use strict';
 const init=()=>{
  const aside=document.querySelector('main > aside');
  const fixed=document.getElementById('sidebarFixed');
  const nav=document.getElementById('studioNav');
  const content=document.getElementById('sidebarContent');
  const toggle=document.getElementById('editorMenuToggle');
  const subnav=document.getElementById('studioSubnav');
  if(!aside||!fixed||!nav||!content||!toggle||!subnav||document.body.classList.contains('flyerChatLayout'))return;
  const css=document.createElement('link');
  css.rel='stylesheet';css.href='./chat-sidebar.css';
  document.head.append(css);
  const railKey='flyer-studio-chat-rail-wide-v1';
  let wide=false;
  try{wide=localStorage.getItem(railKey)==='1';}catch{}
  const originallyCollapsed=fixed.classList.contains('menuCollapsed');
  if(originallyCollapsed===wide)toggle.click();
  document.body.classList.add('flyerChatLayout');
  const header=document.createElement('div');
  header.id='studioChatHeader';
  const title=document.createElement('strong');
  title.id='studioChatTitle';
  const close=document.createElement('button');
  close.id='studioChatMobileClose';close.type='button';
  close.textContent='⌃';close.title='Hide editing panel';
  close.setAttribute('aria-label','Collapse editing panel');
  header.append(title,close);
  content.prepend(header);
  for(const button of nav.querySelectorAll('[data-nav]')){
    const name=button.textContent.trim();
    button.title=name;
    button.setAttribute('aria-label',name);
  }
  const layout=document.getElementById('layoutSettings');
  if(layout){layout.title='Layout & Appearance';layout.setAttribute('aria-label','Layout & Appearance');}
  const compact=()=>fixed.classList.contains('menuCollapsed');
  function sync(){
    document.body.classList.toggle('chatRailWide',!compact());
    const active=nav.querySelector('[data-nav].active,[data-nav][aria-current="page"]');
    title.textContent=active?.textContent?.trim()||'Editor';
    if(matchMedia('(max-width:700px)').matches)
      toggle.setAttribute('aria-expanded',String(!aside.classList.contains('chatMobileClosed')));
    else toggle.setAttribute('aria-expanded',String(!compact()));
  }
  // The legacy collapse control now switches between an icon-only rail and
  // a labeled rail on desktop. On phones it closes just the editor panel.
  toggle.addEventListener('click',event=>{
    if(!matchMedia('(max-width:700px)').matches)return;
    event.preventDefault();event.stopImmediatePropagation();
    aside.classList.toggle('chatMobileClosed');
    sync();
  },true);
  toggle.addEventListener('click',()=>{
    try{localStorage.setItem(railKey,compact()?'0':'1');}catch{}
    sync();
  });
  close.onclick=()=>{
    aside.classList.add('chatMobileClosed');
    sync();toggle.focus();
  };
  nav.addEventListener('click',event=>{
    if(!event.target.closest('[data-nav]'))return;
    aside.classList.remove('chatMobileClosed');
    requestAnimationFrame(sync);
  });
  const observer=new MutationObserver(sync);
  observer.observe(nav,{subtree:true,attributes:true,attributeFilter:['class','aria-current']});
  window.addEventListener('resize',sync,{passive:true});
  sync();
 };
 // IndexedDB/protected storage hydration can complete after DOMContentLoaded.
 // Retry exactly once on the editor's own ready event; init is idempotent.
 window.addEventListener('flyerstudio:ready',init,{once:true});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
