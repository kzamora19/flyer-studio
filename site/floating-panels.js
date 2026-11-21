/* Flyer Studio: non-blocking movable editing panels.
   Panels stay open while users edit the preview behind them. */
(()=>{
'use strict';
const handles='.modalHeading,.powerTop,.sa-drag-handle';
const panels='.uiModalBox,.powerDialog,#sharedAssetDialog';
let drag=null;
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function start(e){
 if(e.button!==0 || e.isPrimary===false)return;
 if(!(e.target instanceof Element))return;
 if(e.target.closest('button,a,input,textarea,select,label,[contenteditable="true"],[role="button"]'))return;
 const handle=e.target.closest(handles);
 if(!handle)return;
 const panel=handle.closest(panels);
 if(!panel)return;
 const wrapper=panel.parentElement;
 if(wrapper?.hidden)return;
 const rect=panel.getBoundingClientRect();
 drag={panel,handle,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,
  previousX:Number(panel.dataset.dragX||0),previousY:Number(panel.dataset.dragY||0),rect};
 try{handle.setPointerCapture(e.pointerId);}catch{}
 handle.classList.add('panelDragging');
 e.preventDefault();
}
function move(e){
 if(!drag||e.pointerId!==drag.pointerId)return;
 const {panel,rect,startX,startY,previousX,previousY}=drag;
 // Keep the floating panel visible and its close button reachable.
 const deltaX=clamp(e.clientX-startX,12-rect.left,innerWidth-12-rect.right);
 const deltaY=clamp(e.clientY-startY,12-rect.top,innerHeight-60-rect.top);
 const x=previousX+deltaX,y=previousY+deltaY;
 panel.dataset.dragX=String(x);panel.dataset.dragY=String(y);
 panel.style.transform='translate('+x+'px,'+y+'px)';
 e.preventDefault();
}
function stop(e){
 if(!drag||e.pointerId!==drag.pointerId)return;
 drag.handle.classList.remove('panelDragging');
 try{drag.handle.releasePointerCapture(e.pointerId);}catch{}
 drag=null;
}
document.addEventListener('pointerdown',start);
document.addEventListener('pointermove',move);
document.addEventListener('pointerup',stop);
document.addEventListener('pointercancel',stop);
window.addEventListener('resize',()=>{
 for(const panel of document.querySelectorAll(panels)){
  panel.style.transform='';
  delete panel.dataset.dragX;delete panel.dataset.dragY;
 }
});
})();
// Load optional, presentation-only two-level navigation after the existing editor.
(()=>{const script=document.createElement('script');script.src='./chat-sidebar.js';script.defer=true;document.head.append(script)})();
