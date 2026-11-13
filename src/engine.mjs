/** Shared, deterministic prototype rules. Ticks are supplied by the online clock, never wall time. */
export const RULES = Object.freeze({
  version: 4, prototype: true, periodsPerDay: 3, daysPerMonth: 30, secondsPerPeriod: 20,
  speeds: Object.freeze([1, 2, 4]), initialCash: 1000, initialMembers: 0,
  initialServerId: 'nest', initialMonths: 1, initialRegistration: 'open',
  monthOptions: Object.freeze([1, 2, 3]), patronRatio: .05, sponsorCycleDays: 7,
  sponsorExpiryDays: 14, sponsorAmount: 100, inviteDailyLimit: 2,
  eventExpiryDays: 6, worldCycleDays: 12, maxEvents: 8, buildingActivityCooldownDays: 7,
  explanation: '试玩平衡参数，非最终规则：一天 3 时段，每时段 20 秒，默认 1 分钟一天；服务器租期按整天扣减；30 天一月。开局预付 1 月。邀请注册由站长每天邀请最多 2 人；关闭注册阻止所有新增佬友入站。富可敌国上限为佬友数的 5% 向下取整，每 7 天产生 100 星币赞助，14 天后失效。世界事件每 12 天轮换；氛围与内容限 0–100，事件入站也受当前注册名额和容量限制。到期先于当日奖励结算。升级按未使用租期向下取整折抵。离线、后台与说明/管理弹窗暂停，主画面事件卡不暂停。',
});
export const SERVERS = Object.freeze([
  { id: 'nest', name: '小窝', spec: '1C1G', rent: 240, monthlyRent: 240, capacity: 60 },
  { id: 'block', name: '街区', spec: '2C2G', rent: 540, monthlyRent: 540, capacity: 180 },
  { id: 'town', name: '城镇', spec: '4C8G', rent: 1260, monthlyRent: 1260, capacity: 500 },
  { id: 'city', name: '都会', spec: '8C16G', rent: 2850, monthlyRent: 2850, capacity: 1500 },
].map(Object.freeze));
export const REGISTRATIONS = Object.freeze([
  { id: 'open', name: '开放注册', description: '佬友可自由加入，所有入站均受服务器容量限制。' },
  { id: 'invite', name: '邀请注册', description: '站长每天最多邀请 2 位佬友，事件入站也共用名额，0 位佬友也能起步。' },
  { id: 'closed', name: '关闭注册', description: '暂停所有佬友入站，已有佬友继续创作和赞助。' },
].map(Object.freeze));
export const STRATEGIES = Object.freeze([
  { id: 'balanced', name: '均衡运营', description: '兼顾佬友增长、氛围与内容。' },
  { id: 'growth', name: '热情迎新', description: '更多佬友，氛围与内容每天各消耗 1 点。' },
  { id: 'content', name: '深耕内容', description: '增长较慢，内容每天增加 3 点。' },
  { id: 'care', name: '友善维护', challengeOnly: true, description: '挑战模式：氛围每天 +2、内容 -2，增长减半。' },
].map(Object.freeze));
// Fictional, deterministic building activities. These prototype values are not
// real offers, paid prize draws, sponsorships, or user-confirmed final balance.
export const BUILDING_ACTIVITIES = Object.freeze([
  {id:'benefits-free-list',building:'benefits',name:'整理限免清单',description:'整理游戏内的虚构限免清单，分享省星币的小发现。',cost:0,rewards:{members:0,mood:3,content:2}},
  {id:'benefits-badge-draw',building:'benefits',name:'社区徽章抽奖',description:'使用游戏星币筹办免费的虚构徽章活动；氛围固定提升，尝试吸引 2 位佬友，无真实奖品或付费参与。',cost:15,rewards:{members:2,mood:7,content:0}},
  {id:'resources-software',building:'resources',name:'软件分享',description:'分享游戏内的虚构软件使用心得，积累社区内容。',cost:0,rewards:{members:0,mood:0,content:4}},
  {id:'resources-repository',building:'resources',name:'开源仓库共读',description:'用游戏星币筹备一次虚构开源项目共读，交流代码思路。',cost:10,rewards:{members:0,mood:1,content:7}},
  {id:'resources-course',building:'resources',name:'视频课程共学',description:'用游戏星币组织虚构视频课程共学，一起整理学习笔记。',cost:15,rewards:{members:0,mood:3,content:6}},
  {id:'resources-book',building:'resources',name:'书籍共读',description:'围绕虚构书目交流阅读心得，把收获留在社区。',cost:0,rewards:{members:0,mood:2,content:3}},
].map(activity=>Object.freeze({...activity,cooldownDays:RULES.buildingActivityCooldownDays,rewards:Object.freeze(activity.rewards)})));
const ACTIVITY_BUILDINGS = Object.freeze({benefits:'福利羊毛',resources:'资源荟萃'});
const option = (id, label, description, cost, members=0, mood=0, content=0, cash=0, patrons=0) => ({id,label,description,cost,rewards:{members,mood,content,cash,patrons}});
// Exact historical snapshots remain trusted only as a whole, including every reward.
// Never edit these definitions when updating player-facing copy.
const LEGACY_EVENTS = [
  { id: 'welcome', category: 'character', title: '新成员加入', description: '新朋友敲响小站的大门，想在这里安家。入站遵守当前注册状态和容量。', options: [
    option('host','举办欢迎会','花 20 星币，尝试迎接 6 人，氛围 +8。',20,6,8),
    option('greet','亲自问好','尝试迎接 2 人，氛围 +3。',0,2,3),
  ]},
  { id: 'article', category: 'character', title: '优秀文章产出', description: '成员写下了一篇用心的技术长文，大家等待站长推荐。', options: [
    option('support','奖励作者','花 25 星币，内容 +15、氛围 +6。',25,0,6,15),
    option('feature','置顶推荐','内容 +6，获得 15 星币感谢金。',0,0,0,6,15),
  ]},
  { id: 'patron', category: 'character', title: '富可敌国入驻', description: '一位愿意长期支持社区的新朋友正在申请加入。只有容量、注册名额和 5% 上限均允许时才能入驻。', options: [
    option('welcome','欢迎赞助者','尝试迎接 1 位富可敌国成员，氛围 +3；不会立即发放赞助。',0,1,3,0,0,1),
    option('thanks','婉谢并致意','不增加成员，氛围 +2。',0,0,2),
  ]},
  { id: 'troublemaker', category: 'character', title: '处理捣乱分子', description: '争论正在升温，成员们希望站长维护友善的交流环境。', options: [
    option('mediate','耐心调解','氛围 +5，内容 +2。',0,0,5,2),
    option('remove','请他离开','减少 1 位成员，氛围 +10。',0,-1,10),
  ]},
  { id: 'model', category: 'world', title: '新模型发布', description: '虚构世界里的新一代开源模型发布了！技术圈热议不断，社区也迎来分享机会。', options: [
    option('workshop','组织体验工坊','花 30 星币，内容 +15，尝试吸引 8 位新成员。',30,8,2,15),
    option('digest','整理模型速报','内容 +8，尝试吸引 2 位新成员。',0,2,0,8),
  ]},
];
export const EVENTS = [
  { id: 'welcome', category: 'character', title: '佬友加入', description: '佬友敲响小站的大门，想在这里安家。入站遵守当前注册状态和容量。', options: [
    option('host','举办欢迎会','花 20 星币，尝试迎接 6 位佬友，氛围 +8。',20,6,8),
    option('greet','亲自问好','尝试迎接 2 位佬友，氛围 +3。',0,2,3),
  ]},
  { id: 'article', category: 'character', title: '优秀文章产出', description: '佬友写下了一篇用心的技术长文，大家等待站长推荐。', options: [
    option('support','奖励作者','花 25 星币，内容 +15、氛围 +6。',25,0,6,15),
    option('feature','置顶推荐','内容 +6，获得 15 星币感谢金。',0,0,0,6,15),
  ]},
  { id: 'patron', category: 'character', title: '富可敌国入驻', description: '一位愿意长期支持社区的佬友正在申请加入。只有容量、注册名额和 5% 上限均允许时才能入驻。', options: [
    option('welcome','欢迎赞助者','尝试迎接 1 位富可敌国佬友，氛围 +3；不会立即发放赞助。',0,1,3,0,0,1),
    option('thanks','婉谢并致意','不增加佬友，氛围 +2。',0,0,2),
  ]},
  { id: 'troublemaker', category: 'character', title: '处理捣乱分子', description: '争论正在升温，佬友们希望站长维护友善的交流环境。', options: [
    option('mediate','耐心调解','氛围 +5，内容 +2。',0,0,5,2),
    option('remove','请他离开','减少 1 位佬友，氛围 +10。',0,-1,10),
  ]},
  { id: 'newcomer-help', category: 'character', title: '佬友求助', description: '刚到小站的佬友卡在配置步骤，贴出了报错。陪他一步步排查，还是整理一份大家都能用的入门指南？', options: [
    option('guide','整理入门指南','花 15 星币，氛围 +4、内容 +6。',15,0,4,6),
    option('walkthrough','耐心陪同排查','氛围 +5；暂缓整理文章，内容 -2。',0,0,5,-2),
  ]},
  { id: 'moderator-shift', category: 'character', title: '版主轮值求援', description: '热心佬友连着值了几天班，想休息一下。站长可以接班，也可以花些星币筹备轮值交接。', options: [
    option('handover','筹备轮值交接','花 20 星币，氛围 +8、内容 +3。',20,0,8,3),
    option('cover','站长亲自接班','氛围 +6；创作时间减少，内容 -3。',0,0,6,-3),
  ]},
  { id: 'broken-resource', category: 'character', title: '资源失效举报', description: '佬友发现收藏帖里的链接失效了。先标注并补上替代线索，或出资整理一份完整的资源索引？', options: [
    option('rebuild','重整资源索引','花 25 星币，氛围 +3、内容 +12。',25,0,3,12),
    option('flag','标注失效与替代线索','内容 +6；等待补全，氛围 -1。',0,0,-1,6),
  ]},
  { id: 'experience-debate', category: 'character', title: '经验帖起争论', description: '两位佬友分享了相反的使用经验。可以请大家补充复现过程，也可以先总结共识，让讨论平静下来。', options: [
    option('reproduce','邀请补充复现过程','内容 +9；讨论继续升温，氛围 -2。',0,0,-2,9),
    option('common-ground','整理共识并劝和','氛围 +5、内容 +3，暂不追究分歧。',0,0,5,3),
  ]},
  { id: 'promotion-spam', category: 'character', title: '促销帖刷屏', description: '一位佬友连续发了太多促销帖，正常交流被挤到后面。严格清理能恢复秩序，合并导读则能留下有用信息。', options: [
    option('remove','清理刷屏并请他离开','减少 1 位佬友，氛围 +7、内容 +2。',0,-1,7,2),
    option('merge','合并促销帖为导读','内容 +5；部分佬友仍有意见，氛围 -2。',0,0,-2,5),
  ]},
  { id: 'community-maintenance', category: 'character', title: '公益维护招募', description: '佬友们想一起修补标签、整理重复问题。站长可以提供整理工具，也可以组织一次慢慢来的志愿接力。', options: [
    option('tools','提供整理工具','花 20 星币，氛围 +6、内容 +10。',20,0,6,10),
    option('volunteer','组织志愿接力','内容 +8；整理有些辛苦，氛围 -3。',0,0,-3,8),
  ]},
  { id: 'model', category: 'world', title: '新模型发布', description: '虚构世界里的新一代开源模型发布了！技术圈热议不断，社区也迎来分享机会。', options: [
    option('workshop','组织体验工坊','花 30 星币，内容 +15、氛围 +2，尝试吸引 8 位佬友。',30,8,2,15),
    option('digest','整理模型速报','内容 +8，尝试吸引 2 位佬友。',0,2,0,8),
  ]},
  { id: 'mirror', category: 'world', title: '星环镜像站搬家', description: '虚构的星环开源镜像站开始迁移，下载变慢了。佬友们在等一条顺畅的路，你愿意为此出多少力？', options: [
    option('relay','搭建临时镜像','花 40 星币，内容 +10、氛围 +4，尝试吸引 4 位佬友。',40,4,4,10),
    option('guide','整理下载指南','内容 +6；等待下载让氛围 -2。',0,0,-2,6),
  ]},
  { id: 'archive', category: 'world', title: '云端旧书库告急', description: '虚构的云端旧书库即将下线，一批早期技术笔记等待抢救。是出资加快整理，还是请大家慢慢抄录？', options: [
    option('rescue','资助资料抢救','花 35 星币，内容 +18、氛围 +3。',35,0,3,18),
    option('transcribe','组织人工抄录','内容 +10；整理负担让氛围 -3。',0,0,-3,10),
  ]},
  { id: 'festival', category: 'world', title: '浮光街区灯会', description: '虚构的浮光街区发来灯会邀请。让小站热闹一晚，或留在站内接龙写故事，各有各的温度。', options: [
    option('lanterns','布置夜间灯会','花 25 星币，氛围 +12、内容 -3，尝试吸引 5 位佬友。',25,5,12,-3),
    option('stories','发起故事接龙','氛围 +5、内容 +6，不增加入站人数。',0,0,5,6),
  ]},
  { id: 'security', category: 'world', title: '纸盾安全演练', description: '虚构的纸盾技术社发起安全演练，佬友开始担心自己的设置。专业讲解更安心，自查清单则更省钱。', options: [
    option('speaker','邀请安全讲师','花 45 星币，内容 +12、氛围 +8。',45,0,8,12),
    option('checklist','发布自查清单','内容 +7；独自排查让氛围 -2。',0,0,-2,7),
  ]},
  { id: 'heatwave', category: 'world', title: '琉璃城热浪', description: '虚构的琉璃城连日高温，佬友们都想放慢脚步。添置散热设施保持交流，或把今天变成轻松的慢聊日？', options: [
    option('cooling','添置散热设施','花 35 星币，氛围 +10、内容 +2。',35,0,10,2),
    option('slowday','举办慢聊日','氛围 +6；暂停深度讨论，内容 -5。',0,0,6,-5),
  ]},
  { id: 'comet', category: 'world', title: '银尾彗星过境', description: '虚构的银尾彗星划过夜空，整个网络都在分享照片。小站可以办一场直播，也可以收集属于大家的观星文字。', options: [
    option('stargaze','直播观星夜','花 30 星币，氛围 +9，尝试吸引 6 位佬友。',30,6,9),
    option('essays','征集观星随笔','氛围 +3、内容 +8，不增加入站人数。',0,0,3,8),
  ]},
  { id: 'translation', category: 'world', title: '万叶手册开放共译', description: '虚构的万叶工具发布了厚厚的新手册，正在寻找共译社区。完整翻译更有影响力，精华导读则让大家轻松上手。', options: [
    option('translate','组织翻译接力','花 30 星币，内容 +16、氛围 -2，尝试吸引 3 位佬友。',30,3,-2,16),
    option('highlights','挑选精华导读','内容 +7、氛围 +3，不增加入站人数。',0,0,3,7),
  ]},
  { id: 'retro', category: 'world', title: '方盒旧机复兴', description: '虚构的方盒电脑重回大家的视野，旧照片和修机心得纷纷出现。办一场旧机展吸引同好，还是安静地整理回忆？', options: [
    option('exhibit','筹办旧机展','花 25 星币，氛围 +7、内容 +8，尝试吸引 4 位佬友。',25,4,7,8),
    option('scrapbook','整理数字回忆册','氛围 +3、内容 +7，不增加入站人数。',0,0,3,7),
  ]},
  { id: 'bazaar', category: 'world', title: '蒲公英创作集市', description: '虚构的蒲公英集市向小站开放摊位。公益分享能结识同好，售卖原创贴纸则能补贴运营，但会挤占交流与创作时间。', options: [
    option('sharing','开设公益摊位','花 20 星币，氛围 +6、内容 +3，尝试吸引 6 位佬友。',20,6,6,3),
    option('stickers','售卖原创贴纸','获得 35 星币；氛围 -4、内容 -2，不增加入站人数。',0,0,-4,-2,35),
  ]},
];
// Presentation-only attention metadata: keep it outside the trusted save snapshots.
// Existing troublemaker events retain their distinct warning appearance.
export const CHARACTER_ATTENTION_KINDS = Object.freeze([
  'newcomer-help','moderator-shift','broken-resource','experience-debate','promotion-spam','community-maintenance',
]);
for (const e of [...LEGACY_EVENTS,...EVENTS]) { for (const o of e.options) { Object.freeze(o.rewards); Object.freeze(o); } Object.freeze(e.options); Object.freeze(e); } Object.freeze(EVENTS); Object.freeze(LEGACY_EVENTS);
const TRUSTED_EVENTS = Object.freeze([...EVENTS,...LEGACY_EVENTS]);
const WORLD_EVENTS = Object.freeze(EVENTS.filter(e=>e.category==='world'));
const MAX = 1_000_000_000;
const MAX_DAY = MAX - 100;
const clone = value => JSON.parse(JSON.stringify(value));
// Call only after validating an entire saved state. Keep IDs, expiry, economy, and
// player-chosen names untouched; replace only trusted event presentation snapshots.
function refreshEventCopy(s) {
  s.events=s.events.map(e=>{const def=EVENTS.find(v=>v.id===e.kind);return {...e,title:def.title,description:def.description,options:clone(def.options)};});
  return s;
}
const int = (n, min=0, max=MAX) => Number.isSafeInteger(n) && n>=min && n<=max;
const str = (s,max=500) => typeof s==='string' && s.length>0 && s.length<=max;
const record = v => v!==null && typeof v==='object' && !Array.isArray(v);
const clamp = (n,low,high) => Math.min(high,Math.max(low,n));
const serverFor = s => SERVERS.find(v=>v.id===s.serverId);
const patronCap = s => Math.floor(s.members * RULES.patronRatio);
export const CHALLENGE = Object.freeze({
  maintenanceBase: Object.freeze({nest:1,block:3,town:8,city:20}),
  maintenancePerMember: Object.freeze({nest:.5,block:.55,town:.58,city:.6}), lowQuality:35, troubleGraceDays:2,
  strategies:Object.freeze({balanced:Object.freeze({mood:-1,content:-1,growth:1}),growth:Object.freeze({mood:-2,content:-2,growth:1.4}),content:Object.freeze({mood:-1,content:1,growth:.7}),care:Object.freeze({mood:2,content:-2,growth:.5})}),
});
const isChallenge=s=>s.difficulty==='challenge';
const maintenanceCost=s=>isChallenge(s)?CHALLENGE.maintenanceBase[s.serverId]+Math.floor(s.members*CHALLENGE.maintenancePerMember[s.serverId]):0;
const validSlogan=s=>typeof s==='string'&&s.length<=40;


function random(s) { let x=s.rngState>>>0; x^=x<<13; x^=x>>>17; x^=x<<5; s.rngState=x>>>0; return s.rngState/4294967296; }
function log(s,text,kind='info') { s.logs.push({id:`log-${s.revision+1}-${s.day}-${s.timeSlot}-${s.logs.length}-${s.rngState}`,day:s.day,text,kind});s.logs=s.logs.slice(-30); }
function capPatrons(s) { s.patrons=Math.min(s.patrons,patronCap(s)); }
function admit(s,count) {
  if (count<=0 || s.registration==='closed') return 0;
  const quota=s.registration==='invite'?Math.max(0,RULES.inviteDailyLimit-s.admissionsToday):MAX;
  const accepted=Math.max(0,Math.min(count,quota,serverFor(s).capacity-s.members));
  s.members+=accepted;s.admissionsToday+=accepted;return accepted;
}
function activityAdmissions(s,count) {
  // Reuse the same admission gate for forecasts and execution. The preview only
  // changes scalar fields on this detached object, never the player's save.
  const accepted=admit({...s},count),reasons=[];
  if(count>0){
    if(s.registration==='closed')reasons.push({code:'registration_closed',text:'当前关闭注册，暂停所有新增佬友入站'});
    else {
      const quota=Math.max(0,RULES.inviteDailyLimit-s.admissionsToday),capacity=serverFor(s).capacity-s.members;
      if(s.registration==='invite'&&quota<count)reasons.push({code:'invite_quota',text:quota===0?'今日邀请名额已用完':`今日邀请名额仅剩 ${quota} 位`});
      if(capacity<count)reasons.push({code:'capacity',text:capacity===0?'服务器容量已满':`服务器仅剩 ${capacity} 个空位`});
    }
  }
  return {expectedMembers:accepted,admissionReasons:reasons,admissionNote:count>0?`预计入站 ${accepted} 位佬友${reasons.length?`；${reasons.map(v=>v.text).join('；')}`:''}。`:''};
}
/** A read-only snapshot. expectedMembers forecasts admission gates, independently
 * of canRun; blockedReason explains why an activity itself cannot run. */
export function activityStatus(s,building) {
  if(!Object.hasOwn(ACTIVITY_BUILDINGS,building))throw new Error('请选择有效的活动建筑。');
  const lastUsedDay=s.buildingActivities?.[building]?.day??null;
  const nextAvailableDay=lastUsedDay===null?null:lastUsedDay+RULES.buildingActivityCooldownDays;
  const remainingDays=nextAvailableDay===null?0:Math.max(0,nextAvailableDay-s.day);
  const blockedReason=s.gameOver?'服务器已到期，本局结束。请重新开始。':s.members<1?'至少需要 1 位佬友才能开展活动。':remainingDays>0?`${ACTIVITY_BUILDINGS[building]}还需等待 ${remainingDays} 个游戏日，第 ${nextAvailableDay+1} 天可再次开展活动。`:null;
  const activities=BUILDING_ACTIVITIES.filter(v=>v.building===building).map(activity=>{
    const reason=blockedReason||(s.cash<activity.cost?`游戏星币不足：需要 ${activity.cost}，当前 ${s.cash}。`:null);
    return {...activity,canRun:!reason,blockedReason:reason,...activityAdmissions(s,activity.rewards.members)};
  });
  return {building,cooldownDays:RULES.buildingActivityCooldownDays,lastUsedDay,nextAvailableDay,remainingDays,canRun:activities.some(v=>v.canRun),blockedReason,activities};
}
function expire(s) {
  const previous=s.pendingSponsors.length;
  s.pendingSponsors=s.pendingSponsors.filter(v=>v.expiresDay>s.day);
  if(previous!==s.pendingSponsors.length) log(s,`${previous-s.pendingSponsors.length} 封未领取赞助已到期。`,'warning');
  s.events=s.events.filter(v=>v.expiresDay>s.day);
}
export function createGame(name='像素小站',seed=20261110) {
  if(typeof name!=='string'||!name.trim()||name.trim().length>24) throw new Error('小站名称须为 1–24 个字符。');
  if(!int(seed,1,4294967295)) throw new Error('种子必须为非零 32 位正整数。');
  return {version:RULES.version,revision:0,day:0,timeSlot:0,name:name.trim(),cash:RULES.initialCash-SERVERS[0].rent,members:0,patrons:0,serverId:'nest',serverDaysRemaining:RULES.daysPerMonth,serverPeriodsRemaining:RULES.daysPerMonth*RULES.periodsPerDay,gameOver:false,mood:75,content:55,strategy:'balanced',registration:'open',admissionsToday:0,nextEventDay:1,nextWorldEventDay:RULES.worldCycleDays,pendingSponsors:[],events:[],logs:[],seed,rngState:seed,history:[],migrationNotice:null};
}
export function createChallengeGame(name='LINUX DO',seed=20261110,slogan='Where possible begins.') {
  if(!validSlogan(slogan))throw new Error('社区标语须为 0–40 个字符。');
  return {...createGame(name,seed),difficulty:'challenge',slogan};
}
export function validateState(s) { return validateVersion(s,false); }
function validateVersion(s,legacy) {
  try {
    if(!record(s)||s.version!==(legacy?3:RULES.version)||!int(s.revision)||!int(s.day,0,MAX_DAY)||!int(s.timeSlot,0,2)||!str(s.name,24)||s.name!==s.name.trim()||!int(s.cash)||!int(s.members,0,1500)||!int(s.patrons,0,patronCap(s))||!int(s.mood,0,100)||!int(s.content,0,100)||!int(s.seed,1,4294967295)||!int(s.rngState,1,4294967295)) return false;
    if(Object.hasOwn(s,'difficulty')&&s.difficulty!=='challenge')return false;
    if(Object.hasOwn(s,'slogan')&&!validSlogan(s.slogan))return false;
    // Missing/null ledgers preserve old v4/v3 snapshots without adding fields.
    if(Object.hasOwn(s,'buildingActivities')&&s.buildingActivities!==null){
      if(!record(s.buildingActivities)||!Object.entries(s.buildingActivities).every(([building,entry])=>
        Object.hasOwn(ACTIVITY_BUILDINGS,building)&&record(entry)&&Object.keys(entry).sort().join(',')==='activityId,day'&&int(entry.day,0,s.day)&&BUILDING_ACTIVITIES.some(v=>v.id===entry.activityId&&v.building===building)
      ))return false;
    }
    if(s.strategy==='care'&&!isChallenge(s))return false;
    const server=serverFor(s);
    if(!legacy&&(!int(s.serverDaysRemaining,0,Math.floor(MAX/RULES.periodsPerDay))||s.serverPeriodsRemaining!==s.serverDaysRemaining*RULES.periodsPerDay))return false;
    if(!server||s.members>server.capacity||!int(s.serverPeriodsRemaining)||typeof s.gameOver!=='boolean'||s.gameOver!==(s.serverPeriodsRemaining===0)||!int(s.admissionsToday,0,1500)) return false;
    if(!REGISTRATIONS.some(v=>v.id===s.registration)||!STRATEGIES.some(v=>v.id===s.strategy)||!int(s.nextEventDay,s.day+1,s.day+5)||!int(s.nextWorldEventDay,s.day+1,s.day+RULES.worldCycleDays)||s.nextWorldEventDay%RULES.worldCycleDays!==0) return false;
    if(s.migrationNotice!==null&&!str(s.migrationNotice)) return false;
    if(!Array.isArray(s.pendingSponsors)||s.pendingSponsors.length>150||!Array.isArray(s.events)||s.events.length>RULES.maxEvents||!Array.isArray(s.logs)||s.logs.length>30||!Array.isArray(s.history)||s.history.length>40) return false;
    if(!s.pendingSponsors.every(v=>record(v)&&int(v.createdDay,7,s.day)&&v.createdDay%7===0&&v.expiresDay===v.createdDay+14&&v.expiresDay>s.day&&v.amount===RULES.sponsorAmount&&int(v.patron,1,75)&&v.id===`sponsor-${v.createdDay}-${v.patron}`)) return false;
    if(new Set(s.pendingSponsors.map(v=>v.id)).size!==s.pendingSponsors.length||new Set(s.events.map(v=>v.id)).size!==s.events.length) return false;
    if(!s.events.every(v=>{ if(!record(v))return false;return int(v.createdDay,1,s.day)&&v.expiresDay===v.createdDay+RULES.eventExpiryDays&&v.expiresDay>s.day&&TRUSTED_EVENTS.some(def=>v.kind===def.id&&v.id===`event-${def.category}-${v.createdDay}`&&v.category===def.category&&v.title===def.title&&v.description===def.description&&JSON.stringify(v.options)===JSON.stringify(def.options)); })) return false;
    if(!s.logs.every(v=>record(v)&&str(v.id,150)&&int(v.day,0,s.day)&&str(v.text)&&['info','success','warning','event'].includes(v.kind))) return false;
    if(!s.history.every((v,i,a)=>record(v)&&int(v.day,1,s.day)&&int(v.members,0,1500)&&int(v.cash)&&(!i||v.day>a[i-1].day))) return false;
    return true;
  } catch { return false; }
}
export function migrateState(state) {
  if(validateState(state))return refreshEventCopy(clone(state));
  if(validateVersion(state,true)) {
    const migrated=refreshEventCopy(clone(state));
    migrated.version=RULES.version;
    migrated.serverDaysRemaining=Math.ceil(state.serverPeriodsRemaining/RULES.periodsPerDay);
    migrated.serverPeriodsRemaining=migrated.serverDaysRemaining*RULES.periodsPerDay;
    migrated.migrationNotice='服务器租期已改为按天结算，旧存档不足一天的余量已向上补齐；已有进度和资产保留。';
    if(!validateState(migrated))throw new Error('存档格式无效，无法迁移。');
    return migrated;
  }
  // Legacy balances and events cannot safely be converted into the new economy. The caller
  // must retain the original blob as its backup; this function never mutates that blob.
  if(!record(state)||![1,2].includes(state.version)||!str(state.name,24)||!state.name.trim()||!int(state.seed,1,4294967295)||!int(state.cash)||!int(state.day)||!int(state.members,0,1500)||!int(state.patrons,0,Math.floor(state.members*.05))||!int(state.revision)||!int(state.rngState,1,4294967295)||!Array.isArray(state.events)||!Array.isArray(state.pendingSponsors))throw new Error('存档格式无效，无法迁移。');
  const fresh=createGame(state.name,state.seed);
  fresh.migrationNotice=`旧版 v${state.version} 存档不兼容新的按月经营规则，已开启独立新版试玩；旧数据请保留备份。`;
  return fresh;
}
export function summarize(s) {
  const server=serverFor(s);
  const challenge=isChallenge(s),pressureHints=[];
  if(challenge){
    pressureHints.push(`每日维护 ${maintenanceCost(s)} 星币（基础 ${CHALLENGE.maintenanceBase[s.serverId]} + 佬友数 × ${CHALLENGE.maintenancePerMember[s.serverId]} 向下取整），新增佬友次日起计费。`);
    if(s.cash<maintenanceCost(s)*7)pressureHints.push('余额不足七天维护费；及时领取赞助，减少付费活动或换用更小服务器。');
    if(s.mood<45)pressureHints.push('氛围偏低：切换友善维护，及时调解争论。');
    if(s.content<45)pressureHints.push('内容偏低：切换深耕内容，处理文章和世界事件。');
    if(s.events.some(e=>e.kind==='troublemaker'))pressureHints.push('捣乱事件出现满两天后，每个未处理事件每天氛围 -2；可免费调解。');
    if(Math.min(s.mood,s.content)<CHALLENGE.lowQuality)pressureHints.push('氛围或内容低于 35，每天流失约 2% 佬友，极低时 4%。');
  }
  return {difficulty:challenge?'challenge':'classic',maintenanceCost:maintenanceCost(s),maintenancePerMember:challenge?CHALLENGE.maintenancePerMember[s.serverId]:0,maintenanceBase:challenge?CHALLENGE.maintenanceBase[s.serverId]:0,pressureHints,strategyEffects:challenge?CHALLENGE.strategies[s.strategy]:null,server,rent:server.rent,monthlyRent:server.rent,capacity:server.capacity,load:s.members/server.capacity,runway:s.serverDaysRemaining,serverDaysRemaining:s.serverDaysRemaining,serverPeriodsRemainder:0,serverPeriodsRemaining:s.serverPeriodsRemaining,timeSlot:s.timeSlot,gameOver:s.gameOver,nextSponsorDay:(Math.floor(s.day/7)+1)*7,sponsorTotal:s.pendingSponsors.reduce((n,v)=>n+v.amount,0),patronCap:patronCap(s),elapsedPeriods:s.day*3+s.timeSlot,registration:s.registration,inviteRemaining:Math.max(0,RULES.inviteDailyLimit-s.admissionsToday),score:s.day*3+s.timeSlot};
}
function addEvent(s,def) {
  if(s.events.length>=RULES.maxEvents)return;
  s.events.push({id:`event-${def.category}-${s.day}`,kind:def.id,category:def.category,createdDay:s.day,expiresDay:s.day+RULES.eventExpiryDays,title:def.title,description:def.description,options:clone(def.options)});
  log(s,`${def.category==='world'?'世界':'人物'}事件：${def.title}`,'event');
}
function settleDay(s) {
  s.admissionsToday=0;
  const challenge=isChallenge(s);
  if(challenge){
    const cost=maintenanceCost(s),paid=Math.min(s.cash,cost);s.cash-=paid;
    if(paid<cost){s.mood=clamp(s.mood-3,0,100);log(s,`维护费 ${cost} 星币，仅支付 ${paid}；服务受影响，氛围 -3。`,'warning');}
    const trouble=s.events.filter(e=>e.kind==='troublemaker'&&s.day-e.createdDay>=CHALLENGE.troubleGraceDays).length;
    if(trouble){s.mood=clamp(s.mood-trouble*2,0,100);log(s,'未处理的争论影响氛围，请及时免费调解。','warning');}
    const low=Math.min(s.mood,s.content);
    if(low<CHALLENGE.lowQuality&&s.members){const loss=Math.min(s.members,Math.max(1,Math.ceil(s.members*(low<15?.04:.02))));s.members-=loss;log(s,`社区质量偏低，${loss} 位佬友离开。`,'warning');}
  }
  const quality=(s.mood+s.content)/200;
  const growth=Math.max(1,Math.floor((2+random(s)*4)*(.65+quality)*(challenge?CHALLENGE.strategies[s.strategy].growth:(s.strategy==='growth'?1.4:s.strategy==='content'?.7:1))*(challenge?(.35+.65*quality):1)));
  const admitted=admit(s,growth);
  s.mood=clamp(s.mood+(challenge?CHALLENGE.strategies[s.strategy].mood:(s.strategy==='growth'?-1:1)),0,100);
  s.content=clamp(s.content+(challenge?CHALLENGE.strategies[s.strategy].content:(s.strategy==='content'?3:s.strategy==='growth'?-1:1)),0,100);
  capPatrons(s);
  // Classic: a new arrival may be a patron. Challenge: an existing member may also
  // become a patron, so a full server cannot permanently lock out sponsorship.
  if((challenge?s.members>0:admitted>0)&&s.patrons<patronCap(s)&&random(s)<(challenge?.35*quality:.65))s.patrons++;
  if(s.day%RULES.sponsorCycleDays===0&&s.patrons) {
    for(let i=1;i<=s.patrons;i++)s.pendingSponsors.push({id:`sponsor-${s.day}-${i}`,createdDay:s.day,expiresDay:s.day+RULES.sponsorExpiryDays,amount:RULES.sponsorAmount,patron:i});
    log(s,`收到 ${s.patrons} 封赞助，请在第 ${s.day+RULES.sponsorExpiryDays} 天前领取。`,'success');
  }
  if(s.day===s.nextEventDay) {
    const pool=EVENTS.filter(e=>e.category==='character'&&(s.members>0||['welcome','patron'].includes(e.id)));
    addEvent(s,s.day===1?EVENTS[0]:pool[Math.floor(random(s)*pool.length)]);
    s.nextEventDay=s.day+2+Math.floor(random(s)*4);
  }
  // Rotation is based on the existing clock, not RNG, so growth and character rolls stay unchanged.
  if(s.day===s.nextWorldEventDay){const cycle=s.day/RULES.worldCycleDays-1;addEvent(s,WORLD_EVENTS[cycle%WORLD_EVENTS.length]);s.nextWorldEventDay+=RULES.worldCycleDays;}
  s.history.push({day:s.day,members:s.members,cash:s.cash});s.history=s.history.slice(-40);
}
export function applyAction(state,action) {
  if(!validateState(state))throw new Error('存档格式无效。');
  if(!record(action)||typeof action.type!=='string')throw new Error('操作格式无效。');
  const s=refreshEventCopy(clone(state));
  if(s.revision>=MAX||s.day>=MAX_DAY)throw new Error('已达到存档进度上限。');
  if(s.gameOver&&action.type!=='restart')throw new Error('服务器已到期，本局结束。请重新开始。');
  switch(action.type) {
    case 'restart': {
      if(!s.gameOver&&action.confirmed!==true)throw new Error('重新开始会清空本局进度，请先确认。');
      const fresh=createChallengeGame(s.name,((s.seed+2654435761)>>>0)||1,s.slogan??'');fresh.revision=s.revision+1;return fresh;
    }
    case 'rent': {
      const server=SERVERS.find(v=>v.id===action.serverId);
      if(!server)throw new Error('请选择有效的服务器。');
      if(server.id===s.serverId)throw new Error('当前已使用该服务器，请选择续租。');
      if(server.capacity<s.members)throw new Error('该服务器容量不足以容纳现有佬友。');
      const months=action.months===undefined?1:action.months;
      if(!RULES.monthOptions.includes(months)||Object.hasOwn(action,'days'))throw new Error('租期只能选择 1、2 或 3 个月。');
      const credit=Math.floor(serverFor(s).rent*s.serverDaysRemaining/RULES.daysPerMonth);
      const price=server.rent*months;
      if(s.cash+credit<price)throw new Error('余额不足以预付所选租期。');
      s.cash+=credit-price;s.serverId=server.id;s.serverDaysRemaining=months*RULES.daysPerMonth;
      log(s,`租用 ${server.spec} ${months} 个月，费用 ${price}，未使用租期折抵 ${credit} 星币。`,'success');break;
    }
    case 'renew': {
      if(!RULES.monthOptions.includes(action.months)||Object.hasOwn(action,'days'))throw new Error('续租只能选择 1、2 或 3 个月。');
      const price=serverFor(s).rent*action.months;
      if(s.cash<price)throw new Error('余额不足以续租。');
      s.cash-=price;s.serverDaysRemaining+=action.months*RULES.daysPerMonth;
      log(s,`续租 ${action.months} 个月，支付 ${price} 星币。`,'success');break;
    }
    case 'tick': {
      if(action.periods!==1||Object.hasOwn(action,'days'))throw new Error('自动时钟每次只能结算一个时段。');
      s.timeSlot=(s.timeSlot+1)%RULES.periodsPerDay;
      if(s.timeSlot===0){s.day++;s.serverDaysRemaining--;expire(s);}
      if(s.serverDaysRemaining===0){
        s.gameOver=true;
        // Lease expiry wins over growth, sponsors and events on the same boundary.
        if(s.nextEventDay<=s.day)s.nextEventDay=s.day+2;
        if(s.nextWorldEventDay<=s.day)s.nextWorldEventDay+=RULES.worldCycleDays;
        log(s,'服务器租期已到期，本局结束。','warning');
      }else if(s.timeSlot===0)settleDay(s);
      break;
    }
    case 'claim': {
      const selected=s.pendingSponsors.filter(v=>action.id==='all'||v.id===action.id);
      if(!selected.length)throw new Error('没有可领取的赞助，或该信封已领取/到期。');
      const ids=new Set(selected.map(v=>v.id));const total=selected.reduce((n,v)=>n+v.amount,0);
      s.cash+=total;s.pendingSponsors=s.pendingSponsors.filter(v=>!ids.has(v.id));
      log(s,`领取 ${selected.length} 封赞助，获得 ${total} 星币。`,'success');break;
    }
    case 'activity': {
      if(Object.keys(action).sort().join(',')!=='activityId,type')throw new Error('活动操作只能指定活动编号。');
      const definition=BUILDING_ACTIVITIES.find(v=>v.id===action.activityId);
      if(!definition)throw new Error('请选择有效的建筑活动。');
      const status=activityStatus(s,definition.building).activities.find(v=>v.id===definition.id);
      if(!status.canRun)throw new Error(status.blockedReason);
      s.cash-=definition.cost;
      const accepted=admit(s,definition.rewards.members);
      s.mood=clamp(s.mood+definition.rewards.mood,0,100);
      s.content=clamp(s.content+definition.rewards.content,0,100);
      s.buildingActivities={...s.buildingActivities,[definition.building]:{activityId:definition.id,day:s.day}};
      const admission=definition.rewards.members>0?`，实际入站 ${accepted} 位佬友${status.admissionReasons.length?`（${status.admissionReasons.map(v=>v.text).join('；')}）`:''}`:'';
      log(s,`${ACTIVITY_BUILDINGS[definition.building]}：${definition.name}，已完成${admission}。`,'success');break;
    }
    case 'resolve': {
      const event=s.events.find(v=>v.id===action.eventId);
      if(!event)throw new Error('事件已处理、到期或不存在。');
      const op=event.options.find(v=>v.id===action.optionId);
      if(!op)throw new Error('请选择有效的事件选项。');
      if(s.cash<op.cost)throw new Error('余额不足以执行此选项。');
      const r=op.rewards;
      s.cash+=r.cash-op.cost;
      let accepted=0;
      if(r.patrons){
        // No phantom ordinary admission when the patron application cannot qualify.
        if(s.patrons+r.patrons<=Math.floor((s.members+r.members)*RULES.patronRatio)){
          accepted=admit(s,r.members);if(accepted===r.members)s.patrons+=r.patrons;
        }
      }else if(r.members>0)accepted=admit(s,r.members);
      else if(r.members<0)s.members=Math.max(0,s.members+r.members);
      s.mood=clamp(s.mood+r.mood,0,100);s.content=clamp(s.content+r.content,0,100);capPatrons(s);
      s.events=s.events.filter(v=>v.id!==event.id);
      log(s,`${event.title}：${op.label}，已完成${r.members>0?`，实际入站 ${accepted} 位佬友（注册状态、名额、容量及身份上限限制）`:''}。`,'success');break;
    }
    case 'registration':
      if(!REGISTRATIONS.some(v=>v.id===action.value))throw new Error('运营状态无效。');
      s.registration=action.value;log(s,`已切换为${REGISTRATIONS.find(v=>v.id===action.value).name}。`);break;
    case 'strategy':
      if(!STRATEGIES.some(v=>v.id===action.strategy&&(!v.challengeOnly||isChallenge(s))))throw new Error('运营策略无效。');s.strategy=action.strategy;break;
    case 'rename':
      if(typeof action.name!=='string'||!action.name.trim()||action.name.trim().length>24)throw new Error('小站名称须为 1–24 个字符。');s.name=action.name.trim();
      if(Object.hasOwn(action,'slogan')){if(!validSlogan(action.slogan))throw new Error('社区标语须为 0–40 个字符。');s.slogan=action.slogan;}break;
    default:throw new Error('未知操作。');
  }
  s.serverPeriodsRemaining=s.serverDaysRemaining*RULES.periodsPerDay;
  s.revision++;
  if(!validateState(s))throw new Error('操作超出存档允许范围。');
  return s;
}
