import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createChallengeGame,applyAction,activityStatus} from '../src/engine.mjs';
import {renderActivityActors} from '../src/life-ui.mjs';
import {icon} from '../src/icons.mjs';
import {getSceneActors,WORLD_WIDTH,WORLD_HEIGHT,ACTIVITY_PLACES} from '../src/world.mjs';
import {renderFunction} from './fixtures/render-function.mjs';

test('staff controls follow real unlock, project, cooldown and end states without changing the save',()=>{
 const scene={children:[],append(button){this.children.push(button);},querySelector(selector){return this.children.find(button=>selector===`[data-staff="${button.dataset.staff}"]`);},ownerDocument:{createElement(){return {dataset:{},style:{},attributes:{},setAttribute(key,value){this.attributes[key]=value;},remove(){scene.children.splice(scene.children.indexOf(this),1);}};}}};
 let state={...createChallengeGame(),members:60};
 const render=renderFunction('activityStatus','ACTIVITY_PLACES','WORLD_WIDTH','WORLD_HEIGHT','icon',`return ${renderActivityActors.toString()};`)(activityStatus,ACTIVITY_PLACES,WORLD_WIDTH,WORLD_HEIGHT,icon);
 const draw=()=>{const before=structuredClone(state);render(scene,state);assert.deepEqual(state,before);};
 draw();assert.equal(scene.children.length,2);
 const button=scene.children[0];assert.equal(button.dataset.action,'benefits');assert.equal(button.dataset.ready,'true');assert.match(button.innerHTML,/可办活动/);
 state=applyAction(state,{type:'activity',activityId:'benefits-badge-draw'});draw();assert.equal(scene.children[0],button);assert.equal(button.dataset.ready,'false');assert.match(button.innerHTML,/筹备中 · 2 天/);
 for(let day=1;day<=7;day++){
  for(let period=0;period<3;period++)state=applyAction(state,{type:'tick',periods:1});
  draw();const actor=getSceneActors(state,12000).find(actor=>actor.id==='staff:benefits:0');
  assert.equal(button.style.left,(actor.x+21)/WORLD_WIDTH*100+'%');assert.equal(button.style.top,(actor.y-103)/WORLD_HEIGHT*100+'%');
  if(day===1)assert.match(button.innerHTML,/举办中 · 1 天/);
  if(day===2){assert.match(button.innerHTML,/5 天后再办/);assert.equal(state.life.completed['benefits-badge-draw'],1);}
 }
 assert.equal(activityStatus(state,'benefits').canRun,true);assert.match(button.innerHTML,/可办活动/);
 state={...state,gameOver:true};draw();assert.equal(scene.children.length,0);
 state=createChallengeGame();draw();assert.equal(scene.children.length,0);
 state={...state,members:10};draw();assert.equal(scene.children.length,1);
});

test('clicking head coins collects once on the street, without opening a dialog or advancing time',async()=>{
 const app=await readFile(new URL('../src/app.mjs',import.meta.url),'utf8');
 const dispatch=app.split('\n').find(line=>line.trimStart().startsWith('async function dispatch('));
 const initial={...createChallengeGame(),day:7,nextEventDay:8,members:30,patrons:1,pendingSponsors:[{id:'sponsor-7-1',createdDay:7,expiresDay:21,amount:100,patron:1}]};
 const run=renderFunction('initial','applyAction',`
  let state=initial,dialogRevision=0;const dialog={open:false},ownsSave=()=>true;
  const mail=()=>{throw Error('street collection should not open a dialog');};
  const act=async action=>{state=applyAction(state,action);return true;};
  ${dispatch}
  return {click:()=>dispatch('claim'),state:()=>state};
 `)(initial,applyAction);
 await run.click();assert.equal(run.state().cash,initial.cash+100);assert.equal(run.state().pendingSponsors.length,0);assert.equal(run.state().day,7);
 assert.equal(getSceneActors(run.state()).some(actor=>actor.role==='sponsor'),false);
 await assert.rejects(run.click(),/没有可领取/);assert.equal(run.state().cash,initial.cash+100);
});
