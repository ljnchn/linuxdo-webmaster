import test from 'node:test';
import assert from 'node:assert/strict';
import {loadRankProfiles} from '../src/rank-profiles.mjs';
function fixture(count=1){
 const rows=Array.from({length:count},()=>{
  const fields=Object.fromEntries(['.rank-user-name','.rank-username','.rank-avatar'].map(key=>[key,{textContent:'',append(img){this.img=img;}}]));
  return {fields,querySelector:key=>fields[key]};
 });
 return {children:rows,ownerDocument:{createElement:()=>({addEventListener(type,callback){this[type]=callback;},remove(){this.removed=true;}})}};
}
test('profiles use plain text and SDK blob avatars; failed image leaves initials',async()=>{
 const root=fixture();
 await loadRankProfiles(root,[{userId:42}],{getUserProfile:async()=>({username:'neo',name:'<佬友>',initials:'佬',avatarUrl:'blob:session'})},()=>true);
 const fields=root.children[0].fields;
 assert.equal(fields['.rank-user-name'].textContent,'<佬友>');assert.equal(fields['.rank-username'].textContent,'@neo');
 const avatar=fields['.rank-avatar'];assert.equal(avatar.textContent,'佬');assert.equal(avatar.img.src,'blob:session');
 avatar.img.error();assert.equal(avatar.img.removed,true);
});
test('late profile responses cannot overwrite a newer dialog and unavailable profiles keep scores usable',async()=>{
 const root=fixture(3);let finish,current=true;
 const pending=loadRankProfiles(root,[{userId:1},{userId:null},{userId:3}],{getUserProfile:id=>id===1?new Promise(resolve=>finish=resolve):Promise.reject(Error('deleted'))},()=>current);
 await Promise.resolve();current=false;finish({username:'late',name:'迟到',initials:'迟',avatarUrl:null});await pending;
 assert.equal(root.children[0].fields['.rank-user-name'].textContent,'');
 assert.match(root.children[1].fields['.rank-user-name'].textContent,/暂不可用/);
 assert.match(root.children[2].fields['.rank-user-name'].textContent,/暂不可用/);
});
