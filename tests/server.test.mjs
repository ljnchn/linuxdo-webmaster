import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createStore } from '../server/store.mjs';
import { createAuthenticator } from '../server/auth.mjs';
import { createApp } from '../server/app.mjs';
import { validateInput, PERIOD_MS } from '../server/protocol.mjs';
const alice={iss:'https://trusted.test',sub:'1',channel:'sandbox'};
const input=(revision=0,key='unique-operation-0001',action={type:'rename',name:'测试小站'})=>({revision,idempotencyKey:key,action});
function rig(path=':memory:'){let time=100000,n=0;const store=createStore(path,'sandbox',{now:()=>time});return {store,advance(ms){time+=ms;},async action(a){return store.act(alice,input((await store.get(alice)).revision,`test-operation-${String(++n).padStart(8,'0')}`,a));}};}
test('atomic idempotency, persistence, channel and identity isolation, leaderboard',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'game-v3-')),path=join(dir,'test.sqlite');let store=createStore(path,'sandbox');
 try{
  assert.equal((await store.get(alice)).state.cash,480);
  const first=await store.act(alice,input());assert.equal(first.revision,1);assert.deepEqual(await store.act(alice,input()),first);
  await assert.rejects(store.act(alice,input(0,'unique-operation-0002')),e=>e.code==='REVISION_CONFLICT');
  await assert.rejects(store.act(alice,input(1)),e=>e.code==='IDEMPOTENCY_CONFLICT');
  await assert.rejects(store.get({...alice,channel:'production'}),e=>e.status===401);
  assert.equal((await store.get({...alice,sub:'2'})).revision,0);
  const board=await store.leaderboard('days');assert.equal(board.trusted,true);assert.equal(board.entries.length,2);assert.equal(JSON.stringify(board).includes('trusted.test'),false);
  assert.deepEqual(board.entries.map(e=>e.userId).sort(),[1,2]);assert.ok(board.entries.every(e=>!Object.hasOwn(e,'identity')));
  await assert.rejects(store.leaderboard('cash'),e=>e.status===400);
  assert.throws(()=>createStore(path,'production'),/mix database channels/);
  store.close();store=createStore(path,'sandbox');assert.deepEqual(await store.act(alice,input()),first);
  const db=new DatabaseSync(path);assert.equal(db.prepare('SELECT COUNT(*) n FROM audit').get().n,1);db.close();
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('strict v3 action contract rejects client state, jumps and arbitrary speed',()=>{
 for(const action of [{type:'advance',days:7},{type:'tick',periods:2},{type:'tick',periods:1,cash:999},{type:'rent',serverId:'nest',months:4},{type:'renew',days:30},{type:'speed',value:8},{type:'heartbeat',active:'true'}])assert.throws(()=>validateInput(input(0,'unique-operation-0001',action)),e=>e.status===400);
 assert.throws(()=>validateInput({...input(),user_id:42}),e=>e.status===400);
 for(const action of [{type:'tick',periods:1},{type:'renew',months:2},{type:'registration',value:'open'},{type:'speed',value:4},{type:'heartbeat',active:false}])assert.equal(validateInput(input(0,'unique-operation-0001',action)).action,action);
});
test('server clock uses sixty-second days, keeps earned partial credit and excludes pauses/gaps',async()=>{
 const r=rig();try{
  await assert.rejects(r.action({type:'tick',periods:1}),e=>e.code==='TICK_TOO_EARLY');
  assert.equal(PERIOD_MS,20000);await r.action({type:'heartbeat',active:true});
  for(let phase=0;phase<3;phase++){
   for(let i=0;i<10;i++){r.advance(2000);await r.action({type:'heartbeat',active:true});}
   const result=await r.action({type:'tick',periods:1});assert.equal(result.timing.creditMs,0);assert.equal(result.state.serverDaysRemaining,phase===2?29:30);
  }
  assert.equal((await r.store.get(alice)).state.day,1);
  r.advance(2000);let response=await r.action({type:'speed',value:4});assert.equal(response.timing.creditMs,2000);
  r.advance(1000);response=await r.action({type:'heartbeat',active:false});assert.equal(response.timing.creditMs,6000);
  r.advance(100000);response=await r.action({type:'heartbeat',active:true});assert.equal(response.timing.creditMs,6000);
  r.advance(1000);response=await r.action({type:'heartbeat',active:true});assert.equal(response.timing.creditMs,10000);
  r.advance(60000);response=await r.action({type:'heartbeat',active:true});assert.equal(response.timing.creditMs,10000);
  r.advance(2500);response=await r.action({type:'tick',periods:1});assert.equal(response.timing.creditMs,0);
 }finally{r.store.close();}
});
test('2x and 4x clocks complete days in thirty and fifteen active seconds',async()=>{
 for(const speed of [2,4]){const r=rig();try{
  await r.action({type:'heartbeat',active:true});await r.action({type:'speed',value:speed});
  for(let phase=0;phase<3;phase++){for(let i=0;i<10;i++){r.advance(2000/speed);await r.action({type:'heartbeat',active:true});}await r.action({type:'tick',periods:1});}
  assert.equal((await r.store.get(alice)).state.day,1);
 }finally{r.store.close();}}
});
test('concurrent distinct revisions have one winner; same-key retries converge',async()=>{
 const r=rig();try{await r.store.get(alice);const results=await Promise.allSettled([r.store.act(alice,input()),r.store.act(alice,input(0,'unique-operation-0002'))]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.code,'REVISION_CONFLICT');
 const op=input(1,'unique-operation-0003');const same=await Promise.all([r.store.act(alice,op),r.store.act(alice,op)]);assert.deepEqual(same[0],same[1]);
 }finally{r.store.close();}
});
test('finished snapshot immutable, restart keeps best historical score',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'game-finish-')),path=join(dir,'db.sqlite'),r=rig(path);
 try{await r.action({type:'heartbeat',active:true});await r.action({type:'speed',value:4});for(let i=0;i<90;i++){r.advance(2500);await r.action({type:'heartbeat',active:true});r.advance(2500);await r.action({type:'tick',periods:1});}
 const finished=await r.store.get(alice);assert.equal(finished.state.gameOver,true);assert.equal(finished.state.day,30);
 for(const action of [{type:'rename',name:'篡改'},{type:'heartbeat',active:true},{type:'claim',id:'all'},{type:'renew',months:1}])await assert.rejects(r.action(action),e=>e.code==='RUN_FINISHED');
 const db=new DatabaseSync(path),snapshot=db.prepare('SELECT * FROM completed_runs').get();assert.equal(snapshot.days,30);
 const op=input(finished.revision,'restart-safe-operation',{type:'restart'}),restarted=await r.store.act(alice,op);assert.equal(restarted.revision,finished.revision+1);assert.equal(restarted.state.cash,480);assert.equal(restarted.state.members,0);assert.deepEqual(await r.store.act(alice,op),restarted);
 assert.deepEqual(db.prepare('SELECT * FROM completed_runs').get(),snapshot);assert.equal((await r.store.leaderboard('days')).entries[0].days,30);db.close();
 }finally{r.store.close();rmSync(dir,{recursive:true,force:true});}
});
test('auth defaults fail closed and dev is loopback-only',async()=>{
 await assert.rejects(createAuthenticator({}),/PLATFORM_ISSUER/);await assert.rejects(createAuthenticator({DEV_MODE:'enabled',HOST:'0.0.0.0'}),/loopback/);
 const auth=await createAuthenticator({DEV_MODE:'enabled'});await assert.rejects(auth.authenticate({socket:{remoteAddress:'10.0.0.1'}}),e=>e.status===401);assert.equal((await auth.authenticate({socket:{remoteAddress:'127.0.0.1'},headers:{'x-user-id':'fake'}})).sub,'local-tester');auth.close();
});
test('Node HTTP CORS, JSON limits, trusted storage requests',async()=>{
 const store=createStore(':memory:','development'),auth=await createAuthenticator({DEV_MODE:'enabled'}),server=createApp({store,auth});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{assert.equal((await fetch(base+'/api/state')).status,200);assert.equal((await fetch(base+'/api/state',{headers:{Origin:'https://evil.test'}})).status,403);
 assert.equal((await fetch(base+'/api/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input())})).status,200);
 for(const [body,status,type] of [['x'.repeat(9000),413,'application/json'],['{bad',400,'application/json'],['{}',415,'text/plain']])assert.equal((await fetch(base+'/api/actions',{method:'POST',headers:{'Content-Type':type},body})).status,status);
 assert.equal((await (await fetch(base+'/api/leaderboard')).json()).trusted,false);
 }finally{await new Promise(resolve=>server.close(resolve));store.close();auth.close();}
});

test('existing v3 store migrates atomically on get/act without replaying historical operations',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'game-upgrade-')),path=join(dir,'db.sqlite'),r=rig(path),db=new DatabaseSync(path);
 try{
  const previous=await r.store.act(alice,input()),original=structuredClone(previous.state);
  const legacy={...original,version:3,serverPeriodsRemaining:73};delete legacy.serverDaysRemaining;
  const historical={...previous,state:legacy,timing:{...previous.timing,periodMs:6000}};
  db.prepare('UPDATE operations SET response=?').run(JSON.stringify(historical));
  db.prepare('UPDATE players SET state=?').run(JSON.stringify(legacy));
  const [a,b]=await Promise.all([r.store.get(alice),r.store.get(alice)]);assert.deepEqual(a,b);assert.equal(a.state.version,4);assert.equal(a.state.serverDaysRemaining,25);assert.equal(a.revision,previous.revision);assert.equal(a.state.cash,original.cash);
  assert.deepEqual(await r.store.act(alice,input()),historical);
  db.prepare('UPDATE players SET state=?').run(JSON.stringify(legacy));
  const next=await r.store.act(alice,input(1,'migration-operation-002',{type:'renew',months:1}));assert.equal(next.state.serverDaysRemaining,55);assert.equal(next.state.cash,original.cash-240);assert.equal(next.revision,2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM audit').get().n,2);
 }finally{db.close();r.store.close();rmSync(dir,{recursive:true,force:true});}
});
