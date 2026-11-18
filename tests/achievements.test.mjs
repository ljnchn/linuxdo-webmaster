import test from 'node:test';
import assert from 'node:assert/strict';
import {ACHIEVEMENTS,earnedAchievements} from '../src/achievements.mjs';
import {createChallengeGame} from '../src/engine.mjs';

test('all museum exhibits start locked and preserve inclusive thresholds',()=>{
 assert.equal(ACHIEVEMENTS.length,31);
 assert.deepEqual(earnedAchievements(createChallengeGame()),[]);
 for(const achievement of ACHIEVEMENTS.filter(a=>['members','day','cash'].includes(a.metric))){
  assert.ok(!earnedAchievements({...createChallengeGame(),[achievement.metric]:achievement.threshold-1}).includes(achievement));
  assert.ok(earnedAchievements({...createChallengeGame(),[achievement.metric]:achievement.threshold}).includes(achievement));
 }
});

test('each collection tier uses its own inclusive boundary and the historical population survives a decline',()=>{
 const state=createChallengeGame();
 const ids=track=>earnedAchievements(state).filter(item=>item.track===track).map(item=>item.badge);
 state.life={completed:{},projects:{},stories:{},specialty:null,awards:[]};
 for(const [track,steps,update] of [
  ['growth',[[24,25],[450,26],[20000,27]],n=>{state.members=n;}],
  ['activity',[[2,28],[8,29],[24,30]],n=>{state.life.completed['benefits-free-list']=Math.floor(n/2);state.life.completed['resources-software']=Math.ceil(n/2);}],
  ['story',[[1,6],[4,7],[9,8]],n=>{state.life.stories=Object.fromEntries(['he','juan','ce'].map((id,i)=>[id,{choices:Array(Math.max(0,Math.min(3,n-i*3))).fill('choice')}]).filter(([,s])=>s.choices.length));}],
 ]){
  const earned=[];
  for(const [threshold,id] of steps){
   update(threshold-1);assert.deepEqual(ids(track),earned);
   update(threshold);earned.push(id);assert.deepEqual(ids(track),earned);
  }
 }
 state.members=0;state.history=[];state.communityLevel=13;
 assert.deepEqual(ids('growth'),[25,26,27]);
});
