window.addEventListener('message',event=>{
  if(event.source!==document.querySelector('iframe').contentWindow||event.origin!==location.origin||event.data?.type!=='game-regression')return;
  document.body.dataset.result=event.data.result;
  if(event.data.error){const node=document.createElement('pre');node.textContent=event.data.error;document.body.append(node);}
});
