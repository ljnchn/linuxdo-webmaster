import {COMMUNITY_LEVELS,communityProgress,communityGoals,RESIDENTS,RESIDENT_PLACES,residentStatus,lifeOf,SPECIALTIES,AWARDS} from './community-life.mjs';
import {operatingForecast,activityStatus} from './engine.mjs';
import {markup} from './markup.mjs';
import {WORLD_WIDTH,WORLD_HEIGHT,ACTIVITY_PLACES} from './world.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const portrait=(person,avatars={})=>`<span class="resident-portrait portrait-${person.id}" aria-hidden="true"><img src="${esc(avatars[person.avatar]||person.avatar)}" alt="" draggable="false"></span>`;
const effects=rewards=>[rewards.mood?`氛围 +${rewards.mood}`:'',rewards.content?`内容 +${rewards.content}`:'',rewards.members?`最多迎接 ${rewards.members} 位`:''].filter(Boolean).join(' · ');
export function goalsMarkup(s){
 return `<p class="modal-copy">从第一帖到每天有人催更，一口一口把小站养大。</p><div class="goal-list">${communityGoals(s).map(goal=>`<button type="button" class="goal-row ${goal.current>=goal.target?'done':''}" data-action="${goal.action}"><span>${goal.current>=goal.target?'✓':'○'}</span><strong>${goal.label}</strong><small>${goal.current} / ${goal.target}</small></button>`).join('')}</div><div class="level-road">${COMMUNITY_LEVELS.map(level=>`<span class="${communityProgress(s).level>=level.level?'reached':''}">Lv.${level.level} ${level.name}<small>${level.members} 位佬友</small></span>`).join('')}</div>`;
}
export function residentsMarkup(s,avatars={}){
 return `<p class="modal-copy">一起办成几件小事，把眼熟的 ID 变成真朋友。</p><div class="resident-list">${RESIDENTS.map(person=>{const status=residentStatus(s,person.id);return `<button type="button" class="resident-row" data-resident="${person.id}">${portrait(person,avatars)}<span><strong>${person.name} <small>${person.role}</small></strong><span>${status.unlocked?status.complete?'社区骨干 · '+person.perk:status.memory:`社区 Lv.${person.level} 相遇`}</span><small>${status.complete?'故事已完成':status.wait?`${status.wait} 天后有新消息`:status.unlocked?'有事想和你商量':'还没碰上'} · ${status.step} / 3</small></span><b>${status.canAct?'!':'›'}</b></button>`;}).join('')}</div>`;
}
export function storyMarkup(s,id,avatars={}){
 const status=residentStatus(s,id);
 if(!status.unlocked)return `<div class="resident-intro">${portrait(status,avatars)}<h3>${status.name} · ${status.role}</h3><p>社区 Lv.${status.level} 相遇</p></div>`;
 return `<div class="resident-heading">${portrait(status,avatars)}<span><strong>${status.name} · ${status.role}</strong><small>${status.complete?'社区骨干':`故事 ${status.step+1} / 3`}</small></span></div><p class="story-memory">${esc(status.memory)}</p>${status.complete?`<div class="info-box">${status.perk}</div><p class="modal-copy">这段故事留在社区里了，${status.name}还会继续陪你折腾。</p>`:`<h3>${status.title}</h3><p class="modal-copy">${status.text}</p>${s.gameOver?'<p class="info-box">本局已结束，故事进度留在前局备份里。</p>':status.wait?`<p class="info-box">${status.wait} 个游戏日后再来，先回街景让时间跑起来。</p>`:''}<div class="story-options">${status.options.map(option=>`<button type="button" data-story="${id}" data-story-option="${option.id}" ${!status.canAct||s.cash<option.cost?'disabled':''}><strong>${option.label}</strong><span>${effects(option.rewards)}</span><small>${option.cost?option.cost+' 刀':'免费'}</small></button>`).join('')}</div>`}<button type="button" class="secondary full" data-action="residents">查看其他佬友</button>`;
}
export function specialtyMarkup(s){
 const current=lifeOf(s).specialty,unlocked=communityProgress(s).level>=5;
 return `<p class="modal-copy">${s.gameOver?'本局已结束，可查看已选择的特色。':current?'本局特色已确定，持续影响每日经营。':unlocked?'免费选择一项，本局确定后不能更改。':'社区 Lv.5 开放，先迎接 120 位佬友。'}</p><div class="specialty-options">${SPECIALTIES.map(item=>`<button type="button" data-specialty="${item.id}" ${!unlocked||current||s.gameOver?'disabled':''} class="${current===item.id?'chosen':''}"><strong>${item.name}${current===item.id?' ✓':''}</strong><span>${item.description}</span></button>`).join('')}</div>`;
}
export function reviewsMarkup(s){
 const awards=lifeOf(s).awards;
 return `<p class="modal-copy">${s.gameOver?'本局已结束，未获得的荣誉可在新局挑战。':`每运营满 30 天评选一次。下次在满 ${Math.floor(s.day/30)*30+30} 天时。荣誉在本局保留。`}</p><div class="review-list">${AWARDS.map(award=>`<article class="review-row ${awards.includes(award.id)?'earned':''}"><span class="review-medal" aria-hidden="true">${awards.includes(award.id)?'★':'☆'}</span><div><h3>${award.name}</h3><p>${award.description}</p><small>${awards.includes(award.id)?'已获得':`当前 ${s.members} 位 · 氛围 ${s.mood} · 内容 ${s.content}`}</small></div></article>`).join('')}</div><button type="button" class="secondary full" data-action="specialty">社区特色</button>`;
}
export function financeMarkup(s,serverId=s.serverId){
 const data=operatingForecast(s,serverId),amount=value=>value.toFixed(1);
 return `<div class="finance-summary"><span>赞助日均 <b>+${amount(data.income)}</b></span><span>维护 / 天 <b>−${data.maintenance}</b></span><span>租金摊销 / 天 <b>−${amount(data.rent)}</b></span><strong class="${data.net<0?'deficit':'surplus'}">预计日均结余 ${data.net>=0?'+':''}${amount(data.net)} 刀</strong></div><p class="prototype-note">按当前人数、赞助者估算，不含事件收益。赞助每 7 天产生，需主动领取；租金购买时预付，不会每日再扣。</p>${serverId===s.serverId?`<div class="info-box">待领取 ${data.pending} 刀 · 下次赞助在满 ${data.nextSponsorDay} 天</div><button type="button" class="secondary full" data-action="mail">领取赞助</button>`:''}`;
}
export function renderActivityActors(scene,s){
 for(const [building,x] of Object.entries(ACTIVITY_PLACES)){
  const status=activityStatus(s,building);let button=scene.querySelector('[data-staff="'+building+'"]');
  if(!status.unlocked||s.gameOver){button?.remove();continue;}
  if(!button){button=scene.ownerDocument.createElement('button');button.type='button';button.className='scene-actor activity-actor';button.dataset.staff=building;button.dataset.action=building;button.style.left=(x+21)/WORLD_WIDTH*100+'%';button.dataset.worldX=String(x);scene.append(button);}
  const label=status.project?`${status.project.stage} · ${status.project.remainingDays} 天`:status.remainingDays?`${status.remainingDays} 天后再办`:status.canRun?'可办活动':'查看活动';
  const content=`<span class="actor-marker" aria-hidden="true">${status.project||status.remainingDays?'◷':'+'}</span><span class="actor-tip" aria-hidden="true">${label}</span>`;
  if(button.dataset.content!==content){markup(button).html=content;button.dataset.content=content;}
  const y=status.project&&s.day>status.project.startedDay?690:700;
  button.style.top=(y-103)/WORLD_HEIGHT*100+'%';button.dataset.worldY=String(y);button.dataset.ready=String(status.canRun);
  button.setAttribute('aria-label',`${building==='benefits'?'福利羊毛':'资源荟萃'}工作人员：${label}，点击查看活动`);
  button.title=status.project?`${status.project.name}，${status.project.remainingDays} 天后自动完成`:'点击工作人员安排活动';
 }
}
export function createLifeView(root,notify){
 const goal=root.querySelector('#life-goal'),friends=root.querySelector('#resident-shortcut');
 let previous=null,timer;
 return {
  update(s,started){
   root.hidden=!started||s.gameOver;
   const goals=communityGoals(s),next=goals.find(item=>item.current<item.target),progress=communityProgress(s),life=lifeOf(s);
   const text=`<small>Lv.${progress.level} · ${progress.name}</small><strong>${next?next.label:'全街区目标已完成'}</strong><span>${next?`${next.current} / ${next.target}`:'来看看大家的故事'} ›</span>`;
   if(goal.dataset.text!==text){markup(goal).html=text;goal.dataset.text=text;}
   const available=RESIDENTS.filter(person=>residentStatus(s,person.id).canAct).length;
   friends.textContent=available?`佬友故事 · ${available}`:'佬友故事';
   friends.classList.toggle('has-news',available>0);
   const scene=root.ownerDocument.querySelector('#resident-actors');
   renderActivityActors(scene,s);
   for(const person of RESIDENTS){
    const status=residentStatus(s,person.id);let button=scene.querySelector('[data-resident="'+person.id+'"]');
    if(!status.unlocked||s.gameOver){button?.remove();continue;}
    if(!button){button=scene.ownerDocument.createElement('button');button.type='button';button.className='resident-scene';button.dataset.resident=person.id;button.style.left=(RESIDENT_PLACES[person.id]+21)/WORLD_WIDTH*100+'%';button.style.top=645/WORLD_HEIGHT*100+'%';button.style.width=80/WORLD_WIDTH*100+'%';button.style.height=180/WORLD_HEIGHT*100+'%';scene.append(button);}
    const content=`<span class="resident-signal" aria-hidden="true">${status.complete?'★':status.canAct?'!':status.wait+'天'}</span><span class="resident-name">${person.name}</span>`;
    if(button.dataset.content!==content){markup(button).html=content;button.dataset.content=content;}
    button.dataset.worldX=String(RESIDENT_PLACES[person.id]);button.dataset.worldY='748';button.classList.toggle('has-news',status.canAct);button.setAttribute('aria-label',person.name+'，'+(status.canAct?'有新故事，点击交谈':status.complete?'查看骨干故事':status.wait+' 天后有新故事'));
   }
   const completed=Object.values(life.completed).reduce((n,v)=>n+v,0),snapshot={level:progress.level,completed,awards:life.awards.length,goals:goals.filter(item=>item.current>=item.target).length};
   const messages=[];
   if(previous){
    if(snapshot.level>previous.level)messages.push(`社区升至 Lv.${snapshot.level} · ${progress.name}`);
    if(snapshot.completed>previous.completed&&s.logs.at(-1)?.text.includes('已完成'))messages.push(s.logs.at(-1).text);
    if(snapshot.awards>previous.awards)messages.push('获得新的月度荣誉');
    if(snapshot.goals>previous.goals){root.classList.add('goal-celebrate');clearTimeout(timer);timer=setTimeout(()=>root.classList.remove('goal-celebrate'),1800);}
   }
   previous=snapshot;
   if(messages.length)notify(messages.slice(0,2).join(' · '));
  },destroy(){clearTimeout(timer);}
 };
}
