import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createStore} from '../server/store.mjs';
import {identityKey} from '../server/protocol.mjs';
import {createStreetTV} from '../src/street-tv.mjs';
import {earnedAchievements} from '../src/achievements.mjs';
import {createGame} from '../src/engine.mjs';
import {lifeOf} from '../src/community-life.mjs';

test('either visible top ten qualifies, only opted-in accounts air, and an off-board owner can withdraw',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'street-tv-')),path=join(dir,'tv.sqlite');
 const account=id=>({channel:'shared',iss:'https://forum.test',sub:String(id)});
 let store=createStore(path,'shared');
 const db=new DatabaseSync(path);
 try{
  for(let i=1;i<=12;i++){
   await store.get(account(i));
   db.prepare('UPDATE players SET members=?,days=? WHERE identity=?').run(i,i,identityKey(account(i)));
  }
  const viewer=account(1),guest=account(2);
  assert.deepEqual(await store.television(viewer),{enabled:false,eligible:false,userIds:[]});
  await assert.rejects(store.setTelevision(viewer,true),{code:'RANK_REQUIRED'});
  db.prepare('UPDATE players SET days=90 WHERE identity=?').run(identityKey(guest));
  assert.ok(!(await store.leaderboard('members')).entries.slice(0,10).some(e=>e.userId===2));
  assert.equal((await store.leaderboard('days')).entries[0].userId,2);
  assert.deepEqual(await store.setTelevision(guest,true),{enabled:true,eligible:true,userIds:[2]});
  store.close();store=createStore(path,'shared');
  assert.deepEqual((await store.television(viewer)).userIds,[2]);
  assert.equal((await store.get(guest)).revision,0);
  db.prepare('UPDATE players SET days=0 WHERE identity=?').run(identityKey(guest));
  assert.deepEqual(await store.television(guest),{enabled:true,eligible:false,userIds:[]});
  await store.setTelevision(guest,false);
  db.prepare('UPDATE players SET members=900 WHERE identity=?').run(identityKey(guest));
  assert.deepEqual(await store.television(guest),{enabled:false,eligible:true,userIds:[]});
  // A completed run can qualify even when the current run is new.
  db.prepare('INSERT INTO completed_runs SELECT ?,identity,channel,public_id,name,2000,100,state,0 FROM players WHERE identity=?').run('past-guest-run',identityKey(viewer));
  assert.deepEqual((await store.setTelevision(viewer,true)).userIds,[1]);
  await store.act(viewer,{revision:0,idempotencyKey:'television-restart-1',action:{type:'restart',confirmed:true}});
  assert.deepEqual((await store.television(guest)).userIds,[1]);
 }finally{db.close();store.close();rmSync(dir,{recursive:true,force:true});}
});

test('a removed guest disappears before the new profile loads, and a late lookup cannot undo withdrawal',async()=>{
 let ids=[1],finish;
 const transport={
  getTelevision:async()=>({enabled:true,eligible:true,userIds:ids}),
  setTelevision:async()=>({enabled:false,eligible:true,userIds:[]}),
  getUserProfile:id=>id===1?Promise.resolve({name:' 小满 ',username:'one'}):new Promise(resolve=>{finish=resolve;}),
 };
 const tv=createStreetTV(transport,()=>{});
 await tv.refresh();assert.deepEqual(tv.names(),['小满']);
 ids=[2];const pending=tv.refresh();await Promise.resolve();assert.deepEqual(tv.names(),[]);
 await tv.refresh(false);finish({name:'春声',username:'two'});await pending;assert.deepEqual(tv.names(),[]);
 ids=[3];transport.getUserProfile=async()=>({name:' ',username:'private-handle'});
 await tv.refresh();assert.deepEqual(tv.names(),[]);
 tv.destroy();
});

test('museum thresholds count completed activities and keep bronze, silver and gold independently',()=>{
 const state=createGame();state.life=lifeOf(state);
 const badges=()=>earnedAchievements(state).filter(a=>a.badge&&!a.track).map(a=>a.badge);
 state.life.projects.resources={activityId:'resources-book',startedDay:0};
 assert.deepEqual(badges(),[]);
 state.life.completed={'resources-book':1,'benefits-badge-draw':1,'resources-repository':24};
 assert.deepEqual(badges(),[17,107,121]);
 state.life.completed['resources-repository']=25;assert.deepEqual(badges(),[17,107,121,122]);
 state.life.completed['resources-repository']=250;assert.deepEqual(badges(),[17,107,121,122,123]);
});
