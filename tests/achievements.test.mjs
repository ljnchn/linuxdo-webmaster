import test from 'node:test';
import assert from 'node:assert/strict';
import {ACHIEVEMENTS,earnedAchievements} from '../src/achievements.mjs';
import {createChallengeGame} from '../src/engine.mjs';

test('fourteen achievements preserve old inclusive thresholds and do not unlock at creation',()=>{
 assert.equal(ACHIEVEMENTS.length,14);
 assert.deepEqual(earnedAchievements(createChallengeGame()),[]);
 for(const achievement of ACHIEVEMENTS.filter(a=>['members','day','cash'].includes(a.metric))){
  assert.ok(!earnedAchievements({...createChallengeGame(),[achievement.metric]:achievement.threshold-1}).includes(achievement));
  assert.ok(earnedAchievements({...createChallengeGame(),[achievement.metric]:achievement.threshold}).includes(achievement));
 }
});
