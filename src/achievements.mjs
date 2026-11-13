export const ACHIEVEMENTS = Object.freeze([
  {id:'first-member',name:'首位佬友',description:'社区拥有至少 1 位佬友。',metric:'members',threshold:1},
  {id:'ten-members',name:'初聚十人',description:'社区拥有至少 10 位佬友。',metric:'members',threshold:10},
  {id:'hundred-members',name:'百人小站',description:'社区拥有至少 100 位佬友。',metric:'members',threshold:100},
  {id:'thousand-members',name:'千人社区',description:'社区拥有至少 1000 位佬友。',metric:'members',threshold:1000},
  {id:'seven-days',name:'运营满七天',description:'本局持续运营至少 7 天。',metric:'day',threshold:7},
  {id:'thirty-days',name:'运营满三十天',description:'本局持续运营至少 30 天。',metric:'day',threshold:30},
  {id:'hundred-days',name:'运营满百天',description:'本局持续运营至少 100 天。',metric:'day',threshold:100},
  {id:'ten-thousand-coins',name:'万币家底',description:'社区资金达到 10000 星币。',metric:'cash',threshold:10000},
].map(Object.freeze));

export function earnedAchievements(state) {
  return ACHIEVEMENTS.filter(achievement=>state[achievement.metric]>=achievement.threshold);
}
