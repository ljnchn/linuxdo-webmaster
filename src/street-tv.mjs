import {markup} from './markup.mjs';

// Account preference and public cast live outside the run/save and its clock.
export function createStreetTV(transport,redraw){
 let names=[],profiles=new Map(),panel=null,status=null,version=0,writing=false,error='',reading=false;
 function render(){
  if(!panel?.isConnected)return;
  const label=status?.enabled?'退出上电视':'我要上电视';
  const detail=status?.enabled&&!status.eligible?'已开启，重回前十时恢复展示。':status?.enabled?'已开启。上榜时，其他玩家街景中的普通佬友会轮换显示你的 Linux DO 昵称；离榜暂停，重回前十恢复。':'任一榜单前十名可将自己的 Linux DO 昵称展示在大家的街景路人头顶。';
  markup(panel).html=`<strong>上电视</strong><p>${detail}</p><button type="button" class="secondary" aria-pressed="${!!status?.enabled}" ${writing||(!error&&!status?.enabled&&!status?.eligible)?'disabled':''}>${error?'重新读取':writing?'正在保存…':status?label:'正在读取…'}</button><small role="status">${error||''}</small>`;
  panel.querySelector('button').onclick=()=>error?refresh():refresh(!status.enabled);
 }
 async function refresh(enabled){
  const write=typeof enabled==='boolean';
  if(!transport?.getTelevision||writing||(!write&&reading))return;
  const ticket=++version;
  reading=!write;writing=write;error='';
  render();
  try{
   const next=write?await transport.setTelevision(enabled):await transport.getTelevision();
   if(ticket!==version)return;
   status=next;writing=false;render();
   const ids=next.userIds;
   // Withdrawn or displaced players disappear before any new profile lookup.
   profiles=new Map(ids.filter(id=>profiles.has(id)).map(id=>[id,profiles.get(id)]));
   names=[...profiles.values()];redraw();
   const additions=await Promise.allSettled(ids.filter(id=>!profiles.has(id)).map(async id=>{
    const profile=await transport.getUserProfile(id);
    return [id,profile.name?.trim()];
   }));
   if(ticket!==version)return;
   for(const item of additions)if(item.status==='fulfilled'&&item.value[1])profiles.set(...item.value);
   names=ids.filter(id=>profiles.has(id)).map(id=>profiles.get(id));redraw();
  }catch{
   if(ticket!==version)return;
   status=null;names=[];profiles.clear();error='暂时无法确认上电视状态，请重新读取。';redraw();
  }finally{
   if(ticket===version){reading=false;writing=false;render();}
  }
 }
 return {
  names:()=>names,refresh,
  attach(element){panel=element;render();void refresh();},
  destroy(){version++;panel=null;names=[];profiles.clear();},
 };
}
