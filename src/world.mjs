/* Original pixel characters plus commissioned original environment. Rendering never changes rules. */
import {CHARACTER_ATTENTION_KINDS} from './engine.mjs';
export const WORLD_WIDTH=2823, WORLD_HEIGHT=941;
// The original street retains its coordinates; sharing houses extend it to the right.
// The former document kiosk is now a non-interactive garden and rest area.
export const ORIGINAL_OFFSET=0, DEFAULT_SCENE_CENTER=790;
export const SCENE_BUILDINGS=Object.freeze([
 {id:'board',name:'社区公告',action:'events',x:145,y:460,w:295,h:265,labelX:290,labelY:512},
 {id:'cafe',name:'搞七捻三',action:'hall',x:443,y:355,w:638,h:370,labelX:790,labelY:504},
 {id:'server',name:'开发调优',action:'server',x:1105,y:443,w:235,h:282,labelX:1224,labelY:518},
 {id:'benefits',name:'福利羊毛',action:'benefits',x:1700,y:342,w:465,h:383,labelX:1934,labelY:488},
 {id:'resources',name:'资源荟萃',action:'resources',x:2246,y:330,w:535,h:395,labelX:2514,labelY:488}
].map(Object.freeze));
export function getSceneBuilding(x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 return SCENE_BUILDINGS.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)||null;
}
// Legacy static projection for callers that have not moved to getSceneActors.
// The canvas and moving markers use the shared projection below instead.
export function getTroublemakerActors(state){
 if(state.gameOver)return [];
 const positions=[910,1200,600,1360,220,1520,70,1035];
 return (state.events||[]).filter(e=>e.kind==='troublemaker'&&e.expiresDay>state.day)
  .slice().sort((a,b)=>a.createdDay-b.createdDay||a.id.localeCompare(b.id)).slice(0,8)
  .map((event,i)=>({eventId:event.id,x:positions[i],y:748}));
}
// Each event keeps its own walking space until it disappears. Layout is transient
// presentation state, keyed by the game's immutable seed, never by array index or
// RNG. Keeping live reservations avoids reassigning survivors when a card closes.
const EVENT_HOMES=Object.freeze([910,1200,600,1360,220,1520,70,1035]);
const actorLayouts=new Map();
const actorHash=id=>{let hash=2166136261;for(const char of id)hash=Math.imul(hash^char.codePointAt(0),16777619);return hash>>>0;};
const eventOrder=(a,b)=>(a.createdDay||0)-(b.createdDay||0)||a.id.localeCompare(b.id);
function eventHomes(state,events){
 const key=state.seed??'preview';
 let homes=actorLayouts.get(key);
 if(!homes){homes=new Map();actorLayouts.set(key,homes);if(actorLayouts.size>64)actorLayouts.delete(actorLayouts.keys().next().value);}
 const live=new Set(events.map(event=>event.id));
 for(const id of homes.keys())if(!live.has(id))homes.delete(id);
 const occupied=new Set(homes.values());
 for(const event of events){
  if(homes.has(event.id))continue;
  const day=event.id.match(/-(\d+)$/),preferred=day?Number(day[1])%EVENT_HOMES.length:actorHash(event.id)%EVENT_HOMES.length;
  let slot=preferred;
  while(occupied.has(slot)){slot=(slot+1)%EVENT_HOMES.length;if(slot===preferred){slot=EVENT_HOMES.length;while(occupied.has(slot))slot++;break;}}
  homes.set(event.id,slot);occupied.add(slot);
 }
 return homes;
}
function markedActors(state,time,reduced){
 if(state.gameOver)return [];
 const events=(state.events||[]).filter(event=>event.expiresDay>state.day).slice().sort(eventOrder),homes=eventHomes(state,events);
 const actors=events.map(event=>{
  const hash=actorHash(event.id),slot=homes.get(event.id),trouble=event.kind==='troublemaker';
  const baseX=EVENT_HOMES[slot]??(1940+(slot-EVENT_HOMES.length)*135);
  const x=Math.round(baseX+(reduced?0:Math.sin(time/4200+(hash%628)/100)*12)),y=748;
  return {id:`event:${event.id}`,role:'event',eventId:event.id,eventKind:event.kind,category:event.category,
   marker:trouble?'×':CHARACTER_ATTENTION_KINDS.includes(event.kind)?'!':'?',x,y,homeX:baseX,markerX:x+21,markerY:y-103,
   style:trouble?2:hash%14+1,patron:event.kind==='patron',trouble};
 });
 const sponsors=(state.pendingSponsors||[]).filter(sponsor=>sponsor.expiresDay>state.day);
 if(sponsors.length){
  const x=Math.round(1730+(reduced?0:Math.sin(time/4600+1.7)*12)),y=748;
  actors.push({id:'sponsor:pending',role:'sponsor',marker:'coin',x,y,homeX:1730,markerX:x+21,markerY:y-103,style:4,patron:true,trouble:false,sponsorCount:sponsors.length});
 }
 return actors;
}
function communityActors(state,time,reduced,marked){
 const people=[];
 // Keep a whole walking envelope clear, so ambient people never blink in and
 // out as a marked actor takes a step. Preserve the legacy trouble exclusion too.
 const blockers=[...getTroublemakerActors(state),...marked,{x:772}];
 for(let i=0;i<Math.min(14,state.members||0);i++){
  const baseX=i<10?210+(i*173)%1310:[1800,2070,2350,2660][i-10];
  const x=Math.round(ORIGINAL_OFFSET+baseX+(reduced?0:Math.sin(time/5200+i*4)*30)),y=737+(i%3)*20;
  if(!blockers.some(actor=>Math.abs((actor.homeX??actor.x)-(ORIGINAL_OFFSET+baseX))<127))people.push({id:`member-${i}`,role:'member',x,y,style:i+1,patron:i<state.patrons});
 }
 return people;
}
// All coordinates are the actual pixel-aligned canvas origins. markerX/markerY
// locate the DOM control above that same character; no second clock is needed.
export function getSceneActors(state,time=0,reduced=false){
 const now=Number.isFinite(time)?time:0,marked=markedActors(state,now,reduced);
 return [...communityActors(state,now,reduced,marked),{id:'host',role:'host',x:772,y:748,style:0,patron:false},...marked];
}
export function getCommunityActors(state,time=0,reduced=false){
 return getSceneActors(state,time,reduced).filter(actor=>actor.role==='member');
}
export const ROOM_LAYOUT=Object.freeze([
 ['development','开发调优','server'],['alternatives','国产替代','workshop'],['resources','资源荟萃','resources'],['documentation','文档共建','workshop'],['careers','非我莫属','hall'],['reading','读书成诗','workshop'],['news','前沿快讯','workshop'],['memory','网络记忆','workshop'],['benefits','福利羊毛','benefits'],['offtopic','搞七捻三','cafe'],['square','虫洞广场','hall'],['feedback','运营反馈','events']
].map(([id,name,action],i)=>Object.freeze({id,name,action,x:170+(i%4)*340,y:500+Math.floor(i/4)*70,w:260,h:60})));
export function createWorld(canvas,getState,onBuilding,onFrame,sceneUrl='assets/community-sharing-day-v2.png'){
 const ctx=canvas.getContext('2d');canvas.width=WORLD_WIDTH;canvas.height=WORLD_HEIGHT;ctx.imageSmoothingEnabled=false;
 const media=matchMedia('(prefers-reduced-motion: reduce)');let reduced=media.matches,running=true,raf=0,last=0;
 const bg=typeof Image!=='undefined'?new Image():null;if(bg){bg.src=sceneUrl;bg.onload=()=>{if(running)draw(reduced?0:performance.now())}}
 const r=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h)};
 function person(x,y,i,t,patron=false,trouble=false){
  const c=trouble?'#52616b':['#e6ac32','#3886bb','#bf637d','#6c9a76','#9a7eb6','#dc774e'][i%6],skin=['#edc196','#f3d0af','#c99870'][i%3],hair=['#292e36','#674734','#40372f','#bc6d51'][i%4];
  const step=reduced?0:Math.floor(t/220+i)%2;ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(3,3);
  r(-4,20,22,3,'#362b3533');r(1,16,6,6+step,'#293a4e');r(10,16,6,7-step,'#293a4e');r(0,21+step,7,2,'#20252d');r(10,22-step,8,2,'#20252d');
  r(-1,6,18,12,'#303132');r(1,6,14,11,c);r(-4,8,5,8,skin);r(16,8,4,8,skin);r(-4,7,5,4,c);r(16,7,4,4,c);
  r(-2,-9,19,15,hair);r(0,-6,15,12,skin);r(-2,-11,18,5,hair);r(-4,-7,5,7,hair);r(14,-6,4,5,hair);
  r(3,-2,2,3,'#2c2a2c');r(11,-2,2,3,'#2c2a2c');r(7,3,3,1,'#a96959');r(2,1,3,2,'#e6a18b');r(12,1,2,2,'#e6a18b');
  if(i%4===0){r(-4,-11,24,3,'#b97c21');r(0,-15,15,5,'#efbb4d');r(3,-16,8,2,'#f4ca65')}
  if(i%4===1){r(0,-3,7,5,'#25323d');r(9,-3,7,5,'#25323d');r(2,-2,3,2,'#b7d6de');r(11,-2,3,2,'#b7d6de');r(7,-2,2,1,'#25323d')}
  if(patron){r(4,8,7,7,'#f3cd51');r(6,10,3,3,'#b78525')}
  if(trouble){
   // A coral cap and a discussion note identify the situation, not a villain.
   r(-3,-12,21,5,'#b65640');r(0,-16,16,5,'#df8061');r(3,-18,10,3,'#e6a07d');r(-4,-12,23,2,'#f1b58e');
   r(2,9,13,2,'#9ba8aa');r(7,6,2,11,'#36474c');r(16,8,10,10,'#fff2d6');r(18,10,6,2,'#bf6045');r(21,12,3,2,'#bf6045');r(17,17,3,3,'#fff2d6');
  }
  ctx.restore();
 }
 function draw(t=0){
  if(!running)return;
  const s=getState();r(0,0,WORLD_WIDTH,WORLD_HEIGHT,'#90c9ed');if(bg?.complete&&bg.naturalWidth)ctx.drawImage(bg,0,0,WORLD_WIDTH,WORLD_HEIGHT);
  if(s.timeSlot===1)r(0,0,WORLD_WIDTH,WORLD_HEIGHT,'#f3a44d20');
  if(s.timeSlot===2){r(0,0,WORLD_WIDTH,WORLD_HEIGHT,'#19244480');for(let i=0;i<58;i++)r((i*127+54)%WORLD_WIDTH,40+(i*43)%190,3,3,'#fff3c7');for(const x of [70,519,1380,1755,2210,2470]){ctx.fillStyle='#ffd87735';ctx.beginPath();ctx.arc(x,520,35,0,Math.PI*2);ctx.fill()}}
  const actors=getSceneActors(s,t,reduced);
  for(const actor of actors)person(actor.x,actor.y,actor.style,t,actor.patron,actor.trouble);
  if(s.gameOver)r(0,0,WORLD_WIDTH,WORLD_HEIGHT,'#26313d50');
  onFrame?.(actors);
 }
 const hit=e=>{const b=canvas.getBoundingClientRect();if(!b.width||!b.height)return null;return getSceneBuilding((e.clientX-b.left)/b.width*WORLD_WIDTH,(e.clientY-b.top)/b.height*WORLD_HEIGHT)};
 const click=e=>{const building=hit(e);if(building)onBuilding(building.action,building.name)};
 const move=e=>canvas.style.cursor=hit(e)?'pointer':'default';
 function frame(t){if(!running||reduced)return;if(t-last>65){draw(t);last=t}raf=requestAnimationFrame(frame)}
 const change=()=>{reduced=media.matches;cancelAnimationFrame(raf);draw(0);if(!reduced)raf=requestAnimationFrame(frame)};
 canvas.addEventListener('click',click);canvas.addEventListener('pointermove',move);media.addEventListener?.('change',change);draw();if(!reduced)raf=requestAnimationFrame(frame);
 return{redraw:()=>draw(reduced?0:performance.now()),destroy:()=>{if(!running)return;running=false;cancelAnimationFrame(raf);canvas.removeEventListener('click',click);canvas.removeEventListener('pointermove',move);media.removeEventListener?.('change',change)}};
}
