import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,createChallengeGame,applyAction,validateState,migrateState,EVENTS,CHARACTER_ATTENTION_KINDS,RULES} from '../src/engine.mjs';

const addedIds=['newcomer-help','moderator-shift','broken-resource','experience-debate','promotion-spam','community-maintenance'];
const additions=EVENTS.filter(e=>addedIds.includes(e.id));
const expectedEffects={
  'newcomer-help':[[15,0,4,6],[0,0,5,-2]],
  'moderator-shift':[[20,0,8,3],[0,0,6,-3]],
  'broken-resource':[[25,0,3,12],[0,0,-1,6]],
  'experience-debate':[[0,0,-2,9],[0,0,5,3]],
  'promotion-spam':[[0,-1,7,2],[0,0,-2,5]],
  'community-maintenance':[[20,0,6,10],[0,0,-3,8]],
};
const tick=s=>applyAction(s,{type:'tick',periods:1});
const until=(s,day)=>{while(s.day<day&&!s.gameOver)s=tick(s);return s;};
const snapshot=(def,day=1)=>({id:`event-${def.category}-${day}`,kind:def.id,category:def.category,createdDay:day,expiresDay:day+6,title:def.title,description:def.description,options:structuredClone(def.options)});
const eventState=(def,patch={})=>({...createGame('佬友互助小站',123),day:1,nextEventDay:4,members:20,mood:50,content:50,events:[snapshot(def)],...patch});
const resolve=(s,op)=>applyAction(s,{type:'resolve',eventId:s.events[0].id,optionId:op.id});

test('six distinct community dilemmas expand the pool and expose presentation-only attention IDs',()=>{
  assert.deepEqual(additions.map(e=>e.id),addedIds);
  assert.deepEqual(CHARACTER_ATTENTION_KINDS,addedIds);
  assert.equal(Object.isFrozen(CHARACTER_ATTENTION_KINDS),true);
  assert.equal(EVENTS.filter(e=>e.category==='character').length,10);
  assert.equal(EVENTS.filter(e=>e.category==='world').length,10);
  assert.equal(new Set(EVENTS.map(e=>e.id)).size,EVENTS.length);
  assert.equal(EVENTS[0].id,'welcome');
  assert.equal(RULES.version,4);
  assert.equal(RULES.eventExpiryDays,6);
  assert.equal(RULES.worldCycleDays,12);
  assert.equal(RULES.sponsorCycleDays,7);
  assert.equal(RULES.sponsorExpiryDays,14);
  assert.equal(RULES.sponsorAmount,100);
  for(const def of additions){
    assert.equal(def.category,'character');
    assert.equal(Object.isFrozen(def),true);
    assert.match(def.description,/佬友/);
    assert.equal(def.options.length,2);
    assert.equal(new Set(def.options.map(o=>o.id)).size,2);
    assert.ok(def.options.some(o=>o.cost===0));
    assert.notDeepEqual(def.options[0].rewards,def.options[1].rewards);
    assert.equal('marker' in snapshot(def),false);
    for(const [index,op] of def.options.entries()){
      const {members,mood,content,cash,patrons}=op.rewards;
      assert.deepEqual([op.cost,members,mood,content],expectedEffects[def.id][index]);
      assert.equal(cash,0);assert.equal(patrons,0);
      assert.ok(Object.isFrozen(op));assert.ok(Object.isFrozen(op.rewards));
      if(op.cost)assert.ok(op.description.includes(`花 ${op.cost} 星币`));
      if(members<0)assert.ok(op.description.includes(`减少 ${-members} 位佬友`));
      for(const [label,value] of [['氛围',mood],['内容',content]])if(value)assert.ok(op.description.includes(`${label} ${value>0?'+':''}${value}`));
    }
  }
});

for(const def of additions){
  test(`${def.id}: exact choices apply once, preserve saves and remain free to resolve when broke`,()=>{
    for(const op of def.options){
      const state=eventState(def),original=structuredClone(state),next=resolve(state,op),r=op.rewards;
      assert.equal(next.cash,state.cash-op.cost);
      assert.equal(next.members,state.members+r.members);
      assert.equal(next.mood,state.mood+r.mood);
      assert.equal(next.content,state.content+r.content);
      assert.equal(next.patrons,0);assert.equal(next.admissionsToday,0);
      assert.equal(next.gameOver,false);assert.equal(next.serverDaysRemaining,state.serverDaysRemaining);
      assert.equal(next.events.length,0);assert.equal(next.revision,state.revision+1);
      assert.equal(next.rngState,state.rngState);assert.equal(validateState(next),true);
      assert.equal(next.logs.at(-1).text,`${def.title}：${op.label}。`);
      assert.deepEqual(state,original);
      assert.throws(()=>applyAction(next,{type:'resolve',eventId:state.events[0].id,optionId:op.id}),/不存在/);
      if(op.cost){
        const poor=eventState(def,{cash:op.cost-1}),copy=structuredClone(poor);
        assert.throws(()=>resolve(poor,op),/余额不足/);assert.deepEqual(poor,copy);
      }else{
        const broke=resolve(eventState(def,{cash:0}),op);
        assert.equal(broke.cash,0);assert.equal(broke.gameOver,false);
      }
    }
  });

  test(`${def.id}: effects clamp safely, respect patron cap and reject forged snapshots`,()=>{
    for(const op of def.options){
      for(const value of [0,100]){
        const state=eventState(def,{members:1,mood:value,content:value}),next=resolve(state,op);
        assert.ok(next.members>=0);
        assert.equal(next.mood,Math.max(0,Math.min(100,value+op.rewards.mood)));
        assert.equal(next.content,Math.max(0,Math.min(100,value+op.rewards.content)));
        assert.equal(validateState(next),true);assert.equal(next.gameOver,false);
      }
      const next=resolve(eventState(def,{patrons:1}),op);
      assert.ok(next.patrons<=Math.floor(next.members*.05));
      const forged=eventState(def);
      forged.events[0].options[0].rewards.cash=999;
      assert.equal(validateState(forged),false);
      assert.throws(()=>resolve(forged,op),/存档格式无效/);
    }
  });

  test(`${def.id}: pending event lasts six days and expires before it can be resolved again`,()=>{
    let state=eventState(def,{registration:'closed'});
    const id=state.events[0].id;
    state=until(state,6);state=tick(tick(state));
    assert.equal(state.day,6);assert.equal(state.timeSlot,2);
    assert.ok(state.events.some(e=>e.id===id));
    state=tick(state);
    assert.equal(state.day,7);assert.ok(!state.events.some(e=>e.id===id));
    assert.equal(validateState(state),true);
    assert.throws(()=>applyAction(state,{type:'resolve',eventId:id,optionId:def.options[0].id}),/不存在/);
  });
}

test('new events arise through the existing deterministic clock with unchanged two-to-five-day spacing',()=>{
  const seen=new Set();
  for(const seed of [1,17,123,20261110,7919,4294967295,987654321,23456789]){
    let state={...createGame('轮换互助站',seed),serverDaysRemaining:90,serverPeriodsRemaining:270};
    let previousDay=0;
    for(let day=1;day<=60;day++){
      state=until(state,day);
      const fresh=state.events.filter(e=>e.category==='character'&&e.createdDay===day);
      assert.ok(fresh.length<=1);
      if(fresh.length){
        if(previousDay)assert.ok(day-previousDay>=2&&day-previousDay<=5);
        else assert.equal(fresh[0].kind,'welcome');
        previousDay=day;
        seen.add(fresh[0].kind);
        assert.equal(fresh[0].expiresDay,day+6);
      }
      assert.equal(validateState(state),true);
      assert.equal(state.nextWorldEventDay,(Math.floor(day/12)+1)*12);
    }
    const repeated=until({...createGame('轮换互助站',seed),serverDaysRemaining:90,serverPeriodsRemaining:270},60);
    assert.deepEqual(state,repeated);
  }
  for(const id of addedIds)assert.ok(seen.has(id),`not generated: ${id}`);
});

test('an empty closed community never invents an existing-member request',()=>{
  let state={...createGame('空站',123),registration:'closed',serverDaysRemaining:90,serverPeriodsRemaining:270};
  for(let day=1;day<=60;day++){
    state=until(state,day);
    assert.equal(state.members,0);
    assert.ok(state.events.filter(e=>e.category==='character').every(e=>['welcome','patron'].includes(e.kind)));
  }
});

test('ignoring the new requests adds no hidden daily penalty or random ending',()=>{
  for(const def of additions){
    const base={...createChallengeGame('互助站',123),day:1,nextEventDay:5,members:20,registration:'closed',mood:50,content:50};
    const withRequest=until({...base,events:[snapshot(def)]},4),withoutRequest=until(base,4);
    for(const key of ['cash','members','patrons','mood','content','rngState','serverDaysRemaining','gameOver'])assert.equal(withRequest[key],withoutRequest[key],`${def.id}: ${key}`);
  }
});

// Independent pre-expansion snapshots, not assembled from current definitions.
const historicWelcome={id:'welcome',category:'character',title:'新成员加入',description:'新朋友敲响小站的大门，想在这里安家。入站遵守当前注册状态和容量。',options:[
  {id:'host',label:'举办欢迎会',description:'花 20 星币，尝试迎接 6 人，氛围 +8。',cost:20,rewards:{members:6,mood:8,content:0,cash:0,patrons:0}},
  {id:'greet',label:'亲自问好',description:'尝试迎接 2 人，氛围 +3。',cost:0,rewards:{members:2,mood:3,content:0,cash:0,patrons:0}},
]};
const currentWelcome={id:'welcome',category:'character',title:'佬友加入',description:'佬友敲响小站的大门，想在这里安家。入站遵守当前注册状态和容量。',options:[
  {id:'host',label:'举办欢迎会',description:'花 20 星币，尝试迎接 6 位佬友，氛围 +8。',cost:20,rewards:{members:6,mood:8,content:0,cash:0,patrons:0}},
  {id:'greet',label:'亲自问好',description:'尝试迎接 2 位佬友，氛围 +3。',cost:0,rewards:{members:2,mood:3,content:0,cash:0,patrons:0}},
]};

test('pre-expansion v4 and legacy v3 snapshots preserve progress, identity, event IDs and rewards',()=>{
  assert.deepEqual(EVENTS.find(e=>e.id==='welcome'),currentWelcome);
  for(const version of [3,4])for(const def of [historicWelcome,currentWelcome]){
    const source=eventState(def,{version,revision:47,cash:432,name:'自取的站名',slogan:'一起认真分享',timeSlot:2});
    if(version===3){delete source.serverDaysRemaining;source.serverPeriodsRemaining=71;}
    const original=structuredClone(source),loaded=migrateState(source);
    assert.deepEqual(source,original);assert.equal(validateState(loaded),true);
    for(const key of ['revision','cash','name','slogan','day','timeSlot','members','patrons','rngState','nextEventDay','nextWorldEventDay'])assert.equal(loaded[key],source[key]);
    assert.equal(loaded.events[0].id,source.events[0].id);
    assert.equal(loaded.events[0].expiresDay,source.events[0].expiresDay);
    assert.deepEqual(loaded.events[0].options.map(o=>o.rewards),source.events[0].options.map(o=>o.rewards));
    assert.equal(loaded.events[0].title,currentWelcome.title);
    assert.equal('buildingActivities' in loaded,false);
    assert.equal(loaded.serverDaysRemaining,version===3?24:30);
    assert.deepEqual(migrateState(loaded),loaded);
    const next=resolve(loaded,loaded.events[0].options[1]);
    assert.equal(next.members,source.members+2);assert.equal(next.mood,source.mood+3);
    assert.equal(next.cash,source.cash);assert.equal(next.revision,source.revision+1);
  }
});
