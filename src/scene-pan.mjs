export function attachScenePan(scene) {
 let gesture=null,suppressClick=false;
 const down=event=>{
  if(!event.isPrimary||event.button!==0||event.pointerType==='touch')return;
  suppressClick=false;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,left:scene.scrollLeft,dragging:false};
 };
 const move=event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
  if(!gesture.dragging){
   if(Math.abs(dx)<6||Math.abs(dx)<Math.abs(dy))return;
   gesture.dragging=true;scene.setPointerCapture(event.pointerId);scene.classList.add('is-panning');
  }
  event.preventDefault();scene.scrollLeft=gesture.left-dx;
 };
 const end=event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  suppressClick=gesture.dragging;
  gesture=null;scene.classList.remove('is-panning');
  if(scene.hasPointerCapture(event.pointerId))scene.releasePointerCapture(event.pointerId);
 };
 const leave=event=>{if(!gesture?.dragging)end(event);};
 const click=event=>{
  if(!suppressClick||event.detail===0)return;
  suppressClick=false;event.preventDefault();event.stopImmediatePropagation();
 };
 const prevent=event=>event.preventDefault();
 const handlers={pointerdown:down,pointermove:move,pointerup:end,pointercancel:end,lostpointercapture:end,pointerleave:leave,click,dragstart:prevent,contextmenu:prevent};
 for(const [type,handler] of Object.entries(handlers))scene.addEventListener(type,handler,type==='click');
 return ()=>{
  if(gesture)end({pointerId:gesture.id});
  for(const [type,handler] of Object.entries(handlers))scene.removeEventListener(type,handler,type==='click');
 };
}
