import { HttpError } from './errors.mjs';
import { applyAction, RULES, BUILDING_ACTIVITIES } from '../src/engine.mjs';
export const PERIOD_MS = RULES.secondsPerPeriod * 1000, HEARTBEAT_TIMEOUT_MS = 4000;
const fields = {tick:['periods'],rent:['serverId','months'],renew:['months'],registration:['value'],strategy:['strategy'],resolve:['eventId','optionId'],activity:['activityId'],claim:['id'],rename:['name'],restart:[],heartbeat:['active'],speed:['value']};
export function validateInput(body) {
 if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).sort().join() !== 'action,idempotencyKey,revision') throw new HttpError(400,'INVALID_BODY');
 if(!Number.isSafeInteger(body.revision)||body.revision<0||typeof body.idempotencyKey!=='string'||!/^[A-Za-z0-9_-]{16,96}$/.test(body.idempotencyKey))throw new HttpError(400,'INVALID_REVISION_OR_KEY');
 const a=body.action;
 if(!a||Array.isArray(a)||typeof a!=='object'||typeof a.type!=='string'||!Object.hasOwn(fields,a.type))throw new HttpError(400,'INVALID_ACTION');
 const optional=a.type==='rename'?['slogan']:a.type==='restart'?['confirmed']:[];
 const allowed=['type',...fields[a.type],...optional];
 if(Object.keys(a).some(key=>!allowed.includes(key))||['type',...fields[a.type]].some(key=>!Object.hasOwn(a,key)))throw new HttpError(400,'INVALID_ACTION');
 for(const key of fields[a.type]) {
  const v=a[key];
  if(key==='months'?![1,2,3].includes(v):key==='periods'?v!==1:key==='active'?typeof v!=='boolean':a.type==='speed'?![1,2,4].includes(v):typeof v!=='string'||!v.length||v.length>100)throw new HttpError(400,'INVALID_ACTION');
 }
 if(a.type==='rename'&&(!a.name.trim()||a.name.trim().length>24))throw new HttpError(400,'INVALID_ACTION');
 if(a.type==='activity'&&!BUILDING_ACTIVITIES.some(v=>v.id===a.activityId))throw new HttpError(400,'INVALID_ACTION');
 if(Object.hasOwn(a,'slogan')&&(typeof a.slogan!=='string'||a.slogan.length>40))throw new HttpError(400,'INVALID_ACTION');
 if(Object.hasOwn(a,'confirmed')&&typeof a.confirmed!=='boolean')throw new HttpError(400,'INVALID_ACTION');
 return body;
}
export const fingerprint = input => JSON.stringify({revision:input.revision,action:Object.fromEntries(Object.entries(input.action).sort(([a],[b])=>a.localeCompare(b)))});
export const identityKey = identity => JSON.stringify([identity.channel,identity.iss,identity.sub]);
export function resultOf(row) { return {state:JSON.parse(row.state),revision:row.revision,started:row.started!==0,timing:{speed:row.speed,active:!!row.active,creditMs:row.credit_ms,periodMs:PERIOD_MS,heartbeatTimeoutMs:HEARTBEAT_TIMEOUT_MS}}; }
export function transition(row,action,now) {
 let state=JSON.parse(row.state), speed=row.speed, active=!!row.active, credit=row.credit_ms;
 if(action.type==='restart'&&!state.gameOver&&action.confirmed!==true)throw new HttpError(422,'RESTART_CONFIRMATION_REQUIRED','重新开始需要确认，当前进度将备份。');
 const delta=Math.max(0,now-row.last_seen);
 // Preserve earned progress across pauses/gaps, but never accrue unobserved time.
 if(active && delta<=HEARTBEAT_TIMEOUT_MS)credit=Math.min(PERIOD_MS,credit+delta*speed);
 if(state.gameOver && action.type!=='restart')throw new HttpError(422,'RUN_FINISHED');
 if(action.type==='heartbeat') {active=action.active;state={...state,revision:state.revision+1};}
 else if(action.type==='speed'){speed=action.value;state={...state,revision:state.revision+1};}
 else {
  if(action.type==='tick') {if(!active||credit<PERIOD_MS)throw new HttpError(429,'TICK_TOO_EARLY','请保持在线，等待下一个时段');credit-=PERIOD_MS;}
  try{state=applyAction(state,action);}catch(e){throw new HttpError(422,'ACTION_REJECTED',e.message);}
  if(action.type==='restart'||state.gameOver){active=false;credit=0;speed=1;}
 }
 if(state.revision!==row.revision+1)throw new Error('Engine revision invariant failed');
 return {...row,state:JSON.stringify(state),revision:state.revision,name:state.name,members:state.members,days:state.day,started:action.type==='restart'?0:action.type==='rename'?1:row.started,speed,active:Number(active),credit_ms:credit,last_seen:now};
}
