import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createChallengeGame,applyAction,validateState,migrateState,serverQuote,SERVERS,EVENTS,eventChoice} from '../src/engine.mjs';
import {createStore} from '../server/store.mjs';

const eligible=()=>({...createChallengeGame(),members:20000,serverId:'global',cash:86000});
const launch={type:'rent',serverId:'space',months:1};
const tick={type:'tick',periods:1};

test('orbit requires the earned level and net construction funds and a permanent lease round-trips as JSON',()=>{
 const initial=eligible(),server=SERVERS.at(-1),quote=serverQuote(initial,server);
 assert.equal(quote.credit,34000);assert.equal(quote.cost,86000);
 assert.throws(()=>applyAction({...initial,members:19999},launch),/Lv.13/);
 assert.throws(()=>applyAction({...initial,cash:85999},launch),/余额/);
 assert.throws(()=>applyAction(initial,{...launch,months:3}),/一次建设/);
 const orbit=applyAction(initial,launch);
 assert.equal(orbit.cash,0);assert.equal(orbit.serverDaysRemaining,null);
 assert.equal(orbit.serverPeriodsRemaining,null);assert.equal(orbit.gameOver,false);
 assert.deepEqual(migrateState(JSON.parse(JSON.stringify(orbit))),orbit);
 assert.throws(()=>applyAction(orbit,{type:'renew',months:1}),/永久/);
 assert.throws(()=>applyAction(orbit,{type:'rent',serverId:'global',months:1}),/永久/);
 assert.equal(validateState({...orbit,serverId:'global'}),false);
 assert.equal(validateState({...orbit,serverDaysRemaining:1}),false);
});

test('large populations use one weekly sponsorship and keep growing through the old storage ceilings',()=>{
 const space=applyAction(eligible(),launch);
 const initial={...space,members:1_000_000_100,cash:2_000_000_000,patrons:45_000_000,day:6,timeSlot:2,nextEventDay:8};
 const result=applyAction(initial,tick);
 assert.ok(result.members>initial.members);assert.equal(result.history.at(-1).members,result.members);
 assert.equal(result.pendingSponsors.length,1);
 const receipt=result.pendingSponsors[0];
 assert.equal(receipt.amount,result.patrons*100);assert.equal(receipt.count,result.patrons);
 const claimed=applyAction(result,{type:'claim',id:receipt.id});
 assert.equal(claimed.cash,result.cash+receipt.amount);assert.throws(()=>applyAction(claimed,{type:'claim',id:receipt.id}),/领取/);
 assert.equal(validateState({...result,pendingSponsors:[{...receipt,amount:1}]}),false);
});

test('quoted late-game event budget and turnout match settlement',()=>{
 const def=EVENTS.find(v=>v.id==='welcome');
 const event={id:'event-character-1',kind:def.id,category:def.category,title:def.title,description:def.description,options:def.options,createdDay:1,expiresDay:7};
 const state={...eligible(),day:1,nextEventDay:3,events:[event]};
 const choice=eventChoice(state,event.options[0]);
 const settled=applyAction(state,{type:'resolve',eventId:event.id,optionId:choice.id});
 assert.equal(choice.cost,640);assert.equal(settled.cash,state.cash-choice.cost);
 assert.equal(choice.rewards.members,192);assert.equal(settled.members,state.members+192);
});

test('SQLite replays one construction, persists perpetual operation and ranks the actual population',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'orbit-store-')),path=join(dir,'game.sqlite');
 const identity={channel:'shared',iss:'https://orbit.test',sub:'81'};
 let store=createStore(path,'shared');
 try{
  await store.get(identity);
  const db=new DatabaseSync(path);
  try{db.prepare('UPDATE players SET state=?,members=?').run(JSON.stringify(eligible()),20000);}finally{db.close();}
  const request={revision:0,idempotencyKey:'orbit-build-operation',action:launch};
  const built=await store.act(identity,request);
  assert.ok(built.achievements.some(v=>v.id==='space-center'));
  store.close();store=createStore(path,'shared');
  assert.deepEqual(await store.act(identity,request),built);
  assert.equal((await store.get(identity)).state.serverDaysRemaining,null);
  assert.equal((await store.leaderboard('members')).entries[0].members,20000);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
