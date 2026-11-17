import {lifeOf} from './community-life.mjs';
export const ACHIEVEMENTS = Object.freeze([
  {id:'first-member',name:'首位佬友',description:'第一位佬友推门进来。',metric:'members',threshold:1},
  {id:'ten-members',name:'初聚十人',description:'社区凑够 10 位佬友，终于能开一桌了。',metric:'members',threshold:10},
  {id:'hundred-members',name:'百人小站',description:'社区规模破百，帖子开始有人回。',metric:'members',threshold:100},
  {id:'thousand-members',name:'千人社区',description:'千人同站，服务器开始冒烟。',metric:'members',threshold:1000},
  {id:'seven-days',name:'运营满七天',description:'连续运营 7 天，没有鸽。',metric:'day',threshold:7},
  {id:'thirty-days',name:'运营满三十天',description:'连续运营 30 天，站还亮着。',metric:'day',threshold:30},
  {id:'hundred-days',name:'运营满百天',description:'连续运营 100 天，熬成老站友。',metric:'day',threshold:100},
  {id:'ten-thousand-coins',name:'万刀家底',description:'小金库攒到 10000 刀。',metric:'cash',threshold:10000},
  {id:'first-activity',name:'开张大吉',description:'办成第一场社区活动。',metric:'activities',threshold:1},
  {id:'ten-activities',name:'街区常客',description:'累计办成 10 场社区活动。',metric:'activities',threshold:10},
  {id:'first-story',name:'并肩同行',description:'带出第一位社区骨干。',metric:'stories',threshold:1},
  {id:'resource-repair',name:'让分享继续',description:'陪神墨把资源修复故事走完。',metric:'resourceStory',threshold:1},
  {id:'all-stories',name:'小站有我们',description:'三位街区熟面孔都成了骨干。',metric:'stories',threshold:3},
  {id:'first-award',name:'月度之星',description:'拿下第一项月度荣誉。',metric:'awards',threshold:1},
].map(Object.freeze));

export function earnedAchievements(state) {
  const life=lifeOf(state),metrics={...state,activities:Object.values(life.completed).reduce((a,b)=>a+b,0),stories:Object.values(life.stories).filter(story=>story.choices.length===3).length,resourceStory:Number(life.stories.juan?.choices.length===3),awards:life.awards.length};
  return ACHIEVEMENTS.filter(achievement=>metrics[achievement.metric]>=achievement.threshold);
}
