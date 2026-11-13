import test from 'node:test';
import assert from 'node:assert/strict';
import {ACHIEVEMENTS,earnedAchievements} from '../src/achievements.mjs';
import {createChallengeGame} from '../src/engine.mjs';

test('eight state achievements use inclusive thresholds and do not unlock at creation',()=>{
 assert.equal(ACHIEVEMENTS.length,8);
 assert.deepEqual(earnedAchievements(createChallengeGame()),[]);
 for(const achievement of ACHIEVEMENTS){
  assert.ok(!earnedAchievements({...createChallengeGame(),[achievement.metric]:achievement.threshold-1}).includes(achievement));
  assert.ok(earnedAchievements({...createChallengeGame(),[achievement.metric]:achievement.threshold}).includes(achievement));
 }
});
