import {WORLD_WIDTH,WORLD_HEIGHT} from './world.mjs';
// Original and user-provided fictional NPC chatter. Display-only randomness never touches the game seed.
export const CHAT_TIMING=Object.freeze({showMs:5000,firstMinMs:3000,firstMaxMs:6000,gapMinMs:5000,gapMaxMs:9000});
export const CHAT_LINES=Object.freeze([
 {text:'佬友，今天也来逛逛。'}, {text:'先看文档再动手。'}, {text:'这个思路有意思。'},
 {text:'等我写个最小复现。'}, {text:'这篇长文值得收藏。'}, {text:'有问题，慢慢聊。'},
 {text:'开源的快乐又多一点。'}, {text:'咖啡好了，代码呢？'}, {text:'给认真分享的人点赞。'},
 {text:'小黄鸭听懂我的问题了。'}, {text:'先备份，再折腾。'}, {text:'这个报错有点眼熟。'},
 {text:'文档补上一行也很棒。'}, {text:'今天又学到一招。'}, {text:'模型要测，饭也要吃。'},
 {text:'这段代码可以再简洁些。'}, {text:'好问题比答案更难找。'}, {text:'先礼貌，再讨论。'},
 {text:'路过，给佬友递杯茶。'}, {text:'小社区也有大灵感。'}, {text:'别急，让测试跑一会。'},
 {text:'工具再多，备份不能少。'}, {text:'今天的收藏夹又胖了。'}, {text:'灵感来了，记一笔。'},
 {text:'早呀，先看一眼新帖。',period:0}, {text:'晨光正好，开个新坑。',period:0},
 {text:'午后适合慢慢读长文。',period:1}, {text:'喝口水，休息一下。',period:1},
 {text:'在错误的地方'}, {text:'谁又举报我？'}, {text:'neo 哪里跑'}, {text:'你们赢了我却没有输'},
 {text:'最爱小鲸鱼！'}, {text:'快来抢红包！'}, {text:'热乎的公益站~'}, {text:'曝光黑心富可敌国'},
 {text:'马上三级啦'}, {text:'号又被A\\封了'}, {text:'O\\又降智了'}, {text:'大的要来了'}, {text:'我看女装了'},
 {text:'佬友，借一步说话。'}, {text:'感谢佬友，已三连！'}, {text:'今天也是感恩的一天。'},
 {text:'先码住，回头再看。'}, {text:'收藏了就算学会了。'}, {text:'等一个大佬总结。'},
 {text:'佬友们的手速太快了！'}, {text:'这波羊毛赶上了。'}, {text:'来晚了，车开走了。'},
 {text:'公益站又上新了！'}, {text:'求个省流版。'}, {text:'蹲一个后续。'},
 {text:'一觉醒来又变天了。'}, {text:'这帖子有点东西。'}, {text:'我的收藏夹会学的。'},
 {text:'让我康康什么好东西。'}, {text:'路过，给佬友点个赞。'}, {text:'今天的额度又用完了。'},
 {text:'这个模型有点聪明。'}, {text:'刷新一下，奇迹出现。'}, {text:'佬，你是懂分享的。'},
 {text:'刚上车就发车了。'}, {text:'又被佬友带飞了。'}, {text:'我宣布这波血赚！'},
 {text:'夜深了，记得早点睡。',period:2}, {text:'晚安，明天再来折腾。',period:2}
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
