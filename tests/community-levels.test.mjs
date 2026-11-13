import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {COMMUNITY_LEVELS,BUILDING_ACTIVITIES,communityProgress,activityStatus,createGame,applyAction,validateState,migrateState,EVENTS} from '../src/engine.mjs';
import {createStore} from '../server/store.mjs';
import {identityKey,validateInput} from '../server/protocol.mjs';
import {renderFunction} from './fixtures/render-function.mjs';

const state=members=>({...createGame('建筑开放',987),members,serverId:members>60?'block':'nest'});
const activity=(s,id)=>applyAction(s,{type:'activity',activityId:id});
const app=await readFile(new URL('../src/app.mjs',import.meta.url),'utf8');
const source=name=>app.split('\n').find(line=>line.trimStart().startsWith(`function ${name}(`));
const panel=(s,building)=>{
 const result=[];
 renderFunction('state','activityStatus','open','esc','icon',`${source('buildingActivities')};buildingActivities('${building}');`)(s,activityStatus,(...args)=>result.push(args),String,()=>'');
 return result[0][1];
};

test('community levels and every activity enforce exact member thresholds with no mutation on rejection',()=>{
 assert.deepEqual(COMMUNITY_LEVELS.map(v=>v.members),[0,10,30,60,120,250,500,1000,1500]);
 for(const definition of BUILDING_ACTIVITIES){
  const threshold=COMMUNITY_LEVELS[definition.requiredLevel-1].members;
  for(const members of [threshold-1,threshold]){
   const s=state(members),before=structuredClone(s);
   const status=activityStatus(s,definition.building).activities.find(v=>v.id===definition.id);
   assert.equal(status.unlocked,members===threshold,definition.id);
   assert.equal(status.canRun,members===threshold,definition.id);
   if(members<threshold)assert.throws(()=>activity(s,definition.id),/社区 Lv\./);
   else assert.equal(activity(s,definition.id).communityLevel,definition.requiredLevel);
   assert.deepEqual(s,before);
  }
 }
 assert.equal(activityStatus(state(9),'benefits').unlocked,false);
 assert.equal(activityStatus(state(10),'benefits').unlocked,true);
 assert.equal(activityStatus(state(29),'resources').unlocked,false);
 assert.equal(activityStatus(state(30),'resources').unlocked,true);
});

test('levels persist through member loss and history rollover; restart resets them and migration preserves saves',()=>{
 const definition=EVENTS.find(v=>v.id==='troublemaker');
 const before={...state(60),day:1,nextEventDay:2,events:[{id:'event-character-1',kind:definition.id,category:definition.category,createdDay:1,expiresDay:7,title:definition.title,description:definition.description,options:structuredClone(definition.options)}]};
 const after=applyAction(before,{type:'resolve',eventId:'event-character-1',optionId:'remove'});
 assert.equal(after.members,59);assert.equal(after.communityLevel,4);
 assert.equal(activityStatus(after,'benefits').activities.find(v=>v.id==='benefits-badge-draw').canRun,true);
 const historical={...state(2),day:2,nextEventDay:3,history:[{day:1,members:120,cash:500}]};
 assert.equal(communityProgress(historical).level,5);
 const saved=applyAction(historical,{type:'rename',name:'旧站'});
 assert.equal(communityProgress({...saved,history:[]}).level,5);
 assert.deepEqual(migrateState(historical),historical);
 assert.deepEqual(migrateState(saved),saved);
 const fresh=applyAction(saved,{type:'restart',confirmed:true});
 assert.equal(communityProgress(fresh).level,1);
 assert.equal(activityStatus(fresh,'benefits').unlocked,false);
 for(const value of [0,10,1.5,'5',null])assert.equal(validateState({...state(1),communityLevel:value}),false);
});

test('locked buildings show requirements rather than action buttons; later activity tiers remain disabled',()=>{
 for(const building of ['benefits','resources']){
  const html=panel(state(0),building);
  assert.match(html,/街区正在等更多同路人/);assert.match(html,/还差 (10|30) 位/);
  assert.doesNotMatch(html,/data-activity=/);
 }
 const benefits=panel(state(10),'benefits');
 assert.match(benefits,/data-activity="benefits-free-list"\s+aria-label/);
 assert.match(benefits,/data-activity="benefits-badge-draw" disabled/);
 const resources=panel(state(30),'resources');
 for(const id of ['resources-software','resources-book'])assert.match(resources,new RegExp(`data-activity="${id}"\\s+aria-label`));
 for(const id of ['resources-repository','resources-course'])assert.match(resources,new RegExp(`data-activity="${id}" disabled`));
 assert.match(resources,/Lv\.5 解锁/);
});

test('scene signs and level label refresh without replacing focusable building nodes or changing state',()=>{
 const nodes=new Map();
 const node=()=>({textContent:'',title:'',dataset:{},attributes:{},hidden:true,classes:new Set(),setAttribute(k,v){this.attributes[k]=v;},querySelector(){return this.badge;}});
 for(const selector of ['#community-level','.building-benefits','.building-resources']){
  const item=node();item.badge=node();item.classList={toggle:(key,value)=>value?item.classes.add(key):item.classes.delete(key)};nodes.set(selector,item);
 }
 const render=renderFunction('state','communityProgress','activityStatus','$',`${source('renderBuildingAccess')};renderBuildingAccess();`);
 for(const members of [0,10,30,120]){
  const s=state(members),before=structuredClone(s);
  render(s,communityProgress,activityStatus,selector=>nodes.get(selector));
  assert.equal(nodes.get('#community-level').textContent,`Lv.${communityProgress(s).level}`);
  for(const building of ['benefits','resources']){
   const status=activityStatus(s,building),button=nodes.get('.building-'+building);
   assert.equal(button.classes.has('is-locked'),!status.unlocked);
   assert.equal(button.badge.textContent,status.unlocked?'已开放':`Lv.${status.requiredLevel} 开放`);
   assert.match(button.attributes['aria-label'],status.unlocked?/已开放/:/查看开放条件/);
  }
  assert.deepEqual(s,before);
 }
});

test('SQLite rejects bypassed level gates atomically, retains level on reopen and resets on restart',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'building-levels-')),path=join(directory,'state.sqlite');
 const identity={channel:'shared',iss:'https://levels.test',sub:'1'};
 let store=createStore(path,'shared');
 const db=new DatabaseSync(path);
 const op=(revision,activityId,idempotencyKey)=>({revision,idempotencyKey,action:{type:'activity',activityId}});
 try{
  const first=await store.get(identity),before=db.prepare('SELECT * FROM players').get();
  await assert.rejects(store.act(identity,op(0,'benefits-free-list','locked-building-operation')),error=>error.code==='ACTION_REJECTED');
  assert.deepEqual(db.prepare('SELECT * FROM players').get(),before);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM operations').get().n,0);
  db.prepare('UPDATE players SET state=?,members=? WHERE identity=?').run(JSON.stringify({...first.state,members:10}),10,identityKey(identity));
  await assert.rejects(store.act(identity,op(0,'benefits-badge-draw','locked-activity-operation')),error=>error.code==='ACTION_REJECTED');
  const request=op(0,'benefits-free-list','unlocked-building-operation');
  const accepted=await store.act(identity,request);
  assert.equal(accepted.state.communityLevel,2);
  store.close();store=createStore(path,'shared');
  assert.deepEqual(await store.act(identity,request),accepted);
  assert.equal(communityProgress((await store.get(identity)).state).level,2);
  const restarted=await store.act(identity,{revision:1,idempotencyKey:'levels-restart-operation',action:{type:'restart',confirmed:true}});
  assert.equal(communityProgress(restarted.state).level,1);
  assert.equal(restarted.backup.state.communityLevel,2);
  assert.throws(()=>validateInput({...request,action:{...request.action,communityLevel:5}}));
 }finally{db.close();store.close();await rm(directory,{recursive:true,force:true});}
});
