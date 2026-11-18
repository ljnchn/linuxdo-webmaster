import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {museumView} from '../src/museum.mjs';
import {createGame} from '../src/engine.mjs';
const source=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
const rankSource=source.slice(source.indexOf(" async function rank(sort='days')"),source.indexOf('\n function achievements()'));
function harness(transport,local=false){
 const node={textContent:'',html:''},screens=[],profiles=[];
 const api=new Function('transport','local','node','screens','profiles',`
 let dialogRevision=0;
 const state={day:4,members:12},fmt=String,icon=()=>'',esc=s=>String(s).replaceAll('<','&lt;');
 const $=()=>node,markup=n=>n,open=(title,html)=>{dialogRevision++;screens.push(html);},loadRankProfiles=(_,entries)=>profiles.push(...entries);
 ${rankSource}
 return {rank,leave:()=>dialogRevision++};`)(transport,local,node,screens,profiles);
 return {...api,node,screens,profiles};
}
test('local preview never requests or fabricates global leaderboard data',async()=>{
 const h=harness({getLeaderboard(){throw Error('must not call');}},true);await h.rank();
 assert.match(h.screens[0],/不参加全站排行榜/);assert.match(h.screens[0],/本局当前成绩/);assert.equal(h.node.html,'');
});
test('a slower previous sorting request cannot replace the current leaderboard',async()=>{
 let finish;const h=harness({getLeaderboard:sort=>sort==='days'?new Promise(resolve=>finish=resolve):Promise.resolve({entries:[{name:'规模榜',members:40,days:3}]})});
 const pending=h.rank();await h.rank('members');finish({entries:[{name:'过期榜',members:2,days:50}]});await pending;
 assert.match(h.node.html,/规模榜/);assert.doesNotMatch(h.node.html,/过期榜/);
});
test('leaderboard renders explicit empty and retryable error states',async()=>{
 const empty=harness({getLeaderboard:async()=>({entries:[]})});await empty.rank();assert.match(empty.node.html,/榜上还空着/);
 const error=harness({getLeaderboard:async()=>{throw Error('<offline>');}});await error.rank('members');assert.match(error.node.html,/&lt;offline>/);assert.match(error.node.html,/data-rank="members"/);
});
test('both leaderboard sorts render and load profiles only for the first ten entries',async()=>{
 const entries=Array.from({length:100},(_,i)=>({userId:i+1,name:`社区-${i+1}`,members:100-i,days:100-i}));
 for(const sort of ['days','members']){
  const h=harness({getLeaderboard:async()=>({entries})});await h.rank(sort);
  assert.equal((h.node.html.match(/class="rank-row"/g)||[]).length,10);
  assert.deepEqual(h.profiles,entries.slice(0,10));
  assert.match(h.node.html,/社区-10</);assert.doesNotMatch(h.node.html,/社区-11</);
  assert.match(h.screens[0],/仅展示前 10 名/);
 }
});
test('new communities send no interval heartbeat before opening',()=>{
 const interval=source.slice(source.indexOf('if(transport){heartbeatTimer='),source.indexOf('if(transport){heartbeatTimer=')+240);
 assert.match(interval,/if\(!busy&&isRunning\(\)&&performance.now\(\)-lastSyncedAt>=RULES.heartbeatIntervalMs\)/);
});
test('a durable achievement timestamp of zero still renders unlocked',()=>{
 const {html}=museumView(createGame(),new Map([['first-member',0]]),false);
 assert.match(html,/已解锁 <strong>1 \/ 31/);assert.match(html,/achievement-card unlocked/);assert.match(html,/已解锁 · /);
});
