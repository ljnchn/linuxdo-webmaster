import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createGame,createChallengeGame,applyAction,activityStatus,BUILDING_ACTIVITIES,RULES,validateState,migrateState,EVENTS} from '../src/engine.mjs';
import {createRunBackups,validSave} from '../src/run-backups.mjs';
import {validateInput,transition,identityKey} from '../server/protocol.mjs';
import {createStore} from '../server/store.mjs';
import {PROJECT_DAYS} from '../src/community-life.mjs';

const ready=(patch={})=>({...createGame('活动测试',12345),members:20,patrons:1,communityLevel:5,...patch});
const run=(s,activityId)=>applyAction(s,{type:'activity',activityId});
const tick=s=>applyAction(s,{type:'tick',periods:1});
const until=(s,day)=>{while(s.day<day&&!s.gameOver)s=tick(s);return s;};
const selected=(s,id)=>activityStatus(s,BUILDING_ACTIVITIES.find(v=>v.id===id).building).activities.find(v=>v.id===id);
const free='benefits-free-list',draw='benefits-badge-draw',software='resources-software';
const input=(revision,action,key='building-activity-operation-0001')=>({revision,action,idempotencyKey:key});
const snapshot=s=>JSON.stringify(s);

const expected=[
 ['benefits-free-list','benefits','整理限免清单',0,0,3,2],
 ['benefits-badge-draw','benefits','社区徽章抽奖',15,2,7,0],
 ['resources-software','resources','软件分享',0,0,0,4],
 ['resources-repository','resources','开源仓库共读',10,0,1,7],
 ['resources-course','resources','视频课程共学',15,0,3,6],
 ['resources-book','resources','书籍共读',0,0,2,3],
];

test('building activity catalog has six canonical fictional choices and shared prototype cooldown',()=>{
 assert.equal(BUILDING_ACTIVITIES.length,6);
 assert.equal(RULES.buildingActivityCooldownDays,7);
 for(const [id,building,name,cost,members,mood,content] of expected){
  const def=BUILDING_ACTIVITIES.find(v=>v.id===id);
  assert.deepEqual({...def,description:undefined},{id,building,name,description:undefined,requiredLevel:{'benefits-free-list':2,'benefits-badge-draw':4,'resources-software':3,'resources-repository':4,'resources-course':5,'resources-book':3}[id],cost,rewards:{members,mood,content},cooldownDays:7});
  assert.match(def.description,/虚构/);
  assert.doesNotMatch(def.description,/https?:\/\//);
  assert.ok(Object.isFrozen(def)&&Object.isFrozen(def.rewards));
 }
 assert.ok(Object.isFrozen(BUILDING_ACTIVITIES));
 assert.throws(()=>{BUILDING_ACTIVITIES[0].rewards.content=999;},TypeError);
 assert.throws(()=>activityStatus(ready(),'workshop'),/有效/);
});

for(const [id,building,,cost,members,mood,content] of expected){
 test(`${id} charges once and either starts a project or grants immediate rewards, without advancing time`,()=>{
  for(const mode of ['classic','challenge']){
   const s=ready(mode==='challenge'?{...createChallengeGame('活动测试',12345,'一起分享'),members:20,patrons:1}:{}),before=snapshot(s);
   const status=selected(s,id),n=run(s,id);
   assert.equal(status.canRun,true);assert.equal(status.blockedReason,null);assert.equal(status.expectedMembers,members);
   const immediate=!PROJECT_DAYS[id];
   assert.equal(n.cash,s.cash-cost);assert.equal(n.members,s.members+(immediate?members:0));assert.equal(n.admissionsToday,s.admissionsToday+(immediate?members:0));
   assert.equal(n.mood,s.mood+(immediate?mood:0));assert.equal(n.content,s.content+(immediate?content:0));assert.equal(n.rngState,s.rngState);
   assert.equal(n.patrons,s.patrons);assert.deepEqual(n.pendingSponsors,s.pendingSponsors);assert.deepEqual(n.events,s.events);
   assert.equal(n.day,s.day);assert.equal(n.timeSlot,s.timeSlot);assert.equal(n.serverDaysRemaining,s.serverDaysRemaining);assert.equal(n.serverPeriodsRemaining,s.serverPeriodsRemaining);
   assert.equal(n.revision,s.revision+1);assert.equal(validateState(n),true);assert.equal(snapshot(s),before);
   assert.deepEqual(n,run(s,id));assert.deepEqual(n.buildingActivities,{[building]:{activityId:id,day:s.day}});
   assert.equal(n.logs.length,s.logs.length+1);assert.match(n.logs.at(-1).text,immediate?/已完成/:/开始筹备/);
   if(immediate)assert.equal(n.life.completed[id],1);else assert.deepEqual(n.life.projects[building],{activityId:id,startedDay:s.day});
   assert.throws(()=>run(n,id),/等待 7 个游戏日/);
  }
 });
}

test('one activity locks every option in its building, but the other building remains independent',()=>{
 const first=run(ready(),free),after=snapshot(first);
 assert.equal(activityStatus(first,'benefits').remainingDays,7);
 for(const id of [free,draw])assert.throws(()=>run(first,id),/等待 7 个游戏日/);
 assert.equal(snapshot(first),after);
 const other=activityStatus(first,'resources');assert.equal(other.remainingDays,0);assert.ok(other.activities.every(v=>v.canRun));
 const next=run(first,software);
 assert.deepEqual(next.buildingActivities,{benefits:{activityId:free,day:0},resources:{activityId:software,day:0}});
 assert.ok(activityStatus(next,'resources').activities.every(v=>!v.canRun));
 assert.equal(activityStatus(next,'benefits').lastUsedDay,0);
});

test('cooldown uses seven rolling game days, not phases, wall time, or unrelated actions',()=>{
 let s=run(ready({registration:'closed'}),free);
 assert.equal(activityStatus(s,'benefits').nextAvailableDay,7);
 assert.equal(activityStatus(s,'benefits').blockedReason,'福利羊毛还需等待 7 个游戏日，第 8 天可再次开展活动。');
 s=tick(tick(s));assert.equal(s.day,0);assert.equal(activityStatus(s,'benefits').remainingDays,7);
 s=until(s,6);s=tick(tick(s));
 assert.equal(s.timeSlot,2);assert.equal(activityStatus(s,'benefits').remainingDays,1);assert.throws(()=>run(s,draw),/等待 1 个游戏日/);
 assert.match(activityStatus(s,'benefits').blockedReason,/第 8 天可再次开展活动/);
 s=applyAction(s,{type:'rename',name:'换名不刷新'});s=applyAction(s,{type:'registration',value:'closed'});
 assert.equal(activityStatus(s,'benefits').remainingDays,1);
 s=tick(s);assert.equal(s.day,7);assert.equal(activityStatus(s,'benefits').remainingDays,0);assert.equal(activityStatus(s,'benefits').canRun,true);
 s=run(s,draw);assert.equal(activityStatus(s,'benefits').nextAvailableDay,14);assert.equal(s.buildingActivities.benefits.activityId,draw);
 assert.match(activityStatus(s,'benefits').blockedReason,/第 15 天可再次开展活动/);
 const copy=snapshot(s);activityStatus(s,'benefits');activityStatus(s,'resources');assert.equal(snapshot(s),copy);
});

test('fees are exact, free alternatives work at zero cash, and capped rewards do not overflow',()=>{
 for(const def of BUILDING_ACTIVITIES){
  const s=ready({cash:def.cost,mood:99,content:99}),n=run(s,def.id);
  assert.equal(n.cash,0);assert.equal(n.mood,PROJECT_DAYS[def.id]?99:Math.min(100,99+def.rewards.mood));assert.equal(n.content,PROJECT_DAYS[def.id]?99:Math.min(100,99+def.rewards.content));
  if(def.cost){
   const poor=ready({cash:def.cost-1}),copy=snapshot(poor),status=selected(poor,def.id);
   assert.equal(status.canRun,false);assert.match(status.blockedReason,/游戏星币不足/);
   assert.throws(()=>run(poor,def.id),/游戏星币不足/);assert.equal(snapshot(poor),copy);assert.equal(Object.hasOwn(poor,'buildingActivities'),false);
  }
 }
 assert.equal(run(ready({cash:0}),free).cash,0);assert.equal(run(ready({cash:0}),software).cash,0);
});

test('zero members and expired runs reject all choices without any state or revision changes',()=>{
 for(const patch of [{members:0,patrons:0},{gameOver:true,serverDaysRemaining:0,serverPeriodsRemaining:0}]){
  const s=ready(patch),before=snapshot(s);
  for(const def of BUILDING_ACTIVITIES){
   assert.equal(selected(s,def.id).canRun,false);
   assert.throws(()=>run(s,def.id),patch.gameOver?/本局结束/:/至少需要 1 位佬友/);
   assert.equal(snapshot(s),before);
  }
 }
 assert.equal(run(ready({members:1,patrons:0}),free).members,1);
});

test('draw preview reports current admission gates but a new project does not grant or reserve members',()=>{
 const cases=[
  [{registration:'open'},2,[],null],
  [{registration:'closed'},0,['registration_closed'],/关闭注册/],
  [{registration:'invite',admissionsToday:0},2,[],null],
  [{registration:'invite',admissionsToday:1},1,['invite_quota'],/邀请名额仅剩 1/],
  [{registration:'invite',admissionsToday:2},0,['invite_quota'],/邀请名额已用完/],
  [{registration:'invite',admissionsToday:25},0,['invite_quota'],/邀请名额已用完/],
  [{members:59},1,['capacity'],/仅剩 1 个空位/],
  [{members:60},0,['capacity'],/容量已满/],
  [{registration:'invite',admissionsToday:1,members:60},0,['invite_quota','capacity'],/容量已满/],
 ];
 for(const [patch,accepted,codes,reason] of cases){
  const s=ready(patch),before=snapshot(s),status=selected(s,draw),n=run(s,draw);
  assert.equal(status.canRun,true);assert.equal(status.expectedMembers,accepted);assert.deepEqual(status.admissionReasons.map(v=>v.code),codes);
  assert.equal(n.members,s.members);assert.equal(n.admissionsToday,s.admissionsToday);assert.equal(n.patrons,s.patrons);
  assert.equal(n.cash,s.cash-15);assert.equal(n.mood,s.mood);assert.equal(n.rngState,s.rngState);assert.equal(snapshot(s),before);
  assert.match(n.logs.at(-1).text,/开始筹备/);
  if(reason)assert.match(status.admissionNote,reason);
  assert.doesNotMatch(n.logs.at(-1).text,/（|）/);
 }
 const n=run(ready({members:19,patrons:0}),draw);assert.equal(n.members,19);assert.equal(n.patrons,0);assert.deepEqual(n.pendingSponsors,[]);
});

test('preparing a draw does not consume the invitation quota needed by immediate events',()=>{
 const def=EVENTS.find(v=>v.id==='welcome');
 const s=ready({day:1,nextEventDay:3,registration:'invite',events:[{id:'event-character-1',kind:def.id,category:def.category,createdDay:1,expiresDay:7,title:def.title,description:def.description,options:structuredClone(def.options)}]});
 const a=run(s,draw),b=applyAction(a,{type:'resolve',eventId:'event-character-1',optionId:'greet'});
 assert.equal(a.members,s.members);assert.equal(b.members,a.members+2);assert.equal(b.mood,a.mood+3);assert.equal(b.admissionsToday,2);
 const firstEvent=applyAction(s,{type:'resolve',eventId:'event-character-1',optionId:'greet'}),lastDraw=run(firstEvent,draw);
 assert.equal(lastDraw.members,firstEvent.members);assert.match(lastDraw.logs.at(-1).text,/开始筹备/);
});

test('missing, null, and empty ledgers remain compatible and are added only on a successful activity',()=>{
 for(const patch of [{},{buildingActivities:null},{buildingActivities:{}}]){
  const s=ready(patch),before=snapshot(s);assert.equal(validateState(s),true);
  for(const building of ['benefits','resources']){const status=activityStatus(s,building);assert.equal(status.lastUsedDay,null);assert.equal(status.nextAvailableDay,null);assert.equal(status.remainingDays,0);}
  assert.deepEqual(migrateState(s),s);assert.equal(snapshot(s),before);
  const renamed=applyAction(s,{type:'rename',name:'仍兼容'});assert.equal(Object.hasOwn(renamed,'buildingActivities'),Object.hasOwn(s,'buildingActivities'));assert.deepEqual(renamed.buildingActivities,s.buildingActivities);
  assert.deepEqual(run(s,free).buildingActivities,{benefits:{activityId:free,day:0}});
  const legacy={...s,version:3,serverPeriodsRemaining:73};delete legacy.serverDaysRemaining;
  const original=snapshot(legacy),migrated=migrateState(legacy);assert.equal(migrated.version,4);assert.equal(migrated.serverDaysRemaining,25);assert.equal(snapshot(legacy),original);
  assert.equal(Object.hasOwn(migrated,'buildingActivities'),Object.hasOwn(s,'buildingActivities'));assert.deepEqual(migrated.buildingActivities,s.buildingActivities);
 }
});

test('ledger validation rejects malformed days, IDs, wrong buildings, and client-supplied effects',()=>{
 const invalid=[[],false,0,'bad',{unknown:{activityId:free,day:0}},{benefits:null},{benefits:[]},{benefits:{}},
  {benefits:{activityId:free,day:-1}},{benefits:{activityId:free,day:1}},{benefits:{activityId:free,day:.5}},{benefits:{activityId:free,day:'0'}},
  {benefits:{activityId:'fake',day:0}},{benefits:{activityId:software,day:0}},{resources:{activityId:draw,day:0}},
  {benefits:{activityId:free,day:0,cost:0}},{benefits:{activityId:free,day:0,rewards:{cash:999}}}];
 for(const ledger of invalid){const s=ready({buildingActivities:ledger});assert.equal(validateState(s),false,JSON.stringify(ledger));assert.throws(()=>run(s,free),/存档格式无效/);assert.throws(()=>migrateState(s));}
 for(const action of [{type:'activity'},{type:'activity',activityId:'fake'},{type:'activity',activityId:null},{type:'activity',activityId:draw,rewards:{members:999}},{type:'activity',activityId:draw,cost:0},{type:'activity',activityId:draw,building:'resources'},{type:'activity',activityId:draw,day:7}]){
  const s=ready(),before=snapshot(s);assert.throws(()=>applyAction(s,action));assert.equal(snapshot(s),before);
 }
});

test('restart clears activity history while local backups and restoration preserve exact old snapshots',()=>{
 const s=run(run(ready(),draw),software),save={state:s,speed:4,started:true,progressMs:12345};
 assert.equal(validSave(save),true);assert.deepEqual(migrateState(s),s);
 const map=new Map(),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)},backups=createRunBackups(storage);
 const captured=backups.capture(save),fresh=applyAction(s,{type:'restart',confirmed:true});
 assert.equal(Object.hasOwn(fresh,'buildingActivities'),false);assert.equal(activityStatus(fresh,'benefits').remainingDays,0);assert.equal(fresh.members,0);
 assert.deepEqual(captured.save,save);assert.deepEqual(backups.list()[0].save,save);
 const restored=backups.replace('active-game',{...save,state:fresh},captured.save);
 assert.deepEqual(restored,save);assert.deepEqual(JSON.parse(storage.getItem('active-game')),save);assert.equal(selected(restored.state,draw).canRun,false);
});

test('backend accepts only canonical activity IDs and no client reward, cost, day or building fields',()=>{
 for(const def of BUILDING_ACTIVITIES){const a={type:'activity',activityId:def.id};assert.equal(validateInput(input(0,a)).action,a);}
 for(const a of [{type:'activity'},{type:'activity',activityId:''},{type:'activity',activityId:4},{type:'activity',activityId:'unknown'},
  {type:'activity',activityId:draw,rewards:{mood:100}},{type:'activity',activityId:draw,cost:0},{type:'activity',activityId:draw,day:7},
  {type:'activity',activityId:draw,building:'resources'},{type:'activity',activityId:draw,confirmed:true},{type:'activity',activityId:draw,slogan:''}]){
  assert.throws(()=>validateInput(input(0,a)),e=>e.code==='INVALID_ACTION'&&e.status===400);
 }
 const state=ready(),row={state:JSON.stringify(state),revision:0,speed:2,active:1,credit_ms:4000,last_seen:1000},before=snapshot(row);
 const next=transition(row,{type:'activity',activityId:draw},2000),newState=JSON.parse(next.state);
 assert.equal(newState.cash,state.cash-15);assert.equal(newState.members,state.members);assert.ok(newState.life.projects.benefits);assert.equal(next.credit_ms,6000);assert.equal(next.speed,2);assert.equal(next.active,1);
 assert.equal(snapshot(row),before);assert.equal(newState.day,0);assert.equal(newState.timeSlot,0);
 const failed={...row,state:JSON.stringify(ready({cash:14}))},failedBefore=snapshot(failed);
 assert.throws(()=>transition(failed,{type:'activity',activityId:draw},2000),e=>e.code==='ACTION_REJECTED');assert.equal(snapshot(failed),failedBefore);
});

test('persistent backend activity is atomic and idempotent; rejection changes nothing and restart backs up ledger',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'building-activities-')),path=join(dir,'state.sqlite'),identity={iss:'https://building-activities.test',sub:'player-1',channel:'sandbox'};
 let store=createStore(path,'sandbox',{now:()=>1000});const db=new DatabaseSync(path);
 try{
  await store.get(identity);const state=ready();db.prepare('UPDATE players SET state=?,members=?,days=? WHERE identity=?').run(snapshot(state),state.members,state.day,identityKey(identity));
  const action=input(0,{type:'activity',activityId:draw}),results=await Promise.all([store.act(identity,action),store.act(identity,action)]);
  assert.deepEqual(results[0],results[1]);assert.equal(results[0].state.cash,state.cash-15);assert.equal(results[0].state.members,state.members);assert.ok(results[0].state.life.projects.benefits);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM audit').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM operations').get().n,1);
  const before=await store.get(identity),rowBefore=db.prepare('SELECT * FROM players').get();
  await assert.rejects(store.act(identity,input(1,{type:'activity',activityId:free},'activity-cooldown-operation-001')),e=>e.code==='ACTION_REJECTED');
  await assert.rejects(store.act(identity,input(1,{type:'activity',activityId:draw,cost:0},'activity-tampering-operation-001')),e=>e.code==='INVALID_ACTION');
  assert.deepEqual(await store.get(identity),before);assert.deepEqual(db.prepare('SELECT * FROM players').get(),rowBefore);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM operations').get().n,1);
  store.close();store=createStore(path,'sandbox',{now:()=>1000});assert.deepEqual(await store.act(identity,action),results[0]);
  const restarted=await store.act(identity,input(1,{type:'restart',confirmed:true},'activity-restart-operation-001'));
  assert.equal(Object.hasOwn(restarted.state,'buildingActivities'),false);assert.deepEqual(restarted.backup.state,before.state);
  assert.deepEqual(JSON.parse(db.prepare('SELECT state FROM last_run_backups').get().state),before.state);
 }finally{db.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
