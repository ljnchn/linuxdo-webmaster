import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
const rankSource=source.slice(source.indexOf(" async function rank(sort='days')"),source.indexOf('\n function achievements()'));
function harness(transport,local=false){
 const node={textContent:'',html:''},screens=[];
 const api=new Function('transport','local','node','screens',`
 let dialogRevision=0;
 const state={day:4,members:12},fmt=String,icon=()=>'',esc=s=>String(s).replaceAll('<','&lt;');
 const $=()=>node,markup=n=>n,open=(title,html)=>{dialogRevision++;screens.push(html);},loadRankProfiles=()=>{};
 ${rankSource}
 return {rank,leave:()=>dialogRevision++};`)(transport,local,node,screens);
 return {...api,node,screens};
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
 const empty=harness({getLeaderboard:async()=>({entries:[]})});await empty.rank();assert.match(empty.node.html,/暂无上榜成绩/);
 const error=harness({getLeaderboard:async()=>{throw Error('<offline>');}});await error.rank('members');assert.match(error.node.html,/&lt;offline>/);assert.match(error.node.html,/data-rank="members"/);
});
test('new communities send no interval heartbeat before opening',()=>{
 const interval=source.slice(source.indexOf('if(transport){heartbeatTimer='),source.indexOf('if(transport){heartbeatTimer=')+240);
 assert.match(interval,/if\(started&&!busy&&!state.gameOver\)/);
});
test('a durable achievement timestamp of zero still renders unlocked',()=>{
 const body=source.slice(source.indexOf(' function achievements()'),source.indexOf('\n function journal()'));
 let html='';new Function('local','unlocked','ACHIEVEMENTS','open','icon','esc',body+';achievements();')(false,new Map([['first',0]]),[{id:'first',name:'首位佬友',description:'一位佬友'}],(_,value)=>html=value,()=>'',String);
 assert.match(html,/已解锁 1 \/ 1/);assert.match(html,/achievement-card unlocked/);assert.match(html,/已解锁 · /);assert.doesNotMatch(html,/未解锁/);
});
