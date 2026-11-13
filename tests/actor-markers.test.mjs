import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, CHARACTER_ATTENTION_KINDS, RULES} from '../src/engine.mjs';
import {createWorld, getSceneActors, getCommunityActors, getTroublemakerActors, ROOM_LAYOUT, WORLD_WIDTH, WORLD_HEIGHT} from '../src/world.mjs';

let seed=5300;
const event=(id,kind='welcome',createdDay=1)=>({id,kind,category:kind==='model'?'world':'character',createdDay,expiresDay:createdDay+6});
const sponsor=(id,expiresDay=21)=>({id,createdDay:7,expiresDay,amount:100,patron:1});
const fixture=patch=>({...createGame('人物标记测试',++seed),day:3,members:30,patrons:1,events:[],pendingSponsors:[],...patch});
const markers=(state,time=0,reduced=true)=>getSceneActors(state,time,reduced).filter(actor=>actor.marker);

test('each live event has its own stable actor and the correct question, attention or trouble marker',()=>{
 const state=fixture({events:[event('welcome-1'),event('world-2','model',2),event('trouble-3','troublemaker',3)]}),before=structuredClone(state);
 const found=markers(state);
 assert.deepEqual(found.map(actor=>actor.marker),['?','?','×']);
 assert.deepEqual(found.map(actor=>actor.eventId),state.events.map(event=>event.id));
 assert.equal(new Set(found.map(actor=>actor.id)).size,found.length);
 for(const actor of found){
  assert.equal(actor.id,`event:${actor.eventId}`);
  assert.equal(actor.role,'event');
  assert.equal(actor.markerX,actor.x+21);
  assert.equal(actor.markerY,actor.y-103);
  assert.equal(Number.isInteger(actor.x),true);
  assert.equal(Number.isInteger(actor.y),true);
 }
 assert.deepEqual(markers({...state,events:[...state.events].reverse()}),found);
 for(const kind of CHARACTER_ATTENTION_KINDS){
  const attention=markers({...state,events:[event(`attention:${kind}`,kind)]});
  assert.equal(attention.length,1);
  assert.equal(attention[0].marker,'!');
 }
 assert.deepEqual(state,before,'projection cannot change the game or its random seed');
});

test('resolving an earlier card preserves survivors even when their preferred slots collide',()=>{
 const state=fixture({events:[event('earlier-1'),event('later-9','article',2),event('last-17','troublemaker',3)]});
 const initial=markers(state,9876,false),survivors=initial.slice(1);
 const resolved={...state,events:state.events.slice(1)};
 assert.deepEqual(markers(resolved,9876,false),survivors);
 assert.deepEqual(markers({...resolved,events:[...resolved.events].reverse()},9876,false),survivors);
 const newer={...resolved,events:[event('new-arrival-25','patron',3),...resolved.events]};
 const updated=markers(newer,9876,false);
 for(const actor of survivors)assert.deepEqual(updated.find(other=>other.id===actor.id),actor);
 assert.equal(new Set(updated.map(actor=>`${actor.x},${actor.y}`)).size,updated.length);
});

test('ordinary, attention, trouble and sponsor people all walk with their own markers',()=>{
 const state=fixture({events:[event('walk-1'),event('walk-2',CHARACTER_ATTENTION_KINDS[0]),event('walk-3','troublemaker')],pendingSponsors:[sponsor('sponsor-7-1'),sponsor('sponsor-7-2')]});
 const still=markers(state),moving=markers(state,17000,false);
 assert.equal(moving.length,4);
 assert.equal(moving.filter(actor=>actor.role==='sponsor').length,1);
 assert.equal(moving.find(actor=>actor.role==='sponsor').id,'sponsor:pending');
 assert.equal(moving.find(actor=>actor.role==='sponsor').sponsorCount,2);
 assert.deepEqual(markers(state,17000,true),still,'reduced motion keeps every marked actor still');
 for(const actor of moving){
  assert.notEqual(actor.x,still.find(other=>other.id===actor.id).x,actor.id);
  assert.equal(actor.markerX,actor.x+21);
  assert.equal(actor.markerY,actor.y-103);
  assert.ok(actor.markerX>0&&actor.markerX<WORLD_WIDTH);
  assert.ok(actor.markerY>0&&actor.y+72<WORLD_HEIGHT);
 }
 const partiallyClaimed={...state,pendingSponsors:state.pendingSponsors.slice(1)};
 const remaining=markers(partiallyClaimed,17000,false).find(actor=>actor.role==='sponsor');
 assert.deepEqual({...remaining,sponsorCount:2},moving.find(actor=>actor.role==='sponsor'),'partial claim does not rebind the sponsor');
});

test('zero-member welcome visitors exist but expired, claimed and game-over markers do not',()=>{
 const empty=fixture({members:0,patrons:0}),welcome={...empty,events:[event('visitor-1')]};
 assert.deepEqual(markers(empty),[]);
 assert.deepEqual(getCommunityActors(welcome),[]);
 assert.equal(markers(welcome).length,1,'a visitor is not an admitted community member');
 assert.equal(getSceneActors(welcome).length,2,'one host and one visitor');
 const pending={...welcome,pendingSponsors:[sponsor('sponsor-7-1')]};
 assert.equal(markers(pending).length,2);
 assert.deepEqual(markers({...pending,day:21}),[]);
 assert.deepEqual(markers({...pending,events:[],pendingSponsors:[]}),[]);
 assert.deepEqual(markers({...pending,gameOver:true}),[]);
 assert.equal(pending.members,0);
});

test('full event capacity stays separated from other event actors, the host and ambient walkers',()=>{
 const state=fixture({events:Array.from({length:RULES.maxEvents},(_,i)=>event(`busy-${i}`)),pendingSponsors:[sponsor('sponsor-7-1')]}),before=JSON.stringify(state);
 let memberIds;
 for(const time of [0,700,1500,12000,30000,99999]){
  const all=getSceneActors(state,time,false),marked=all.filter(actor=>actor.marker),members=all.filter(actor=>actor.role==='member');
  assert.equal(marked.length,RULES.maxEvents+1);
  assert.deepEqual(getCommunityActors(state,time,false),members,'chat uses the same population and coordinates as canvas');
  if(memberIds)assert.deepEqual(members.map(actor=>actor.id),memberIds,'walking must not blink ambient people in and out');
  memberIds=members.map(actor=>actor.id);
  for(const actor of marked){
   for(const other of all.filter(other=>other.id!==actor.id))assert.ok(Math.abs(actor.x-other.x)>=85,`${actor.id} overlaps ${other.id} at ${time}`);
  }
 }
 assert.equal(JSON.stringify(state),before);
});

function canvasHarness(reduced=false){
 const keys=['matchMedia','requestAnimationFrame','cancelAnimationFrame','Image','performance'];
 const originals=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const handlers=new Map(),callbacks=new Map(),images=[],translations=[],frames=[];
 let next=0,now=1500;
 const media={matches:reduced,addEventListener(type,callback){this.listener=callback;},removeEventListener(type,callback){assert.equal(callback,this.listener);this.listener=null;}};
 Object.defineProperties(globalThis,{
  matchMedia:{configurable:true,writable:true,value:()=>media},
  requestAnimationFrame:{configurable:true,writable:true,value:callback=>{callbacks.set(++next,callback);return next;}},
  cancelAnimationFrame:{configurable:true,writable:true,value:id=>callbacks.delete(id)},
  performance:{configurable:true,writable:true,value:{now:()=>now}},
  Image:{configurable:true,writable:true,value:class{constructor(){this.complete=false;this.naturalWidth=0;images.push(this);}}}
 });
 const ctx=new Proxy({translate:(x,y)=>translations.push([x,y])},{get:(target,key)=>target[key]??(()=>{})});
 const canvas={style:{},getContext:()=>ctx,addEventListener:(type,callback)=>handlers.set(type,callback),removeEventListener(type,callback){assert.equal(callback,handlers.get(type));handlers.delete(type);}};
 return {canvas,media,handlers,images,frames,callbacks,setNow:value=>{now=value;},
  onFrame(actors){assert.deepEqual(translations.splice(0),actors.map(actor=>[actor.x,actor.y]),'callback uses the exact actors just drawn');frames.push(actors);},
  pump(time){const [id,callback]=callbacks.entries().next().value;callbacks.delete(id);callback(time);},
  restore(){for(const [key,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
 };
}

test('onFrame receives the actual draw frame on startup, animation, redraw, image load and motion changes',()=>{
 const harness=canvasHarness(),state=fixture({events:[event('frame-1'),event('frame-2',CHARACTER_ATTENTION_KINDS[1]),event('frame-3','troublemaker')],pendingSponsors:[sponsor('sponsor-7-1')]}),before=JSON.stringify(state);
 let world;
 try{
  world=createWorld(harness.canvas,()=>state,()=>{},actors=>harness.onFrame(actors));
  assert.deepEqual(harness.frames.at(-1),getSceneActors(state,0,false));
  harness.pump(1000);
  assert.deepEqual(harness.frames.at(-1),getSceneActors(state,1000,false));
  const count=harness.frames.length;
  harness.pump(1030);
  assert.equal(harness.frames.length,count,'skipped canvas frames also skip DOM updates');
  harness.setNow(2000);world.redraw();
  assert.deepEqual(harness.frames.at(-1),getSceneActors(state,2000,false));
  harness.setNow(3000);harness.images[0].onload();
  assert.deepEqual(harness.frames.at(-1),getSceneActors(state,3000,false),'late image load does not reset walking time');
  harness.media.matches=true;harness.media.listener();
  assert.equal(harness.callbacks.size,0);
  assert.deepEqual(harness.frames.at(-1),getSceneActors(state,0,true));
  state.gameOver=true;world.redraw();
  assert.deepEqual(harness.frames.at(-1).filter(actor=>actor.marker),[]);
  state.gameOver=false;
  assert.equal(JSON.stringify(state),before);
  world.destroy();
  const endedCount=harness.frames.length;
  world.redraw();harness.images[0].onload();
  assert.equal(harness.frames.length,endedCount,'cleanup prevents callbacks from late image loads or stale redraws');
  assert.equal(harness.handlers.size,0);
  assert.equal(harness.media.listener,null);
 }finally{world?.destroy();harness.restore();}
});

test('legacy trouble projections and three-argument createWorld remain usable',()=>{
 const state=fixture({events:[event('legacy-1','troublemaker')]}),harness=canvasHarness(true);
 let world;
 try{
  assert.deepEqual(getTroublemakerActors(state),[{eventId:'legacy-1',x:910,y:748}]);
  world=createWorld(harness.canvas,()=>state,()=>{});
  assert.equal(harness.callbacks.size,0);
  world.redraw();
 }finally{world?.destroy();harness.restore();}
});

test('room links keep building activities separate from the sponsorship mailbox',()=>{
 assert.equal(ROOM_LAYOUT.find(room=>room.id==='benefits').action,'benefits');
 assert.equal(ROOM_LAYOUT.find(room=>room.id==='resources').action,'resources');
});
