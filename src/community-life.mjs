export const COMMUNITY_LEVELS=Object.freeze([0,10,30,60,120,250,500,1000,1500].map((members,i)=>Object.freeze({level:i+1,members,name:['初来乍到','十人相聚','街角小站','热闹街区','百人社区','特色小镇','知识之城','千人同行','繁荣都会'][i]})));
export const PROJECT_DAYS=Object.freeze({'benefits-badge-draw':2,'resources-repository':2,'resources-course':3});
export const RESIDENT_PLACES=Object.freeze({he:2070,juan:2350,ce:2660});
export const SPECIALTIES=Object.freeze([
 {id:'welcome',name:'迎新社区',description:'每日自然入站人数 +1。'},
 {id:'knowledge',name:'知识社区',description:'每日内容 +1。'},
 {id:'care',name:'互助社区',description:'每日氛围 +1。'},
].map(Object.freeze));
export const AWARDS=Object.freeze([
 {id:'warm',name:'温暖街区',members:60,mood:80,content:0,description:'60 位佬友 · 氛围 80'},
 {id:'library',name:'知识灯塔',members:120,mood:0,content:80,description:'120 位佬友 · 内容 80'},
 {id:'city',name:'共建之城',members:500,mood:70,content:70,description:'500 位佬友 · 氛围、内容 70'},
].map(Object.freeze));
const choice=(id,label,cost,mood,content,members=0)=>({id,label,cost,rewards:{mood,content,members}});
export const RESIDENTS=[
 {id:'he',name:'小禾',role:'热心版主',level:2,building:'benefits',style:3,perk:'福利活动氛围额外 +1',steps:[
  {title:'欢迎帖起了争论',text:'小禾想让新佬友安心留下，请你一起处理。',options:[choice('mediate','一起耐心调解',0,5,0),choice('rules','整理入站公约',0,1,3)]},
  {title:'小禾想试试轮值',text:'上次的处理让小禾有了信心，准备组织一支互助小队。',options:[choice('volunteer','招募热心志愿者',0,3,1),choice('tools','准备轮值工具',10,3,5)]},
  {title:'第一份轮值总结',text:'小禾已经能独当一面，邀请你参加交接。',options:[choice('appoint','邀请担任社区骨干',0,8,3),choice('guide','把经验写成指南',0,4,8)]},
 ]},
 {id:'juan',name:'阿卷',role:'资源整理者',level:3,building:'resources',style:5,perk:'资源活动内容额外 +1',steps:[
  {title:'收藏夹里的链接失效了',text:'阿卷找到了一批旧分享，希望和你一起救回来。',options:[choice('repair','联系作者修复',10,2,4),choice('index','先整理可用目录',0,1,3)]},
  {title:'原作者回信了',text:'阿卷带回了消息，作者愿意继续参与整理。',options:[choice('collaborate','组织作者共建',15,2,7),choice('archive','整理维护档案',0,1,4)]},
  {title:'资源专题准备上线',text:'修复后的资料终于串成了完整专题。',options:[choice('publish','发布长期维护专题',0,3,10),choice('share','邀请佬友来共建',0,5,5,3)]},
 ]},
 {id:'ce',name:'阿策',role:'模型研究员',level:4,building:'resources',style:1,perk:'付费资源活动省 2 星币',steps:[
  {title:'这个模型真的变聪明了吗',text:'阿策带着一份测试单来找你，想认真试一试。',options:[choice('trial','提供测试额度',10,1,5),choice('read','先读公开报告',0,0,3)]},
  {title:'测试结果有些出入',text:'阿策发现了差异，准备做一次更完整的比较。',options:[choice('reproduce','一起复现关键结果',15,2,8),choice('compare','对比现有测试记录',0,1,4)]},
  {title:'佬友们都在等结论',text:'研究已经完成，该把结果分享给社区了。',options:[choice('open','公开评测与复现方法',0,3,10),choice('workshop','举办小型分享会',0,6,5,2)]},
 ]},
];
for(const resident of RESIDENTS){for(const step of resident.steps){for(const option of step.options){Object.freeze(option.rewards);Object.freeze(option);}Object.freeze(step.options);Object.freeze(step);}Object.freeze(resident.steps);Object.freeze(resident);}Object.freeze(RESIDENTS);
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
 const unlocked=communityProgress(s).level>=resident.level,complete=step===3,wait=record&&!complete?Math.max(0,record.day+2-s.day):0;
 const previous=step?resident.steps[step-1].options.find(v=>v.id===record.choices[step-1]).label:null;
 const route=record?.choices[0];
 const memory=previous?`上次与你${previous}。`:'还没与你一起办过事。';
 const followup=id==='juan'&&step===1?(route==='repair'?'你们的修复请求得到了回应，原作者愿意加入。':'可用目录吸引了原作者，他想一起补齐缺失资料。'):id==='ce'&&step===1?(route==='trial'?'自测记录与宣传有差异，阿策想继续复现。':'公开报告互相矛盾，阿策想整理可比的结果。'):null;
 const options=(resident.steps[step]?.options??[]).map(option=>step===2?{...option,rewards:{...option.rewards,content:option.rewards.content+(route===resident.steps[0].options[0].id?2:0),mood:option.rewards.mood+(route===resident.steps[0].options[1].id?1:0)}}:option);
 return {...resident,step,unlocked,complete,wait,memory,title:resident.steps[step]?.title,text:followup||resident.steps[step]?.text,options,canAct:unlocked&&!complete&&!wait&&!s.gameOver};
}
export function activityBenefits(s,activity){
 const life=lifeOf(s),mastery=buildingMastery(s,activity.building).level-1;
 const completed=id=>life.stories[id]?.choices.length===3;
 return {cost:Math.max(0,activity.cost-(activity.building==='resources'&&activity.cost&&completed('ce')?2:0)),rewards:{...activity.rewards,mood:activity.rewards.mood+(activity.building==='benefits'?mastery+Number(completed('he')):0),content:activity.rewards.content+(activity.building==='resources'?mastery+Number(completed('juan')):0)}};
}
export function communityGoals(s){
 const life=lifeOf(s),count=Object.values(life.completed).reduce((a,b)=>a+b,0),stories=Object.values(life.stories).filter(v=>v.choices.length===3).length;
 const memberGoal=(target,label)=>({id:'members-'+target,label,current:Math.min(target,Math.max(s.members,...s.history.map(v=>v.members),COMMUNITY_LEVELS[(s.communityLevel??1)-1].members)),target,action:'registration'});
 return [memberGoal(1,'迎接第一位佬友'),memberGoal(10,'开放福利羊毛'),{id:'activity',label:'完成第一次街区活动',current:Math.min(1,count),target:1,action:'benefits'},memberGoal(30,'开放资源荟萃'),{id:'story',label:'培养第一位社区骨干',current:Math.min(1,stories),target:1,action:'residents'},memberGoal(60,'解锁共读与徽章活动'),memberGoal(120,'选择社区特色'),{id:'specialty',label:'确定本局社区特色',current:Number(!!life.specialty),target:1,action:'specialty'},memberGoal(250,'成长为特色小镇'),{id:'award',label:'获得首次月度荣誉',current:Math.min(1,life.awards.length),target:1,action:'reviews'},memberGoal(500,'成长为知识之城'),{id:'team',label:'三位佬友成为社区骨干',current:stories,target:3,action:'residents'},memberGoal(1000,'达成千人同行'),memberGoal(1500,'建成繁荣都会'),{id:'mastery',label:'两栋活动建筑达到专长 3 级',current:['benefits','resources'].filter(b=>buildingMastery(s,b).level===3).length,target:2,action:'benefits'}];
}
export function validLife(s,activities){
 if(s.life===undefined)return true;
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v),integer=(v,max=1_000_000_000)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
 const life=s.life;
 if(!object(life)||Object.keys(life).sort().join()!=='awards,completed,projects,specialty,stories'||!object(life.completed)||!object(life.projects)||!object(life.stories))return false;
 if(!Object.entries(life.completed).every(([id,count])=>activities.some(a=>a.id===id)&&integer(count)))return false;
 if(!Object.entries(life.projects).every(([building,project])=>object(project)&&Object.keys(project).sort().join()==='activityId,startedDay'&&integer(project.startedDay,s.day)&&activities.some(a=>a.id===project.activityId&&a.building===building)&&PROJECT_DAYS[project.activityId]&&s.buildingActivities?.[building]?.activityId===project.activityId&&s.buildingActivities[building].day===project.startedDay&&(s.gameOver||s.day<project.startedDay+PROJECT_DAYS[project.activityId])))return false;
 if(!Object.entries(life.stories).every(([id,story])=>{const resident=RESIDENTS.find(v=>v.id===id);return resident&&object(story)&&Object.keys(story).sort().join()==='choices,day'&&integer(story.day,s.day)&&Array.isArray(story.choices)&&story.choices.length>=1&&story.choices.length<=3&&story.choices.every((choice,i)=>resident.steps[i].options.some(option=>option.id===choice));}))return false;
 return (life.specialty===null||SPECIALTIES.some(v=>v.id===life.specialty))&&Array.isArray(life.awards)&&life.awards.length<=AWARDS.length&&new Set(life.awards).size===life.awards.length&&life.awards.every(id=>AWARDS.some(v=>v.id===id));
}
