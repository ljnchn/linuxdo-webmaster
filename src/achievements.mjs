import {lifeOf,COMMUNITY_LEVELS,isMentor} from './community-life.mjs';
export const GALLERIES=Object.freeze([
  {id:'growth',name:'社区成长',metric:'peak',symbol:'users',unit:'位佬友',tiers:[
    [25,'推广者',24,'邀请一人加入论坛。'],[26,'活动家',450,'邀请三人并帮助他们达到基础用户等级。'],[27,'拥护者',20000,'邀请五人并帮助他们达到成员等级。'],
  ]},
  {id:'activity',name:'建筑活动',metric:'activities',symbol:'gift',unit:'场活动',tiers:[
    [28,'热门链接',2,'分享的外部链接获得 50 次点击。'],[29,'火热链接',8,'分享的外部链接获得 300 次点击。'],[30,'著名链接',24,'分享的外部链接获得 1,000 次点击。'],
  ]},
  {id:'story',name:'人物故事',metric:'chapters',symbol:'chat',unit:'章故事',tiers:[
    [6,'不错的回复',1,'一条回复获得 10 个赞。'],[7,'很棒的回复',4,'一条回复获得 25 个赞。'],[8,'精彩的回复',9,'一条回复获得 50 个赞。'],
  ]},
]);
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
  {id:'network-members',name:'万家灯火',description:'社区有了 10,000 位佬友。',metric:'members',threshold:10000},
  {id:'space-center',name:'轨道上线',description:'建成太空数据中心，进入无限模式。',metric:'orbit',threshold:1},
  // Forum references: https://linux.do/badges.json . Unlocks below belong to this game.
  ...GALLERIES.flatMap(gallery=>gallery.tiers.map(([badge,name,threshold,origin],index)=>({
    id:'ld-tier-'+badge,badge,name,threshold,origin,track:gallery.id,metric:gallery.metric,symbol:gallery.symbol,
    metal:['铜','银','金'][index],description:`${gallery.id==='growth'?'社区规模曾达到':'本局累计完成'} ${threshold.toLocaleString('zh-CN')} ${gallery.unit}。`,
  }))),
  {id:'ld-reader',name:'读者',description:'完成一次书籍共读。',metric:'books',threshold:1,badge:17,metal:'铜',symbol:'book',origin:'读完一个回复超过 100 条的话题。'},
  {id:'ld-lucky',name:'幸运佬',description:'办成一次社区徽章抽奖。',metric:'draws',threshold:1,badge:107,metal:'铜',symbol:'ticket',origin:'曾在论坛活动中中奖。'},
  {id:'ld-culture',name:'文化宣导员',description:'带出三位社区骨干。',metric:'stories',threshold:3,badge:115,metal:'银',symbol:'chat',origin:'社区文化活动的纪念徽章。'},
  ...[[121,'代码贡献者','铜',1],[122,'活跃代码贡献者','银',25],[123,'杰出代码贡献者','金',250]].map(([badge,name,metal,threshold])=>({
    id:'ld-commit-'+badge,name,metal,badge,threshold,metric:'repositories',symbol:'code',
    description:`本局累计完成 ${threshold} 次开源仓库共读。`,origin:`为社区开源项目贡献 ${threshold} 次提交。`,
  })),
].map(Object.freeze));

export function achievementMetrics(state) {
  const life=lifeOf(state),metrics={...state,activities:Object.values(life.completed).reduce((a,b)=>a+b,0),stories:Object.values(life.stories).filter(isMentor).length,resourceStory:Number(isMentor(life.stories.juan)),awards:life.awards.length};
  metrics.orbit=Number(state.serverId==='space');
  metrics.books=life.completed['resources-book']??0;
  metrics.draws=life.completed['benefits-badge-draw']??0;
  metrics.repositories=life.completed['resources-repository']??0;
  metrics.peak=Math.max(state.members,COMMUNITY_LEVELS[(state.communityLevel??1)-1].members,...(state.history??[]).map(day=>day.members));
  metrics.chapters=Object.values(life.stories).reduce((total,story)=>total+story.choices.length,0);
  return metrics;
}
export function earnedAchievements(state) {
  const metrics=achievementMetrics(state);
  return ACHIEVEMENTS.filter(achievement=>metrics[achievement.metric]>=achievement.threshold);
}
