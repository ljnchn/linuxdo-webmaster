// Independent fixtures captured before the display-copy change. Do not derive
// these from current definitions: the whole old snapshot is the trust boundary.
const op=(id,label,description,cost,members=0,mood=0,content=0,cash=0,patrons=0)=>({id,label,description,cost,rewards:{members,mood,content,cash,patrons}});
export const oldEvents=[
 {id:'welcome',category:'character',title:'新成员加入',description:'新朋友敲响小站的大门，想在这里安家。入站遵守当前注册状态和容量。',options:[
  op('host','举办欢迎会','花 20 星币，尝试迎接 6 人，氛围 +8。',20,6,8),op('greet','亲自问好','尝试迎接 2 人，氛围 +3。',0,2,3)]},
 {id:'article',category:'character',title:'优秀文章产出',description:'成员写下了一篇用心的技术长文，大家等待站长推荐。',options:[
  op('support','奖励作者','花 25 星币，内容 +15、氛围 +6。',25,0,6,15),op('feature','置顶推荐','内容 +6，获得 15 星币感谢金。',0,0,0,6,15)]},
 {id:'patron',category:'character',title:'富可敌国入驻',description:'一位愿意长期支持社区的新朋友正在申请加入。只有容量、注册名额和 5% 上限均允许时才能入驻。',options:[
  op('welcome','欢迎赞助者','尝试迎接 1 位富可敌国成员，氛围 +3；不会立即发放赞助。',0,1,3,0,0,1),op('thanks','婉谢并致意','不增加成员，氛围 +2。',0,0,2)]},
 {id:'troublemaker',category:'character',title:'处理捣乱分子',description:'争论正在升温，成员们希望站长维护友善的交流环境。',options:[
  op('mediate','耐心调解','氛围 +5，内容 +2。',0,0,5,2),op('remove','请他离开','减少 1 位成员，氛围 +10。',0,-1,10)]},
 {id:'model',category:'world',title:'新模型发布',description:'虚构世界里的新一代开源模型发布了！技术圈热议不断，社区也迎来分享机会。',options:[
  op('workshop','组织体验工坊','花 30 星币，内容 +15，尝试吸引 8 位新成员。',30,8,2,15),op('digest','整理模型速报','内容 +8，尝试吸引 2 位新成员。',0,2,0,8)]},
];
