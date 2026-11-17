import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EVENTS, CHARACTER_ATTENTION_KINDS, REGISTRATIONS, RULES, createGame, summarize, validateState, applyAction } from '../src/engine.mjs';
import { getSceneActors, createWorld, WORLD_WIDTH, WORLD_HEIGHT } from '../src/world.mjs';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const functionLine = name => {
  const source = app.split('\n').find(line => new RegExp(`^\\s*(?:async )?function ${name}\\(`).test(line));
  assert.ok(source, `missing ${name}`);
  return source;
};
const event = (kind, id = `ui-${kind}`) => {
  const definition = EVENTS.find(item => item.id === kind);
  assert.ok(definition);
  return { id, kind, category: definition.category, createdDay: 10, expiresDay: 16,
    title: definition.title, description: definition.description, options: structuredClone(definition.options) };
};
const fixture = patch => ({ ...createGame('跟着佬友走', 81725), members: 30, patrons: 1, day: 12,
  nextEventDay: 14, nextWorldEventDay: 24,
  events: ['troublemaker', 'article', ...CHARACTER_ATTENTION_KINDS].map(kind => event(kind)),
  pendingSponsors: [{ id: 'sponsor-a', amount: 100, createdDay: 7, expiresDay: 16, patron: 1 }], ...patch });

function markerDOM(initial, project = getSceneActors) {
  const root = { children: [], append(button) { button.isConnected = true; this.children.push(button); } };
  const document = { createElement(tag) {
    assert.equal(tag, 'button');
    return { dataset: {}, style: {}, attributes: {}, writes: 0, isConnected: false, tip: {}, querySelector() { return this.tip; },
      set innerHTML(value) { this.html = value; this.writes++; }, get innerHTML() { return this.html; },
      setAttribute(name, value) { this.attributes[name] = value; },
      remove() { root.children.splice(root.children.indexOf(this), 1); this.isConnected = false; } };
  } };
  const factory = renderFunction('initial', '$', 'getSceneActors', 'document', 'WORLD_WIDTH', 'WORLD_HEIGHT', 'icon', `
    let state=initial;const chatMotion={matches:true};${functionLine('renderSceneActors')}
    return {draw:frame=>renderSceneActors(frame),setState:value=>{state=value;}};
  `);
  const api = factory(initial, selector => { assert.equal(selector, '#scene-actors'); return root; }, project, document,
    WORLD_WIDTH, WORLD_HEIGHT, kind => `<svg data-test-icon="${kind}"></svg>`);
  return { ...api, root, byId: id => root.children.find(button => button.dataset.actorId === id) };
}

function assertFrame(dom, actors) {
  const marked = actors.filter(actor => actor.marker);
  assert.equal(dom.root.children.length, marked.length);
  for (const actor of marked) {
    const button = dom.byId(actor.id);
    assert.ok(button, actor.id);
    assert.equal(button.type, 'button');
    assert.equal(button.style.left, `${actor.markerX / WORLD_WIDTH * 100}%`);
    assert.equal(button.style.top, `${actor.markerY / WORLD_HEIGHT * 100}%`);
    assert.equal(button.dataset.worldX, String(actor.x));
    assert.equal(button.dataset.worldY, String(actor.y));
    if (actor.eventId) { assert.equal(button.dataset.sceneEvent, actor.eventId); assert.equal(button.dataset.action, undefined); }
    else { assert.equal(button.dataset.action, 'claim'); assert.equal(button.dataset.sceneEvent, undefined); }
  }
}

test('all six attention events and the existing question, trouble and sponsor markers use native actor-bound controls', () => {
  const state = fixture(), before = structuredClone(state), dom = markerDOM(state), actors = getSceneActors(state, 2500, false);
  dom.draw(actors);
  assertFrame(dom, actors);
  assert.equal(dom.root.children.length, 9);
  for (const actor of actors.filter(actor => actor.marker)) {
    const button = dom.byId(actor.id);
    const expectedClass = { '!': 'attention-actor', '?': 'question-actor', '×': 'troublemaker-actor', coin: 'sponsor-actor' }[actor.marker];
    assert.ok(button.className.includes('scene-actor') && button.className.includes(expectedClass));
    if (actor.marker === 'coin') { assert.match(button.innerHTML, /data-test-icon="coin"/); assert.match(button.attributes['aria-label'], /领取富可敌国的赞助/); }
    else {
      assert.ok(button.innerHTML.includes(`>${actor.marker}</span>`));
      assert.ok(button.attributes['aria-label'].includes(state.events.find(item => item.id === actor.eventId).title));
      assert.match(button.attributes['aria-label'], /第 11 天，剩 4 天/);
    }
  }
  assert.deepEqual(actors.filter(actor => actor.marker === '!').map(actor => actor.eventKind).sort(), [...CHARACTER_ATTENTION_KINDS].sort());
  assert.deepEqual(state, before, 'marker rendering never rewrites the save');
  assert.doesNotMatch(app, /id="(?:event-bubble|sponsor-bubble)"|#(?:event-bubble|sponsor-bubble)/);
  assert.match(app, /const blockers=\$\$\('\.scene-actor,/);
});

test('moving and reordered frames preserve node identity, exact event binding and current coordinates', () => {
  const state = fixture(), dom = markerDOM(state), frames = [0, 2500, 9700].map(time => getSceneActors(state, time, false));
  dom.draw(frames[0]);
  const nodes = new Map(dom.root.children.map(button => [button.dataset.actorId, button]));
  assert.ok(frames[0].some(actor => actor.marker && frames[1].find(next => next.id === actor.id).x !== actor.x));
  for (const frame of [frames[1], [...frames[2]].reverse(), frames[2]]) {
    dom.draw(frame);
    assertFrame(dom, frame);
    for (const button of dom.root.children) {
      assert.equal(button, nodes.get(button.dataset.actorId), 'a focused control survives frame and ordering changes');
      assert.equal(button.writes, 1, 'the button contents must not be replaced each animation frame');
    }
  }
});

test('removing and replacing actors never recycles an old event binding or reassigns surviving controls', () => {
  const state = fixture(), dom = markerDOM(state), first = getSceneActors(state, 1000, true);
  dom.draw(first);
  const nodes = new Map(dom.root.children.map(button => [button.dataset.actorId, button]));
  const removed = state.events[2], removedActor = first.find(actor => actor.eventId === removed.id), removedNode = dom.byId(removedActor.id);
  const replacement = event(removed.kind, 'replacement-attention-event');
  const next = { ...state, events: [...state.events.filter(item => item.id !== removed.id), replacement].reverse() };
  dom.setState(next);
  const frame = getSceneActors(next, 1000, true);
  dom.draw(frame);
  assertFrame(dom, frame);
  assert.equal(removedNode.isConnected, false);
  assert.equal(dom.byId(removedActor.id), undefined);
  const replacementActor = frame.find(actor => actor.eventId === replacement.id);
  assert.equal(replacementActor.homeX, removedActor.homeX, 'a reused walking position is not a reused identity');
  assert.notEqual(dom.byId(replacementActor.id), removedNode);
  for (const button of dom.root.children.filter(button => button.dataset.sceneEvent !== replacement.id)) assert.equal(button, nodes.get(button.dataset.actorId));
  const noEvents = { ...next, events: [], pendingSponsors: [] };
  dom.setState(noEvents); dom.draw(getSceneActors(noEvents, 1000, true));
  assert.equal(dom.root.children.length, 0, 'one refresh removes every stale adjacent event and sponsor control');
});

test('zero-member visitors remain actionable while expired, claimed and game-over markers disappear', () => {
  const state = fixture({ members: 0, patrons: 0 }), dom = markerDOM(state), before = structuredClone(state);
  dom.draw();
  assert.equal(dom.root.children.length, state.events.length + 1);
  assert.equal(getSceneActors(state).filter(actor => actor.role === 'member').length, 0);
  const sponsor = dom.byId('sponsor:pending');
  const stillPending = { ...state, pendingSponsors: [{ ...state.pendingSponsors[0], id: 'sponsor-b' }] };
  dom.setState(stillPending); dom.draw();
  assert.equal(dom.byId('sponsor:pending'), sponsor, 'the sponsor entrance remains stable while pending letters change');
  const claimed = { ...state, pendingSponsors: [] };
  dom.setState(claimed); dom.draw();
  assert.equal(dom.byId('sponsor:pending'), undefined);
  assert.equal(dom.root.children.length, state.events.length);
  for (const ending of [{ ...state, day: 16 }, { ...state, gameOver: true }]) {
    dom.setState(ending); dom.draw();
    assert.equal(dom.root.children.length, 0);
  }
  assert.deepEqual(state, before);
});

test('nested actor clicks target the exact event ID and sponsor clicks request direct collection', async () => {
  const state = fixture(), dom = markerDOM(state), eventIds = [], actions = [];
  dom.draw();
  const click = renderFunction('e', 'ownsSave', 'events', 'dispatch', `${functionLine('onClick')};return onClick(e);`);
  for (const button of dom.root.children) {
    const e = { target: { closest(selector) {
      return selector === '[data-scene-event]' && button.dataset.sceneEvent || selector === '[data-action]' && button.dataset.action ? button : null;
    } } };
    await click(e, () => true, id => eventIds.push(id), action => actions.push(action));
  }
  assert.deepEqual(eventIds.sort(), state.events.map(item => item.id).sort());
  assert.deepEqual(actions, ['claim'], 'clicking the gold marker explicitly collects pending support');
  const opened = [];
  const mail = renderFunction('state', 'summarize', 'open', 'icon', 'esc', 'fmt', `${functionLine('mail')};mail();`);
  mail(state, summarize, (...args) => opened.push(args), () => '', value => value, value => String(value));
  assert.match(opened[0][1], /data-claim="sponsor-a"/);
  assert.match(opened[0][1], /data-action="claim"/);
});

test('sponsor panels and entry points use support language while preserving amounts, expiry and explicit claims', async () => {
  const icon = kind => `<svg data-test-icon="${kind}"></svg>`, opened = [];
  const mail = renderFunction('state', 'summarize', 'open', 'icon', 'esc', 'fmt', `${functionLine('mail')};mail();`);
  for (const pendingSponsors of [fixture().pendingSponsors, []]) {
    const state = fixture({ pendingSponsors }), before = structuredClone(state);
    mail(state, summarize, (...args) => opened.push(args), icon, value => value, value => String(value));
    const markup = opened.at(-1).join(' ');
    assert.doesNotMatch(markup, /信箱|邮差|签收|每一封|data-test-icon="mail"/);
    assert.match(markup, /支持|赞助/);
    if (pendingSponsors.length) {
      assert.match(markup, /100/);
      assert.match(markup, /还剩 4 天可领取/);
      assert.match(markup, /data-claim="sponsor-a"/);
      assert.match(markup, /全部领取/);
    } else {
      assert.match(markup, /下轮赞助/);
      assert.doesNotMatch(markup, /data-claim=|data-action="claim"/);
    }
    assert.deepEqual(state, before, 'looking at pending support never claims it automatically');
  }
  const members = renderFunction('state', 'summarize', 'REGISTRATIONS', 'open', 'icon', 'esc', 'fmt', `${functionLine('members')};members();`);
  members(fixture(), summarize, REGISTRATIONS, (...args) => opened.push(args), icon, value => value, value => String(value));
  assert.match(opened.at(-1)[1], /data-action="mail"/);
  assert.doesNotMatch(opened.at(-1).join(' '), /信箱|邮差|签收|data-test-icon="mail"/);
  const calls = [];
  let refreshes = 0;
  const click = renderFunction('e', 'ownsSave', 'act', 'mail', `let dialogRevision=0;const dialog={open:true};${functionLine('onClick')};return onClick(e);`);
  await click({ target: { closest: selector => selector === '[data-claim]' ? { dataset: { claim: 'sponsor-a' } } : null } },
    () => true, async (...args) => { calls.push(args); return true; }, () => refreshes++);
  assert.deepEqual(calls[0][0], { type: 'claim', id: 'sponsor-a' });
  assert.match(calls[0][1], /领取/);
  assert.doesNotMatch(calls[0][1], /签收|信箱/);
  assert.equal(refreshes, 1);
});

test('mixed and duplicate event kinds open only the selected instance and stale IDs cannot redirect to another event', () => {
  const duplicate = event(CHARACTER_ATTENTION_KINDS[0], 'another-help-instance');
  const state = fixture({ events: [event('troublemaker'), event('article'), event('model'), ...CHARACTER_ATTENTION_KINDS.slice(0, 4).map(kind => event(kind)), duplicate] });
  const show = renderFunction('state', 'eventId', 'open', 'notify', 'redraw', 'endGame', 'eventMarkup', 'esc', `let selectedEvent=null;${functionLine('events')};events(eventId);return selectedEvent;`);
  for (const selected of state.events) {
    const opened = [];
    assert.equal(show(state, selected.id, (...args) => opened.push(args), () => assert.fail('unexpected stale event'), () => {}, () => assert.fail('unexpected end'), event => `<p>${event.id}</p>`, value => value), selected.id);
    assert.equal(opened.length, 1);
    assert.ok(opened[0][1].includes(`<p>${selected.id}</p>`));
    for (const other of state.events.filter(item => item !== selected)) assert.ok(!opened[0][1].includes(`<p>${other.id}</p>`));
    assert.equal(opened[0][0], selected.kind === 'troublemaker' ? '处理这场争论。' : selected.title);
  }
  let notices = 0, redraws = 0, ends = 0;
  for (const [current, id] of [[state, 'removed-event'], [{ ...state, day: 16 }, state.events[0].id]]) {
    assert.equal(show(current, id, () => assert.fail('stale marker opened a dialog'), () => notices++, () => redraws++, () => ends++, () => '', value => value), null);
  }
  assert.equal(notices, 2); assert.equal(redraws, 2);
  show({ ...state, gameOver: true }, state.events[0].id, () => assert.fail('ended game opened an event'), () => {}, () => {}, () => ends++, () => '', value => value);
  assert.equal(ends, 1);
});

test('canvas and DOM markers share every rendered frame, including motion, reduced motion and destruction', () => {
  const globals = ['matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const originals = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const state = fixture(), before = structuredClone(state), dom = markerDOM(state, () => assert.fail('DOM must consume the provided frame, not sample another clock'));
  const media = { matches: false, addEventListener(_type, callback) { this.listener = callback; }, removeEventListener(_type, callback) { assert.equal(callback, this.listener); this.listener = null; } };
  const raf = new Map(), listeners = new Map(), translations = [], frames = [];
  let id = 0, world;
  const ctx = new Proxy({ translate: (x, y) => translations.push([x, y]) }, { get: (object, key) => object[key] ?? (() => {}) });
  const canvas = { style: {}, getContext: () => ctx, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  try {
    globalThis.matchMedia = () => media;
    globalThis.requestAnimationFrame = callback => { raf.set(++id, callback); return id; };
    globalThis.cancelAnimationFrame = request => raf.delete(request);
    world = createWorld(canvas, () => state, () => {}, actors => {
      assert.deepEqual(translations.splice(0), actors.map(actor => [actor.x, actor.y]), 'the callback returns exactly the canvas origins drawn in this frame');
      dom.draw(actors); assertFrame(dom, actors); frames.push(structuredClone(actors));
    });
    assert.equal(frames.length, 1);
    const nodes = new Map(dom.root.children.map(button => [button.dataset.actorId, button]));
    for (const time of [1000, 4000, 9000]) {
      const [request, callback] = raf.entries().next().value;
      raf.delete(request); callback(time);
      for (const button of dom.root.children) assert.equal(button, nodes.get(button.dataset.actorId));
    }
    assert.equal(frames.length, 4);
    assert.ok(frames[1].some(actor => actor.marker && actor.x !== frames[3].find(other => other.id === actor.id).x));
    media.matches = true; media.listener();
    assert.equal(raf.size, 0);
    const still = frames.at(-1);
    world.redraw();
    assert.deepEqual(frames.at(-1), still);
    const count = frames.length;
    world.destroy(); world.redraw(); world = null;
    assert.equal(frames.length, count, 'destroyed worlds must not emit later marker frames');
    assert.equal(listeners.size, 0); assert.equal(media.listener, null); assert.equal(raf.size, 0);
    assert.deepEqual(state, before);
  } finally {
    world?.destroy();
    globals.forEach((key, index) => { if (originals[index]) Object.defineProperty(globalThis, key, originals[index]); else delete globalThis[key]; });
  }
});

const canonicalEvent = (definition, day = 12) => ({ ...event(definition.id, `event-${definition.category}-${day}`), createdDay: day, expiresDay: day + RULES.eventExpiryDays });

test('all twenty event kinds retain their own moving actionable character even at zero members', async () => {
  assert.equal(EVENTS.length, 20);
  const click = renderFunction('e', 'ownsSave', 'events', `${functionLine('onClick')};return onClick(e);`);
  for (const members of [0, 30]) for (const [index, definition] of EVENTS.entries()) {
    const state = fixture({ seed: 50000 + members * 20 + index, members, patrons: members ? 1 : 0,
      events: [canonicalEvent(definition)], pendingSponsors: [] });
    assert.equal(validateState(state), true, `${members}/${definition.id}`);
    const before = structuredClone(state), dom = markerDOM(state), positions = new Set();
    let original;
    for (const time of [0, 2500, 9700, 17000]) {
      const frame = getSceneActors(state, time, false), marked = frame.filter(actor => actor.marker);
      assert.equal(marked.length, 1);
      assert.equal(marked[0].eventId, state.events[0].id);
      assert.equal(marked[0].category, definition.category);
      assert.equal(marked[0].marker, definition.id === 'troublemaker' ? '×' : CHARACTER_ATTENTION_KINDS.includes(definition.id) ? '!' : '?');
      if (!members) assert.equal(frame.some(actor => actor.role === 'member'), false);
      positions.add(marked[0].x); dom.draw(frame); assertFrame(dom, frame);
      const button = dom.root.children[0];
      if (original) assert.equal(button, original); else original = button;
      assert.doesNotMatch(button.attributes['aria-label'] + button.title, /虚构|模拟/);
      const opened = [];
      await click({ target: { closest: selector => selector === '[data-scene-event]' ? button : null } }, () => true, id => opened.push(id));
      assert.deepEqual(opened, [state.events[0].id]);
    }
    assert.ok(positions.size > 1, `${definition.id} should walk`);
    assert.deepEqual(getSceneActors(state, 17000, true), getSceneActors(state, 0, true));
    assert.deepEqual(state, before, 'world and DOM rendering never change the saved event or population');
    assert.equal(validateState(state), true);
  }
});

test('maxEvents mixes world and character markers with exact choices, stable survivors, and no stale access after expiry', async () => {
  const definitions = [EVENTS[0], EVENTS[10], EVENTS[3], EVENTS[11], EVENTS[4], EVENTS[12], EVENTS[5], EVENTS[13]];
  assert.equal(definitions.length, RULES.maxEvents);
  for (const members of [0, 30]) {
    let state = fixture({ seed: 70000 + members, members, patrons: members ? 1 : 0,
      events: definitions.map((definition, index) => canonicalEvent(definition, 9 + Math.floor(index / 2))),
      pendingSponsors: [{ id: 'sponsor-7-1', amount: 100, createdDay: 7, expiresDay: 21, patron: 1 }] });
    const before = structuredClone(state), dom = markerDOM(state), actions = [], opened = [], notices = [], sponsorActions = [];
    assert.equal(validateState(state), true);
    const controls = renderFunction('initial', 'open', 'notify', 'applyAction', 'record', 'dispatch', `
      let state=initial,selectedEvent=null,closed=0,dialogRevision=0;const ownsSave=()=>true,esc=String,dialog={open:true},redraw=()=>{},
        endGame=()=>{throw Error('unexpected end');},eventMarkup=event=>'<p>'+event.id+'</p>',
        close=()=>{closed++;dialog.open=false;},act=async action=>{record(action);state=applyAction(state,action);return true;};
      ${functionLine('events')}${functionLine('onClick')}
      return {click:onClick,setState(next){state=next;},inspect:()=>({state,closed}),show:events};
    `)(state, (...args) => opened.push(args), message => notices.push(message), applyAction, action => actions.push(action), action => sponsorActions.push(action));
    const trigger = button => ({ target: { closest: selector => selector === '[data-scene-event]' && button.dataset.sceneEvent || selector === '[data-action]' && button.dataset.action ? button : null } });
    dom.draw(getSceneActors(state, 0, false));
    const nodes = new Map(dom.root.children.map(button => [button.dataset.actorId, button]));
    assert.equal(nodes.size, RULES.maxEvents + 1);
    for (const time of [2500, 9700, 17000]) {
      const frame = getSceneActors(state, time, false); dom.draw(frame); assertFrame(dom, frame);
      for (const button of dom.root.children) {
        assert.equal(button, nodes.get(button.dataset.actorId));
        await controls.click(trigger(button));
        if (button.dataset.sceneEvent) {
          const selected = button.dataset.sceneEvent, html = opened.at(-1)[1];
          assert.match(html, new RegExp(`data-open-event="${selected}"`));
          assert.equal([...html.matchAll(/data-open-event=/g)].length, 1, 'an actor always opens only its own instance');
        }
      }
      for (const actor of frame.filter(actor => actor.marker)) for (const other of frame.filter(other => other.id !== actor.id))
        assert.ok(Math.abs(actor.x - other.x) >= 85, `${actor.id} overlaps ${other.id} at ${time}`);
    }
    assert.deepEqual(sponsorActions, ['claim', 'claim', 'claim']);
    assert.equal(actions.length, 0, 'event markers only open choices; sponsor collection is dispatched separately');
    assert.deepEqual(state, before);

    const selected = state.events.find(item => item.category === 'world');
    await controls.click(trigger(nodes.get(`event:${selected.id}`)));
    const choice = { dataset: { event: selected.id, option: selected.options[1].id } };
    await controls.click({ target: { closest: selector => selector === '[data-event]' ? choice : null } });
    assert.deepEqual(actions, [{ type: 'resolve', eventId: selected.id, optionId: selected.options[1].id }]);
    assert.equal(controls.inspect().closed, 1);
    state = controls.inspect().state;
    assert.equal(validateState(state), true);
    dom.setState(state); dom.draw(getSceneActors(state, 17000, false));
    assert.equal(nodes.get(`event:${selected.id}`).isConnected, false);
    for (const button of dom.root.children) assert.equal(button, nodes.get(button.dataset.actorId), 'resolving another event preserves surviving focus targets');
    const openCount = opened.length;
    await controls.click(trigger(nodes.get(`event:${selected.id}`)));
    assert.equal(opened.length, openCount);
    assert.equal(notices.length, 1);

    while (state.day < 18) { state = applyAction(state, { type: 'tick', periods: 1 }); assert.equal(validateState(state), true); }
    controls.setState(state); dom.setState(state); dom.draw();
    for (const old of before.events) {
      assert.equal(dom.byId(`event:${old.id}`), undefined, 'expired original events disappear even when new events arrive');
      await controls.click(trigger(nodes.get(`event:${old.id}`)));
    }
    assert.equal(opened.length, openCount, 'stale clicks never redirect to a newer event');
    assert.equal(notices.length, 1 + before.events.length);
    assert.ok(dom.byId('sponsor:pending'), 'event expiry does not remove unexpired sponsorship');
    dom.setState({ ...state, gameOver: true }); dom.draw();
    assert.equal(dom.root.children.length, 0);
  }
});
import {renderFunction} from './fixtures/render-function.mjs';
