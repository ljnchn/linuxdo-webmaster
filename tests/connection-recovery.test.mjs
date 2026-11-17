import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createChallengeGame,applyAction,migrateState,validateState,RULES} from '../src/engine.mjs';
import {createClock} from '../src/clock.mjs';
import {transition,HEARTBEAT_TIMEOUT_MS} from '../server/protocol.mjs';
import {renderFunction} from './fixtures/render-function.mjs';

const source=await readFile(new URL('../src/app.mjs',import.meta.url),'utf8');
const actions=source.slice(source.indexOf(' async function act('),source.indexOf('\n function close('));
const running=source.split('\n').find(line=>line.includes('const isRunning='));
const heartbeat=source.split('\n').find(line=>line.includes('heartbeatTimer=setInterval'));
const initial={...createChallengeGame('重连测试',17),day:7,nextEventDay:8,members:30,patrons:1,pendingSponsors:[{id:'sponsor-7-1',createdDay:7,expiresDay:21,amount:100,patron:1}]};
const snapshot=(state=initial,patch={})=>({state,started:true,timing:{speed:2,creditMs:5000},achievements:[],backup:null,...patch});

function harness(transport){
 let now=1000;
 const time={now:()=>now},clock=createClock({periodMs:20000,now,progressMs:1000,speed:1}),document={hidden:false},nodes=new Map();
 const query=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{open:false,disabled:false,textContent:'',shows:0,focus(){this.focused=true;},showModal(){this.open=true;this.shows++;},close(){this.open=false;}});
  return nodes.get(selector);
 };
 return renderFunction('transport','initial','clock','document','$','migrateState','validateState','RULES','performance','advance',`
  let state=structuredClone(initial),busy=false,disconnected=false,lastSyncedAt=0,speed=1,started=true,pendingClockActive=null,pendingRestartRequest=null,serverBackup=null,selectedEvent='stale',dialogRevision=0,heartbeatTimer;
  const local=false,unlocked=new Map(),ACHIEVEMENTS=[],logText=String,messages=[],confirmations=[],setup=[];
  const dialog=$('#dialog'),ownsSave=()=>true,save=()=>{},redraw=()=>{},notify=text=>messages.push(text);
  const confirmRestart=()=>confirmations.push(structuredClone(pendingRestartRequest)),rename=value=>setup.push(value);
  let interval;const setInterval=callback=>{interval=callback;};
  ${running}
  ${actions}
  return {act,reconnect,setClockActive,clock,document,query:$,advance,
   startHeartbeat:async()=>{${heartbeat}},heartbeat:()=>interval(),
   inspect:()=>({state:structuredClone(state),disconnected,busy,started,speed,serverBackup,pendingRestartRequest,selectedEvent,unlocked:[...unlocked],messages,confirmations,setup,running:isRunning()})};
 `)(transport,initial,clock,document,query,migrateState,validateState,RULES,time,ms=>{now+=ms;});
}

test('failed heartbeat and state recovery pause the game, show one dialog and stop further writes',async()=>{
 let writes=0,reads=0;
 const h=harness({sendAction:async()=>{writes++;throw Error('request failed');},getState:async()=>{reads++;throw Error('offline');}});
 await h.startHeartbeat();
 assert.equal(h.inspect().disconnected,true);assert.equal(h.inspect().running,false);assert.equal(h.clock.active,false);
 assert.equal(h.query('#connection-dialog').open,true);assert.equal(h.query('#connection-dialog').shows,1);
 for(let i=0;i<30;i++)h.heartbeat();
 for(const action of [{type:'tick',periods:1},{type:'claim',id:'all'},{type:'restart',confirmed:true}])assert.equal(await h.act(action),false);
 await h.setClockActive(true);
 assert.equal(h.clock.active,false);assert.equal(writes,1);assert.equal(reads,1);assert.deepEqual(h.inspect().state,initial);
});

test('retry failures keep the snapshot and dialog; repeated retry clicks share one pending attempt',async()=>{
 let reads=0,finish;
 const h=harness({sendAction:async()=>{throw Error('request failed');},getState:()=>{reads++;if(reads===1)return Promise.reject(Error('offline'));return new Promise(resolve=>finish=resolve);}});
 await h.act({type:'heartbeat',active:true});
 const pending=h.reconnect();assert.equal(h.query('#connection-retry').disabled,true);await h.reconnect();assert.equal(reads,2);
 finish({state:{invalid:true}});await pending;
 assert.equal(h.inspect().disconnected,true);assert.equal(h.clock.active,false);assert.equal(h.query('#connection-dialog').open,true);
 assert.equal(h.query('#connection-retry').disabled,false);assert.match(h.query('#connection-message').textContent,/稍后再试/);assert.deepEqual(h.inspect().state,initial);
});

test('reconnect adopts a committed claim, metadata and timing without replaying the payment',async()=>{
 const committed=applyAction(initial,{type:'claim',id:'all'}),calls=[];let online=false;
 const h=harness({sendAction:async request=>{calls.push(structuredClone(request));if(!online)throw Error('response lost');return snapshot({...committed,revision:committed.revision+1},{backup:{state:initial}});},getState:async()=>{
  if(!online)throw Error('offline');return snapshot(committed,{achievements:[{id:'first-friend',unlockedAt:123}],backup:{state:initial}});
 }});
 h.query('#dialog').open=true;await h.act({type:'claim',id:'all'});online=true;await h.reconnect();
 const result=h.inspect();assert.equal(result.disconnected,false);assert.equal(result.running,true);
 assert.equal(result.state.cash,initial.cash+100);assert.equal(result.state.pendingSponsors.length,0);assert.equal(result.state.day,initial.day);
 assert.equal(result.speed,2);assert.equal(h.clock.speed,2);assert.ok(h.clock.progressMs<5100);assert.deepEqual(result.unlocked,[['first-friend',123]]);
 assert.deepEqual(result.serverBackup,{state:initial});assert.equal(result.selectedEvent,null);assert.equal(h.query('#dialog').open,false);assert.equal(h.query('#connection-dialog').open,false);
 assert.deepEqual(calls.map(call=>call.action.type),['claim','heartbeat']);assert.equal(calls[1].revision,committed.revision);
});

test('background and paused dialogs stop interval heartbeats; returning sends only the current active state',async()=>{
 const calls=[];const h=harness({sendAction:async request=>{calls.push(request.action);return snapshot();},getState:async()=>snapshot()});
 await h.startHeartbeat();assert.equal(calls.length,1);
 h.document.hidden=true;await h.setClockActive(false);
 for(let i=0;i<30;i++)h.heartbeat();assert.equal(calls.length,2);assert.equal(calls[1].active,false);
 h.document.hidden=false;await h.setClockActive(true);assert.equal(calls.length,3);assert.equal(calls[2].active,true);
 h.query('#dialog').open=true;await h.setClockActive(false);for(let i=0;i<30;i++)h.heartbeat();assert.equal(calls.length,4);
});

test('connection recovery preserves an uncertain restart request for explicit same-key confirmation',async()=>{
 const calls=[];let online=false;
 const h=harness({sendAction:async request=>{calls.push(structuredClone(request));throw Error('response lost');},getState:async()=>{if(!online)throw Error('offline');return snapshot(applyAction(initial,{type:'restart',confirmed:true}),{started:false});}});
 await h.act({type:'restart',confirmed:true});const pending=structuredClone(h.inspect().pendingRestartRequest);
 online=true;await h.reconnect();assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);
 assert.deepEqual(h.inspect().pendingRestartRequest,pending);assert.deepEqual(h.inspect().confirmations,[pending]);assert.equal(h.inspect().running,false);assert.equal(h.clock.active,false);
});

test('business rejection with a successful state read stays in its current dialog',async()=>{
 const h=harness({sendAction:async()=>{throw Object.assign(Error('余额不足以续租。'),{code:'ACTION_REJECTED',status:422});},getState:async()=>snapshot()});
 h.query('#dialog').open=true;await h.act({type:'renew',months:3});
 assert.equal(h.inspect().disconnected,false);assert.equal(h.query('#connection-dialog').open,false);assert.equal(h.query('#dialog').open,true);assert.match(h.inspect().messages.at(-1),/余额不足/);
});

test('reconnect keeps finished or not-yet-started games paused and does not send a heartbeat',async()=>{
 for(const result of [snapshot({...initial,gameOver:true,serverDaysRemaining:0,serverPeriodsRemaining:0}),snapshot(createChallengeGame(),{started:false})]){
  let online=false,writes=0;const h=harness({sendAction:async()=>{writes++;throw Error('offline');},getState:async()=>{if(!online)throw Error('offline');return result;}});
  await h.act({type:'heartbeat',active:true});online=true;await h.reconnect();
  assert.equal(writes,1);assert.equal(h.clock.active,false);assert.equal(h.inspect().running,false);assert.equal(h.inspect().disconnected,false);
  assert.deepEqual(h.inspect().setup,result.started?[]:[true]);
 }
});

test('known platform rate limits pause immediately without recovery reads or automatic restart replay',async()=>{
 for(const action of [{type:'heartbeat',active:true},{type:'restart',confirmed:true}]){
  let calls=0;const h=harness({sendAction:async()=>{calls++;throw Object.assign(Error('request failed'),{status:429,code:'RATE_LIMIT'});},getState:async()=>assert.fail('429 must not trigger an immediate recovery request')});
  await h.act(action);assert.equal(calls,1);assert.equal(h.inspect().disconnected,true);assert.equal(h.clock.active,false);assert.equal(h.query('#connection-dialog').open,true);
 }
});

test('recent successful operations suppress heartbeat requests until ten seconds have passed',async()=>{
 const calls=[];const h=harness({sendAction:async request=>{calls.push(request.action);return snapshot();},getState:async()=>snapshot()});
 await h.startHeartbeat();assert.equal(calls.length,1);
 h.advance(9000);await h.act({type:'registration',value:'open'});assert.equal(calls.length,2);
 h.advance(1000);h.heartbeat();assert.equal(calls.length,2);
 h.advance(8999);h.heartbeat();assert.equal(calls.length,2);
 h.advance(1);h.heartbeat();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,3);
 h.heartbeat();assert.equal(calls.length,3);
 assert.equal(RULES.heartbeatIntervalMs,10000);assert.match(heartbeat,/,RULES\.heartbeatIntervalMs\)/);
});

test('the server accepts ten-second heartbeats, rejects long gaps, and does not accrue paused time',()=>{
 assert.equal(HEARTBEAT_TIMEOUT_MS,20000);
 const row={state:JSON.stringify(initial),revision:initial.revision,speed:1,active:1,credit_ms:0,last_seen:1000};
 const first=transition(row,{type:'heartbeat',active:true},11000);assert.equal(first.credit_ms,10000);
 const next=transition(first,{type:'tick',periods:1},21000);assert.equal(next.credit_ms,0);assert.equal(JSON.parse(next.state).timeSlot,1);
 const gap=transition(row,{type:'heartbeat',active:true},21001);assert.equal(gap.credit_ms,0);
 const paused=transition(row,{type:'heartbeat',active:false},2000),resumed=transition(paused,{type:'heartbeat',active:true},11000);assert.equal(resumed.credit_ms,1000);
});

test('the game timing 429 is distinct from a platform rate limit',async()=>{
 const h=harness({sendAction:async()=>{throw Object.assign(Error('请等待下一时段'),{status:429,code:'TICK_TOO_EARLY'});},getState:async()=>snapshot()});
 await h.act({type:'tick',periods:1});assert.equal(h.inspect().disconnected,false);assert.equal(h.query('#connection-dialog').open,false);assert.equal(h.inspect().messages.length,0);
});
