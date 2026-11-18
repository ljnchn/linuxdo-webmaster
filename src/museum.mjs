import {ACHIEVEMENTS,GALLERIES,achievementMetrics} from './achievements.mjs';
import {icon} from './icons.mjs';
import {markup} from './markup.mjs';

function galleryOf(item){
 if(item.track)return item.track;
 if(['stories','resourceStory'].includes(item.metric))return 'story';
 if(['activities','books','draws','repositories'].includes(item.metric))return 'activity';
 return 'growth';
}

export function museumView(state,unlocked,local){
 const metrics=achievementMetrics(state);
 const earned=item=>local?metrics[item.metric]>=item.threshold:unlocked.has(item.id);
 const collection=gallery=>ACHIEVEMENTS.filter(item=>galleryOf(item)===gallery);
 const fmt=n=>n.toLocaleString('zh-CN');
 function room(id){
  const items=collection(id),track=items.filter(item=>item.track);
  const next=track.find(item=>!earned(item));
  function exhibit(item){
   const done=earned(item),value=Math.min(item.threshold,metrics[item.metric]);
   const status=done?(local?'本局达成':'已解锁 · '+new Date(unlocked.get(item.id)).toLocaleDateString('zh-CN')):'进度 '+fmt(value)+' / '+fmt(item.threshold);
   return `<article class="achievement-card${done?' unlocked':''}" data-metal="${item.metal||''}">
    <span class="achievement-symbol">${icon(item.symbol||(done?'trophy':'closed'))}</span>
    <div><strong>${item.name}</strong>${item.badge?`<small class="badge-catalog">${item.metal}章 · 论坛徽章第 ${item.badge} 号</small>`:''}
    <p>${item.description}</p>${item.origin?`<small class="badge-origin">论坛原型 · ${item.origin}</small>`:''}<small class="museum-status">${status}</small></div></article>`;
  }
  return `<p class="museum-next">${next?`下一枚 <strong>${next.name}</strong> · ${next.description}`:'铜、银、金三枚均已集齐。'}</p>
   <div class="museum-track">${track.map(exhibit).join('')}</div>
   <h3>同馆收藏</h3><div class="achievement-list">${items.filter(item=>!item.track).map(exhibit).join('')}</div>`;
 }
 const html=`<p class="museum-total">${local?'本局达成':'已解锁'} <strong>${ACHIEVEMENTS.filter(earned).length} / ${ACHIEVEMENTS.length}</strong> · ${local?'本机试玩':'跨局收藏'}</p>
  <p class="modal-copy">每个展厅都有铜、银、金三阶。达成游戏条件即可点亮馆藏，原版徽章由论坛另行授予。</p>
  <div class="museum-rooms" role="group" aria-label="切换展厅">${GALLERIES.map((gallery,i)=>{
   const items=collection(gallery.id);
   return `<button type="button" data-gallery="${gallery.id}" aria-pressed="${i===0}">${icon(gallery.symbol)}<strong>${gallery.name}</strong><small>${items.filter(earned).length} / ${items.length}</small></button>`;
  }).join('')}</div><section id="museum-room" aria-label="社区成长">${room('growth')}</section>`;
 return {html,bind(root){
  const panel=root.querySelector('#museum-room');
  const buttons=root.querySelectorAll('[data-gallery]');
  for(const button of buttons)button.onclick=()=>{
   for(const item of buttons)item.setAttribute('aria-pressed',String(item===button));
   panel.setAttribute('aria-label',button.querySelector('strong').textContent);
   markup(panel).html=room(button.dataset.gallery);
  };
 }};
}
