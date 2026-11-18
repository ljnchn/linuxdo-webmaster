import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,createChallengeGame,applyAction as act,validateState,summarize,migrateState,SERVERS,EVENTS} from '../src/engine.mjs';
const day=s=>Array.from({length:3}).reduce(v=>act(v,{type:'tick',periods:1}),s);
export function simulate(seed,{active=true,expand=false,days=180,classic=false}={}) {
 let s=classic?createGame('模拟',seed):createChallengeGame('模拟',seed);let peak=0,upgrades=0,orbitDay=null;
 while(s.day<days&&!s.gameOver){
  if(s.pendingSponsors.length)s=act(s,{type:'claim',id:'all'});
  if(active){
   for(const e of [...s.events]){const op=e.options.find(o=>!o.cost);s=act(s,{type:'resolve',eventId:e.id,optionId:op.id});}
   const strategy=classic?'balanced':s.mood<65?'care':s.content<65?'content':'balanced';
   if(s.strategy!==strategy)s=act(s,{type:'strategy',strategy});
  }
  const server=SERVERS.find(v=>v.id===s.serverId),next=SERVERS[SERVERS.indexOf(server)+1];
  if(expand&&next&&s.members>=server.capacity*.9&&s.cash>=(next.buildCost??next.rent*2)+7*summarize(s).maintenanceCost){s=act(s,{type:'rent',serverId:next.id,months:1});upgrades++;if(next.buildCost)orbitDay=s.day;}
  if(s.serverDaysRemaining!==null&&s.serverDaysRemaining<=7&&s.cash>=SERVERS.find(v=>v.id===s.serverId).rent)s=act(s,{type:'renew',months:1});
  s=day(s);peak=Math.max(peak,s.members);
 }
 return {seed,day:s.day,over:s.gameOver,cash:s.cash,members:s.members,mood:s.mood,content:s.content,server:s.serverId,peak,upgrades,orbitDay};
}
test('challenge is opt-in and optional identity fields validate without migrating old saves',()=>{
 const old=createGame();assert.equal(Object.hasOwn(old,'difficulty'),false);assert.deepEqual(migrateState(old),old);
 const s=createChallengeGame('测试',1,'好好说话');assert.equal(s.cash,480);assert.equal(s.members,0);assert.equal(s.difficulty,'challenge');assert.ok(validateState(s));
 for(const slogan of [null,{},41,'x'.repeat(41)]){assert.throws(()=>createChallengeGame('测试',1,slogan));assert.equal(validateState({...s,slogan}),false);assert.throws(()=>act(s,{type:'rename',name:'新站',slogan}));}
 for(const difficulty of [null,'classic','hard',1])assert.equal(validateState({...s,difficulty}),false);
 assert.equal(act(s,{type:'rename',name:'新站'}).slogan,s.slogan);assert.equal(act(s,{type:'rename',name:'新站',slogan:''}).slogan,'');
 assert.throws(()=>act(old,{type:'strategy',strategy:'care'}));
});
test('confirmed active restart changes seed, preserves identity and does not mutate source',()=>{
 const s={...createGame('我的社区',42),slogan:'一起生长'};const before=structuredClone(s);
 for(const confirmed of [undefined,false,'true',1])assert.throws(()=>act(s,{type:'restart',confirmed}));
 const fresh=act(s,{type:'restart',confirmed:true});assert.deepEqual(s,before);assert.equal(fresh.difficulty,'challenge');assert.equal(fresh.slogan,s.slogan);assert.equal(fresh.name,s.name);assert.equal(fresh.revision,1);assert.notEqual(fresh.seed,s.seed);
});
test('daily costs, recoverable shortage, controlled quality and exact 30-day expiry',()=>{
 const s=createChallengeGame();const next=day(s);assert.equal(next.cash,479);assert.equal(next.mood,74);assert.equal(next.content,54);assert.equal(summarize({...s,members:60}).maintenanceCost,13);
 const broke=day({...s,cash:0,registration:'closed'});assert.equal(broke.gameOver,false);assert.equal(broke.cash,0);assert.equal(broke.mood,71);
 const care=day(act(s,{type:'strategy',strategy:'care'}));assert.equal(care.mood,77);assert.equal(care.content,54);
 let end=s;while(!end.gameOver)end=day(end);assert.equal(end.day,30);assert.equal(end.members<=60,true);
 const last=day({...s,serverDaysRemaining:1,serverPeriodsRemaining:3});assert.equal(last.cash,s.cash);assert.equal(last.mood,s.mood);
});
test('unhandled trouble has a two-day grace, free resolution prevents pressure, low quality loses members',()=>{
 const def=EVENTS.find(v=>v.id==='troublemaker');const s={...createChallengeGame(),day:1,nextEventDay:5,members:60,registration:'closed',events:[{id:'event-character-1',kind:def.id,category:def.category,createdDay:1,expiresDay:7,title:def.title,description:def.description,options:structuredClone(def.options)}]};
 assert.ok(validateState(s));const first=day(s),second=day(first);assert.equal(first.mood,74);assert.equal(second.mood,71);
 const fixed=day(act(first,{type:'resolve',eventId:first.events[0].id,optionId:'mediate'}));assert.equal(fixed.mood,78);
 const low=day({...s,mood:10,content:10,events:[]});assert.equal(low.members,57);assert.ok(summarize(low).pressureHints.some(t=>t.includes('流失')));
});
test('multi-seed active free choices outperform neglect without changing classic simulation',()=>{
 for(const seed of [1,17,20261110,4294967295]){
  const active=simulate(seed,{days:120}),neglect=simulate(seed,{days:120,active:false});
  assert.equal(active.over,false,JSON.stringify(active));assert.ok(active.mood>neglect.mood);assert.ok(active.content>neglect.content);assert.deepEqual(active,simulate(seed,{days:120}));
 }
});
test('scaled fees are previewed and full servers can earn patron support within the five-percent cap',()=>{
 for(const [serverId,members,cost] of [['nest',60,13],['block',180,47],['town',500,147],['city',1500,485]])assert.equal(summarize({...createChallengeGame(),serverId,members}).maintenanceCost,cost);
 let s={...createChallengeGame('满员小站',7919),members:60,mood:100,content:100,registration:'closed'};
 for(let i=0;i<25;i++){s=day(s);assert.ok(s.patrons<=Math.floor(s.members*.05));}
 assert.ok(s.patrons>0);assert.equal(s.members,60);
});
test('active play funds every expansion and operates beyond the final land capacity',()=>{
 for(const seed of [1,17,20261110,4294967295]){
  const result=simulate(seed,{expand:true,days:500});
  assert.equal(result.over,false,JSON.stringify(result));assert.equal(result.upgrades,7,JSON.stringify(result));assert.equal(result.server,'space');
  assert.ok(result.orbitDay<=450,JSON.stringify(result));assert.ok(result.members>25000);assert.ok(Math.min(result.mood,result.content)>=35);
 }
});
