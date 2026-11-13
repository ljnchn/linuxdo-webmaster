import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createStore} from '../server/store.mjs';
import {identityKey} from '../server/protocol.mjs';

const alice={iss:'https://trusted.test',sub:'alice',channel:'sandbox'};
const action=(revision,key,action)=>({revision,idempotencyKey:key,action});

test('trusted snapshot backfill, stable replay, concurrent CAS, restart and identity isolation',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'achievements-')),path=join(directory,'game.sqlite');
 let store=createStore(path,'sandbox',{now:()=>200000});
 const db=new DatabaseSync(path);
 try{
  const fresh=await store.get(alice);assert.equal(fresh.started,false);assert.deepEqual(fresh.achievements,[]);
  // Model an existing authoritative server snapshot before achievement migration.
  const state={...fresh.state,members:10,cash:10000};
  db.prepare('UPDATE players SET state=?,members=?,last_seen=? WHERE identity=?').run(JSON.stringify(state),10,123456,identityKey(alice));
  const request=action(0,'achievement-operation-one',{type:'rename',name:'十人小站'});
  const concurrent=await Promise.allSettled([store.act(alice,request),store.act(alice,action(0,'achievement-operation-two',{type:'rename',name:'另一名字'}))]);
  assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(concurrent.find(result=>result.status==='rejected').reason.code,'REVISION_CONFLICT');
  const winner=concurrent.find(result=>result.status==='fulfilled').value;
  assert.equal(winner.started,true);assert.equal(winner.achievements.length,3);
  assert.ok(winner.achievements.every(entry=>entry.unlockedAt===123456));
  const winningRequest=concurrent[0].status==='fulfilled'?request:action(0,'achievement-operation-two',{type:'rename',name:'另一名字'});
  assert.deepEqual(await store.act(alice,winningRequest),winner);
  const restarted=await store.act(alice,action(1,'achievement-restart-one',{type:'restart',confirmed:true}));
  assert.equal(restarted.started,false);assert.deepEqual(restarted.achievements,winner.achievements);
  assert.equal(restarted.state.members,0);
  assert.deepEqual((await store.get({...alice,sub:'bob'})).achievements,[]);
  await assert.rejects(store.get({...alice,channel:'production'}),error=>error.code==='CHANNEL_MISMATCH');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM player_achievements').get().count,3);
  store.close();store=createStore(path,'sandbox');
  assert.deepEqual((await store.get(alice)).achievements,winner.achievements);
  assert.deepEqual(await store.act(alice,winningRequest),winner);
  assert.equal((await store.leaderboard('members')).entries.length,2);
 }finally{db.close();store.close();rmSync(directory,{recursive:true,force:true});}
});

test('state reads backfill existing trusted metrics once without changing revision',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'achievement-read-')),path=join(directory,'game.sqlite'),store=createStore(path,'sandbox');
 const db=new DatabaseSync(path);
 try{
  const fresh=await store.get(alice);
  db.prepare('UPDATE players SET state=?,days=?,last_seen=? WHERE identity=?').run(JSON.stringify({...fresh.state,day:100}),100,555,identityKey(alice));
  const first=await store.get(alice),second=await store.get(alice);
  assert.equal(first.revision,0);assert.equal(first.achievements.length,3);
  assert.deepEqual(first.achievements,second.achievements);
  assert.ok(first.achievements.every(entry=>entry.unlockedAt===555));
 }finally{db.close();store.close();rmSync(directory,{recursive:true,force:true});}
});

test('new threshold unlocks share action commit and rejected actions leave no unlock or ledger',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'achievement-action-')),path=join(directory,'game.sqlite'),store=createStore(path,'sandbox',{now:()=>777});
 const db=new DatabaseSync(path);
 try{
  const fresh=await store.get(alice);
  db.prepare('UPDATE players SET state=?,members=? WHERE identity=?').run(JSON.stringify({...fresh.state,members:8}),8,identityKey(alice));
  const request=action(0,'achievement-first-member',{type:'activity',activityId:'benefits-badge-draw'});
  const result=await store.act(alice,request);
  assert.equal(result.state.members,10);
  assert.deepEqual(result.achievements,[{id:'first-member',unlockedAt:777},{id:'ten-members',unlockedAt:777}]);
  assert.deepEqual(await store.act(alice,request),result);
  await assert.rejects(store.act(alice,action(1,'achievement-reject-one',{type:'activity',activityId:'benefits-badge-draw'})),error=>error.code==='ACTION_REJECTED');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM operations').get().count,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM player_achievements').get().count,2);
  assert.equal((await store.get(alice)).revision,1);
 }finally{db.close();store.close();rmSync(directory,{recursive:true,force:true});}
});
