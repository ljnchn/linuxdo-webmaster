import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EVENTS, RULES, STRATEGIES, createGame, summarize } from '../src/engine.mjs';
import { SCENE_BUILDINGS, WORLD_WIDTH } from '../src/world.mjs';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const line = name => {
  const found = app.split('\n').find(value => new RegExp(`^\\s*(?:async )?function ${name}\\(`).test(value));
  assert.ok(found, `missing ${name}`);
  return found;
};
const node = () => ({ dataset: {}, attributes: {}, style: {}, innerHTML: '', hidden: false, classList: { toggle() {} },
  setAttribute(name, value) { this.attributes[name] = value; } });
const event = (definition, day = 12) => ({ id: `event-${definition.category}-${day}`, kind: definition.id, category: definition.category,
  createdDay: day, expiresDay: day + 6, title: definition.title, description: definition.description, options: structuredClone(definition.options) });

function sceneHarness() {
  const nodes = new Map(), query = selector => { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); };
  const draw = renderFunction('$', 'summarize', 'STRATEGIES', `
    let state,started=true,eventPanelMarkup='';const speed=1,storageWarning='新版试玩',world={redraw(){}},
      remaining=()=>state.serverDaysRemaining+' 天',isRunning=()=>!state.gameOver,fmt=String,logText=String,icon=()=>'',
      renderQuality=()=>{},renderManagement=()=>{},renderClock=()=>{},updateChat=()=>{};
    ${line('renderEvent')}${line('redraw')}
    return (next,active=true)=>{state=next;started=active;redraw();};
  `)(query, summarize, STRATEGIES);
  return { draw, query };
}

test('scene refresh keeps the original community board as the counted all-events entrance and hides the central panel', () => {
  const h = sceneHarness(), board = h.query('.building-board');
  assert.equal(SCENE_BUILDINGS.find(building => building.id === 'board').action, 'events');
  const initial = { ...createGame('公告汇总', 942), day: 12, events: [event(EVENTS[0]), event(EVENTS[10])],
    pendingSponsors: [{ id: 'sponsor-7-1', createdDay: 7, expiresDay: 21, amount: 100, patron: 1 }] };
  for (const [patch, count] of [[{}, 2], [{ events: initial.events.slice(1) }, 1], [{ events: [] }, 0],
    [{ events: [...initial.events, { ...initial.events[0], id: 'already-expired', expiresDay: 12 }] }, 2], [{ gameOver: true }, 0]]) {
    const state = { ...initial, ...patch }, before = structuredClone(state);
    h.draw(state); h.draw(state);
    assert.equal(h.query('.building-board'), board, 'refresh cannot replace the keyboard-focusable board');
    assert.equal(board.dataset.eventCount, String(count));
    assert.equal(board.attributes['aria-label'], `社区公告建筑，查看全部 ${count} 件待处理事件`);
    assert.equal(board.title, `社区公告 · ${count} 件待处理事件`);
    assert.equal(h.query('#event-panel').hidden, !state.gameOver);
    if (!state.gameOver) assert.equal(h.query('#event-panel').innerHTML, '');
    assert.equal(h.query('#storage-warning').textContent, '新版进度');
    assert.deepEqual(state, before);
  }
});

test('community board opens all current events, including mixed world and character events, without claiming sponsors', async () => {
  const state = { ...createGame('所有事件', 56), day: 12,
    events: Array.from({ length: RULES.maxEvents }, (_, index) => event(EVENTS[(index % 2) * 10 + Math.floor(index / 2)], 9 + Math.floor(index / 2))) };
  const opened = [], rendered = [];
  const show = renderFunction('state', 'open', 'eventMarkup', `let selectedEvent='old-selection';const esc=String;${line('events')};events();return selectedEvent;`);
  assert.equal(show(state, (...args) => opened.push(args), item => { rendered.push(item.id); return `<p>${item.title}</p>`; }), null);
  assert.deepEqual(rendered, state.events.map(item => item.id));
  assert.deepEqual([...opened[0][1].matchAll(/data-open-event="([^"]+)"/g)].map(match => match[1]), state.events.map(item => item.id));
  assert.doesNotMatch(opened[0][1], /data-claim|data-action="mail"/);
  const calls = [];
  await renderFunction('ownsSave', 'events', `${line('dispatch')};return dispatch('events');`)(() => true, (...args) => calls.push(args));
  assert.deepEqual(calls, [[]], 'board routing resets any previous individual selection');
  opened.length = 0;
  show({ ...state, events: [] }, (...args) => opened.push(args), () => assert.fail('empty board must not fabricate an event'));
  assert.match(opened[0][1], /今天暂时风平浪静/);
  assert.doesNotMatch(opened[0][1], /data-open-event|data-event=/);
});

function streetHarness({ scrollWidth = WORLD_WIDTH, clientWidth = 900, scrollLeft = 0 } = {}) {
  const scene = { scrollWidth, clientWidth, scrollLeft }, nodes = new Map();
  const query = selector => { if (selector === '#scene-scroll') return scene; if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); };
  let actors = [];
  const draw = renderFunction('$', '$$', 'WORLD_WIDTH', `${line('updateStreet')};return updateStreet;`)(query, selector => {
    assert.equal(selector, '.scene-actor[data-scene-event]', 'direction counts must exclude sponsor and ambient controls');
    return actors.filter(actor => actor.dataset.sceneEvent);
  }, WORLD_WIDTH);
  return { scene, query, draw, setActors(value) { actors = value; } };
}
const actorAt = (markerX, id = 'event') => ({ dataset: { worldX: String(markerX - 21), sceneEvent: id } });

test('pan arrows count only off-screen events at exact marker boundaries and update after movement or removal', () => {
  const h = streetHarness();
  const left = h.query('[data-action="pan-left"]'), right = h.query('[data-action="pan-right"]');
  const actors = [actorAt(23, 'left'), actorAt(24, 'left-edge'), actorAt(876, 'right-edge'), actorAt(877, 'right'),
    { dataset: { worldX: '1700', action: 'mail' } }];
  h.setActors(actors); h.draw();
  assert.equal(left.dataset.eventCount, '1');
  assert.equal(right.dataset.eventCount, '1');
  assert.equal(left.disabled, true); assert.equal(right.disabled, false);
  assert.equal(left.attributes['aria-label'], '向左逛社区，1 件待处理事件在左侧');
  assert.equal(right.title, '向右逛社区，1 件待处理事件在右侧');
  actors[3].dataset.worldX = '400'; h.draw();
  assert.equal(right.dataset.eventCount, '0', 'counts follow the latest DOM-marker coordinates without replacing arrow nodes');
  assert.equal(right.title, '向右逛社区');
  h.setActors([]); h.draw();
  assert.equal(left.dataset.eventCount, '0'); assert.equal(right.dataset.eventCount, '0');
  assert.equal(left.attributes['aria-label'], '向左逛社区');
  assert.equal(h.query('[data-action="pan-left"]'), left);
  assert.match(app, /setInterval\(async\(\)=>\{[^\n]*updateStreet\(\)[^\n]*\},200\)/, 'walking counts refresh even without a scroll event');
});

test('pan boundaries use scaled scroll coordinates and retained arrows only move the scene', async () => {
  const h = streetHarness({ scrollWidth: WORLD_WIDTH / 2, clientWidth: 450, scrollLeft: 500 });
  h.setActors([actorAt(1023, 'left'), actorAt(1024, 'left-edge'), actorAt(1876, 'right-edge'), actorAt(1877, 'right')]);
  h.draw();
  assert.equal(h.query('[data-action="pan-left"]').dataset.eventCount, '1');
  assert.equal(h.query('[data-action="pan-right"]').dataset.eventCount, '1');
  assert.equal(h.query('[data-action="pan-left"]').disabled, false);
  for (const [offset, disabled] of [[1, true], [2, false]]) {
    h.scene.scrollLeft = offset; h.draw(); assert.equal(h.query('[data-action="pan-left"]').disabled, disabled);
  }
  for (const [remaining, disabled] of [[3, false], [2, true], [0, true]]) {
    h.scene.scrollLeft = h.scene.scrollWidth - h.scene.clientWidth - remaining; h.draw();
    assert.equal(h.query('[data-action="pan-right"]').disabled, disabled);
  }
  const calls = [], scene = { clientWidth: 500, scrollBy: value => calls.push(value) };
  const dispatch = renderFunction('action', '$', 'ownsSave', 'chatMotion', `${line('dispatch')};return dispatch(action);`);
  for (const reduced of [false, true]) for (const direction of ['left', 'right']) {
    await dispatch(`pan-${direction}`, selector => { assert.equal(selector, '#scene-scroll'); return scene; }, () => true, { matches: reduced });
    assert.deepEqual(calls.at(-1), { left: (direction === 'left' ? -1 : 1) * 400, behavior: reduced ? 'instant' : 'smooth' });
  }
});
import {renderFunction} from './fixtures/render-function.mjs';
