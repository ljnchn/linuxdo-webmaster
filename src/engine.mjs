/** Shared, deterministic prototype rules. Ticks are supplied by the online clock, never wall time. */
import {COMMUNITY_LEVELS,communityProgress,PROJECT_DAYS,SPECIALTIES,AWARDS,lifeOf,buildingMastery,residentStatus,activityBenefits,validLife} from './community-life.mjs';
export {COMMUNITY_LEVELS,communityProgress} from './community-life.mjs';
export const RULES = Object.freeze({
  version: 4, prototype: true, periodsPerDay: 3, daysPerMonth: 30, secondsPerPeriod: 20,
  heartbeatIntervalMs: 10_000, heartbeatTimeoutMs: 20_000,
  speeds: Object.freeze([1, 2, 4]), initialCash: 1000, initialMembers: 0,
  initialServerId: 'nest', initialMonths: 1, initialRegistration: 'open',
  monthOptions: Object.freeze([1, 2, 3]), patronRatio: .05, sponsorCycleDays: 7,
  sponsorExpiryDays: 14, sponsorAmount: 100, inviteDailyLimit: 2,
  eventExpiryDays: 6, worldCycleDays: 12, maxEvents: 8, buildingActivityCooldownDays: 7,
  explanation: '试玩平衡参数，非最终规则：一天 3 时段，每时段 20 秒，默认 1 分钟一天；服务器租期按整天扣减；30 天一月。开局预付 1 月。邀请注册每天最多发 2 个邀请码；关闭注册后所有新增佬友都会在门口吃闭门羹。富可敌国上限为佬友数的 5% 向下取整，每 7 天产生 100 刀赞助，14 天不领会过期。世界事件每 12 天轮换；氛围与内容限 0–100，事件入站也受当前注册名额和容量限制。到期先于当日奖励结算。升级按未使用租期向下取整折抵。离线、后台与说明/管理弹窗暂停，主画面事件卡不暂停。',
});
export const SERVERS = Object.freeze([
  { id: 'nest', name: '小窝', spec: '1C1G', rent: 240, monthlyRent: 240, capacity: 60 },
  { id: 'block', name: '街区', spec: '2C2G', rent: 540, monthlyRent: 540, capacity: 180 },
  { id: 'town', name: '城镇', spec: '4C8G', rent: 1260, monthlyRent: 1260, capacity: 500 },
  { id: 'city', name: '都会', spec: '8C16G', rent: 2850, monthlyRent: 2850, capacity: 1500 },
].map(Object.freeze));
export const REGISTRATIONS = Object.freeze([
  { id: 'open', name: '开放注册', description: '注册申请直接放行，容量满了自动排队。' },
  { id: 'invite', name: '邀请注册', description: '每天最多发 2 个邀请码，事件入站也占名额，0 位佬友也能起步。' },
  { id: 'closed', name: '关闭注册', description: '门口挂上「暂停营业」，已有佬友照常发帖和赞助。' },
].map(Object.freeze));
export const STRATEGIES = Object.freeze([
  { id: 'balanced', name: '均衡运营', description: '兼顾佬友增长、氛围和内容，稳字当头。' },
  { id: 'growth', name: '热情迎新', description: '多发迎新帖，人来得快，氛围与内容每天各消耗 1 点。' },
  { id: 'content', name: '深耕内容', description: '慢慢扩圈，内容每天增加 3 点，靠干货留人。' },
  { id: 'care', name: '友善维护', challengeOnly: true, description: '挑战模式：氛围每天 +2、内容 -2，增长减半。' },
].map(Object.freeze));
export const BUILDING_UNLOCKS = Object.freeze({benefits:2,resources:3});
// Deterministic building activities drawn from everyday forum life. Prototype
// values are not real offers, paid prize draws, sponsorships, or final balance.
export const BUILDING_ACTIVITIES = Object.freeze([
  {id:'benefits-free-list',building:'benefits',requiredLevel:2,name:'整理限免清单',description:'把本周的限免、白嫖和公益额度整理成一张表，标好截止时间和坑位，顺手帮佬友省下几刀。',cost:0,rewards:{members:0,mood:3,content:2}},
  {id:'benefits-badge-draw',building:'benefits',requiredLevel:4,name:'社区徽章抽奖',description:'拿 15 刀办一场社区徽章抽奖，用 CDK 或兑换码发奖，看看能不能再拐来 2 位新佬友。',cost:15,rewards:{members:2,mood:7,content:0}},
  {id:'resources-software',building:'resources',requiredLevel:3,name:'软件分享',description:'安利几款压箱底的软件，写清楚安装、配置和踩坑点；Docker、NAS、效率工具都行。',cost:0,rewards:{members:0,mood:0,content:4}},
  {id:'resources-repository',building:'resources',requiredLevel:5,name:'开源仓库共读',description:'拉上几位佬友共读一个热门开源仓库，从 README 一路聊到 Issue 和实现细节。',cost:10,rewards:{members:0,mood:1,content:7}},
  {id:'resources-course',building:'resources',requiredLevel:6,name:'视频课程共学',description:'一起刷完一套视频课，笔记共享、进度打卡，谁也别想鸽。',cost:15,rewards:{members:0,mood:3,content:6}},
  {id:'resources-book',building:'resources',requiredLevel:4,name:'书籍共读',description:'挑一本技术书慢慢啃，在「读书成诗」开个共读帖，把划线和吐槽都留给后来人。',cost:0,rewards:{members:0,mood:2,content:3}},
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
// Snapshots written by 0.10.0 before the copy refresh. Kept only so pending
// events in existing saves still validate; the UI always renders EVENTS copy.
const PREVIOUS_EVENTS = Object.freeze([
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
]);
// Snapshot of the previous player-facing copy. Kept whole for pending events in
// existing saves; migrateState/applyAction replace it with the current EVENTS copy.
const PREVIOUS_EVENTS_V2 = Object.freeze([
  { id: 'welcome', category: 'character', title: '有人来敲门', description: '门口站着一位拎着包的新佬友，眼神里写满「求收留」。这扇门，开不开？', options: [
    option('host','举办欢迎会','花 20 刀摆一桌欢迎会，尝试迎接 6 位佬友，氛围 +8。',20,6,8),
    option('greet','亲自问好','挨个打招呼，尝试迎接 2 位佬友，氛围 +3。',0,2,3),
  ]},
  { id: 'article', category: 'character', title: '一篇长文炸场了', description: '有佬友熬到凌晨三点，甩出一篇硬核长文。是加鸡腿还是挂首页，站长说了算。', options: [
    option('support','奖励作者','花 25 刀给作者加个鸡腿，内容 +15、氛围 +6。',25,0,6,15),
    option('feature','置顶推荐','把文章挂上首页，内容 +6，还收到 15 刀感谢金。',0,0,0,6,15),
  ]},
  { id: 'patron', category: 'character', title: '富可敌国想入伙', description: '一位出手阔绰的佬友表示想长期驻扎。容量、名额和 5% 上限都点头，才能请进门。', options: [
    option('welcome','欢迎赞助者','尝试迎接 1 位富可敌国佬友，氛围 +3；赞助稍后到账。',0,1,3,0,0,1),
    option('thanks','婉谢并致意','不增加佬友，氛围 +2，江湖再见仍是朋友。',0,0,2),
  ]},
  { id: 'troublemaker', category: 'character', title: '有人在楼里吵起来了', description: '两位佬友从技术分歧一路吵到人生哲学，围观群众已经搬好小板凳。该站长出场了。', options: [
    option('mediate','耐心调解','氛围 +5，内容 +2；顺便收获一场高质量辩论。',0,0,5,2),
    option('remove','请他离开','减少 1 位佬友，氛围 +10；耳根子终于清净。',0,-1,10),
  ]},
  { id: 'newcomer-help', category: 'character', title: '新佬友卡在第一步', description: '刚进门的佬友贴出报错截图，语气有点慌。是手把手带一遍，还是写份谁都看得懂的入门指南？', options: [
    option('guide','整理入门指南','花 15 刀整理一份避坑指南，氛围 +4、内容 +6。',15,0,4,6),
    option('walkthrough','耐心陪同排查','陪着一步步排错，氛围 +5；文章先放一放，内容 -2。',0,0,5,-2),
  ]},
  { id: 'moderator-shift', category: 'character', title: '版主想请个假', description: '热心佬友连着值了几天班，顶着黑眼圈来交班。你接，还是张罗一次体面的交接？', options: [
    option('handover','筹备轮值交接','花 20 刀把交接安排明白，氛围 +8、内容 +3。',20,0,8,3),
    option('cover','站长亲自接班','氛围 +6；码字时间被压缩，内容 -3。',0,0,6,-3),
  ]},
  { id: 'broken-resource', category: 'character', title: '收藏的链接全红了', description: '有佬友发现收藏帖集体 404，急得在楼里直跺脚。补线索，还是干脆重做一份索引？', options: [
    option('rebuild','重整资源索引','花 25 刀重做索引，氛围 +3、内容 +12。',25,0,3,12),
    option('flag','标注失效与替代线索','内容 +6；补全还要等，氛围 -1。',0,0,-1,6),
  ]},
  { id: 'experience-debate', category: 'character', title: '两派吵起来了', description: '同样的配置，两个佬友跑出相反结果，楼里已经分好阵营。让子弹再飞一会儿，还是先劝和？', options: [
    option('reproduce','邀请补充复现过程','内容 +9；讨论继续升温，氛围 -2。',0,0,-2,9),
    option('common-ground','整理共识并劝和','氛围 +5、内容 +3；分歧留着下次再战。',0,0,5,3),
  ]},
  { id: 'promotion-spam', category: 'character', title: '促销帖刷屏了', description: '一位佬友连发十几条促销帖，正常讨论被淹到第二页。清理还是合并，你选。', options: [
    option('remove','清理刷屏并请他离开','减少 1 位佬友，氛围 +7、内容 +2。',0,-1,7,2),
    option('merge','合并促销帖为导读','内容 +5；有人还在嘀咕，氛围 -2。',0,0,-2,5),
  ]},
  { id: 'community-maintenance', category: 'character', title: '想一起把社区修一修', description: '几位佬友主动请缨，要整理标签、清理重复问题。是给工具，还是组织一场志愿接力？', options: [
    option('tools','提供整理工具','花 20 刀上工具，氛围 +6、内容 +10。',20,0,6,10),
    option('volunteer','组织志愿接力','内容 +8；大家累并快乐着，氛围 -3。',0,0,-3,8),
  ]},
  { id: 'model', category: 'world', title: '新模型发布了', description: '新一代开源模型突然发布，技术圈一夜之间沸腾。小站要不要蹭这波热度？', options: [
    option('workshop','组织体验工坊','花 30 刀搭个体验工坊，内容 +15、氛围 +2，尝试吸引 8 位佬友。',30,8,2,15),
    option('digest','整理模型速报','内容 +8，尝试吸引 2 位佬友，顺手把讨论热度接住。',0,2,0,8),
  ]},
  { id: 'mirror', category: 'world', title: '镜像站要搬家了', description: '星环镜像站连夜搬家，下载速度梦回拨号上网。佬友们正等一条顺畅的新路。', options: [
    option('relay','搭建临时镜像','花 40 刀架个临时镜像，内容 +10、氛围 +4，尝试吸引 4 位佬友。',40,4,4,10),
    option('guide','整理下载指南','内容 +6；下载还是慢，氛围 -2。',0,0,-2,6),
  ]},
  { id: 'archive', category: 'world', title: '旧书库快撑不住了', description: '云端旧书库发出下线倒计时，一批早期笔记等着抢救。砸钱加速，还是号召大家手抄？', options: [
    option('rescue','资助资料抢救','花 35 刀抢救资料，内容 +18、氛围 +3。',35,0,3,18),
    option('transcribe','组织人工抄录','内容 +10；抄书抄到手腕酸，氛围 -3。',0,0,-3,10),
  ]},
  { id: 'festival', category: 'world', title: '灯会邀请函到了', description: '浮光街区发来灯会请柬。去赴一场热闹，还是留在站里接力写故事？', options: [
    option('lanterns','布置夜间灯会','花 25 刀点亮整条街，氛围 +12、内容 -3，尝试吸引 5 位佬友。',25,5,12,-3),
    option('stories','发起故事接龙','氛围 +5、内容 +6，不增加入站人数。',0,0,5,6),
  ]},
  { id: 'security', category: 'world', title: '安全演练开始了', description: '纸盾技术社发起安全演练，佬友们开始翻自己的配置。请讲师还是发清单？', options: [
    option('speaker','邀请安全讲师','花 45 刀请位讲师，内容 +12、氛围 +8。',45,0,8,12),
    option('checklist','发布自查清单','内容 +7；自己排查心里没底，氛围 -2。',0,0,-2,7),
  ]},
  { id: 'heatwave', category: 'world', title: '热浪杀到琉璃城', description: '琉璃城连发高温预警，佬友们只想瘫着。添设备，还是把今天过成慢聊日？', options: [
    option('cooling','添置散热设施','花 35 刀给服务器降温，氛围 +10、内容 +2。',35,0,10,2),
    option('slowday','举办慢聊日','氛围 +6；深度讨论暂停，内容 -5。',0,0,6,-5),
  ]},
  { id: 'comet', category: 'world', title: '彗星划过夜空', description: '银尾彗星拖着长尾巴路过，全网都在晒照片。开直播，还是收集大家的观星文字？', options: [
    option('stargaze','直播观星夜','花 30 刀办场观星直播，氛围 +9，尝试吸引 6 位佬友。',30,6,9),
    option('essays','征集观星随笔','氛围 +3、内容 +8，不增加入站人数。',0,0,3,8),
  ]},
  { id: 'translation', category: 'world', title: '厚手册求共译', description: '万叶工具甩来一本厚得能当枕头的新手册，正在找社区一起翻译。全译还是先出导读？', options: [
    option('translate','组织翻译接力','花 30 刀组翻译队，内容 +16、氛围 -2，尝试吸引 3 位佬友。',30,3,-2,16),
    option('highlights','挑选精华导读','内容 +7、氛围 +3，不增加入站人数。',0,0,3,7),
  ]},
  { id: 'retro', category: 'world', title: '旧电脑集体复活', description: '方盒旧机突然翻红，老照片和修机心得刷满版面。办展还是安静整理回忆？', options: [
    option('exhibit','筹办旧机展','花 25 刀办场旧机展，氛围 +7、内容 +8，尝试吸引 4 位佬友。',25,4,7,8),
    option('scrapbook','整理数字回忆册','氛围 +3、内容 +7，不增加入站人数。',0,0,3,7),
  ]},
  { id: 'bazaar', category: 'world', title: '蒲公英集市开摊了', description: '蒲公英创作集市给小站留了摊位。公益分享能交朋友，卖贴纸能回血，但都得花时间。', options: [
    option('sharing','开设公益摊位','花 20 刀摆公益摊，氛围 +6、内容 +3，尝试吸引 6 位佬友。',20,6,6,3),
    option('stickers','售卖原创贴纸','获得 35 刀；氛围 -4、内容 -2，不增加入站人数。',0,0,-4,-2,35),
  ]},
]);
// Current copy: forum operations and community life that Linux.do readers recognize.
export const EVENTS = [
  { id: 'welcome', category: 'character', title: '门口来了一队新佬友', description: '门口忽然排起一队新佬友：有人带着自我介绍，有人只留一句「求收留」。', options: [
    option('host','办一场迎新茶话会','花 20 刀准备好迎新帖和茶水，尝试迎接 6 位佬友，氛围 +8。',20,6,8),
    option('greet','在迎新帖里挨个回复','认真回复每位新佬友，尝试迎接 2 位佬友，氛围 +3。',0,2,3),
  ]},
  { id: 'article', category: 'character', title: '一篇踩坑记录被顶成热门', description: '有佬友把折腾三天的踩坑过程写成保姆级教程，命令、截图和报错原样贴出。评论区已经开始「收藏吃灰」接龙。', options: [
    option('support','给作者加鸡腿','花 25 刀给作者加个鸡腿，内容 +15、氛围 +6。',25,0,6,15),
    option('feature','加精并挂上首页','把教程加精推荐，内容 +6，还收到 15 刀感谢金。',0,0,0,6,15),
  ]},
  { id: 'patron', category: 'character', title: '富可敌国佬友申请常驻', description: '一位富可敌国的佬友想长期驻扎，还愿意每月支持小站。容量、注册名额和 5% 上限都点头，才能请进门。', options: [
    option('welcome','欢迎入驻','尝试迎接 1 位富可敌国佬友，氛围 +3；赞助稍后到账。',0,1,3,0,0,1),
    option('thanks','客气婉拒','不增加佬友，氛围 +2，改天再合作。',0,0,2),
  ]},
  { id: 'troublemaker', category: 'character', title: '技术争论开始上强度了', description: '两位佬友从「你这个配置有问题」一路吵到「你根本没用过」，楼里已经有人点举报。再不下场，帖子就要进小黑屋了。', options: [
    option('mediate','下场把楼拉回正题','氛围 +5，内容 +2；顺手把双方的复现步骤整理进主楼。',0,0,5,2),
    option('remove','按版规请出讨论','减少 1 位佬友，氛围 +10；楼里终于安静了。',0,-1,10),
  ]},
  { id: 'newcomer-help', category: 'character', title: '新佬友卡在 API 配置', description: '刚注册的佬友把 Base URL 和 Key 填反了，贴出 401 报错，语气里全是慌。是远程陪跑，还是写份配置避坑指南？', options: [
    option('guide','整理配置避坑指南','花 15 刀整理一份图文指南，氛围 +4、内容 +6。',15,0,4,6),
    option('walkthrough','开屏幕共享陪跑','一步步陪他排查，氛围 +5；文章先放一放，内容 -2。',0,0,5,-2),
  ]},
  { id: 'moderator-shift', category: 'character', title: '举报队列堆到第二页了', description: '几位热心佬友连着轮值，举报队列还是清不完，黑眼圈一个比一个重。你接，还是把交接流程理顺？', options: [
    option('handover','把轮值交接理顺','花 20 刀完善版规和交接文档，氛围 +8、内容 +3。',20,0,8,3),
    option('cover','站长亲自顶班','氛围 +6；码字时间被压缩，内容 -3。',0,0,6,-3),
  ]},
  { id: 'broken-resource', category: 'character', title: '资源帖链接红了一片', description: '有佬友发现收藏夹里的资源帖集体失效：网盘限速、域名过期、附件 404。补链接，还是干脆重做一份索引？', options: [
    option('rebuild','重做资源索引','花 25 刀重做索引并逐条校验链接，氛围 +3、内容 +12。',25,0,3,12),
    option('flag','先标注失效与替代方案','内容 +6；补全还要等，氛围 -1。',0,0,-1,6),
  ]},
  { id: 'experience-debate', category: 'character', title: '两套跑分结果打起来了', description: '同一模型，两位佬友跑出完全相反的结论：一个说能力起飞，一个说降智明显。楼里已经按显卡和网络分好阵营。', options: [
    option('reproduce','约一场公开复现','内容 +9；讨论继续升温，氛围 -2。',0,0,-2,9),
    option('common-ground','整理共识与变量','氛围 +5、内容 +3；分歧留到下次再测。',0,0,5,3),
  ]},
  { id: 'promotion-spam', category: 'character', title: '推广链接刷屏了', description: '一位佬友连发十几条带 AFF 的推广帖，正常讨论被挤到第二页。清理还是合并，站长得给个说法。', options: [
    option('remove','清理并请出推广号','减少 1 位佬友，氛围 +7、内容 +2。',0,-1,7,2),
    option('merge','合并成一条推广导读','内容 +5；有人还在嘀咕，氛围 -2。',0,0,-2,5),
  ]},
  { id: 'community-maintenance', category: 'character', title: '有人提议大扫除标签', description: '几位佬友主动请缨，想清理重复帖、补全标签、把已解决的问题标上「已解决」。是给工具，还是组织一场志愿接力？', options: [
    option('tools','提供整理工具','花 20 刀上整理工具和模板，氛围 +6、内容 +10。',20,0,6,10),
    option('volunteer','组织志愿接力','内容 +8；大家累并快乐着，氛围 -3。',0,0,-3,8),
  ]},
  { id: 'model', category: 'world', title: '新模型发布，L 站连夜开测', description: '某个前沿模型突然开放 API，佬友们一边排队一边刷榜：有人说代码能力起飞，也有人吐槽中文理解降智。小站要不要跟进？', options: [
    option('workshop','组织模型体验局','花 30 刀开一场体验局，内容 +15、氛围 +2，尝试吸引 8 位佬友。',30,8,2,15),
    option('digest','整理首日实测速报','把佬友的首日实测整理成速报，内容 +8，尝试吸引 2 位佬友。',0,2,0,8),
  ]},
  { id: 'mirror', category: 'world', title: '公益镜像站突然打不开了', description: '常用的公益镜像站一夜之间 502，群里开始流传「站长跑路」和「被 DDoS」两个版本。下载任务还卡在 0%。', options: [
    option('relay','临时搭个镜像分流','花 40 刀租临时带宽做镜像，内容 +10、氛围 +4，尝试吸引 4 位佬友。',40,4,4,10),
    option('guide','整理可用镜像清单','把还能用的镜像和备用下载方式整理成清单，内容 +6；等待让人焦躁，氛围 -2。',0,0,-2,6),
  ]},
  { id: 'archive', category: 'world', title: '旧帖外链集体阵亡', description: '一批早年神帖的外链和网盘全部失效，评论区只剩「mark 一下，回头补」。再不抢救，这些经验就真成赛博遗迹了。', options: [
    option('rescue','出钱做离线归档','花 35 刀把资料抓取归档，内容 +18、氛围 +3。',35,0,3,18),
    option('transcribe','组织佬友人工补档','内容 +10；活儿多且枯燥，氛围 -3。',0,0,-3,10),
  ]},
  { id: 'festival', category: 'world', title: '社区周年庆开始报名了', description: 'L 站周年庆活动帖刚发出来，盖楼、抽奖、徽章申请一下子全来了。小站是跟着热闹，还是自己办场接龙？', options: [
    option('lanterns','报名社区庆典摊位','花 25 刀布置摊位和互动，氛围 +12、内容 -3，尝试吸引 5 位佬友。',25,5,12,-3),
    option('stories','在站内办故事接龙','发起故事接龙，氛围 +5、内容 +6，不增加入站人数。',0,0,5,6),
  ]},
  { id: 'security', category: 'world', title: '又有佬友账号被盗了', description: '有人收到「异地登录」提醒，紧接着小号开始到处发广告。2FA、密码管理器和登录设备一下成了热帖。', options: [
    option('speaker','请安全佬开个讲座','花 45 刀请安全佬做场直播，内容 +12、氛围 +8。',45,0,8,12),
    option('checklist','发一份账号自查清单','整理 2FA、授权应用和登录设备清单，内容 +7；自己排查总怕漏，氛围 -2。',0,0,-2,7),
  ]},
  { id: 'heatwave', category: 'world', title: '机房空调罢工，全站 502', description: '机房温度报警，服务器开始随机 502，佬友们一边刷新一边讲冷笑话。小站得先决定：救火，还是躺平？', options: [
    option('cooling','加钱上备用节点','花 35 刀切到备用节点并加散热，氛围 +10、内容 +2。',35,0,10,2),
    option('slowday','开个 502 受害者水楼','氛围 +6；深度讨论暂停，内容 -5。',0,0,6,-5),
  ]},
  { id: 'comet', category: 'world', title: 'GitHub 热榜被一个项目刷屏', description: '一个开源项目半天涨了几千 star，README 还没写完，issues 已经排到三位数。小站要不要第一批上车？', options: [
    option('stargaze','组织源码速读直播','花 30 刀组一场源码速读，氛围 +9，尝试吸引 6 位佬友。',30,6,9),
    option('essays','征集第一批测评文','氛围 +3、内容 +8，不增加入站人数。',0,0,3,8),
  ]},
  { id: 'translation', category: 'world', title: '开源项目在招文档翻译', description: '一个热门开源项目发起中文文档共译，README 里明晃晃写着「help wanted」。是整本翻完，还是先啃精华？', options: [
    option('translate','承包一整个章节','花 30 刀组织翻译接力，内容 +16、氛围 -2，尝试吸引 3 位佬友。',30,3,-2,16),
    option('highlights','先出中文快速上手','内容 +7、氛围 +3，不增加入站人数。',0,0,3,7),
  ]},
  { id: 'retro', category: 'world', title: '论坛考古帖被顶起来了', description: '十年前的旧帖突然被挖坟，里面全是早期的折腾记录和失效截图。有人嫌挖坟，有人看得津津有味。', options: [
    option('exhibit','办一场考古展','花 25 刀整理旧帖做展览，氛围 +7、内容 +8，尝试吸引 4 位佬友。',25,4,7,8),
    option('scrapbook','把旧帖做成时间线','氛围 +3、内容 +7，不增加入站人数。',0,0,3,7),
  ]},
  { id: 'bazaar', category: 'world', title: '闲置硬件和周边开始流转', description: '有佬友在出闲置硬盘、键盘和开发板，也有人想拿自制周边换书。热闹归热闹，版规和交易风险也得盯着。', options: [
    option('sharing','开个以物易物帖','花 20 刀组织交换，氛围 +6、内容 +3，尝试吸引 6 位佬友。',20,6,6,3),
    option('stickers','收摊位费卖周边','获得 35 刀；氛围 -4、内容 -2，不增加入站人数。',0,0,-4,-2,35),
  ]},
];
// Presentation-only attention metadata: keep it outside the trusted save snapshots.
// Existing troublemaker events retain their distinct warning appearance.
export const CHARACTER_ATTENTION_KINDS = Object.freeze([
  'newcomer-help','moderator-shift','broken-resource','experience-debate','promotion-spam','community-maintenance',
]);
for (const e of [...LEGACY_EVENTS,...PREVIOUS_EVENTS,...PREVIOUS_EVENTS_V2,...EVENTS]) { for (const o of e.options) { Object.freeze(o.rewards); Object.freeze(o); } Object.freeze(e.options); Object.freeze(e); } Object.freeze(EVENTS); Object.freeze(LEGACY_EVENTS);
const TRUSTED_EVENTS = Object.freeze([...EVENTS,...PREVIOUS_EVENTS_V2,...PREVIOUS_EVENTS,...LEGACY_EVENTS]);
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
  maintenancePerMember: Object.freeze({nest:.3,block:.32,town:.34,city:.36}), lowQuality:35, troubleGraceDays:2,
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
  const progress=communityProgress(s),requiredLevel=BUILDING_UNLOCKS[building],requiredMembers=COMMUNITY_LEVELS[requiredLevel-1].members;
  const unlocked=progress.level>=requiredLevel;
  const lastUsedDay=s.buildingActivities?.[building]?.day??null;
  const nextAvailableDay=lastUsedDay===null?null:lastUsedDay+RULES.buildingActivityCooldownDays;
  const remainingDays=nextAvailableDay===null?0:Math.max(0,nextAvailableDay-s.day);
  const project=lifeOf(s).projects[building],duration=project?PROJECT_DAYS[project.activityId]:0;
  const ongoing=project?{...project,name:BUILDING_ACTIVITIES.find(a=>a.id===project.activityId).name,stage:s.gameOver?'已中止':s.day===project.startedDay?'筹备中':'举办中',remainingDays:Math.max(0,project.startedDay+duration-s.day),duration}:null;
  const blockedReason=s.gameOver?'服务器已到期，本局结束。请重新开始。':!unlocked?`${ACTIVITY_BUILDINGS[building]}在社区 Lv.${requiredLevel} 开放，需要达到 ${requiredMembers} 位佬友。`:s.members<1?'至少需要 1 位佬友才能开展活动。':remainingDays>0?`${ACTIVITY_BUILDINGS[building]}还需等待 ${remainingDays} 个游戏日，第 ${nextAvailableDay+1} 天可再次开展活动。`:null;
  const activities=BUILDING_ACTIVITIES.filter(v=>v.building===building).map(activity=>{
    const activityUnlocked=progress.level>=activity.requiredLevel;
    const benefit=activityBenefits(s,activity);
    const reason=blockedReason||(!activityUnlocked?`社区 Lv.${activity.requiredLevel} 解锁，需要达到 ${COMMUNITY_LEVELS[activity.requiredLevel-1].members} 位佬友。`:s.cash<benefit.cost?`刀不够了：需要 ${benefit.cost}，当前 ${s.cash}。`:null);
    return {...activity,...benefit,durationDays:PROJECT_DAYS[activity.id]||0,unlocked:activityUnlocked,canRun:!reason,blockedReason:reason,...activityAdmissions(s,benefit.rewards.members)};
  });
  return {building,level:progress.level,unlocked,requiredLevel,requiredMembers,project:ongoing,mastery:buildingMastery(s,building),cooldownDays:RULES.buildingActivityCooldownDays,lastUsedDay,nextAvailableDay,remainingDays,canRun:activities.some(v=>v.canRun),blockedReason,activities};
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
    if(Object.hasOwn(s,'communityLevel')&&!int(s.communityLevel,1,COMMUNITY_LEVELS.length))return false;
    if(!validLife(s,BUILDING_ACTIVITIES))return false;
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
    pressureHints.push(`维护 ${maintenanceCost(s)} 刀/天，新增佬友次日起计费。`);
    if(s.cash<maintenanceCost(s)*7)pressureHints.push('余额不足七天维护费；及时领取赞助，减少付费活动或换用更小服务器。');
    if(s.mood<45)pressureHints.push('氛围偏低：切换友善维护，及时调解争论。');
    if(s.content<45)pressureHints.push('内容偏低：切换深耕内容，处理文章和世界事件。');
    if(s.events.some(e=>e.kind==='troublemaker'))pressureHints.push('捣乱事件出现满两天后，每个未处理事件每天氛围 -2；可免费调解。');
    if(Math.min(s.mood,s.content)<CHALLENGE.lowQuality)pressureHints.push('氛围或内容低于 35，每天流失约 2% 佬友，极低时 4%。');
  }
  return {difficulty:challenge?'challenge':'classic',maintenanceCost:maintenanceCost(s),maintenancePerMember:challenge?CHALLENGE.maintenancePerMember[s.serverId]:0,maintenanceBase:challenge?CHALLENGE.maintenanceBase[s.serverId]:0,pressureHints,strategyEffects:challenge?CHALLENGE.strategies[s.strategy]:null,server,rent:server.rent,monthlyRent:server.rent,capacity:server.capacity,load:s.members/server.capacity,runway:s.serverDaysRemaining,serverDaysRemaining:s.serverDaysRemaining,serverPeriodsRemainder:0,serverPeriodsRemaining:s.serverPeriodsRemaining,timeSlot:s.timeSlot,gameOver:s.gameOver,nextSponsorDay:(Math.floor(s.day/7)+1)*7,sponsorTotal:s.pendingSponsors.reduce((n,v)=>n+v.amount,0),patronCap:patronCap(s),elapsedPeriods:s.day*3+s.timeSlot,registration:s.registration,inviteRemaining:Math.max(0,RULES.inviteDailyLimit-s.admissionsToday),score:s.day*3+s.timeSlot};
}
export function operatingForecast(s,serverId=s.serverId){
 const server=SERVERS.find(v=>v.id===serverId);
 if(!server)throw Error('请选择有效的服务器。');
 const maintenance=maintenanceCost({...s,serverId}),rent=server.rent/RULES.daysPerMonth,income=s.patrons*RULES.sponsorAmount/RULES.sponsorCycleDays;
 return {maintenance,rent,income,net:income-maintenance-rent,nextSponsorDay:(Math.floor(s.day/RULES.sponsorCycleDays)+1)*RULES.sponsorCycleDays,pending:s.pendingSponsors.reduce((n,v)=>n+v.amount,0)};
}
function completeActivity(s,definition){
 const rewards=activityBenefits(s,definition).rewards,accepted=admit(s,rewards.members);
 s.mood=clamp(s.mood+rewards.mood,0,100);s.content=clamp(s.content+rewards.content,0,100);
 s.life??=lifeOf(s);s.life.completed[definition.id]=Math.min(MAX,(s.life.completed[definition.id]||0)+1);
 const admission=rewards.members>0?`，实际入站 ${accepted} 位佬友`:'';
 log(s,`${definition.name}已完成${admission}。`,'success');
}
function settleLife(s){
 for(const [building,project] of Object.entries(lifeOf(s).projects))if(s.day>=project.startedDay+PROJECT_DAYS[project.activityId]){
  completeActivity(s,BUILDING_ACTIVITIES.find(a=>a.id===project.activityId));delete s.life.projects[building];
 }
 if(s.day%30===0)for(const award of AWARDS)if(!lifeOf(s).awards.includes(award.id)&&s.members>=award.members&&s.mood>=award.mood&&s.content>=award.content){
  s.life??=lifeOf(s);s.life.awards.push(award.id);log(s,`月度评选：获得「${award.name}」。`,'success');
 }
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
    if(paid<cost){s.mood=clamp(s.mood-3,0,100);log(s,`维护费 ${cost} 刀，只付得起 ${paid}；服务打了折扣，氛围 -3。`,'warning');}
    const trouble=s.events.filter(e=>e.kind==='troublemaker'&&s.day-e.createdDay>=CHALLENGE.troubleGraceDays).length;
    if(trouble){s.mood=clamp(s.mood-trouble*2,0,100);log(s,'未处理的争论影响氛围，请及时免费调解。','warning');}
    const low=Math.min(s.mood,s.content);
    if(low<CHALLENGE.lowQuality&&s.members){const loss=Math.min(s.members,Math.max(1,Math.ceil(s.members*(low<15?.04:.02))));s.members-=loss;log(s,`社区质量偏低，${loss} 位佬友离开。`,'warning');}
  }
  const quality=(s.mood+s.content)/200;
  // Word of mouth grows with the community; quality and registration still gate arrivals.
  const growth=Math.max(1,Math.floor((2+random(s)*4)*(.65+quality)*(challenge?CHALLENGE.strategies[s.strategy].growth:(s.strategy==='growth'?1.4:s.strategy==='content'?.7:1))*(challenge?(.35+.65*quality)*(1+Math.min(s.members,500)/100):1)));
  const specialty=lifeOf(s).specialty;
  const admitted=admit(s,growth+(specialty==='welcome'?1:0));
  s.mood=clamp(s.mood+(challenge?CHALLENGE.strategies[s.strategy].mood:(s.strategy==='growth'?-1:1)),0,100);
  s.content=clamp(s.content+(challenge?CHALLENGE.strategies[s.strategy].content:(s.strategy==='content'?3:s.strategy==='growth'?-1:1)),0,100);
  if(specialty==='knowledge')s.content=clamp(s.content+1,0,100);
  if(specialty==='care')s.mood=clamp(s.mood+1,0,100);
  capPatrons(s);
  // Classic: a new arrival may be a patron. Challenge: an existing member may also
  // become a patron, so a full server cannot permanently lock out sponsorship.
  if((challenge?s.members>0:admitted>0)&&s.patrons<patronCap(s)&&random(s)<(challenge?.45*quality:.65))s.patrons+=Math.min(patronCap(s)-s.patrons,challenge?1+Math.floor(s.members/150):1);
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
  const previousLevel=communityProgress(s).level;
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
      log(s,`租用 ${server.spec} ${months} 个月，花费 ${price} 刀，旧租期折抵 ${credit} 刀。`,'success');break;
    }
    case 'renew': {
      if(!RULES.monthOptions.includes(action.months)||Object.hasOwn(action,'days'))throw new Error('续租只能选择 1、2 或 3 个月。');
      const price=serverFor(s).rent*action.months;
      if(s.cash<price)throw new Error('余额不足以续租。');
      s.cash-=price;s.serverDaysRemaining+=action.months*RULES.daysPerMonth;
      log(s,`续租 ${action.months} 个月，付出 ${price} 刀，灯还能亮很久。`,'success');break;
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
      }else if(s.timeSlot===0){settleDay(s);settleLife(s);}
      break;
    }
    case 'claim': {
      const selected=s.pendingSponsors.filter(v=>action.id==='all'||v.id===action.id);
      if(!selected.length)throw new Error('没有可领取的赞助，或该信封已领取/到期。');
      const ids=new Set(selected.map(v=>v.id));const total=selected.reduce((n,v)=>n+v.amount,0);
      s.cash+=total;s.pendingSponsors=s.pendingSponsors.filter(v=>!ids.has(v.id));
      log(s,`领取 ${selected.length} 封赞助，入账 ${total} 刀。`,'success');break;
    }
    case 'activity': {
      if(Object.keys(action).sort().join(',')!=='activityId,type')throw new Error('活动操作只能指定活动编号。');
      const definition=BUILDING_ACTIVITIES.find(v=>v.id===action.activityId);
      if(!definition)throw new Error('请选择有效的建筑活动。');
      const status=activityStatus(s,definition.building).activities.find(v=>v.id===definition.id);
      if(!status.canRun)throw new Error(status.blockedReason);
      s.cash-=status.cost;
      s.buildingActivities={...s.buildingActivities,[definition.building]:{activityId:definition.id,day:s.day}};
      if(PROJECT_DAYS[definition.id]){
       s.life??=lifeOf(s);s.life.projects[definition.building]={activityId:definition.id,startedDay:s.day};
       log(s,`${definition.name}开始筹备，${PROJECT_DAYS[definition.id]} 天后完成。`,'info');
      }else completeActivity(s,definition);
      break;
    }
    case 'story': {
      if(Object.keys(action).sort().join()!=='optionId,residentId,type'||!['he','juan','ce'].includes(action.residentId))throw Error('请选择有效的佬友故事。');
      const story=residentStatus(s,action.residentId);
      if(!story.canAct)throw Error(story.complete?'这段故事已完成。':!story.unlocked?`社区 Lv.${story.level} 相遇。`:`${story.wait} 天后再来看看。`);
      const option=story.options.find(v=>v.id===action.optionId);
      if(!option)throw Error('请选择当前故事的选项。');
      if(s.cash<option.cost)throw Error('刀不够了，先攒攒。');
      s.cash-=option.cost;s.mood=clamp(s.mood+option.rewards.mood,0,100);s.content=clamp(s.content+option.rewards.content,0,100);const accepted=admit(s,option.rewards.members);
      s.life??=lifeOf(s);const choices=[...(s.life.stories[story.id]?.choices??[]),option.id];s.life.stories[story.id]={choices,day:s.day};
      log(s,`${story.name}：${option.label}${choices.length===3?'，成为社区骨干':''}${option.rewards.members?`，实际入站 ${accepted} 位佬友`:''}。`,'success');break;
    }
    case 'specialty': {
      if(Object.keys(action).sort().join()!=='specialtyId,type'||!SPECIALTIES.some(v=>v.id===action.specialtyId))throw Error('请选择有效的社区特色。');
      if(communityProgress(s).level<5)throw Error('社区 Lv.5 开放特色选择。');
      if(lifeOf(s).specialty)throw Error('本局社区特色已确定。');
      s.life??=lifeOf(s);s.life.specialty=action.specialtyId;log(s,`社区特色：${SPECIALTIES.find(v=>v.id===action.specialtyId).name}。`,'success');break;
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
      log(s,`${event.title}：${op.label}${r.members>0?`，实际入站 ${accepted} 位佬友`:''}。`,'success');break;
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
  s.communityLevel=Math.max(previousLevel,communityProgress(s).level);
  s.revision++;
  if(!validateState(s))throw new Error('操作超出存档允许范围。');
  return s;
}
