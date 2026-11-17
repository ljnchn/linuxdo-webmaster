import {WORLD_WIDTH,WORLD_HEIGHT} from './world.mjs';
// Original and user-provided NPC chatter. Display-only randomness never touches the game seed.
export const CHAT_TIMING=Object.freeze({showMs:5000,firstMinMs:3000,firstMaxMs:6000,gapMinMs:5000,gapMaxMs:9000});
export const CHAT_LINES=Object.freeze([
 {text:'先搜一下再发帖。'}, {text:'佬，这个有教程吗？'}, {text:'mark，回头慢慢看。'},
 {text:'前排，坐等大佬总结。'}, {text:'插眼，蹲一个后续。'}, {text:'这个报错我昨天刚踩。'},
 {text:'先看版规，再发链接。'}, {text:'又到了赛博菩萨发福利。'}, {text:'公益站且用且珍惜。'},
 {text:'邀请码又抢光了。'}, {text:'注册队列排到门外了。'}, {text:'TL3 保级中，勿扰。'},
 {text:'今天也在努力升 TL3。'}, {text:'徽章收集进度 +1。'}, {text:'已解决，感谢各位佬。'},
 {text:'这个思路可以，收藏了。'}, {text:'最小复现写好了吗？'}, {text:'先备份，再折腾。'},
 {text:'Docker 一把梭，出事再回滚。'}, {text:'这 API 又限流了。'}, {text:'中转站今天还活着吗？'},
 {text:'额度用完，开始省着用。'}, {text:'模型好像又降智了。'}, {text:'跑分图一乐，别太当真。'},
 {text:'等一个真实评测。'}, {text:'这波羊毛我先冲了。'}, {text:'车开走了，下次早点。'},
 {text:'CDK 一秒没，手速吓人。'}, {text:'抽奖绝缘体前来报到。'}, {text:'谢谢分享，好人一生平安。'},
 {text:'楼主更新了，快去看。'}, {text:'这帖值得加精。'}, {text:'建议移到运营反馈。'},
 {text:'别吵了，先看数据。'}, {text:'举报已提交，等版主。'}, {text:'小黑屋又满员了。'},
 {text:'版主今天也在线。'}, {text:'始皇还没睡吗？'}, {text:'神墨在整理资源帖。'},
 {text:'诸葛亮又发评测了。'}, {text:'这个镜像站真快。'}, {text:'Cloudflare 又转圈了。'},
 {text:'证书过期，全站 HTTPS 红。'}, {text:'服务器 502，先别刷新。'}, {text:'机房空调修好了吗？'},
 {text:'这楼歪到虫洞去了。'}, {text:'又有人挖坟了。'}, {text:'重复帖，建议合并。'},
 {text:'已标已解决。'}, {text:'求个省流版。'}, {text:'看不懂，但大受震撼。'},
 {text:'佬友的嘴，骗人的鬼。'}, {text:'先吃饭，回来再说。'}, {text:'键盘已就位，开始折腾。'}, {text:'在错误的地方'}, {text:'谁又举报我？'},
 {text:'neo 哪里跑'}, {text:'你们赢了我却没有输'}, {text:'最爱小鲸鱼！'}, {text:'快来抢红包！'},
 {text:'热乎的公益站~'}, {text:'曝光黑心富可敌国'},
 {text:'早，先刷一遍新帖。',period:0}, {text:'晨光正好，开个新坑。',period:0}, {text:'早八人先来签个到。',period:0},
 {text:'咖啡续上，开始搬砖。',period:0}, {text:'今天的第一条回复。',period:0},
 {text:'午后适合慢慢读长文。',period:1}, {text:'摸鱼时间，来杯咖啡。',period:1}, {text:'下午三点，等一个发车。',period:1},
 {text:'工位上的赛博松弛。',period:1},
 {text:'夜深了，记得早点睡。',period:2}, {text:'晚安，明天再来折腾。',period:2}, {text:'夜猫子还在刷帖。',period:2},
 {text:'凌晨的 L 站最热闹。',period:2}, {text:'再刷一帖就睡。',period:2}
].map(Object.freeze));
export function createChatSchedule({random=Math.random}={}){
 let last=null,wait=0,current=null,remaining=0,previousText='',previousSpeaker=null,destroyed=false,wasActive=false;
 const sample=()=>Math.min(.999999,Math.max(0,Number(random())||0));
 const delay=(first=false)=>(first?CHAT_TIMING.firstMinMs:CHAT_TIMING.gapMinMs)+sample()*((first?CHAT_TIMING.firstMaxMs:CHAT_TIMING.gapMaxMs)-(first?CHAT_TIMING.firstMinMs:CHAT_TIMING.gapMinMs));
 const reset=()=>{last=null;current=null;remaining=0;wait=0;wasActive=false;};
 return {
  step(now,{active,candidates=[],timeSlot=0}={}){
   if(destroyed)return null;
   if(!active||!candidates.length||!Number.isFinite(now)){reset();return null;}
   const gap=last===null?0:now-last;last=now;
   if(!wasActive||gap<0||gap>1200){current=null;remaining=0;wait=delay(true);wasActive=true;return null;}
   if(current){
    remaining-=gap;
    if(!candidates.some(a=>a.id===current.speakerId)||remaining<=0){current=null;wait=delay();return null;}
    return {...current};
   }
   wait-=gap;if(wait>0)return null;
   const speakers=candidates.length>1?candidates.filter(a=>a.id!==previousSpeaker):candidates;
   const speaker=speakers[Math.floor(sample()*speakers.length)];
   const lines=CHAT_LINES.filter(v=>(v.period===undefined||v.period===timeSlot)&&v.text!==previousText);
   const text=lines[Math.floor(sample()*lines.length)].text;
   current={speakerId:speaker.id,text};remaining=CHAT_TIMING.showMs;previousSpeaker=speaker.id;previousText=text;
   return {...current};
  },clear:reset,destroy(){destroyed=true;reset();}
 };
}
const overlaps=(a,b,pad=8)=>a.left<b.left+b.width+pad&&a.left+a.width>b.left-pad&&a.top<b.top+b.height+pad&&a.top+a.height>b.top-pad;
export function placeChat(actor,{scene,viewport,blockers=[],width=172,height=54}){
 if(!actor||!scene||!viewport||scene.width<=0||scene.height<=0||viewport.width<width+16||viewport.height<height+16)return null;
 const headX=scene.left+(actor.x+21)/WORLD_WIDTH*scene.width,headY=scene.top+(actor.y-52)/WORLD_HEIGHT*scene.height;
 if(headX<viewport.left+12||headX>viewport.left+viewport.width-12||headY<viewport.top||headY>viewport.top+viewport.height)return null;
 const left=Math.max(viewport.left+8,Math.min(headX-width/2,viewport.left+viewport.width-width-8));
 const top=headY-height-12;
 const bubble={left,top,width,height};
 if(top<viewport.top+8||top+height>viewport.top+viewport.height-8||blockers.some(r=>overlaps(bubble,r)))return null;
 return {...bubble,tail:Math.max(12,Math.min(width-12,headX-left))};
}
