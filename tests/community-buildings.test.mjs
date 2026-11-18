import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SCENE_BUILDINGS,DEFAULT_SCENE_CENTER,ORIGINAL_OFFSET,WORLD_WIDTH,WORLD_HEIGHT,getSceneBuilding,getCommunityActors,getTroublemakerActors,createWorld} from '../src/world.mjs';
import {placeChat} from '../src/ambient-chat.mjs';
import {createGame} from '../src/engine.mjs';

test('six separate side-view destinations share a sidewalk with the badge pavilion in the garden',()=>{
 assert.equal(WORLD_WIDTH,3*WORLD_HEIGHT);
 assert.equal(ORIGINAL_OFFSET,0);
 assert.equal(DEFAULT_SCENE_CENTER,790);
 assert.deepEqual(SCENE_BUILDINGS.map(b=>b.name),['社区公告','搞七捻三','开发调优','徽章馆','福利羊毛','资源荟萃']);
 assert.ok(Object.isFrozen(SCENE_BUILDINGS));
 assert.ok(!SCENE_BUILDINGS.some(b=>b.id==='documentation'));
 assert.equal(getSceneBuilding(1498,600).action,'achievements');
 for(const [index,b] of SCENE_BUILDINGS.entries()){
  assert.ok(Object.isFrozen(b));
  assert.ok(b.x>=0&&b.x+b.w<=WORLD_WIDTH&&b.y>0&&b.y+b.h<=WORLD_HEIGHT);
  assert.equal(b.y+b.h,725,'all entrances share one flat sidewalk, not a top-down map');
  assert.ok(b.labelX>b.x&&b.labelX<b.x+b.w&&b.labelY>b.y&&b.labelY<b.y+b.h);
  assert.equal(getSceneBuilding(b.x+b.w/2,b.y+b.h/2),b);
  if(index)assert.ok(b.x>SCENE_BUILDINGS[index-1].x+SCENE_BUILDINGS[index-1].w,'buildings are independent and have gaps');
 }
 assert.ok(SCENE_BUILDINGS.find(b=>b.id==='benefits').x>1500);
 assert.ok(SCENE_BUILDINGS.find(b=>b.id==='resources').x>1672);
 assert.equal(SCENE_BUILDINGS.find(b=>b.id==='benefits').action,'benefits');
 assert.equal(SCENE_BUILDINGS.find(b=>b.id==='resources').action,'resources');
 assert.equal(getSceneBuilding(1200,600).action,'server','the old server remains at its established location');
 for(const [x,y] of [[-1,600],[WORLD_WIDTH+1,600],[1934,100],[1934,760],[2200,600],[NaN,600],[1934,Infinity]])assert.equal(getSceneBuilding(x,y),null);
});

test('the expanded canvas routes real storefronts correctly after scaling and horizontal panning',()=>{
 const originals=Object.fromEntries(['matchMedia','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const handlers=new Map(),visits=[];
 const state=createGame('新街道',123),before=JSON.stringify(state);
 const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const rect={left:-900,top:20,width:WORLD_WIDTH/2,height:WORLD_HEIGHT/2};
 const canvas={style:{},getContext:()=>ctx,getBoundingClientRect:()=>rect,addEventListener:(n,f)=>handlers.set(n,f),removeEventListener:(n)=>handlers.delete(n)};
 let world;
 try{
  globalThis.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
  globalThis.requestAnimationFrame=()=>{throw Error('reduced motion must remain still')};
  globalThis.cancelAnimationFrame=()=>{};
  world=createWorld(canvas,()=>state,(...args)=>visits.push(args));
  const at=(x,y)=>({clientX:rect.left+x/2,clientY:rect.top+y/2});
  handlers.get('click')(at(1934,600));
  handlers.get('click')(at(2514,600));
  handlers.get('click')(at(1498,600));
  handlers.get('click')(at(2200,600));
  assert.deepEqual(visits,[['benefits','福利羊毛'],['resources','资源荟萃'],['achievements','徽章馆']]);
  handlers.get('pointermove')(at(1934,600));assert.equal(canvas.style.cursor,'pointer');
  handlers.get('pointermove')(at(2200,600));assert.equal(canvas.style.cursor,'default');
  assert.equal(JSON.stringify(state),before);
 }finally{world?.destroy();for(const [key,descriptor]of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});

test('new-street inhabitants, chatter and original event markers share the expanded coordinate system',()=>{
 const state={...createGame(),members:30,events:[{id:'event-1',kind:'troublemaker',createdDay:0,expiresDay:10}]},before=JSON.stringify(state);
 const people=getCommunityActors(state,0,true),extension=people.filter(p=>p.x>1672);
 assert.ok(extension.length>=1,'ambient walkers leave room for the named residents');
 assert.equal(getTroublemakerActors(state)[0].x,910,'existing event actors do not slide sideways');
 for(const actor of extension){
  assert.ok(actor.x+60<WORLD_WIDTH);
  const scale=.7,headX=(actor.x+21)*scale-1200;
  const placement=placeChat(actor,{scene:{left:-1200,top:0,width:WORLD_WIDTH*scale,height:WORLD_HEIGHT*scale},viewport:{left:0,top:0,width:900,height:800}});
  assert.ok(placement);
  assert.ok(Math.abs(placement.left+placement.tail-headX)<1e-9);
  assert.ok(Math.abs(placement.top+placement.height+12-(actor.y-52)*scale)<1e-9);
 }
 assert.equal(JSON.stringify(state),before,'scene exploration adds no economy, clock, random-seed or save changes');
});

test('the current artwork is a local 3:1 raster asset',async()=>{
 const expanded=await readFile(new URL('../public/assets/community-sharing-day-v2.png',import.meta.url));
 assert.equal(expanded.subarray(1,4).toString(),'PNG');
 const width=expanded.readUInt32BE(16),height=expanded.readUInt32BE(20);
 assert.equal(width,3*height);
 assert.ok(width>=2000&&height>=700);
 const world=await readFile(new URL('../src/world.mjs',import.meta.url),'utf8');
 assert.match(world,/assets\/community-sharing-day-v2\.png/);
});
