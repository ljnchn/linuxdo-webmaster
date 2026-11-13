import {lifeOf} from './community-life.mjs';
export const ACHIEVEMENTS = Object.freeze([
  {id:'first-member',name:'首位佬友',description:'社区拥有至少 1 位佬友。',metric:'members',threshold:1},
  {id:'ten-members',name:'初聚十人',description:'社区拥有至少 10 位佬友。',metric:'members',threshold:10},
  {id:'hundred-members',name:'百人小站',description:'社区拥有至少 100 位佬友。',metric:'members',threshold:100},
  {id:'thousand-members',name:'千人社区',description:'社区拥有至少 1000 位佬友。',metric:'members',threshold:1000},
  {id:'seven-days',name:'运营满七天',description:'本局持续运营至少 7 天。',metric:'day',threshold:7},
  {id:'thirty-days',name:'运营满三十天',description:'本局持续运营至少 30 天。',metric:'day',threshold:30},
  {id:'hundred-days',name:'运营满百天',description:'本局持续运营至少 100 天。',metric:'day',threshold:100},
  {id:'ten-thousand-coins',name:'万币家底',description:'社区资金达到 10000 星币。',metric:'cash',threshold:10000},
  {id:'first-activity',name:'街区初聚',description:'完成一次建筑活动。',metric:'activities',threshold:1},
  {id:'ten-activities',name:'街区常客',description:'完成十次建筑活动。',metric:'activities',threshold:10},
  {id:'first-story',name:'并肩同行',description:'培养首位社区骨干。',metric:'stories',threshold:1},
  {id:'resource-repair',name:'让分享继续',description:'完成阿卷的资源修复故事。',metric:'resourceStory',threshold:1},
  {id:'all-stories',name:'小站有我们',description:'三位佬友都成为社区骨干。',metric:'stories',threshold:3},
  {id:'first-award',name:'月度之星',description:'获得首项月度荣誉。',metric:'awards',threshold:1},
].map(Object.freeze));

export function earnedAchievements(state) {
  const life=lifeOf(state),metrics={...state,activities:Object.values(life.completed).reduce((a,b)=>a+b,0),stories:Object.values(life.stories).filter(story=>story.choices.length===3).length,resourceStory:Number(life.stories.juan?.choices.length===3),awards:life.awards.length};
  return ACHIEVEMENTS.filter(achievement=>metrics[achievement.metric]>=achievement.threshold);
}
