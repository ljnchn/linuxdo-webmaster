import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame,applyAction as act,summarize,validateState,migrateState,EVENTS,RULES,SERVERS } from '../src/engine.mjs';
const period=s=>act(s,{type:'tick',periods:1});
const day=s=>period(period(period(s)));
const until=(s,n)=>{while(s.day<n&&!s.gameOver)s=period(s);return s;};
function eventState(kind,patch={}) { const def=EVENTS.find(e=>e.id===kind);return {...createGame(),day:1,nextEventDay:3,...patch,events:[{id:`event-${def.category}-1`,kind,category:def.category,createdDay:1,expiresDay:7,title:def.title,description:def.description,options:structuredClone(def.options)}]}; }
const resolve=(s,id)=>act(s,{type:'resolve',eventId:s.events[0].id,optionId:id});
test('zero-member opening prepays monthly 1C1G and offline is inert',async()=>{
 const s=createGame(),copy=structuredClone(s);await new Promise(r=>setTimeout(r,5));assert.deepEqual(s,copy);
 assert.equal(validateState(s),true);assert.equal(s.members,0);assert.equal(s.patrons,0);assert.equal(s.serverId,'nest');assert.equal(s.cash,760);assert.equal(s.serverPeriodsRemaining,90);assert.equal(summarize(s).serverDaysRemaining,30);
 assert.equal(RULES.prototype,true);assert.equal(SERVERS[0].spec,'1C1G');assert.deepEqual(RULES.speeds,[1,2,4]);
});
test('only a completed day consumes prepaid time, no per-tick cash charge; manual advance removed',()=>{
 let s=period(createGame());assert.equal(s.cash,760);assert.equal(s.day,0);assert.equal(s.timeSlot,1);assert.equal(s.members,0);assert.equal(s.serverPeriodsRemaining,90);assert.equal(s.serverDaysRemaining,30);
 s=period(period(s));assert.equal(s.day,1);assert.ok(s.members>0);assert.equal(s.cash,760);
 for(const a of [{type:'advance',periods:1},{type:'tick',periods:2},{type:'tick',periods:1,days:1},{type:'tick'}])assert.throws(()=>act(s,a));
});
test('monthly renewal charges once and preserves input; invalid packages rejected',()=>{
 const s=period(createGame()),copy=structuredClone(s);const n=act(s,{type:'renew',months:2});assert.equal(n.cash,280);assert.equal(n.serverPeriodsRemaining,270);assert.equal(n.serverDaysRemaining,90);assert.deepEqual(s,copy);
 assert.throws(()=>act({...s,cash:239},{type:'renew',months:1}),/余额不足/);
 for(const months of [0,4,'1',null,undefined])assert.throws(()=>act(s,{type:'renew',months}));
 assert.throws(()=>act(s,{type:'renew',days:7}));
});
test('server changes conserve cash plus unused prepaid value with downward rounding',()=>{
 let s=period(createGame());s=act(s,{type:'rent',serverId:'block',months:1});assert.equal(s.cash,460);assert.equal(s.serverPeriodsRemaining,90);
 s=act(s,{type:'rent',serverId:'nest',months:1});assert.equal(s.cash,760);
 assert.throws(()=>act({...s,members:61,serverId:'block'},{type:'rent',serverId:'nest',months:1}),/容量/);
 assert.throws(()=>act(s,{type:'rent',serverId:'nest',months:1}));assert.throws(()=>act(s,{type:'rent',serverId:'city',months:3}),/余额/);
});
test('lease expiry wins at sponsor/day/event boundary, cannot revive or pay rewards',()=>{
 let s=until(createGame(),6);s={...s,serverDaysRemaining:1,serverPeriodsRemaining:3,members:40,patrons:2,nextEventDay:7};s=period(period(s));const before=structuredClone(s);s=period(s);
 assert.equal(s.gameOver,true);assert.equal(s.day,7);assert.equal(s.timeSlot,0);assert.equal(s.cash,before.cash);assert.equal(s.members,before.members);assert.equal(s.pendingSponsors.length,0);assert.equal(validateState(s),true);
 for(const action of [{type:'tick',periods:1},{type:'renew',months:1},{type:'claim',id:'all'},{type:'rent',serverId:'block',months:1},{type:'registration',value:'open'},{type:'rename',name:'x'},{type:'resolve',eventId:'x',optionId:'x'}])assert.throws(()=>act(s,action),/本局结束/);
 const fresh=act(s,{type:'restart'});assert.equal(fresh.members,0);assert.equal(fresh.cash,760);assert.equal(fresh.revision,s.revision+1);assert.notEqual(fresh.seed,s.seed);assert.deepEqual(act(s,{type:'restart'}),fresh);assert.throws(()=>act(fresh,{type:'restart'}));
});
test('last day lasts three phases and full natural opening ends day30',()=>{
 let s=period({...createGame(),serverDaysRemaining:1,serverPeriodsRemaining:3});assert.equal(s.gameOver,false);assert.equal(s.serverDaysRemaining,1);s=period(s);assert.equal(s.serverDaysRemaining,1);s=period(s);assert.equal(s.gameOver,true);assert.equal(s.day,1);assert.equal(s.serverDaysRemaining,0);
 s=until(createGame(),30);assert.equal(s.gameOver,true);assert.equal(s.day,30);assert.equal(validateState(s),true);
});
test('closed registration blocks daily and every event admission, including queued events',()=>{
 let s=act(createGame(),{type:'registration',value:'closed'});s=until(s,12);assert.equal(s.members,0);assert.equal(s.patrons,0);assert.ok(s.events.some(e=>e.category==='world'));
 for(const [kind,choice]of [['welcome','host'],['patron','welcome'],['model','workshop']]){const state=eventState(kind,{registration:'closed',members:39,patrons:0});const n=resolve(state,choice);assert.equal(n.members,39);assert.equal(n.patrons,0);}
 const queued=act(eventState('welcome'),{type:'registration',value:'closed'});assert.equal(resolve(queued,'greet').members,0);
});
test('invite registration bootstraps zero members and shares daily quota across events',()=>{
 let s=act(createGame(),{type:'registration',value:'invite'});s=day(s);assert.equal(s.members,2);assert.equal(s.admissionsToday,2);s=resolve(s,'greet');assert.equal(s.members,2);
 s=day(s);assert.equal(s.members,4);assert.equal(summarize(s).inviteRemaining,0);
 s=eventState('welcome',{registration:'invite',admissionsToday:1});s=resolve(s,'host');assert.equal(s.members,1);assert.equal(s.admissionsToday,2);
 s=act(s,{type:'registration',value:'closed'});s=act(s,{type:'registration',value:'invite'});assert.equal(summarize(s).inviteRemaining,0);
});
test('every inbound path respects capacity and patron cap is strictly floor(5%)',()=>{
 for(const [kind,choice]of [['welcome','host'],['patron','welcome'],['model','workshop']]){const s=resolve(eventState(kind,{members:60,patrons:3}),choice);assert.equal(s.members,60);assert.equal(s.patrons,3);}
 let s=resolve(eventState('patron',{members:18}),'welcome');assert.equal(s.members,18);assert.equal(s.patrons,0);
 s=resolve(eventState('patron',{members:19}),'welcome');assert.equal(s.members,20);assert.equal(s.patrons,1);
 s=resolve(eventState('patron',{members:20,patrons:1}),'welcome');assert.equal(s.members,20);assert.equal(s.patrons,1);
 s=resolve(eventState('troublemaker',{members:20,patrons:1}),'remove');assert.equal(s.members,19);assert.equal(s.patrons,0);
});
test('sponsors fixed cycles, manual claim, strict expiry and no duplicate money',()=>{
 let s=until({...createGame(),members:40,patrons:2,registration:'closed'},7);assert.equal(s.pendingSponsors.length,2);assert.equal(s.cash,760);
 const id=s.pendingSponsors[0].id;const n=act(s,{type:'claim',id});assert.equal(n.cash,860);assert.equal(n.pendingSponsors.length,1);assert.throws(()=>act(n,{type:'claim',id}));
 const all=act(n,{type:'claim',id:'all'});assert.equal(all.cash,960);assert.throws(()=>act(all,{type:'claim',id:'all'}));
 s=until(s,20);assert.ok(s.pendingSponsors.some(v=>v.createdDay===7));s=day(s);assert.ok(!s.pendingSponsors.some(v=>v.createdDay===7));assert.ok(s.pendingSponsors.some(v=>v.createdDay===21));assert.throws(()=>act(s,{type:'claim',id}));assert.equal(s.cash,760);
});
test('event resolution uses canonical effects, expires exactly, pays only once',()=>{
 let s=eventState('article');const copy=structuredClone(s);const n=resolve(s,'feature');assert.equal(n.cash,s.cash+15);assert.deepEqual(s,copy);assert.throws(()=>act(n,{type:'resolve',eventId:s.events[0].id,optionId:'feature'}));
 s.events[0].options[0].rewards.cash=999;assert.equal(validateState(s),false);assert.throws(()=>resolve(s,'support'));
 s=eventState('welcome');const id=s.events[0].id;s=until(s,7);assert.ok(!s.events.some(e=>e.id===id));assert.throws(()=>act(s,{type:'resolve',eventId:id,optionId:'greet'}));
});
test('world release has separate category and fixed fictional cycle',()=>{
 let s=until(createGame(),12);const world=s.events.find(e=>e.kind==='model');assert.ok(world);assert.equal(world.category,'world');assert.equal(world.createdDay,12);assert.equal(s.nextWorldEventDay,24);
 assert.match(world.description,/虚构/);s=act(s,{type:'resolve',eventId:world.id,optionId:'digest'});assert.equal(validateState(s),true);
});
test('deterministic simulation survives long play with consistent caps and bounded queues',()=>{
 function run(){let s=createGame('测试',123);for(let i=0;i<180;i++){
  if(s.pendingSponsors.length)s=act(s,{type:'claim',id:'all'});
  if(s.serverPeriodsRemaining<=3)s=act(s,{type:'renew',months:1});
  const previous=s,copy=structuredClone(s);s=day(s);assert.deepEqual(previous,copy);assert.equal(validateState(s),true);assert.ok(s.patrons<=Math.floor(s.members*.05));assert.ok(s.members<=60);
  for(const e of s.events)s=act(s,{type:'resolve',eventId:e.id,optionId:e.options[1].id});
 }assert.equal(s.history.length,40);assert.ok(s.logs.length<=30);assert.equal(s.gameOver,false);return s;}
 assert.deepEqual(run(),run());
});
test('legacy migration is a clear fresh run, leaves source untouched, rejects invalid data',()=>{
 for(const version of [1,2]){const legacy={...createGame(),version,members:20,patrons:1,cash:1234};const copy=structuredClone(legacy);const s=migrateState(legacy);assert.equal(validateState(s),true);assert.equal(s.version,4);assert.equal(s.members,0);assert.equal(s.cash,760);assert.match(s.migrationNotice,/旧版/);assert.deepEqual(legacy,copy);assert.deepEqual(migrateState(s),s);assert.throws(()=>migrateState({...legacy,cash:-1}));}
 assert.throws(()=>migrateState({version:2}));
});
test('strict save boundaries reject malformed balances, clocks, IDs, queues and ratios',()=>{
 for(const patch of [{serverPeriodsRemaining:-1},{serverPeriodsRemaining:1.5},{timeSlot:3},{gameOver:true},{nextEventDay:0},{nextEventDay:6},{nextWorldEventDay:11},{cash:Infinity},{patrons:1},{members:61},{rngState:0},{logs:[{}]},{events:[null]},{registration:'bad'},{admissionsToday:-1},{migrationNotice:{}}])assert.equal(validateState({...createGame(),...patch}),false,JSON.stringify(patch));
 assert.equal(validateState(null),false);assert.equal(validateState({...createGame(),version:2}),false);
 const s=until({...createGame(),members:40,patrons:2},7);s.pendingSponsors.push({...s.pendingSponsors[0]});assert.equal(validateState(s),false);
});

test('v3 migration preserves active progress and rounds partial lease up once; ended stays ended',()=>{
 const current=until(createGame(),6);
 for(const periods of [0,1,2,3,71,90]){
  const {serverDaysRemaining,...legacy}=current;legacy.version=3;legacy.timeSlot=2;legacy.serverPeriodsRemaining=periods;legacy.gameOver=periods===0;
  const original=structuredClone(legacy),migrated=migrateState(legacy);
  assert.equal(migrated.serverDaysRemaining,Math.ceil(periods/3));assert.equal(migrated.version,4);assert.equal(validateState(migrated),true);
  assert.deepEqual(legacy,original);assert.deepEqual(migrateState(migrated),migrated);
  for(const key of Object.keys(legacy).filter(k=>!['version','serverPeriodsRemaining','migrationNotice'].includes(k)))assert.deepEqual(migrated[key],legacy[key],key);
 }
});
test('daily credit keeps monthly denominator and renewal adds thirty whole days',()=>{
 let s=day(createGame());assert.equal(s.serverDaysRemaining,29);
 const rented=act(s,{type:'rent',serverId:'block',months:1});assert.equal(rented.cash,760+Math.floor(240*29/30)-540);assert.equal(rented.serverDaysRemaining,30);
 const renewed=act(s,{type:'renew',months:1});assert.equal(renewed.serverDaysRemaining,59);
});
