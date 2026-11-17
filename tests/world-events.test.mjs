import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createGame, applyAction, validateState, migrateState, EVENTS, RULES, REGISTRATIONS, STRATEGIES } from '../src/engine.mjs';
import { createSharedStore } from '../server/shared-store.mjs';
import { identityKey } from '../server/protocol.mjs';

const worlds=EVENTS.filter(e=>e.category==='world');
const period=s=>applyAction(s,{type:'tick',periods:1});
const until=(s,day)=>{while(s.day<day&&!s.gameOver)s=period(s);return s;};
const snapshot=(def,day=12)=>({id:`event-${def.category}-${day}`,kind:def.id,category:def.category,createdDay:day,expiresDay:day+6,title:def.title,description:def.description,options:structuredClone(def.options)});
const eventState=(def,patch={})=>({...createGame('成员的新朋友小站',123),day:12,nextEventDay:14,nextWorldEventDay:24,cash:1000,members:20,mood:50,content:50,events:[snapshot(def)],...patch});
const resolve=(state,op)=>applyAction(state,{type:'resolve',eventId:state.events[0].id,optionId:op.id});

import { oldEvents } from './fixtures/legacy-events.mjs';

const expectedWorldEffects={
 model:[[30,8,2,15,0],[0,2,0,8,0]],
 mirror:[[40,4,4,10,0],[0,0,-2,6,0]],
 archive:[[35,0,3,18,0],[0,0,-3,10,0]],
 festival:[[25,5,12,-3,0],[0,0,5,6,0]],
 security:[[45,0,8,12,0],[0,0,-2,7,0]],
 heatwave:[[35,0,10,2,0],[0,0,6,-5,0]],
 comet:[[30,6,9,0,0],[0,0,3,8,0]],
 translation:[[30,3,-2,16,0],[0,0,3,7,0]],
 retro:[[25,4,7,8,0],[0,0,3,7,0]],
 bazaar:[[20,6,6,3,0],[0,0,-4,-2,35]],
};

test('ten immutable world stories each offer a paid and free choice with accurate copy',()=>{
 assert.deepEqual(worlds.map(e=>e.id),Object.keys(expectedWorldEffects));
 assert.equal(new Set(EVENTS.map(e=>e.id)).size,EVENTS.length);
 for(const def of worlds){
  assert.doesNotMatch(def.description,/虚构|模拟/);assert.ok(Object.isFrozen(def));assert.equal(def.options.length,2);
  assert.ok(def.options[0].cost>0);assert.equal(def.options[1].cost,0);
  assert.notEqual(def.options[0].id,def.options[1].id);
  for(const [index,choice] of def.options.entries()){
   const {members,mood,content,cash,patrons}=choice.rewards;
   assert.deepEqual([choice.cost,members,mood,content,cash],expectedWorldEffects[def.id][index],`${def.id}/${choice.id}`);
   assert.equal(patrons,0);assert.ok(Object.isFrozen(choice));assert.ok(Object.isFrozen(choice.rewards));
   if(choice.cost)assert.ok(choice.description.includes(`花 ${choice.cost} 刀`));
   if(members)assert.ok(choice.description.includes(`尝试吸引 ${members} 位佬友`));
   for(const [label,value] of [['氛围',mood],['内容',content]])if(value)assert.ok(choice.description.includes(`${label} ${value>0?'+':''}${value}`));
   if(cash)assert.ok(choice.description.includes(`获得 ${cash} 刀`));
  }
 }
 const visible=JSON.stringify([RULES.explanation,REGISTRATIONS,STRATEGIES,EVENTS]);
 assert.doesNotMatch(visible,/成员|新朋友|新人/);assert.match(visible,/富可敌国/);
 assert.equal(RULES.version,4);assert.equal(RULES.worldCycleDays,12);assert.equal(RULES.periodsPerDay*RULES.secondsPerPeriod,60);assert.deepEqual(RULES.speeds,[1,2,4]);
});

for(const def of worlds){
 test(`${def.id}: both choices apply exact effects, cannot pay twice, and preserve the source`,()=>{
  for(const choice of def.options){
   const state=eventState(def),copy=structuredClone(state),next=resolve(state,choice),r=choice.rewards;
   assert.equal(next.cash,state.cash-choice.cost+r.cash);
   assert.equal(next.members,state.members+r.members);assert.equal(next.admissionsToday,r.members);
   assert.equal(next.mood,state.mood+r.mood);assert.equal(next.content,state.content+r.content);assert.equal(next.patrons,0);
   assert.equal(next.events.length,0);assert.equal(validateState(next),true);assert.equal(next.rngState,state.rngState);
   assert.equal(next.revision,state.revision+1);assert.deepEqual(state,copy);
   assert.throws(()=>applyAction(next,{type:'resolve',eventId:state.events[0].id,optionId:choice.id}),/不存在/);
   if(r.members)assert.match(next.logs.at(-1).text,new RegExp(`实际入站 ${r.members} 位佬友`));
   if(choice.cost){const poor=eventState(def,{cash:choice.cost-1}),unchanged=structuredClone(poor);assert.throws(()=>resolve(poor,choice),/余额不足/);assert.deepEqual(poor,unchanged);}
   else assert.equal(resolve(eventState(def,{cash:0}),choice).cash,r.cash);
  }
 });
 test(`${def.id}: all admissions obey closed, invite, used quota and remaining capacity`,()=>{
  for(const choice of def.options){
   const r=choice.rewards;
   for(const [patch,accepted] of [
    [{registration:'closed'},0],
    [{registration:'invite'},Math.min(2,r.members)],
    [{registration:'invite',admissionsToday:1},Math.min(1,r.members)],
    [{registration:'invite',admissionsToday:2},0],
    [{members:59},Math.min(1,r.members)],
    [{members:60,patrons:3},0],
   ]){
    const state=eventState(def,patch),next=resolve(state,choice);
    assert.equal(next.members,state.members+accepted);assert.equal(next.admissionsToday,state.admissionsToday+accepted);
    assert.equal(next.cash,state.cash-choice.cost+r.cash);assert.equal(next.mood,state.mood+r.mood);assert.equal(next.content,state.content+r.content);
    assert.equal(next.patrons,state.patrons);assert.equal(validateState(next),true);
   }
  }
 });
}

test('world rotation runs every twelve days without repeats until the full ten-story cycle',()=>{
 let state={...createGame('轮换测试',123),serverDaysRemaining:240,serverPeriodsRemaining:720};
 const found=[];
 for(let day=1;day<=132;day++){
  state=until(state,day);
  const fresh=state.events.filter(e=>e.category==='world'&&e.createdDay===day);
  assert.equal(fresh.length,day%12===0?1:0);
  if(fresh.length){found.push(fresh[0].kind);assert.equal(fresh[0].expiresDay,day+6);}
  assert.equal(state.nextWorldEventDay,(Math.floor(day/12)+1)*12);
  assert.equal(validateState(state),true);
 }
 assert.deepEqual(found,[...worlds.map(e=>e.id),'model']);
 for(const def of worlds){const state=eventState(def),id=state.events[0].id,next=until(state,18);assert.ok(!next.events.some(e=>e.id===id));assert.throws(()=>applyAction(next,{type:'resolve',eventId:id,optionId:def.options[0].id}),/不存在/);}
});

test('world selection consumes no RNG and preserves pre-change growth and character-event traces',()=>{
 // Golden traces from the unmodified engine, with no events resolved, seed 123.
 // Each tuple is [day, RNG state, population, patrons, next character-event day].
 const golden={
  open:[[12,2350059672,60,3,16],[24,2956214921,60,3,26],[36,882271169,60,3,38],[48,279541256,60,3,51],[60,2374803468,60,3,61],[72,21149728,60,3,73],[84,3039031702,60,3,86],[96,396930356,60,3,99],[108,482383526,60,3,109],[120,83949819,60,3,122],[132,1410892956,60,3,135]],
  invite:[[12,2187555361,24,1,13],[24,2956214921,48,2,26],[36,3844721014,60,2,37],[48,4083502780,60,2,50],[60,124629364,60,2,62],[72,2136158373,60,2,75],[84,2839271390,60,2,85],[96,1137420883,60,2,98],[108,58835442,60,2,110],[120,1508715380,60,2,121],[132,3589275129,60,2,134]],
  closed:[[12,4247338851,0,0,13],[24,156346776,0,0,26],[36,3844721014,0,0,41],[48,4083502780,0,0,49],[60,124629364,0,0,62],[72,2136158373,0,0,75],[84,2839271390,0,0,85],[96,1137420883,0,0,98],[108,58835442,0,0,110],[120,1508715380,0,0,121],[132,3589275129,0,0,134]],
 };
 for(const [registration,expected] of Object.entries(golden)){
  let state={...createGame('RNG 测试',123),registration,serverDaysRemaining:240,serverPeriodsRemaining:720};
  const trace=[];
  for(const [day] of expected){state=until(state,day);trace.push([state.day,state.rngState,state.members,state.patrons,state.nextEventDay]);}
  assert.deepEqual(trace,expected,registration);
 }
});

test('all world gains and losses clamp to the existing 0–100 mood/content boundaries',()=>{
 for(const def of worlds)for(const choice of def.options)for(const amount of [0,99,100]){
  const state=eventState(def,{mood:amount,content:amount}),next=resolve(state,choice);
  for(const field of ['mood','content'])assert.equal(next[field],Math.min(100,Math.max(0,amount+choice.rewards[field])));
  assert.equal(validateState(next),true);
 }
});

test('all five old v4/v3 event snapshots migrate display only and preserve economics and chosen names',()=>{
 for(const old of oldEvents)for(const version of [4,3]){
  const state=eventState(old,{version,logs:[{id:'old-log',day:1,text:'新成员加入了小站。',kind:'event'}],pendingSponsors:[{id:'sponsor-7-1',createdDay:7,expiresDay:21,amount:100,patron:1}]});
  if(version===3){delete state.serverDaysRemaining;state.serverPeriodsRemaining=71;state.timeSlot=2;}
  const copy=structuredClone(state),next=migrateState(state),canonical=EVENTS.find(e=>e.id===old.id);
  assert.deepEqual(state,copy);assert.equal(validateState(next),true);assert.deepEqual(migrateState(next),next);
  assert.deepEqual(next.events,[snapshot(canonical)]);
  for(const key of Object.keys(state).filter(k=>!['version','serverPeriodsRemaining','migrationNotice','events'].includes(k)))assert.deepEqual(next[key],state[key],`${version}/${old.id}/${key}`);
  assert.equal(next.serverDaysRemaining,version===3?24:30);assert.equal(next.serverPeriodsRemaining,version===3?72:90);
  for(const choice of old.options){const currentChoice=canonical.options.find(o=>o.id===choice.id);assert.equal(choice.cost,currentChoice.cost);assert.deepEqual(choice.rewards,currentChoice.rewards);}
  if(version===4){
   assert.equal(validateState(state),true);
   // Trusted service operations hit applyAction directly without migrating v4.
   for(const choice of old.options)assert.deepEqual(resolve(state,choice),resolve(next,choice));
   const updated=applyAction(state,{type:'strategy',strategy:'content'});assert.deepEqual(updated.events,next.events);
  }
 }
});

test('legacy compatibility never accepts edited rewards, costs, presentation, IDs or mixed snapshots',()=>{
 const mutations=[
  e=>e.options[0].rewards.cash++,e=>e.options[0].rewards.members++,e=>e.options[0].rewards.patrons++,e=>e.options[0].rewards.mood++,e=>e.options[0].rewards.content++,
  e=>e.options[0].cost++,e=>e.options[0].label+='改',e=>e.options[0].description+='改',e=>e.options.reverse(),
  e=>e.title+='改',e=>e.description+='改',e=>e.category='fake',e=>e.id+='-forged',e=>e.expiresDay++,e=>e.kind='fake',
 ];
 for(const def of [...oldEvents,...EVENTS])for(const version of [4,3])for(const mutate of mutations){
  const state=eventState(def,{version});if(version===3)delete state.serverDaysRemaining;
  mutate(state.events[0]);assert.equal(validateState(state),false,`${version}/${def.id}`);assert.throws(()=>migrateState(state),/存档格式无效/);
  if(version===4)assert.throws(()=>resolve(state,def.options[0]),/存档格式无效/);
 }
 const mixed=eventState(oldEvents[0]);mixed.events[0].title=EVENTS[0].title;assert.equal(validateState(mixed),false);assert.throws(()=>migrateState(mixed),/存档格式无效/);
});

function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0000_trusted_runs.sql',import.meta.url),'utf8'));sqlite.exec(readFileSync(new URL('../drizzle/0002_player_achievements.sql',import.meta.url),'utf8'));
 return {sqlite,prepare(sql){return {bind(...args){return {first:()=>sqlite.prepare(sql).get(...args)||null,all:()=>({results:sqlite.prepare(sql).all(...args)}),run:()=>({meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}})};}};},async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}

test('the SQLite store reads and operates old v4/v3 saves without losing runs or rewards',async()=>{
 const db=database(),store=createSharedStore(db,'sandbox',{now:()=>1000});
 try{
  for(const old of oldEvents)for(const version of [4,3]){
   const identity={channel:'sandbox',iss:'https://legacy.test',sub:`${version}-${old.id}`},key=identityKey(identity);
   await store.get(identity);
   const state=eventState(old,{version,revision:11});if(version===3){delete state.serverDaysRemaining;state.serverPeriodsRemaining=71;}
   db.sqlite.prepare('UPDATE players SET state=?,revision=?,name=?,members=?,days=? WHERE identity=?').run(JSON.stringify(state),state.revision,state.name,state.members,state.day,key);
   const runId=db.sqlite.prepare('SELECT run_id FROM players WHERE identity=?').get(key).run_id;
   const loaded=await store.get(identity),migrated=migrateState(loaded.state);
   assert.equal(loaded.revision,11);assert.equal(loaded.state.version,4);assert.equal(validateState(loaded.state),true);
   assert.equal(migrated.name,state.name);assert.equal(migrated.cash,state.cash);assert.equal(migrated.members,state.members);
   const choice=old.options[0],input={revision:11,idempotencyKey:`legacy-event-${version}-${old.id}`,action:{type:'resolve',eventId:state.events[0].id,optionId:choice.id}};
   const resolved=await store.act(identity,input);
   assert.deepEqual(resolved.state,resolve(migrated,choice));assert.deepEqual(await store.act(identity,input),resolved);
   assert.equal(db.sqlite.prepare('SELECT run_id FROM players WHERE identity=?').get(key).run_id,runId);
   assert.equal((await store.get(identity)).revision,12);
  }
 }finally{db.sqlite.close();}
});
