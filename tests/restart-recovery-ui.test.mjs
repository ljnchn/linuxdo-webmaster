import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {RULES,createChallengeGame,applyAction,migrateState,validateState} from '../src/engine.mjs';
import {createClock} from '../src/clock.mjs';
import {createRunBackups} from '../src/run-backups.mjs';
import {createSaveOwner} from '../src/local-session.mjs';
const source=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
const actSource=source.slice(source.indexOf(' async function act(action,message)'),source.indexOf('\n async function setClockActive'));
const initial=createChallengeGame('原社区',17,'保留口号');
function harness(transport){
 const clock=createClock({periodMs:20000,speed:4,progressMs:1000,active:true,now:performance.now()}),messages=[];
 const factory=new Function('transport','initial','clock','migrateState','validateState','RULES','messages',`
 let state=structuredClone(initial),busy=false,speed=4,started=true,pendingRestartRequest=null,pendingClockActive=null,serverBackup=null;const unlocked=new Map(),ACHIEVEMENTS=[],logText=s=>s;
 const local=false,ownsSave=()=>true,notify=(message)=>messages.push(message),redraw=()=>{},save=()=>{},setClockActive=async()=>{};
 ${actSource}
 return {act,inspect:()=>({state,busy,speed,started,unlocked:[...unlocked],pendingRestartRequest,serverBackup,clockSpeed:clock.speed,clockActive:clock.active,credit:clock.progressMs})};`);
 return {...factory(transport,initial,clock,migrateState,validateState,RULES,messages),messages};
}
const fresh=applyAction(initial,{type:'restart',confirmed:true});
const result={state:fresh,revision:1,timing:{speed:1,creditMs:0},backup:{state:initial,revision:0,runId:'previous',savedAt:123,timing:{speed:4,creditMs:1000}}};
test('user actions receive busy feedback while heartbeat and tick skip quietly',async()=>{
 let finish;const pending=new Promise(resolve=>finish=resolve),h=harness({sendAction:()=>pending});
 const heartbeat=h.act({type:'heartbeat',active:false});
 assert.equal(await h.act({type:'rename',name:'新名字'}),false);assert.match(h.messages.at(-1),/正在同步进度/);
 const count=h.messages.length;await h.act({type:'heartbeat',active:false});await h.act({type:'tick',periods:1});assert.equal(h.messages.length,count);
 finish(result);assert.equal(await heartbeat,true);
});
test('achievement unlocks preserve action feedback and survive missing legacy response fields',async()=>{
 let count=0;const h=harness({sendAction:async()=>({...result,...(++count===2?{}:{achievements:[{id:'first-friend',unlockedAt:123}]})})});
 assert.equal(await h.act({type:'rename',name:'新名字'},'社区资料已保存。'),true);
 assert.match(h.messages.at(-1),/社区资料已保存。.*解锁成就：first-friend/);
 await h.act({type:'rename',name:'新名字'},'再次保存。');assert.equal(h.messages.at(-1),'再次保存。');
 await h.act({type:'rename',name:'新名字'},'第三次保存。');assert.equal(h.messages.at(-1),'第三次保存。');
});
test('state recovery synchronizes durable achievements and setup metadata',async()=>{
 const h=harness({sendAction:async()=>{throw Error('response lost');},getState:async()=>({...result,started:false,achievements:[{id:'first-friend',unlockedAt:456}]})});
 assert.equal(await h.act({type:'rename',name:'新名字'}),false);
 assert.deepEqual(h.inspect().unlocked,[['first-friend',456]]);assert.equal(h.inspect().started,false);
});
test('action metadata preserves the platform setup requirement',async()=>{
 const h=harness({sendAction:async()=>({...result,started:false})});
 await h.act({type:'rename',name:'新名字'});assert.equal(h.inspect().started,false);
});
test('lost committed restart response retries identical full request and exits paused setup',async()=>{
 const calls=[];const h=harness({sendAction:async request=>{calls.push(structuredClone(request));if(calls.length===1)throw Error('response lost');return result;},getState:async()=>result});
 assert.equal(await h.act({type:'restart',confirmed:true}),true);assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);
 const value=h.inspect();assert.equal(value.state.seed,fresh.seed);assert.equal(value.pendingRestartRequest,null);assert.equal(value.started,false);assert.equal(value.speed,1);assert.equal(value.clockSpeed,1);assert.equal(value.clockActive,false);assert.equal(value.credit,0);assert.equal(value.busy,false);assert.deepEqual(value.serverBackup,result.backup);
});
test('uncertain restart locks other writes and retries original key even after recovering changed revision',async()=>{
 const calls=[];let online=false;
 const h=harness({sendAction:async request=>{calls.push(structuredClone(request));if(!online)throw Error('offline');return result;},getState:async()=>({...result,timing:{speed:2,creditMs:700}})});
 assert.equal(await h.act({type:'restart',confirmed:true}),false);const pending=structuredClone(h.inspect().pendingRestartRequest);
 assert.equal(h.inspect().state.revision,1);assert.equal(h.inspect().speed,2);assert.equal(h.inspect().clockSpeed,2);assert.equal(h.inspect().started,false);assert.equal(h.inspect().clockActive,false);assert.equal(h.inspect().busy,false);
 for(const action of [{type:'heartbeat',active:true},{type:'tick',periods:1},{type:'rename',name:'不会发送'}])assert.equal(await h.act(action),false);
 assert.equal(calls.length,2);online=true;assert.equal(await h.act({type:'restart',confirmed:true}),true);assert.deepEqual(calls[2],pending);assert.equal(calls[2].revision,0);assert.equal(h.inspect().pendingRestartRequest,null);assert.deepEqual(h.inspect().serverBackup,result.backup);
});
test('unreachable state recovery keeps pending request instead of issuing a fresh restart',async()=>{
 const calls=[];const h=harness({sendAction:async request=>{calls.push(structuredClone(request));throw Error('offline');},getState:async()=>{throw Error('offline');}});
 await h.act({type:'restart',confirmed:true});await h.act({type:'restart',confirmed:true});assert.equal(calls.length,4);for(const call of calls)assert.deepEqual(call,calls[0]);assert.equal(h.inspect().busy,false);assert.match(h.messages.at(-1),/重新连接确认结果/);
});
test('ordinary error recovery synchronizes server speed and clock speed',async()=>{
 const h=harness({sendAction:async()=>{throw Error('conflict');},getState:async()=>({state:initial,timing:{speed:2,creditMs:400}})});
 assert.equal(await h.act({type:'rename',name:'改名'}),false);assert.equal(h.inspect().speed,2);assert.equal(h.inspect().clockSpeed,2);assert.equal(h.inspect().credit,400);assert.equal(h.inspect().pendingRestartRequest,null);
});
test('blocked localStorage property safely initializes temporary challenge with destructive actions guarded',async()=>{
 const init=source.slice(source.indexOf(' let state,world'),source.indexOf(' const chatSchedule='));
 const context={environment:{},transport:null,crypto:webcrypto,KEY:'game',PREVIOUS:'old',LEGACY:'legacy',createRunBackups,createSaveOwner,createChallengeGame,migrateState,validateState,RULES};
 Object.defineProperty(context,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});
 Object.defineProperty(context,'storage',{get(){throw new DOMException('blocked','SecurityError');}});
 const value=await vm.runInNewContext(`(async()=>{${init}\nreturn {state,memoryOnly,backups,storageWarning};})()`,context);
 assert.equal(value.memoryOnly,true);assert.equal(value.backups,null);assert.equal(value.state.difficulty,'challenge');assert.match(value.storageWarning,/临时进度/);assert.match(value.storageWarning,/刷新会丢失本次进度/);
 assert.match(source,/if\(local&&memoryOnly\)/);assert.match(source,/if\(!ownsSave\(\)\|\|memoryOnly\)/);
});
test('definite precommit rejection skips replay, refreshes state and waits for new user confirmation',async()=>{
 for(const code of ['REVISION_CONFLICT','ACTION_REJECTED','RESTART_CONFIRMATION_REQUIRED']){
  const calls=[];let reject=true;const latest={...initial,revision:7};
  const h=harness({sendAction:async request=>{calls.push(structuredClone(request));if(reject)throw Object.assign(Error(code),{code});return {...result,state:{...fresh,revision:8}};},getState:async()=>({state:latest,timing:{speed:2,creditMs:50}})});
  assert.equal(await h.act({type:'restart',confirmed:true}),false);assert.equal(calls.length,1);assert.equal(h.inspect().pendingRestartRequest,null);assert.equal(h.inspect().state.revision,7);assert.equal(h.inspect().clockSpeed,2);assert.match(h.messages.at(-1),/重新确认/);
  // Only a separate, explicit user confirmation may create the next operation.
  reject=false;assert.equal(await h.act({type:'restart',confirmed:true}),true);assert.equal(calls.length,2);assert.equal(calls[1].revision,7);assert.notEqual(calls[0].idempotencyKey,calls[1].idempotencyKey);
 }
 assert.match(source,/else if\(transport\)confirmRestart\(\)/);
});
test('definite rejection with failed state refresh stays locked until state can be confirmed',async()=>{
 const calls=[];let online=false;const h=harness({sendAction:async request=>{calls.push(structuredClone(request));throw Object.assign(Error('conflict'),{code:'REVISION_CONFLICT'});},getState:async()=>{if(!online)throw Error('offline');return {state:initial,timing:{speed:1,creditMs:0}};}});
 assert.equal(await h.act({type:'restart',confirmed:true}),false);assert.ok(h.inspect().pendingRestartRequest);assert.equal(calls.length,1);
 online=true;assert.equal(await h.act({type:'restart',confirmed:true}),false);assert.deepEqual(calls[0],calls[1]);assert.equal(h.inspect().pendingRestartRequest,null);
});
test('semantic rejection of exact retry resolves earlier uncertainty; auth and internal errors do not',async()=>{
 for(const code of ['REVISION_CONFLICT','INVALID_PLATFORM_REQUEST','INTERNAL_ERROR']){
  const calls=[];const h=harness({sendAction:async request=>{calls.push(structuredClone(request));if(calls.length===1)throw Error('network');throw Object.assign(Error(code),{code});},getState:async()=>result});
  assert.equal(await h.act({type:'restart',confirmed:true}),false);assert.deepEqual(calls[0],calls[1]);assert.equal(h.inspect().pendingRestartRequest===null,code==='REVISION_CONFLICT');
 }
});
