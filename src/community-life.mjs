export const COMMUNITY_LEVELS=Object.freeze([
 [0,'初来乍到'],[8,'邻里初聚'],[24,'街角小站'],[50,'热闹街区'],[100,'百人社区'],
 [200,'特色小镇'],[450,'知识之城'],[750,'小有名气'],[1000,'千人同行'],[1500,'繁荣都会'],
 [3000,'跨城社区'],[8000,'区域枢纽'],[20000,'星际社区'],
].map(([members,name],i)=>Object.freeze({level:i+1,members,name})));
export const PROJECT_DAYS=Object.freeze({'benefits-badge-draw':2,'resources-repository':2,'resources-course':3,'benefits-market':3,'resources-summit':4});
export const RESIDENT_PLACES=Object.freeze({he:2070,juan:2350,ce:2660});
export const SPECIALTIES=Object.freeze([
 {id:'welcome',name:'迎新友好',description:'每天额外迎接 1 位佬友，社区每满 500 人再加 1 位，最多额外 50 位；仍受注册和容量限制。'},
 {id:'knowledge',name:'内容为王',description:'每天稳定冒出一篇新内容，内容 +1。'},
 {id:'care',name:'有问必答',description:'大家习惯互相搭把手，每天氛围 +1。'},
].map(Object.freeze));
export const AWARDS=Object.freeze([
 {id:'warm',name:'温暖街区',members:60,mood:80,content:0,description:'60 位佬友 · 氛围 80'},
 {id:'library',name:'知识灯塔',members:120,mood:0,content:80,description:'120 位佬友 · 内容 80'},
 {id:'city',name:'共建之城',members:500,mood:70,content:70,description:'500 位佬友 · 氛围、内容 70'},
 {id:'network',name:'跨区共建',members:8000,mood:80,content:80,description:'8,000 位佬友 · 氛围、内容 80'},
].map(Object.freeze));
const choice=(id,label,cost,mood,content,members=0,after='')=>({id,label,cost,rewards:{mood,content,members},after});
export const RESIDENTS=[
 {id:'he',name:'Neo',role:'热心版主',level:2,building:'benefits',style:3,avatar:'assets/avatars/neo.jpg',perk:'福利活动氛围额外 +1',steps:[
  {title:'迎新帖里起了火药味',text:'Neo 想给新佬友留个好印象，结果帖子里先为「该不该开放注册」吵起来了。',options:[choice('mediate','一起耐心调解',0,5,0),choice('rules','整理入站公约',0,1,3)]},
  {title:'Neo 想拉一支迎新小队',text:'上次处理得漂亮，Neo 信心爆棚，准备组个迎新志愿队。',options:[choice('volunteer','招募热心志愿者',0,3,1),choice('tools','准备轮值工具',10,3,5)]},
  {title:'第一份轮值总结',text:'Neo 已经能独当一面，拿着举报队列和交接清单来找你签字。',options:[choice('appoint','邀请担任社区骨干',0,8,3),choice('guide','把经验写成指南',0,4,8)]},
  {title:'交班簿上空了一行',text:'夜班版主留了句「已处理」，早班的人却不知道该回哪个帖子。Neo 把交班簿摊在咖啡桌上，想请你给下一班留个例子。',options:[choice('pair','陪两班一起交接',0,5,1,0,'两个班头一回碰了面，在交班簿上互相画了个笑脸。'),choice('sample','写一页交班样例',12,2,7,0,'交班簿的封二多了一张折角样例，换班的人照着填。')]},
  {title:'让新人当一次班长',text:'第一批来问路的佬友里，有人把交班簿翻得比 Neo 还熟。今晚正好缺个班长，他想试试。',options:[choice('shadow','让他领班，Neo 在旁边',0,6,2,0,'新人自己值完了一晚，Neo 只帮他添了两次茶。'),choice('desk','给他开个迎新桌',20,4,2,3,'公告栏旁多了一张迎新桌，第一位当班的正是当年问路的人。')]},
  {title:'钥匙该有两把',text:'Neo 把值班室的钥匙放在柜台上。「上周我请了个假，居然没一个人来催我上线。」轮值的人想把这套做法留下来。',options:[choice('key','给轮值小队配钥匙',0,7,2,0,'备用钥匙挂上了木钩，轮值小队从此自己开门。'),choice('handbook','把交接簿印成小册',24,3,9,0,'新班长把交接小册递给下一位，封面还留着最早的茶渍。')]},
 ],visitDays:10,visits:[
  {title:'夜班桌边留了个位子',text:'Neo 泡好两杯茶，手边压着一张没回完的迎新帖。「是咱们陪他聊聊，还是请老佬友讲讲第一次发帖的事？」',options:[choice('tea','陪新人坐一会儿',0,3,0),choice('letter','请老佬友写封回信',0,1,2)]},
  {title:'交班簿又翻满了',text:'这一册最后只剩半页。Neo 想给刚接班的人留点什么，挑了一条最难回的帖子，又挑了一条回得最好的。',options:[choice('goodreply','留下那条好回复',0,1,3),choice('hardreply','一起把难题回完',0,3,1)]},
  {title:'空椅子要摆在哪儿',text:'轮值小队刚下班，门边还剩一把椅子。Neo 问你，把它摆到公告栏旁等人问路，还是留给下班来歇脚的志愿者？',options:[choice('welcomechair','摆到公告栏边',0,2,0,1),choice('restchair','留个歇脚位',0,3,0)]},
 ]},
 {id:'juan',name:'神墨',role:'资源整理者',level:3,building:'resources',style:5,avatar:'assets/avatars/smnet.jpg',perk:'资源活动内容额外 +1',steps:[
  {title:'收藏夹集体 404',text:'神墨翻出一批旧资源帖，网盘链接红了一片，想拉你一起抢救。',options:[choice('repair','联系作者修复',10,2,4),choice('index','先整理可用目录',0,1,3)]},
  {title:'原作者回信了',text:'神墨举着 GitHub 回信跑来，原作者愿意一起补档。',options:[choice('collaborate','组织作者共建',15,2,7),choice('archive','整理维护档案',0,1,4)]},
  {title:'资源专题要上线了',text:'修好的资料终于串成完整专题，就差最后发布。',options:[choice('publish','发布长期维护专题',0,3,10),choice('share','邀请佬友来共建',0,5,5,3)]},
  {title:'一份没有署名的笔记',text:'神墨在旧硬盘里翻出初版目录，里面有段注释比正文还好懂，作者栏却是空的。「能不能给写它的人留个位置？」',options:[choice('trace','沿着旧帖找作者',0,5,3,0,'作者回来认出了自己的笔记，还纠正了一处当年的笔误。'),choice('credit','在目录里开署名页',10,2,7,0,'署名页第一行写着「作者待认领」，后来的人也有了补签的地方。')]},
  {title:'书架上那本借走的书',text:'资料馆的书被借了三轮，回来时厚了一截。每位读者都夹了自己的便签。神墨舍不得撕。',options:[choice('margin','把便签编成旁注',15,2,8,0,'便签成了书后的彩页，连那句「这里我也看晕了」都留着。'),choice('reading','请借书人回来带读',0,5,3,2,'借过书的佬友围坐在一起，逐张讲了便签的来历。')]},
  {title:'把资料馆的灯交给谁',text:'天黑时，神墨发现隔壁桌的新人已经把归还的书放回了原位。「看来下次我出门，这里也能照常开。」',options:[choice('curator','邀请读者轮流当馆员',0,7,3,0,'读者把值日表贴到书架边，每一格签名都不一样。'),choice('shelfmap','一起绘制书架地图',20,3,9,0,'书架地图印在借阅卡背面，新馆员第一晚就找齐了还书。')]},
 ],visitDays:12,visits:[
  {title:'还书箱里的夹页',text:'神墨清理还书箱，抖出几张画得很认真的流程图。把它们收进索引，还是留在原书里给下一位一个惊喜？',options:[choice('filepage','收进馆藏索引',0,0,3),choice('leavepage','留给下一个读者',0,3,1)]},
  {title:'旧链接巡检日',text:'索引卡上有一行地址变灰了。神墨找到了两个去处，一个是新版镜像，一个是还能联系上的原作者。',options:[choice('mirrorcard','核对新版镜像',0,1,3),choice('authornote','给作者捎个口信',0,3,1)]},
  {title:'门口的小书摊',text:'书架又腾出一格。神墨推来一车重复的书，问你要摆个交换摊，还是留作下一次共读的公用本。',options:[choice('swapbook','摆半天交换摊',0,2,0,2),choice('bookset','整理一套共读本',0,1,3)]},
 ]},
 {id:'ce',name:'诸葛亮',role:'模型研究员',level:4,building:'resources',style:1,avatar:'assets/avatars/syokatu.jpg',perk:'付费资源活动九折，至少省 2 刀',steps:[
  {title:'这模型真变聪明了吗',text:'诸葛亮抱着跑分单来敲门，眼神里全是不服。',options:[choice('trial','提供测试额度',10,1,5),choice('read','先读公开报告',0,0,3)]},
  {title:'结果对不上',text:'诸葛亮发现自测和宣传有出入，准备来一次更狠的复现。',options:[choice('reproduce','一起复现关键结果',15,2,8),choice('compare','对比现有测试记录',0,1,4)]},
  {title:'全站都在等结论',text:'评测做完了，是时候把结果、脚本和复现步骤摊开给大家看。',options:[choice('open','公开评测与复现方法',0,3,10),choice('workshop','举办小型分享会',0,6,5,2)]},
  {title:'最后一名的那台旧电脑',text:'评测帖下面有人小声问：「我只有旧笔记本，能参加吗？」诸葛亮看了一眼桌上那台吃灰的老机器，找你借电源。',options:[choice('oldpc','给旧电脑单开一组',12,2,7,0,'榜单旁多了一栏旧机器的成绩，第一个提交的人贴了张键盘掉漆的照片。'),choice('loan','把公共机器借给他',0,6,2,0,'那位佬友归还机器时留下了完整笔记，说下次他来教。')]},
  {title:'把猜错的那页贴出来',text:'这回匿名盲测，诸葛亮把两个模型认反了。他把猜错的纸条在手里折了又折：「这页要进报告吗？」',options:[choice('errata','一起写进勘误栏',0,3,7,0,'勘误栏收到了第一条补充，署名就是诸葛亮自己。'),choice('blind','请大家也盲测一次',18,6,4,0,'有人一连猜错三回，把自己的纸条也贴到了墙上。')]},
  {title:'下一场由别人出题',text:'机房的白板擦得干干净净。当初拿旧笔记本来问的佬友抱着题单进门，诸葛亮挪开自己的椅子，让出了主讲位。',options:[choice('hostlab','请他主持开放实验室',0,7,3,0,'开放实验室挂上了轮值牌，诸葛亮坐到最后一排听课。'),choice('testbank','把题单做成公开题库',24,3,9,0,'新题库的第一份评语写着「用老笔记本也能跑完」。')]},
 ],visitDays:14,visits:[
  {title:'白板上还剩一道题',text:'诸葛亮圈出了昨晚争论最久的例子。「要不再跑一遍？也可以先请出题人讲讲，他到底想测什么。」',options:[choice('rerun','留下重跑记录',0,0,3),choice('askwhy','听出题人讲讲',0,3,1)]},
  {title:'给复现报告挑张配图',text:'一张图漂亮，一张图老老实实标了误差。诸葛亮把两张都递过来，让你决定怎么给街坊讲。',options:[choice('errorbar','带大家读误差线',0,1,3),choice('caption','请新人试写图注',0,3,1)]},
  {title:'机房开放半天',text:'今天的轮值牌上写着「带上你的机器来」。诸葛亮腾出了插座，问这半天先照顾第一次来的，还是整理一份实验记录。',options:[choice('plug','给新面孔留插座',0,2,0,2),choice('labnotes','整理公共实验笔记',0,1,3)]},
 ]},
];
for(const resident of RESIDENTS){
 for(const step of [...resident.steps,...resident.visits]){
  for(const option of step.options){Object.freeze(option.rewards);Object.freeze(option);}
  Object.freeze(step.options);Object.freeze(step);
 }
 Object.freeze(resident.steps);Object.freeze(resident.visits);Object.freeze(resident);
}
Object.freeze(RESIDENTS);
const chapterWait=[0,2,2,5,9,14];
export const isMentor=story=>(story?.choices.length??0)>=3;
export function communityProgress(s){
 const peak=Math.max(s.members,...s.history.map(v=>v.members));
 const level=Math.max(s.communityLevel??1,COMMUNITY_LEVELS.filter(v=>peak>=v.members).at(-1).level);
 const next=COMMUNITY_LEVELS[level]??null;
 return {level,name:COMMUNITY_LEVELS[level-1].name,next,remaining:next?Math.max(0,next.members-s.members):0};
}
export function lifeOf(s){return s.life??{completed:{},projects:{},stories:{},specialty:null,awards:[]};}
export function buildingMastery(s,building){
 const count=Object.entries(lifeOf(s).completed).filter(([id])=>id.startsWith(building+'-')).reduce((n,[,value])=>n+value,0);
 return {count,level:count>=8?3:count>=3?2:1,next:count>=8?null:count>=3?8:3};
}
export function residentStatus(s,id){
 const resident=RESIDENTS.find(v=>v.id===id),record=lifeOf(s).stories[id],step=record?.choices.length??0;
 const unlocked=communityProgress(s).level>=resident.level,complete=step===resident.steps.length;
 const visits=record?.visits??0;
 const wait=record?Math.max(0,record.day+(complete?resident.visitDays:chapterWait[step])-s.day):0;
 const episode=complete?resident.visits[visits%resident.visits.length]:resident.steps[step];
 const previousStep=visits?resident.visits[(visits-1)%resident.visits.length]:resident.steps[step-1];
 const previous=previousStep?.options.find(v=>v.id===(visits?record.lastVisit:record.choices[step-1]));
 const route=record?.choices[0];
 const memory=previous?`上回选了「${previous.label}」。${previous.after}`:'还没与你一起办过事。';
 const followup=id==='juan'&&step===1?(route==='repair'?'修复请求有了回音，原作者愿意进帖一起补档。':'可用目录把原作者吸引来了，他想一起补齐缺失资料。'):id==='ce'&&step===1?(route==='trial'?'自测记录和宣传对不上，诸葛亮想继续复现。':'公开报告互相打架，诸葛亮想整理一份可比的结果。'):null;
 const options=step===2?episode.options.map(option=>({...option,rewards:{...option.rewards,content:option.rewards.content+(route===resident.steps[0].options[0].id?2:0),mood:option.rewards.mood+(route===resident.steps[0].options[1].id?1:0)}})):episode.options;
 const recollection=step===3?({
  appoint:'上回你把值班交给了 Neo，这次他带来了接班人的留言。',
  guide:'你们合写的指南已经夹在交班簿里，这一页却没人教过怎么填。',
  publish:'神墨给长期专题补来源时，发现了这份笔记。',
  share:'来共建的佬友寄来一块旧硬盘，神墨从里面翻出了这份笔记。',
  open:'有人照着公开步骤，用一台旧笔记本跑到了最后一行。',
  workshop:'分享会散场时，坐在后排的一位佬友留了下来。',
 })[record.choices[2]]:'';
 const streetNote=complete?visitNews(s,id):'';
 return {...resident,step,unlocked,complete,mentor:isMentor(record),visits,wait,memory,title:episode.title,
  text:[recollection,streetNote,followup||episode.text].filter(Boolean).join(' '),options,canAct:unlocked&&!wait&&!s.gameOver};
}
function visitNews(s,id){
 if(id==='he'){
  if(s.registration==='closed')return '今天暂停注册，Neo 把门口的告示翻到背面，写了句「老朋友也欢迎坐坐」。';
  if(s.mood<40)return '街上这几天火气大。Neo 把值班椅搬到门口，想先听听来龙去脉。';
  return s.registration==='invite'?'今天凭邀请入站，Neo 把邀请名单折好收进口袋。':'今天门开着，Neo 在迎新桌上又添了只杯子。';
 }
 if(id==='juan'){
  if(lifeOf(s).projects.resources)return '楼上正忙着办活动，神墨把还书箱暂时搬到了馆外。';
  return s.content<40?'资料架上有几格还是空的，神墨给空位都夹上了征集卡。':'资料馆刚开门，神墨把新收来的笔记码在靠窗那张桌上。';
 }
 if(s.serverId==='space')return '太空数据中心传来一份新日志，诸葛亮把它打印出来，压在老笔记本底下。';
 return s.members>=1000?'千人社区的评测样本已经装订成册，诸葛亮还留着创站时那份薄薄的对照表。':'机房的旧电脑还插着电，诸葛亮给今天的实验空出了一张桌子。';
}
export function activityBenefits(s,activity){
 const life=lifeOf(s),mastery=buildingMastery(s,activity.building).level-1;
 const completed=id=>isMentor(life.stories[id]);
 const discount=activity.building==='resources'&&completed('ce')?Math.max(2,Math.floor(activity.cost/10)):0;
 return {cost:Math.max(0,activity.cost-discount),rewards:{...activity.rewards,mood:activity.rewards.mood+(activity.building==='benefits'?mastery+Number(completed('he')):0),content:activity.rewards.content+(activity.building==='resources'?mastery+Number(completed('juan')):0)}};
}
export function communityGoals(s){
 const life=lifeOf(s),count=Object.values(life.completed).reduce((a,b)=>a+b,0),stories=Object.values(life.stories).filter(isMentor).length;
 const memberGoal=(target,label)=>({id:'members-'+target,label,current:Math.min(target,Math.max(s.members,...s.history.map(v=>v.members),COMMUNITY_LEVELS[(s.communityLevel??1)-1].members)),target,action:'registration'});
 const levelGoal=(level,label)=>memberGoal(COMMUNITY_LEVELS[level-1].members,label);
 return [
  memberGoal(1,'迎接第一位佬友'),levelGoal(2,'解锁福利羊毛'),
  {id:'activity',label:'在街区办成第一场活动',current:Math.min(1,count),target:1,action:'benefits'},
  levelGoal(3,'解锁资源荟萃'),levelGoal(4,'解锁徽章抽奖与书籍共读'),
  {id:'story',label:'带出第一位社区骨干',current:Math.min(1,stories),target:1,action:'residents'},
  levelGoal(5,'解锁仓库共读与社区特色'),
  {id:'specialty',label:'确定本局社区特色',current:Number(!!life.specialty),target:1,action:'specialty'},
  levelGoal(6,'解锁视频课程共学'),levelGoal(7,'成长为知识之城'),
  {id:'award',label:'拿下首次月度荣誉',current:Math.min(1,life.awards.length),target:1,action:'reviews'},
  levelGoal(8,'小有名气'),levelGoal(9,'开放跨城双活与跨站集市'),
  {id:'team',label:'三位佬友成为社区骨干',current:stories,target:3,action:'residents'},
  levelGoal(10,'建成繁荣都会'),
  {id:'mastery',label:'两栋活动建筑练到专长 3 级',current:['benefits','resources'].filter(b=>buildingMastery(s,b).level===3).length,target:2,action:'benefits'},
  levelGoal(11,'开放区域云'),levelGoal(12,'开放洲际网络与开源大会'),levelGoal(13,'取得轨道建设资格'),
  {id:'orbit',label:'建成太空数据中心',current:Number(s.serverId==='space'),target:1,action:'servers'},
 ];
}
export function validLife(s,activities){
 if(s.life===undefined)return true;
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v),integer=(v,max=1_000_000_000)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
 const life=s.life;
 if(!object(life)||Object.keys(life).sort().join()!=='awards,completed,projects,specialty,stories'||!object(life.completed)||!object(life.projects)||!object(life.stories))return false;
 if(!Object.entries(life.completed).every(([id,count])=>activities.some(a=>a.id===id)&&integer(count)))return false;
 if(!Object.entries(life.projects).every(([building,project])=>object(project)&&Object.keys(project).sort().join()==='activityId,startedDay'&&integer(project.startedDay,s.day)&&activities.some(a=>a.id===project.activityId&&a.building===building)&&PROJECT_DAYS[project.activityId]&&s.buildingActivities?.[building]?.activityId===project.activityId&&s.buildingActivities[building].day===project.startedDay&&(s.gameOver||s.day<project.startedDay+PROJECT_DAYS[project.activityId])))return false;
 if(!Object.entries(life.stories).every(([id,story])=>{
  const resident=RESIDENTS.find(v=>v.id===id);
  if(!resident||!object(story)||!integer(story.day,s.day)||!Array.isArray(story.choices)||!story.choices.length||story.choices.length>resident.steps.length)return false;
  if(!story.choices.every((choice,i)=>resident.steps[i].options.some(option=>option.id===choice)))return false;
  const keys=Object.keys(story).sort().join();
  if(keys==='choices,day')return true;
  if(keys!=='choices,day,lastVisit,visits'||story.choices.length!==resident.steps.length||!integer(story.visits,Math.floor(story.day/resident.visitDays))||story.visits<1)return false;
  return resident.visits[(story.visits-1)%resident.visits.length].options.some(option=>option.id===story.lastVisit);
 }))return false;
 return (life.specialty===null||SPECIALTIES.some(v=>v.id===life.specialty))&&Array.isArray(life.awards)&&life.awards.length<=AWARDS.length&&new Set(life.awards).size===life.awards.length&&life.awards.every(id=>AWARDS.some(v=>v.id===id));
}
