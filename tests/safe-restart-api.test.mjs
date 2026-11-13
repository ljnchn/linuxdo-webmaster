import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from '../server/store.mjs';
import {validateInput,identityKey} from '../server/protocol.mjs';
import {createGame} from '../src/engine.mjs';
const alice={iss:'https://safe-restart.test',sub:'alice',channel:'sandbox'};
const input=(revision,action,key='safe-restart-operation-001')=>({revision,action,idempotencyKey:key});
test('rename and restart strict optional fields preserve old shapes',()=>{
 for(const action of [{type:'rename',name:'旧站'},{type:'rename',name:'新站',slogan:''},{type:'rename',name:'新站',slogan:'字'.repeat(40)},{type:'restart'},{type:'restart',confirmed:true},{type:'restart',confirmed:false}])assert.equal(validateInput(input(0,action)).action,action);
 for(const action of [{type:'rename',name:'新站',slogan:null},{type:'rename',name:'新站',slogan:4},{type:'rename',name:'新站',slogan:'x'.repeat(41)},{type:'rename',name:'新站',solan:'x'},{type:'rename',name:' '},{type:'rename',name:'x'.repeat(25)},{type:'restart',confirmed:1},{type:'restart',confirmed:'true'},{type:'restart',confirmed:null},{type:'restart',state:{}},{type:'restart',name:'x'}])assert.throws(()=>validateInput(input(0,action)),e=>e.status===400);
});
test('old Node schema upgrades lazily; active restart backs up exactly once, survives reopen and preserves classic save',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'safe-restart-')),path=join(dir,'state.sqlite');let store=createStore(path,'sandbox');const db=new DatabaseSync(path);
 try{
  const first=await store.get(alice);assert.equal(first.state.difficulty,'challenge');
  const old=createGame('旧站',42);delete old.difficulty;old.members=12;old.day=5;old.nextEventDay=6;old.nextWorldEventDay=12;
  db.prepare('UPDATE players SET state=?,name=?,members=?,days=?').run(JSON.stringify(old),old.name,old.members,old.day);
  const before=await store.get(alice);assert.deepEqual(before.state,old);assert.equal(db.prepare('SELECT COUNT(*) n FROM last_run_backups').get().n,0);
  for(const action of [{type:'restart'},{type:'restart',confirmed:false}])await assert.rejects(store.act(alice,input(0,action)),e=>e.code==='RESTART_CONFIRMATION_REQUIRED');
  assert.equal((await store.get(alice)).revision,0);
  const renamed=await store.act(alice,input(0,{type:'rename',name:'新站',slogan:'一起长大'},'safe-rename-operation-001'));
  const op=input(1,{type:'restart',confirmed:true}),responses=await Promise.all([store.act(alice,op),store.act(alice,op)]);assert.deepEqual(...responses);
  const result=responses[0];assert.equal(result.state.difficulty,'challenge');assert.equal(result.state.name,'新站');assert.equal(result.state.slogan,'一起长大');assert.deepEqual(result.backup.state,renamed.state);assert.equal(result.backup.revision,1);
  const backup=db.prepare('SELECT * FROM last_run_backups').get();assert.equal(backup.run_id,result.backup.runId);assert.deepEqual(JSON.parse(backup.snapshot),result.backup);assert.equal(db.prepare('SELECT COUNT(*) n FROM completed_runs').get().n,0);assert.equal((await store.leaderboard('days')).entries[0].days,0);
  await assert.rejects(store.act(alice,{...op,action:{type:'restart',confirmed:false}}),e=>e.code==='IDEMPOTENCY_CONFLICT');
  store.close();store=createStore(path,'sandbox');assert.deepEqual(await store.act(alice,op),result);assert.deepEqual(db.prepare('SELECT * FROM last_run_backups').get(),backup);
  const race=await Promise.allSettled([store.act(alice,input(2,{type:'restart',confirmed:true},'safe-race-operation-0001')),store.act(alice,input(2,{type:'restart',confirmed:true},'safe-race-operation-0002'))]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.find(r=>r.status==='rejected').reason.code,'REVISION_CONFLICT');
  const latest=db.prepare('SELECT * FROM last_run_backups').get();assert.equal(latest.revision,2);assert.equal(db.prepare('SELECT COUNT(*) n FROM last_run_backups').get().n,1);
  await store.act(alice,op);assert.deepEqual(db.prepare('SELECT * FROM last_run_backups').get(),latest);
  assert.deepEqual((await store.get(alice)).backup,JSON.parse(latest.snapshot));
  db.exec("CREATE TRIGGER fail_backup BEFORE UPDATE ON last_run_backups BEGIN SELECT RAISE(ABORT,'backup unavailable'); END");
  const beforeFailure=await store.get(alice),failedOp=input(3,{type:'restart',confirmed:true},'safe-failed-operation-001');
  await assert.rejects(store.act(alice,failedOp),/backup unavailable/);assert.deepEqual(await store.get(alice),beforeFailure);assert.equal(db.prepare('SELECT COUNT(*) n FROM operations WHERE key=?').get(failedOp.idempotencyKey).n,0);assert.deepEqual(db.prepare('SELECT * FROM last_run_backups').get(),latest);db.exec('DROP TRIGGER fail_backup');
  const finished={...(await store.get(alice)).state,gameOver:true,serverDaysRemaining:0,serverPeriodsRemaining:0};db.prepare('UPDATE players SET state=? WHERE identity=?').run(JSON.stringify(finished),identityKey(alice));
  const end=await store.act(alice,input(3,{type:'restart'},'safe-ended-operation-001'));assert.equal(end.state.difficulty,'challenge');assert.equal(end.backup.state.gameOver,true);
 }finally{db.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
