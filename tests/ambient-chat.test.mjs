import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHAT_LINES, CHAT_TIMING, createChatSchedule, placeChat } from '../src/ambient-chat.mjs';
import { createGame } from '../src/engine.mjs';
import { getCommunityActors, getTroublemakerActors, getSceneActors, createWorld, WORLD_WIDTH, WORLD_HEIGHT } from '../src/world.mjs';

const candidates = [{ id: 'member-0' }, { id: 'member-1' }];
const live = { active: true, candidates, timeSlot: 0 };
function drive(schedule, from, to, context = live) {
  let result;
  for (let now = from; now <= to; now += 200) result = schedule.step(now, context);
  return result;
}
function started(random = () => 0) {
  const schedule = createChatSchedule({ random });
  const message = drive(schedule, 0, 3000);
  assert.ok(message);
  return { schedule, message };
}

test('original short lines and timing configuration are immutable display data', () => {
  assert.deepEqual(CHAT_TIMING, { showMs: 5000, firstMinMs: 3000, firstMaxMs: 6000, gapMinMs: 5000, gapMaxMs: 9000 });
  assert.ok(Object.isFrozen(CHAT_TIMING) && Object.isFrozen(CHAT_LINES));
  assert.ok(CHAT_LINES.length >= 60);
  assert.equal(new Set(CHAT_LINES.map(line => line.text)).size, CHAT_LINES.length);
  for (const line of CHAT_LINES) {
    assert.ok(Object.isFrozen(line));
    assert.ok(line.text.length > 0 && line.text.length <= 30);
    assert.doesNotMatch(line.text, /https?:|@|\n/);
    assert.ok(line.period === undefined || [0, 1, 2].includes(line.period));
  }
});

test('200ms samples show one sentence for five seconds, then wait five to nine seconds', () => {
  for (const randomValue of [0, 0.5, 0.999999]) {
    const schedule = createChatSchedule({ random: () => randomValue });
    const transitions = [];
    let previous = null;
    for (let now = 0; now <= 80000; now += 200) {
      const current = schedule.step(now, live);
      if (current) {
        assert.deepEqual(Object.keys(current).sort(), ['speakerId', 'text']);
        assert.ok(candidates.some(actor => actor.id === current.speakerId));
        if (previous) assert.deepEqual(current, previous, 'a visible sentence is not replaced mid-display');
      }
      if (Boolean(current) !== Boolean(previous)) transitions.push({ now, current });
      previous = current;
    }
    assert.ok(transitions.length >= 6);
    assert.ok(transitions[0].now >= 3000 && transitions[0].now <= 6000);
    for (let i = 1; i < transitions.length; i++) {
      const elapsed = transitions[i].now - transitions[i - 1].now;
      if (!transitions[i].current) assert.equal(elapsed, 5000);
      else assert.ok(elapsed >= 5000 && elapsed <= 9000, `gap ${elapsed}`);
    }
  }
});

test('successive utterances avoid repeating a sentence or speaker when alternatives exist', () => {
  const schedule = createChatSchedule({ random: () => 0 });
  let last = null, previousVisible = false, count = 0;
  for (let now = 0; now <= 90000; now += 200) {
    const current = schedule.step(now, live);
    if (current && !previousVisible) {
      if (last) { assert.notEqual(current.text, last.text); assert.notEqual(current.speakerId, last.speakerId); }
      last = current; count++;
    }
    previousVisible = Boolean(current);
  }
  assert.ok(count >= 6);
});

test('pause, background, game end and disabled contexts clear immediately and resume without catch-up', () => {
  for (const reason of ['pause', 'background', 'game-over', 'disabled']) {
    const { schedule } = started();
    assert.equal(schedule.step(3200, { ...live, active: false, reason }), null);
    assert.equal(schedule.step(900000, { ...live, active: false }), null);
    assert.equal(drive(schedule, 1000000, 1002800), null);
    assert.ok(schedule.step(1003000, live));
  }
});

test('zero candidates reset the wait, and loss of the current speaker hides without replacing it', () => {
  const { schedule, message } = started();
  const remaining = candidates.filter(actor => actor.id !== message.speakerId);
  assert.equal(schedule.step(3200, { ...live, candidates: remaining }), null);
  assert.equal(drive(schedule, 3400, 8000, { ...live, candidates: remaining }), null);
  assert.equal(schedule.step(8200, { ...live, candidates: remaining }).speakerId, remaining[0].id);
  assert.equal(schedule.step(8400, { ...live, candidates: [] }), null);
  assert.equal(drive(schedule, 8600, 11400), null);
  assert.ok(schedule.step(11600, live));
  const empty = createChatSchedule({ random: () => 0 });
  assert.equal(drive(empty, 0, 60000, { ...live, candidates: [] }), null);
});

test('a still-visible speaker survives removal of other candidates and returned messages are copies', () => {
  const { schedule, message } = started();
  const original = { ...message };
  message.text = 'tampered';
  message.speakerId = 'not-a-person';
  assert.deepEqual(schedule.step(3200, { ...live, candidates: [{ id: original.speakerId }] }), original);
});

test('time jumps over 1200ms, backward clocks, invalid clocks and explicit clear discard pending chatter', () => {
  for (const jump of [4401, 900000, 2900, NaN, Infinity]) {
    const { schedule } = started();
    assert.equal(schedule.step(jump, live), null);
    const resume = Number.isFinite(jump) ? jump : 10000;
    assert.equal(drive(schedule, resume, resume + 2800), null);
    assert.ok(schedule.step(resume + 3000, live));
  }
  const { schedule } = started();
  assert.ok(schedule.step(4200, live), 'exactly 1200ms is allowed');
  schedule.clear();
  assert.equal(drive(schedule, 4400, 7200), null);
  assert.ok(schedule.step(7400, live));
  schedule.destroy();
  assert.equal(drive(schedule, 7600, 16000), null);
  schedule.clear();
  assert.equal(schedule.step(16200, live), null, 'destroy cannot be undone by clear');
});

test('new sentences obey morning, afternoon and night restrictions, including a changed period', () => {
  for (const period of [0, 1, 2]) {
    const schedule = createChatSchedule({ random: () => 0.999999 });
    let seen = 0, last = null;
    for (let now = 0; now <= 150000; now += 200) {
      const current = schedule.step(now, { ...live, timeSlot: period });
      if (current && current.text !== last) {
        const line = CHAT_LINES.find(line => line.text === current.text);
        assert.ok(line.period === undefined || line.period === period);
        last = current.text; seen++;
      }
    }
    assert.ok(seen >= 5);
    schedule.clear();
    const nextPeriod = (period + 1) % 3;
    const next = drive(schedule, 151000, 157000, { ...live, timeSlot: nextPeriod });
    const line = CHAT_LINES.find(line => line.text === next.text);
    assert.ok(line.period === undefined || line.period === nextPeriod);
  }
});

const scene = { left: 0, top: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
const viewport = { left: 0, top: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
const actor = { id: 'member-0', x: 500, y: 737 };
const layout = (who = actor, options = {}) => placeChat(who, { scene, viewport, ...options });

test('bubble coordinates follow the actual member, scene scaling and horizontal scrolling', () => {
  const base = layout();
  assert.deepEqual(base, { left: 435, top: 619, width: 172, height: 54, tail: 86 });
  const moved = layout({ ...actor, x: actor.x + 20, y: actor.y + 10 });
  assert.equal(moved.left, base.left + 20); assert.equal(moved.top, base.top + 10);
  const scrolled = layout(actor, { scene: { ...scene, left: -100 } });
  assert.equal(scrolled.left, base.left - 100); assert.equal(scrolled.top, base.top);
  const scaled = layout(actor, { scene: { left: 10, top: 20, width: WORLD_WIDTH / 2, height: WORLD_HEIGHT / 2 } });
  assert.equal(scaled.left + scaled.tail, 10 + (actor.x + 21) / 2);
  assert.equal(scaled.top + scaled.height + 12, 20 + (actor.y - 52) / 2);
});

test('mobile bounds clamp bubbles and tails, and fully off-screen or cramped candidates are excluded', () => {
  const mobile = { left: 0, top: 0, width: 390, height: 844 };
  const left = layout({ x: 0, y: 737 }, { viewport: mobile });
  assert.equal(left.left, 8); assert.equal(left.tail, 13);
  const right = layout({ x: 350, y: 737 }, { viewport: mobile });
  assert.equal(right.left + right.width, 382);
  assert.ok(right.tail >= 12 && right.tail <= right.width - 12);
  for (const offscreen of [{ x: -30, y: 737 }, { x: 390, y: 737 }, { x: 100, y: 40 }, { x: 100, y: 950 }]) {
    assert.equal(layout(offscreen, { viewport: mobile }), null);
  }
  assert.equal(layout(actor, { viewport: { ...viewport, width: 187 } }), null);
  assert.equal(layout(actor, { viewport: { ...viewport, height: 69 } }), null);
  assert.equal(layout(actor, { scene: { ...scene, width: 0 } }), null);
});

test('all blockers reserve an eight-pixel clearance on every side, without moving over controls', () => {
  const bubble = layout();
  const blockers = [
    { left: bubble.left - 10 - 7, top: bubble.top, width: 10, height: 10 },
    { left: bubble.left + bubble.width + 7, top: bubble.top, width: 10, height: 10 },
    { left: bubble.left, top: bubble.top - 10 - 7, width: 10, height: 10 },
    { left: bubble.left, top: bubble.top + bubble.height + 7, width: 10, height: 10 },
  ];
  for (const blocker of blockers) assert.equal(layout(actor, { blockers: [blocker] }), null);
  assert.equal(layout(actor, { blockers: [{ ...bubble }] }), null);
  assert.deepEqual(layout(actor, { blockers: [{ left: bubble.left + bubble.width + 8, top: bubble.top, width: 10, height: 10 }] }), bubble);
});

test('community projections match actual drawn people, exclude trouble overlap and leave saves untouched', () => {
  const state = { ...createGame('测试社区', 123), members: 30, patrons: 1,
    events: [{ id: 'trouble-1', kind: 'troublemaker', createdDay: 0, expiresDay: 10 }, { id: 'article-1', kind: 'article', createdDay: 0, expiresDay: 10 }],
    pendingSponsors: [{ id: 'sponsor-1', expiresDay: 10, amount: 100 }] };
  const saved = JSON.stringify(state);
  assert.deepEqual(getCommunityActors({ ...state, members: 0 }), []);
  for (const reduced of [true, false]) {
    for (const time of [0, 1200, 50000]) {
      const people = getCommunityActors(state, time, reduced);
      assert.ok(people.length > 0 && people.length <= 14);
      assert.equal(new Set(people.map(person => person.id)).size, people.length);
      for (const person of people) assert.ok(getTroublemakerActors(state).every(other => Math.abs(person.x - other.x) >= 85));
    }
  }
  const keys = ['matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const descriptors = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const translations = [];
  let world;
  try {
    globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    globalThis.requestAnimationFrame = () => { throw Error('reduced motion must not request frames'); };
    globalThis.cancelAnimationFrame = () => {};
    const ctx = new Proxy({ translate: (x, y) => translations.push([x, y]) }, { get: (object, key) => object[key] ?? (() => {}) });
    const canvas = { style: {}, getContext: () => ctx, addEventListener() {}, removeEventListener() {} };
    world = createWorld(canvas, () => state, () => {});
    const people = getCommunityActors(state, 0, true);
    assert.deepEqual(translations.slice(0, people.length), people.map(person => [Math.round(person.x), Math.round(person.y)]));
    const allActors = getSceneActors(state, 0, true);
    assert.deepEqual(translations, allActors.map(actor => [actor.x, actor.y]), 'all marked visitors and the host use the same canvas projection');
    assert.equal(people.length, allActors.filter(actor => actor.role === 'member').length);
    assert.ok(allActors.some(actor => actor.role === 'host') && allActors.some(actor => actor.role === 'event') && allActors.some(actor => actor.role === 'sponsor'));
    assert.ok(people.every(person => !person.marker && person.role === 'member'), 'marked visitors, sponsors and the host are never ambient chatter candidates');
    const schedule = createChatSchedule({ random: () => 0.5 });
    drive(schedule, 0, 120000, { ...live, candidates: people });
    assert.equal(JSON.stringify(state), saved, 'visual sampling must preserve all economic fields and rngState');
  } finally {
    world?.destroy();
    keys.forEach((key, index) => { if (descriptors[index]) Object.defineProperty(globalThis, key, descriptors[index]); else delete globalThis[key]; });
  }
});

test('UI wiring keeps decorative chatter off live announcements and out of save/network actions', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const module = await readFile(new URL('../src/ambient-chat.mjs', import.meta.url), 'utf8');
  assert.match(app, /class="ambient-layer" aria-live="off"/);
  assert.match(app, /id="ambient-chat" role="note" hidden/);
  assert.match(app, /little-community-story:ambient-chat:v1/);
  assert.match(app, /chatEnabled&&isRunning\(\)&&state.members>0/);
  assert.match(app, /addEventListener\('scroll',chatScroll/);
  assert.match(app, /addEventListener\('resize',chatScroll/);
  assert.doesNotMatch(module, /\b(fetch|XMLHttpRequest|WebSocket|localStorage|applyAction|rngState)\b/);
});


test('eight user-provided NPC lines are retained verbatim exactly once', () => {
  for (const text of ['在错误的地方','谁又举报我？','neo 哪里跑','你们赢了我却没有输','最爱小鲸鱼！','快来抢红包！','热乎的公益站~','曝光黑心富可敌国']) {
    assert.equal(CHAT_LINES.filter(line=>line.text===text).length, 1);
  }
});
