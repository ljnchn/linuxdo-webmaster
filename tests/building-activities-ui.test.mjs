import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as engine from '../src/engine.mjs';
import { SCENE_BUILDINGS, WORLD_WIDTH, WORLD_HEIGHT, getSceneBuilding } from '../src/world.mjs';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const functionLine = name => {
  const source = app.split('\n').find(line => new RegExp(`^\\s*(?:async )?function ${name}\\(`).test(line));
  assert.ok(source, `missing ${name}`);
  return source;
};
const actSource = app.slice(app.indexOf(' async function act(action,message)'), app.indexOf('\n async function setClockActive'));
const ready = patch => ({ ...engine.createChallengeGame('分享小站', 123, '一起进步'), members: 20, patrons: 1, communityLevel: 5, ...patch });
const cards = html => [...html.matchAll(/<button\b[^>]*data-activity="([^"]+)"[^>]*>[\s\S]*?<\/button>/g)].map(match => ({ id: match[1], html: match[0], disabled: /<button\b[^>]*\sdisabled(?:\s|>)/.test(match[0]) }));
const show = (state, building) => {
  const opened = [];
  renderFunction('state', 'building', 'activityStatus', 'open', 'esc', 'icon', `${functionLine('buildingActivities')};buildingActivities(building);`)
    (state, building, engine.activityStatus, (...args) => opened.push(args), value => value, () => '');
  assert.equal(opened.length, 1);
  return { title: opened[0][0], html: opened[0][1] };
};

function harness(initial = ready(), transport = null) {
  return renderFunction('initial', 'transport', 'engine', `
    const {RULES, BUILDING_ACTIVITIES, activityStatus, applyAction, migrateState, validateState}=engine;
    let state=structuredClone(initial),busy=false,speed=2,started=true,memoryOnly=false,storageWarning='',
      pendingRestartRequest=null,pendingClockActive=null,serverBackup=null,dialogRevision=0,dialogTrigger=null,owner=true;
    const local=!transport,KEY='little-community-story:v4',writes=[],messages=[],clockCalls=[],elements=new Map();
    let renders=0,redraws=0;
    const clock={progressMs:12345,speed:2,active:true,
      consume(){throw Error('activity must not consume a time period');},
      setSpeed(value){this.speed=value;clockCalls.push(['speed',value]);},
      restore(value){this.progressMs=value;clockCalls.push(['restore',value]);},
      setActive(value){this.active=value;clockCalls.push(['active',value]);}};
    const environment={},storage={setItem(key,value){writes.push({key,value});}},ownsSave=()=>owner,
      notify=(...args)=>messages.push(args),redraw=()=>redraws++,esc=value=>String(value),icon=()=>'',logText=value=>value;
    const document={activeElement:{isConnected:true,focus(){}}},dialog={open:false,showModal(){this.open=true;},close(){this.open=false;}},
      setClockActive=async value=>clock.setActive(value),isRunning=()=>started&&!state.gameOver&&!dialog.open;
    const $=selector=>{
      if(!elements.has(selector))elements.set(selector,{textContent:'',focus(){},
        set innerHTML(value){this.html=value;if(selector==='#dialog-body')renders++;},get innerHTML(){return this.html||'';}});
      return elements.get(selector);
    };
    ${functionLine('save')}
    ${actSource}
    ${functionLine('open')}
    ${functionLine('close')}
    ${functionLine('buildingActivities')}
    ${functionLine('onClick')}
    return {
      show:buildingActivities,close,
      navigate(title='游戏设置'){open(title,'newer panel');},
      setOwner(value){owner=value;},
      click(id){const button={dataset:{activity:id}};return onClick({target:{closest:selector=>selector==='[data-activity]'?button:null}});},
      inspect(){return {state:structuredClone(state),busy,speed,started,memoryOnly,storageWarning,
        writes:structuredClone(writes),messages:structuredClone(messages),clockCalls:structuredClone(clockCalls),
        credit:clock.progressMs,active:clock.active,open:dialog.open,dialogRevision,renders,redraws,
        title:$('#dialog-title').textContent,html:$('#dialog-body').innerHTML};}
    };
  `)(initial, transport, engine);
}

test('rendered building buttons remove the document kiosk and route benefits and resources to their own panels', async () => {
  const start = app.indexOf('${SCENE_BUILDINGS.map(') + 2;
  const end = app.indexOf(".join('')}", start) + ".join('')".length;
  assert.ok(start > 1 && end > start);
  const html = renderFunction('SCENE_BUILDINGS', 'WORLD_WIDTH', 'WORLD_HEIGHT', `return ${app.slice(start, end)};`)(SCENE_BUILDINGS, WORLD_WIDTH, WORLD_HEIGHT);
  assert.equal([...html.matchAll(/<button\b/g)].length, 5);
  assert.doesNotMatch(html, /文档共建|building-documentation|data-action="(?:content|mail)"/);
  assert.match(html, /building-benefits" data-action="benefits"[^>]*查看福利与抽奖/);
  assert.match(html, /building-resources" data-action="resources"[^>]*查看资源分享/);
  assert.equal(getSceneBuilding(1498, 600), null);
  const canvas = app.match(/<canvas\b[^>]*id="world"[^>]*>/)?.[0];
  assert.ok(canvas);
  assert.doesNotMatch(canvas, /文档共建/);
  const destinations = [];
  const dispatch = renderFunction('action', 'ownsSave', 'buildingActivities', `${functionLine('dispatch')};return dispatch(action);`);
  for (const action of ['benefits', 'resources']) await dispatch(action, () => true, value => destinations.push(value));
  assert.deepEqual(destinations, ['benefits', 'resources']);
  const worldSource = app.split('\n').find(line => line.trimStart().startsWith('world=createWorld('));
  const canvasDestinations = [];
  const renderSceneActors = () => {};
  renderFunction('$', 'state', 'createWorld', 'dispatch', 'renderSceneActors', `let world;const environment={};${worldSource}`)(() => ({}), ready(), (_canvas, _getState, visit, onFrame) => {
    assert.equal(onFrame, renderSceneActors, 'world rendering must receive the exact DOM-marker callback');
    visit('benefits'); visit('resources');
  }, action => canvasDestinations.push(action), renderSceneActors);
  assert.deepEqual(canvasDestinations, destinations);
});

test('building panels show two benefits and all four resource categories without prototype disclaimers or changing canonical effects', () => {
  const initial = ready(), before = structuredClone(initial);
  for (const building of ['benefits', 'resources']) {
    const { title, html } = show(initial, building), actual = cards(html);
    const expected = engine.BUILDING_ACTIVITIES.filter(activity => activity.building === building);
    assert.equal(title, building === 'benefits' ? '福利羊毛' : '资源荟萃');
    assert.deepEqual(actual.map(card => card.id), expected.map(activity => activity.id));
    assert.equal(actual.length, building === 'benefits' ? 2 : 4);
    assert.match(html, /每栋建筑独立冷却 7 游戏日/);
    assert.doesNotMatch(html, /虚构|模拟|无真实|不发布或下载真实资源/);
    assert.match(html, building === 'benefits' ? /活动收益计入本局社区的氛围、内容与佬友规模/ : /分享成果计入社区内容与氛围/);
    assert.doesNotMatch(html, /<a\b|https?:\/\/|data-action="mail"/);
    for (const [index, activity] of expected.entries()) {
      assert.equal(actual[index].disabled, false);
      assert.match(actual[index].html, new RegExp(activity.name));
      assert.match(actual[index].html, new RegExp(activity.cost ? `${activity.cost} 星币` : '免费'));
      if (activity.rewards.mood) assert.ok(actual[index].html.includes(`氛围 +${activity.rewards.mood}`));
      if (activity.rewards.content) assert.ok(actual[index].html.includes(`内容 +${activity.rewards.content}`));
    }
  }
  assert.deepEqual(initial, before, 'opening either panel is read-only');
});

test('zero members, game over, cooldown and insufficient funds expose disabled native controls and concrete reasons', () => {
  for (const [patch, reason] of [
    [{ members: 0, patrons: 0 }, /至少需要 1 位佬友/],
    [{ gameOver: true, serverDaysRemaining: 0, serverPeriodsRemaining: 0 }, /本局结束/],
  ]) for (const building of ['benefits', 'resources']) {
    const { html } = show(ready(patch), building);
    for (const card of cards(html)) { assert.equal(card.disabled, true); assert.match(card.html, reason); }
  }
  const used = engine.applyAction(ready(), { type: 'activity', activityId: 'benefits-free-list' });
  const cooldown = show(used, 'benefits').html;
  assert.match(cooldown, /第 8 天可再次开展活动/, 'cooldown dates use the same one-based day labels as the main clock');
  for (const card of cards(cooldown)) { assert.equal(card.disabled, true); assert.match(card.html, /等待 7 个游戏日/); }
  assert.ok(cards(show(used, 'resources').html).every(card => !card.disabled));
  for (const building of ['benefits', 'resources']) for (const card of cards(show(ready({ cash: 0 }), building).html)) {
    const definition = engine.BUILDING_ACTIVITIES.find(activity => activity.id === card.id);
    assert.equal(card.disabled, definition.cost > 0);
    if (definition.cost) assert.match(card.html, /游戏星币不足/);
  }
});

test('draw previews state admission limits once and do not incorrectly disable its other rewards', () => {
  for (const [patch, accepted, reason] of [
    [{ registration: 'open' }, 2, null],
    [{ registration: 'closed' }, 0, /关闭注册/],
    [{ registration: 'invite', admissionsToday: 1 }, 1, /邀请名额仅剩 1/],
    [{ registration: 'invite', admissionsToday: 2 }, 0, /邀请名额已用完/],
    [{ members: 60 }, 0, /容量已满/],
  ]) {
    const card = cards(show(ready(patch), 'benefits').html).find(card => card.id === 'benefits-badge-draw');
    assert.equal(card.disabled, false);
    assert.equal([...card.html.matchAll(/预计入站/g)].length, 1);
    assert.ok(card.html.includes(`预计入站 ${accepted} 位佬友`));
    if (reason) assert.match(card.html, reason);
  }
});

test('all six UI activities use the canonical action, preserve elapsed time, and save the complete updated local run', async () => {
  for (const definition of engine.BUILDING_ACTIVITIES) {
    const initial = ready(), h = harness(initial);
    h.show(definition.building);
    const before = h.inspect();
    assert.equal(before.active, false, 'opening an activity panel pauses the clock');
    await h.click(definition.id);
    const after = h.inspect(), expected = engine.applyAction(initial, { type: 'activity', activityId: definition.id });
    assert.deepEqual(after.state, expected);
    assert.equal(after.writes.length, 1);
    assert.equal(after.writes[0].key, 'little-community-story:v4');
    const saved = JSON.parse(after.writes[0].value);
    assert.deepEqual(saved, { state: expected, speed: 2, started: true, progressMs: 12345 });
    assert.equal(engine.validateState(engine.migrateState(saved.state)), true);
    for (const field of ['day', 'timeSlot', 'serverDaysRemaining', 'serverPeriodsRemaining', 'rngState']) assert.equal(after.state[field], initial[field]);
    assert.equal(after.credit, before.credit);
    assert.equal(after.clockCalls.some(([method]) => method === 'speed' || method === 'restore'), false);
    assert.equal(after.renders, before.renders + 1);
    assert.ok(cards(after.html).every(card => card.disabled), 'successful activity immediately renders the shared building cooldown');
    assert.equal(after.open, true);
  }
});

test('repeated or rejected clicks never save, double-charge, or advance a run', async () => {
  const h = harness();
  h.show('benefits');
  await h.click('benefits-badge-draw');
  const once = h.inspect();
  await h.click('benefits-badge-draw');
  await h.click('benefits-free-list');
  const repeated = h.inspect();
  assert.deepEqual(repeated.state, once.state);
  assert.deepEqual(repeated.writes, once.writes);
  assert.equal(repeated.credit, once.credit);
  for (const [patch, activityId] of [
    [{ cash: 0 }, 'benefits-badge-draw'],
    [{ members: 0, patrons: 0 }, 'resources-software'],
    [{ gameOver: true, serverDaysRemaining: 0, serverPeriodsRemaining: 0 }, 'resources-book'],
  ]) {
    const initial = ready(patch), blocked = harness(initial);
    await blocked.click(activityId);
    assert.deepEqual(blocked.inspect().state, initial);
    assert.equal(blocked.inspect().writes.length, 0);
    assert.equal(blocked.inspect().messages.at(-1)[1], true);
  }
});

test('unknown activity IDs and lost save ownership cannot initiate an activity', async () => {
  const h = harness(), before = h.inspect();
  await h.click('resources-client-created');
  assert.deepEqual(h.inspect().state, before.state);
  assert.equal(h.inspect().writes.length, 0);
  assert.equal(h.inspect().renders, 0);
  h.setOwner(false);
  await h.click('resources-software');
  assert.deepEqual(h.inspect().state, before.state);
  assert.equal(h.inspect().writes.length, 0);
  assert.match(h.inspect().messages.at(-1)[0], /另一个页面/);
});

test('concurrent clicks send one trusted action and preserve the server timing and committed result', async () => {
  const initial = ready(), requests = [];
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const h = harness(initial, { sendAction: request => { requests.push(structuredClone(request)); return pending; } });
  h.show('resources');
  const first = h.click('resources-repository');
  assert.equal(h.inspect().busy, true);
  await h.click('resources-course');
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].action, { type: 'activity', activityId: 'resources-repository' });
  assert.equal(requests[0].revision, initial.revision);
  assert.equal(typeof requests[0].idempotencyKey, 'string');
  const committed = engine.applyAction(initial, requests[0].action);
  finish({ state: committed, timing: { speed: 2, creditMs: 12345 } });
  await first;
  assert.deepEqual(h.inspect().state, committed);
  assert.equal(h.inspect().credit, 12345);
  assert.equal(h.inspect().busy, false);
  assert.equal(h.inspect().writes.length, 0, 'trusted games are not copied into local-mode storage');
  assert.ok(cards(h.inspect().html).every(card => card.disabled));
});

test('a late activity result cannot reopen a dismissed dialog or overwrite any newer dialog', async () => {
  for (const interruption of ['close', 'settings', 'other-building', 'same-building-reopen']) {
    const initial = ready();
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const h = harness(initial, { sendAction: () => pending });
    h.show('benefits');
    const request = h.click('benefits-badge-draw');
    if (interruption === 'close') h.close();
    if (interruption === 'settings') h.navigate();
    if (interruption === 'other-building') h.show('resources');
    if (interruption === 'same-building-reopen') { h.close(); h.show('benefits'); }
    const interrupted = h.inspect();
    const committed = engine.applyAction(initial, { type: 'activity', activityId: 'benefits-badge-draw' });
    finish({ state: committed, timing: { speed: 2, creditMs: 12345 } });
    await request;
    const after = h.inspect();
    assert.deepEqual(after.state, committed, 'valid committed state is still retained after navigation');
    assert.equal(after.open, interrupted.open, interruption);
    assert.equal(after.title, interrupted.title, interruption);
    assert.equal(after.html, interrupted.html, interruption);
    assert.equal(after.renders, interrupted.renders, interruption);
    assert.equal(after.dialogRevision, interrupted.dialogRevision, interruption);
  }
});

test('failed trusted activity retains recovered state and never shows a success or opens another dialog', async () => {
  const initial = ready(), h = harness(initial, {
    sendAction: async () => { throw Object.assign(Error('活动未提交'), { code: 'ACTION_REJECTED' }); },
    getState: async () => ({ state: initial, timing: { speed: 2, creditMs: 12345 } }),
  });
  h.show('resources');
  const before = h.inspect();
  await h.click('resources-course');
  const after = h.inspect();
  assert.deepEqual(after.state, initial);
  assert.equal(after.renders, before.renders);
  assert.equal(after.html, before.html);
  assert.equal(after.messages.some(([message]) => message === '社区活动已完成。'), false);
  assert.equal(after.messages.at(-1)[1], true);
  assert.equal(after.writes.length, 0);
  assert.equal(after.busy, false);
});
import {renderFunction} from './fixtures/render-function.mjs';
