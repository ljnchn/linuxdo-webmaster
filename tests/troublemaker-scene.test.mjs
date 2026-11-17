import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGame, applyAction, migrateState, validateState, EVENTS, RULES, REGISTRATIONS } from '../src/engine.mjs';
import * as scene from '../src/world.mjs';
import { oldEvents } from './fixtures/legacy-events.mjs';

const troublemaker = EVENTS.find(event => event.id === 'troublemaker');
const snapshot = (kind = 'troublemaker', day = 10) => {
  const definition = EVENTS.find(event => event.id === kind);
  return { id: `event-${definition.category}-${day}`, kind, category: definition.category,
    createdDay: day, expiresDay: day + RULES.eventExpiryDays, title: definition.title,
    description: definition.description, options: structuredClone(definition.options) };
};
const fixture = (patch = {}) => ({ ...createGame('我的老社区', 123), day: 12, nextEventDay: 15,
  nextWorldEventDay: 24, members: 20, patrons: 1, mood: 50, content: 50,
  events: [snapshot('article', 9), snapshot('troublemaker', 10), snapshot('troublemaker', 11), snapshot('model', 12)], ...patch });

test('troublemaker choices preserve their existing prices, effects and exact instance resolution', () => {
  assert.deepEqual(troublemaker.options.map(({ id, cost, rewards }) => ({ id, cost, rewards })), [
    { id: 'mediate', cost: 0, rewards: { members: 0, mood: 5, content: 2, cash: 0, patrons: 0 } },
    { id: 'remove', cost: 0, rewards: { members: -1, mood: 10, content: 0, cash: 0, patrons: 0 } },
  ]);
  for (const choice of troublemaker.options) {
    const before = fixture(), original = structuredClone(before), eventId = before.events[2].id;
    assert.equal(validateState(before), true);
    const after = applyAction(before, { type: 'resolve', eventId, optionId: choice.id });
    assert.deepEqual(before, original);
    assert.equal(validateState(after), true);
    assert.deepEqual(after.events, before.events.filter(event => event.id !== eventId));
    assert.equal(after.cash, before.cash);
    assert.equal(after.members, before.members + choice.rewards.members);
    assert.equal(after.mood, before.mood + choice.rewards.mood);
    assert.equal(after.content, before.content + choice.rewards.content);
    assert.equal(after.patrons, choice.id === 'remove' ? 0 : 1);
    for (const field of ['rngState', 'seed', 'serverDaysRemaining', 'serverPeriodsRemaining', 'pendingSponsors', 'history', 'admissionsToday']) {
      assert.deepEqual(after[field], before[field], field);
    }
    assert.equal(after.revision, before.revision + 1);
    assert.throws(() => applyAction(after, { type: 'resolve', eventId, optionId: choice.id }), /不存在/);
  }
});

const actors = state => scene.getTroublemakerActors(state);
test('each live troublemaker gets one distinct on-screen actor, ordered deterministically by event identity', () => {
  const state = fixture(), before = structuredClone(state), found = actors(state);
  assert.deepEqual(found.map(actor => actor.eventId), ['event-character-10', 'event-character-11']);
  assert.deepEqual(actors({ ...state, events: [...state.events].reverse() }), found);
  assert.equal(new Set(found.map(actor => `${actor.x},${actor.y}`)).size, found.length);
  for (const actor of found) {
    assert.ok(Number.isFinite(actor.x) && actor.x > 0 && actor.x < scene.WORLD_WIDTH);
    assert.ok(Number.isFinite(actor.y) && actor.y > 0 && actor.y < scene.WORLD_HEIGHT);
  }
  assert.deepEqual(state, before);
  assert.deepEqual(actors(createGame()), []);
  assert.deepEqual(actors({ ...state, events: state.events.filter(event => event.kind !== 'troublemaker') }), []);
  assert.deepEqual(actors({ ...state, members: 0 }), found, 'event actors do not depend on the ambient population');
});

test('resolved, expired and game-over troublemakers disappear without changing their saved events', () => {
  const state = fixture(), target = state.events[1].id;
  const resolved = applyAction(state, { type: 'resolve', eventId: target, optionId: 'mediate' });
  assert.deepEqual(actors(resolved).map(actor => actor.eventId), ['event-character-11']);
  const stale = { ...state, day: 16 }, copy = structuredClone(stale);
  assert.deepEqual(actors(stale).map(actor => actor.eventId), ['event-character-11']);
  assert.deepEqual(stale, copy, 'display filtering must not edit an old snapshot');
  assert.deepEqual(actors({ ...state, day: 17 }), []);
  assert.deepEqual(actors({ ...state, gameOver: true }), []);
  let clock = state;
  while (clock.day < 16) clock = applyAction(clock, { type: 'tick', periods: 1 });
  assert.equal(validateState(clock), true);
  assert.ok(!actors(clock).some(actor => actor.eventId === target));
  assert.ok(!clock.events.some(event => event.id === target));
  const ending = applyAction(fixture({ timeSlot: 2, serverDaysRemaining: 1, serverPeriodsRemaining: 3 }), { type: 'tick', periods: 1 });
  assert.equal(ending.gameOver, true);
  assert.ok(ending.events.some(event => event.kind === 'troublemaker'), 'ended save can retain unexpired events');
  assert.deepEqual(actors(ending), []);
});

test('legacy v4 troublemaker snapshots render and migrate without new save fields or asset loss', () => {
  const old = fixture();
  const definition = oldEvents.find(event => event.id === 'troublemaker');
  old.events = [{ id: `event-${definition.category}-10`, kind: definition.id, category: definition.category,
    createdDay: 10, expiresDay: 10 + RULES.eventExpiryDays, title: definition.title,
    description: definition.description, options: structuredClone(definition.options) }];
  const saved = JSON.stringify(old), restored = JSON.parse(saved);
  assert.equal(validateState(restored), true);
  const before = actors(restored), migrated = migrateState(restored);
  assert.equal(migrated.version, 4);
  assert.deepEqual(Object.keys(migrated).sort(), Object.keys(restored).sort());
  assert.deepEqual(actors(migrated), before);
  assert.deepEqual(migrateState(migrated), migrated);
  for (const key of Object.keys(old).filter(key => key !== 'events')) assert.deepEqual(migrated[key], old[key], key);
  assert.equal(JSON.stringify(restored), saved);
  assert.equal(validateState(migrated), true);
  assert.equal(migrated.events[0].kind, 'troublemaker');
  assert.equal(Object.hasOwn(migrated.events[0], 'templateId'), false);
});

test('drawing and repeatedly refreshing troublemakers are inert in all time slots and clean up listeners', () => {
  const originalGlobals = Object.fromEntries(['matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const handlers = new Map(), media = { matches: true, addEventListener(type, fn) { this.listener = fn; }, removeEventListener(type, fn) { assert.equal(fn, this.listener); this.listener = null; } };
  let draws = 0, scheduled = 0;
  const ctx = new Proxy({}, { get(target, key) { return target[key] || (() => draws++); }, set(target, key, value) { target[key] = value; return true; } });
  const canvas = { style: {}, getContext: () => ctx, getBoundingClientRect: () => ({ left: 10, top: 20, width: scene.WORLD_WIDTH / 2, height: scene.WORLD_HEIGHT / 2 }), addEventListener: (type, fn) => handlers.set(type, fn), removeEventListener(type, fn) { assert.equal(fn, handlers.get(type)); handlers.delete(type); } };
  let state = fixture(), world;
  const visits = [];
  try {
    globalThis.matchMedia = () => media;
    globalThis.requestAnimationFrame = () => ++scheduled;
    globalThis.cancelAnimationFrame = () => {};
    world = scene.createWorld(canvas, () => state, (...args) => visits.push(args));
    assert.ok(draws > 10);
    assert.equal(scheduled, 0);
    for (const timeSlot of [0, 1, 2]) {
      state = { ...state, timeSlot };
      const before = JSON.stringify(state);
      for (let i = 0; i < 3; i++) { actors(state); world.redraw(); }
      assert.equal(JSON.stringify(state), before);
    }
    handlers.get('click')({ clientX: 10 + 1200 / 2, clientY: 20 + 600 / 2 });
    assert.deepEqual(visits, [['server', '开发调优']]);
    state = { ...state, events: [] }; world.redraw();
    assert.deepEqual(actors(state), []);
    media.matches = false; media.listener();
    assert.equal(scheduled, 1);
    world.destroy(); world = null;
    assert.equal(handlers.size, 0);
    assert.equal(media.listener, null);
  } finally {
    world?.destroy();
    for (const [key, descriptor] of Object.entries(originalGlobals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});

test('event-type detection uses the existing kind field and supports every pending event slot', () => {
  const state = fixture();
  const irrelevant = { ...snapshot('article', 10), templateId: 'troublemaker' };
  assert.deepEqual(actors({ ...state, events: [irrelevant] }), []);
  const pending = Array.from({ length: RULES.maxEvents }, (_, index) => ({ ...snapshot(), id: `test-troublemaker-${index}` }));
  const found = actors({ ...state, events: pending });
  assert.equal(found.length, pending.length);
  assert.equal(new Set(found.map(actor => actor.eventId)).size, pending.length);
  assert.equal(new Set(found.map(actor => `${actor.x},${actor.y}`)).size, pending.length);
  for (const actor of found) {
    assert.ok(actor.x > 0 && actor.x < scene.WORLD_WIDTH);
    assert.ok(actor.y > 0 && actor.y < scene.WORLD_HEIGHT);
  }
});


test('scene event controls keep native keyboard access and route their exact instance to the dialog', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const css = await readFile(new URL('../app.css', import.meta.url), 'utf8');
  assert.match(app, /getSceneActors/);
  assert.match(app, /document\.createElement\(['"]button['"]\)/);
  assert.match(app, /button\.dataset\.sceneEvent=actor\.eventId/);
  assert.match(app, /closest\(['"]\[data-scene-event\]['"]\)/);
  assert.match(app, /events\([^)]*dataset\.sceneEvent\)/);
  assert.match(app, /function events\(eventId/);
  assert.match(app, /\.id===eventId/);
  assert.match(app, /setAttribute\('aria-label',actor\.marker/);
  assert.match(app, /actor\.marker==='×'\?'处理捣乱事件'/);
  assert.match(app, /×/);
  assert.match(css, /:focus-visible/);
  assert.match(app, /KEY='little-community-story:v4'/);
});


test('DOM reconciliation removes all stale actors in one refresh while preserving current button identity', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const source = app.split('\n').find(line => line.trimStart().startsWith('function renderSceneActors('));
  assert.ok(source);
  // A mutable collection deliberately models HTMLCollection removal semantics.
  const root = { children: [], append(button) { this.children.push(button); } };
  const document = { createElement(tagName) {
    assert.equal(tagName, 'button');
    return { dataset: {}, style: {}, attributes: {}, querySelector() { return this.tip ??= {}; },
      setAttribute(name, value) { this.attributes[name] = value; },
      remove() { root.children.splice(root.children.indexOf(this), 1); } };
  } };
  const render = renderFunction('$', 'getSceneActors', 'state', 'document', 'WORLD_WIDTH', 'WORLD_HEIGHT', 'chatMotion', 'icon', `${source};renderSceneActors();`);
  const draw = state => render(selector => { assert.equal(selector, '#scene-actors'); return root; }, scene.getSceneActors, state, document, scene.WORLD_WIDTH, scene.WORLD_HEIGHT, { matches: true }, () => '');
  const state = fixture();
  state.events = state.events.filter(event => event.kind === 'troublemaker');
  draw(state);
  assert.deepEqual(root.children.map(button => button.dataset.sceneEvent), ['event-character-10', 'event-character-11']);
  const buttons = [...root.children];
  draw(state);
  assert.deepEqual(root.children, buttons);
  for (const button of buttons) {
    assert.equal(button.type, 'button');
    assert.match(button.innerHTML, /trouble-marker[^>]*>×/);
    assert.match(button.attributes['aria-label'], /处理捣乱事件/);
  }
  draw({ ...state, gameOver: true });
  assert.equal(root.children.length, 0, 'simultaneous removal must not skip adjacent live children');
  draw(state);
  draw({ ...state, day: 17 });
  assert.equal(root.children.length, 0);
  draw(state);
  draw(applyAction(state, { type: 'resolve', eventId: state.events[0].id, optionId: 'mediate' }));
  assert.deepEqual(root.children.map(button => button.dataset.sceneEvent), ['event-character-11']);
});

test('specific event dialogs show only the selected instance and reject stale IDs without opening another event', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const source = app.split('\n').find(line => line.trimStart().startsWith('function events(eventId'));
  assert.ok(source);
  const opened = [], notices = [];
  let redraws = 0, ends = 0;
  const run = renderFunction('state', 'open', 'eventMarkup', 'esc', 'notify', 'redraw', 'endGame', 'eventId', `let selectedEvent=null;${source};events(eventId);return selectedEvent;`);
  const show = (state, eventId) => run(state, (...args) => opened.push(args), event => event.id, value => value, text => notices.push(text), () => redraws++, () => ends++, eventId);
  const state = fixture(), selected = state.events[2].id;
  assert.equal(show(state, selected), selected);
  assert.ok(opened[0][1].includes(selected));
  assert.ok(!opened[0][1].includes(state.events[1].id));
  assert.match(opened[0][1], /查看所有待办事件/);
  show(state, 'no-such-event');
  show({ ...state, day: 17 }, selected);
  assert.equal(opened.length, 1);
  assert.equal(notices.length, 2);
  assert.equal(redraws, 2);
  show({ ...state, gameOver: true }, selected);
  assert.equal(ends, 1);
  assert.equal(opened.length, 1);
});


test('management refreshes keep the status shortcut current and preserve whichever dialog controls are mounted', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const start = app.indexOf(' function renderManagement()');
  const end = app.indexOf(' function renderSceneActors(', start);
  assert.ok(start >= 0 && end > start);
  const source = app.slice(start, end);
  function controls(attribute, datasetKey) {
    return { children: [], writes: 0,
      set innerHTML(html) {
        this.writes++;
        this.children = [...html.matchAll(new RegExp(`data-${attribute}="([^" ]+)"`, 'g'))].map(match => {
          const classes = new Set();
          return { dataset: { [datasetKey]: match[1] }, attributes: {}, classes,
            classList: { toggle(name, selected) { if (selected) classes.add(name); else classes.delete(name); } },
            setAttribute(name, value) { this.attributes[name] = value; } };
        });
      } };
  }
  const regs = controls('registration', 'registration'), speeds = controls('speed', 'speed');
  const shortcut = { dataset: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
  const symbol = { dataset: {} }, mobileState = {};
  let menuOpen = 'registration';
  const query = selector => {
    assert.notEqual(selector, '#ops-state', 'the removed settings summary must not be queried');
    return ({ '#registration-shortcut': shortcut, '#registration-symbol': symbol, '#registration-mobile-state': mobileState,
      '#registrations': menuOpen === 'registration' ? regs : null, '#speeds': menuOpen === 'settings' ? speeds : null })[selector];
  };
  const render = renderFunction('$', 'REGISTRATIONS', 'RULES', 'state', 'speed', 'esc', 'icon', `${source};renderManagement();`);
  const draw = (state, speed) => render(query, REGISTRATIONS, RULES, state, speed, value => value, () => '');
  const state = fixture();
  draw(state, 1);
  assert.equal(regs.children.length, REGISTRATIONS.length);
  assert.deepEqual(regs.children.map(button => button.dataset.registration), ['open', 'invite', 'closed']);
  assert.equal(speeds.children.length, 0, 'opening-status choices do not mount the speed controls');
  menuOpen = 'settings';
  draw(state, 1);
  assert.equal(speeds.children.length, RULES.speeds.length);
  const regNodes = [...regs.children], speedNodes = [...speeds.children];
  for (const activeMenu of [null, 'registration', 'settings', null]) {
    menuOpen = activeMenu;
    for (const registration of REGISTRATIONS.map(item => item.id)) {
      for (const speed of RULES.speeds) {
        for (const gameOver of [false, true]) {
          draw({ ...state, registration, gameOver }, speed);
          const registrationName = REGISTRATIONS.find(item => item.id === registration).name;
          assert.equal(shortcut.attributes['aria-label'], `开放状态 · ${registrationName}`);
          assert.equal(shortcut.title, shortcut.attributes['aria-label']);
          assert.equal(shortcut.dataset.registrationState, registration);
          assert.equal(mobileState.textContent, registrationName.replace('注册', ''));
          if (menuOpen === 'registration') for (const [index, button] of regs.children.entries()) {
            assert.equal(button, regNodes[index], 'heartbeat must preserve the focused registration node');
            assert.equal(button.attributes['aria-pressed'], String(button.dataset.registration === registration));
            assert.equal(button.classes.has('selected'), button.dataset.registration === registration);
            assert.equal(button.disabled, gameOver);
          }
          if (menuOpen === 'settings') for (const [index, button] of speeds.children.entries()) {
            assert.equal(button, speedNodes[index], 'heartbeat must preserve the actual speed node');
            assert.equal(button.attributes['aria-pressed'], String(Number(button.dataset.speed) === speed));
            assert.equal(button.classes.has('selected'), Number(button.dataset.speed) === speed);
            assert.equal(button.disabled, gameOver);
          }
        }
      }
    }
  }
  assert.equal(regs.writes, 1);
  assert.equal(speeds.writes, 1);
  menuOpen = 'registration';
  draw(state, 2);
  menuOpen = null;
  assert.doesNotThrow(() => draw(state, 2), 'refreshing the scene without an open operations menu is safe');
  assert.deepEqual(regs.children, regNodes);
  assert.equal(regs.children[0].attributes['aria-pressed'], 'true');
  assert.equal(regs.children.every(button => !button.disabled), true);
});

test('closing a dialog restores a connected trigger or falls back to the scene after the actor disappears', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const source = app.split('\n').find(line => line.trimStart().startsWith('function close()'));
  assert.ok(source);
  const run = renderFunction('dialog', 'dialogTrigger', '$', 'setClockActive', 'isRunning', `let dialogRevision=0;${source};close();`);
  for (const triggerState of [true, false, null]) {
    for (const running of [true, false]) {
      const calls = [];
      const dialog = { close() { calls.push('close'); } };
      const trigger = triggerState === null ? null : { isConnected: triggerState, focus() { calls.push('trigger'); } };
      const query = selector => { assert.equal(selector, '#scene-scroll'); return { focus() { calls.push('scene'); } }; };
      run(dialog, trigger, query, active => calls.push(['clock', active]), () => running);
      assert.deepEqual(calls, ['close', triggerState === true ? 'trigger' : 'scene', ['clock', running]]);
    }
  }
});
import {renderFunction} from './fixtures/render-function.mjs';
