import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createGame,createChallengeGame,applyAction,validateState,migrateState,activityStatus,BUILDING_ACTIVITIES,operatingForecast} from '../src/engine.mjs';
import {lifeOf,RESIDENTS,PROJECT_DAYS,communityProgress,communityGoals,residentStatus,buildingMastery,activityBenefits} from '../src/community-life.mjs';
import {earnedAchievements} from '../src/achievements.mjs';
import {goalsMarkup,storyMarkup,financeMarkup,residentsMarkup,reviewsMarkup,specialtyMarkup} from '../src/life-ui.mjs';
import {getSceneActors} from '../src/world.mjs';
import {createStore} from '../server/store.mjs';
import {identityKey,validateInput} from '../server/protocol.mjs';
const ready=patch=>({...createGame('成长小站',412),members:120,communityLevel:5,serverId:'block',cash:10000,registration:'closed',...patch});
const tick=s=>applyAction(s,{type:'tick',periods:1});
const until=(s,day)=>{while(s.day<day&&!s.gameOver)s=tick(s);return s;};
const activity=(s,id)=>applyAction(s,{type:'activity',activityId:id});
const story=(s,id,optionId)=>applyAction(s,{type:'story',residentId:id,optionId});

test('old snapshots stay exact and new growth extends through all server tiers',()=>{
 const old=ready(),before=structuredClone(old);assert.deepEqual(migrateState(old),old);assert.equal(Object.hasOwn(old,'life'),false);
 communityGoals(old);lifeOf(old);residentStatus(old,'he');assert.deepEqual(old,before);
 for(const [members,level] of [[120,5],[249,5],[250,6],[500,7],[1000,8],[1500,9]])assert.equal(communityProgress(ready({members,serverId:'city'})).level,level);
 const peak=applyAction(ready({members:1000,serverId:'city'}),{type:'rename',name:'千人站'});
 assert.equal(communityProgress({...peak,members:5,history:[]}).level,8);
 assert.ok(communityGoals(peak).some(goal=>goal.target===1500));
});
for(const [id,days] of Object.entries(PROJECT_DAYS))test(id+' settles once on the game clock and not at start',()=>{
 const definition=BUILDING_ACTIVITIES.find(v=>v.id===id),initial=ready(),started=activity(initial,id);
 assert.equal(started.cash,initial.cash-definition.cost);assert.equal(started.mood,initial.mood);assert.equal(started.content,initial.content);
 assert.equal(lifeOf(started).completed[id],undefined);assert.equal(activityStatus(started,definition.building).project.stage,'筹备中');
 const preparing=until(started,days-1);assert.equal(activityStatus(preparing,definition.building).project.stage,'举办中');
 const baseline=until({...initial,cash:initial.cash-definition.cost},days),completed=until(preparing,days);
 assert.equal(completed.life.completed[id],1);assert.equal(completed.life.projects[definition.building],undefined);
 assert.equal(completed.cash,baseline.cash);assert.equal(completed.content,Math.min(100,baseline.content+definition.rewards.content));assert.equal(completed.mood,Math.min(100,baseline.mood+definition.rewards.mood));
 assert.equal(completed.members,baseline.members);assert.match(completed.logs.at(-1).text,/已完成/);
 assert.equal(until(completed,days+1).life.completed[id],1);assert.throws(()=>activity(completed,id),/等待/);
 assert.equal(validateState(completed),true);assert.deepEqual(migrateState(preparing),preparing);
});
test('project completion respects the latest registration, invitation quota and capacity',()=>{
 let s=activity(ready({members:20,serverId:'nest',registration:'open'}),'benefits-badge-draw');
 s=applyAction(s,{type:'registration',value:'closed'});s=until(s,2);assert.equal(s.members,20);assert.match(s.logs.at(-1).text,/实际入站 0/);
 for(const patch of [{registration:'invite',members:20,serverId:'nest'},{registration:'open',members:60,serverId:'nest'}]){
  const n=until(activity(ready(patch),'benefits-badge-draw'),2);
  assert.ok(n.members<=60);if(patch.registration==='invite')assert.ok(n.admissionsToday<=2);
  assert.equal(validateState(n),true);
 }
});
test('lease expiry wins over same-day project rewards, and restarting does not keep unfinished work',()=>{
 const initial=ready({serverDaysRemaining:2,serverPeriodsRemaining:6});
 const ended=until(activity(initial,'benefits-badge-draw'),2);assert.equal(ended.gameOver,true);
 assert.equal(ended.life.completed['benefits-badge-draw'],undefined);assert.equal(activityStatus(ended,'benefits').project.stage,'已中止');assert.equal(validateState(ended),true);
 assert.match(storyMarkup(ended,'he'),/本局已结束/);assert.match(reviewsMarkup(ended),/本局已结束/);assert.match(specialtyMarkup(ended),/本局已结束/);
 const fresh=applyAction(ended,{type:'restart',confirmed:true});assert.equal(fresh.life,undefined);assert.equal(communityProgress(fresh).level,1);
});
test('all resident stories enforce stage, cost and wait, remember choices and unlock real perks',()=>{
 let s=ready();
 for(const resident of RESIDENTS){
  assert.throws(()=>story(createGame(),resident.id,resident.steps[0].options[0].id),/社区 Lv/);
  for(let step=0;step<3;step++){
   const status=residentStatus(s,resident.id),option=status.options[0],before=structuredClone(s);
   assert.throws(()=>story(s,resident.id,'forged'));assert.deepEqual(s,before);
   if(option.cost)assert.throws(()=>story({...s,cash:0},resident.id,option.id),/星币不足/);
   s=story(s,resident.id,option.id);assert.equal(s.life.stories[resident.id].choices.length,step+1);
   assert.ok(residentStatus(s,resident.id).memory.includes(option.label));assert.equal(validateState(s),true);
   if(step<2){assert.throws(()=>story(s,resident.id,resident.steps[step+1].options[0].id),/2 天/);s=until(s,s.day+2);}
  }
  assert.equal(residentStatus(s,resident.id).complete,true);assert.throws(()=>story(s,resident.id,'anything'),/已完成/);
 }
 assert.equal(activityBenefits(s,BUILDING_ACTIVITIES[0]).rewards.mood,4);
 assert.equal(activityBenefits(s,BUILDING_ACTIVITIES[3]).rewards.content,8);assert.equal(activityBenefits(s,BUILDING_ACTIVITIES[3]).cost,8);
 assert.ok(earnedAchievements(s).some(a=>a.id==='resource-repair'));assert.ok(earnedAchievements(s).some(a=>a.id==='all-stories'));
});
test('earlier choices change the follow-up and final outcome',()=>{
 const start=ready();
 let a=story(start,'juan','repair'),b=story(start,'juan','index');
 assert.notEqual(residentStatus(a,'juan').text,residentStatus(b,'juan').text);
 a=story(until(a,2),'juan','archive');b=story(until(b,2),'juan','archive');
 const optionA=residentStatus(until(a,4),'juan').options[0],optionB=residentStatus(until(b,4),'juan').options[0];
 assert.equal(optionA.rewards.content,optionB.rewards.content+2);assert.equal(optionB.rewards.mood,optionA.rewards.mood+1);
});
test('specialties require level five, are fixed for the run and affect the real daily settlement',()=>{
 assert.throws(()=>applyAction(createGame(),{type:'specialty',specialtyId:'care'}),/Lv.5/);
 for(const id of ['welcome','knowledge','care']){
  const base=ready({registration:'open'}),chosen=applyAction(base,{type:'specialty',specialtyId:id});
  assert.equal(chosen.cash,base.cash);assert.throws(()=>applyAction(chosen,{type:'specialty',specialtyId:'care'}),/已确定/);
  const before=until(base,1),after=until(chosen,1),field={welcome:'members',knowledge:'content',care:'mood'}[id];
  assert.equal(after[field],before[field]+1);assert.equal(validateState(after),true);
 }
});
test('building mastery comes from completed work and boosts the preview and earned rewards',()=>{
 let s=applyAction(ready(),{type:'renew',months:3});
 for(let i=0;i<8;i++){s=until(s,i*7);s=activity(s,'resources-software');}
 assert.deepEqual(buildingMastery(s,'resources'),{count:8,level:3,next:null});
 assert.equal(activityStatus(s,'resources').activities[0].rewards.content,6);
 const next=until(s,56),before={...next,content:10};
 assert.equal(activity(before,'resources-software').content,16);
});
test('monthly honors are evaluated at day boundaries only and never duplicated',()=>{
 let s=applyAction(ready({members:500,serverId:'town',mood:90,content:90}),{type:'renew',months:3});
 s=until(s,29);assert.deepEqual(lifeOf(s).awards,[]);
 s=until(s,30);assert.deepEqual(s.life.awards,['warm','library','city']);assert.ok(earnedAchievements(s).some(a=>a.id==='first-award'));
 s=until(s,60);assert.deepEqual(s.life.awards,['warm','library','city']);assert.equal(validateState(s),true);
});
test('life state rejects invented rewards, invalid choices, future dates and inconsistent projects',()=>{
 const valid=activity(ready(),'resources-course');assert.equal(validateState(valid),true);
 for(const mutate of [life=>life.cash=1,life=>life.completed.fake=1,life=>life.completed['resources-course']=-1,life=>life.specialty='fake',life=>life.awards=['warm','warm'],life=>life.stories.he={choices:['fake'],day:0},life=>life.stories.he={choices:['mediate'],day:1},life=>life.projects.resources.startedDay=1,life=>life.projects.resources.rewards={cash:999},life=>life.projects.benefits={activityId:'resources-course',startedDay:0}]){
  const bad=structuredClone(valid);mutate(bad.life);assert.equal(validateState(bad),false);assert.throws(()=>migrateState(bad));
 }
});
test('economic previews include rent amortization and do not imply immediate sponsor receipts',()=>{
 const s=ready({members:60,patrons:3,serverId:'nest',difficulty:'challenge'}),before=structuredClone(s);
 const old=operatingForecast(s),next=operatingForecast(s,'block');assert.equal(old.maintenance,31);assert.equal(old.rent,8);assert.equal(next.maintenance,36);assert.equal(next.rent,18);assert.equal(next.net,300/7-54);
 assert.match(financeMarkup(s,'block'),/−11.1|\-11.1/);assert.match(financeMarkup(s),/不会每日再扣/);assert.deepEqual(s,before);
});
test('life panels expose real goals, locks, story choices and earned honors; actors grow without mutating saves',()=>{
 const start=createGame(),high=ready({members:1000,serverId:'city',communityLevel:8}),before=structuredClone(high);
 assert.match(goalsMarkup(start),/迎接第一位佬友/);assert.match(storyMarkup(start,'juan'),/Lv.3 相遇/);
 assert.match(storyMarkup(high,'juan'),/data-story-option="repair"/);assert.match(residentsMarkup(high),/小禾|阿卷|阿策/);assert.match(reviewsMarkup(high),/月度|评选/);
 const lowActors=getSceneActors(ready({members:30}),0,true),highActors=getSceneActors(high,0,true);
 assert.ok(highActors.filter(a=>a.role==='member').length>lowActors.filter(a=>a.role==='member').length);
 assert.equal(highActors.filter(a=>a.role==='resident').length,3);assert.deepEqual(high,before);
});
test('SQLite persists projects and stories, rejects forged actions and settles once after trusted ticks',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'community-life-')),path=join(directory,'state.sqlite'),identity={channel:'shared',iss:'https://life.test',sub:'1'};let now=100000,n=0,store=createStore(path,'shared',{now:()=>now});const db=new DatabaseSync(path);
 const act=async action=>store.act(identity,{revision:(await store.get(identity)).revision,idempotencyKey:'life-operation-'+String(++n).padStart(10,'0'),action});
 try{
  await store.get(identity);const state={...createChallengeGame(),...ready(),difficulty:'challenge'};db.prepare('UPDATE players SET state=?,members=? WHERE identity=?').run(JSON.stringify(state),state.members,identityKey(identity));
  for(const action of [{type:'story',residentId:'he',optionId:'mediate',cash:500},{type:'specialty',specialtyId:'care',rewards:{mood:10}},{type:'complete-project',building:'resources'}])assert.throws(()=>validateInput({revision:0,idempotencyKey:'bad-action-operation',action}));
  await act({type:'activity',activityId:'resources-repository'});const request={revision:1,idempotencyKey:'life-stable-story-operation',action:{type:'story',residentId:'he',optionId:'mediate'}};
  const accepted=await store.act(identity,request);assert.deepEqual(await store.act(identity,request),accepted);
  store.close();now+=100000;store=createStore(path,'shared',{now:()=>now});assert.deepEqual((await store.get(identity)).state.life,accepted.state.life);
  await act({type:'speed',value:4});await act({type:'heartbeat',active:true});
  for(let phase=0;phase<6;phase++){for(let i=0;i<3;i++){now+=2000;await act({type:'heartbeat',active:true});}await act({type:'tick',periods:1});}
  const result=await store.get(identity);assert.equal(result.state.day,2);assert.equal(result.state.life.completed['resources-repository'],1);assert.equal(result.state.life.projects.resources,undefined);assert.ok(result.achievements.some(a=>a.id==='first-activity'));
  const restarted=await act({type:'restart',confirmed:true});assert.equal(restarted.state.life,undefined);assert.deepEqual(restarted.backup.state.life,result.state.life);assert.ok(restarted.achievements.some(a=>a.id==='first-activity'));
 }finally{db.close();store.close();rmSync(directory,{recursive:true,force:true});}
});
