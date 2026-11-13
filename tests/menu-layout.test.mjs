import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHALLENGE, EVENTS, REGISTRATIONS, RULES, STRATEGIES, applyAction, createGame, createChallengeGame, summarize } from '../src/engine.mjs';
import { ROOM_LAYOUT } from '../src/world.mjs';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const css = await readFile(new URL('../app.css', import.meta.url), 'utf8');
const functionLine = name => {
  const line = app.split('\n').find(line => new RegExp(`^\\s*(?:async )?function ${name}\\(`).test(line));
  assert.ok(line, `missing ${name} function`);
  return line;
};
const section = pattern => {
  const match = app.match(pattern);
  assert.ok(match, 'expected main-scene section');
  return match[0];
};
const attributes = markup => Object.fromEntries([...markup.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));

test('the main menu removes only the content shortcut and retains the remaining native controls', () => {
  const nav = section(/<nav class="side-nav"[^>]*>[\s\S]*?<\/nav>/);
  assert.deepEqual([...nav.matchAll(/<button\b[^>]*data-action="([^"]+)"/g)].map(match => match[1]),
    ['strategy', 'registration', 'members', 'servers', 'operations', 'audio']);
  assert.doesNotMatch(nav, /data-action="content"|aria-label="社区内容"/);
  assert.match(nav, /id="strategy-shortcut"[^>]*aria-label="经营方向"/);
});

test('the leaderboard and achievements are accessible from the main interface', () => {
  const initialMarkup = app.slice(app.indexOf("markup($('#app')).html=`<main class=\"game-shell\""), app.indexOf(" const dialog=$('#dialog');"));
  assert.ok(initialMarkup.includes('top-tools'));
  assert.match(initialMarkup, /data-action="rank"/);
  assert.match(initialMarkup, /data-action="achievements"/);
  assert.match(functionLine('rank'), /transport\.getLeaderboard/);
  assert.match(functionLine('dispatch'), /if\(action==='rank'\)return rank\(\)/);
});

test('removing the challenge label leaves the community name, slogan and economic mode logic intact', () => {
  const resources = section(/<section class="resource-bar"[^>]*>[\s\S]*?<\/section>/);
  assert.doesNotMatch(resources, /level-label|挑战经营|原局规则/);
  assert.doesNotMatch(functionLine('redraw'), /#level-label/);
  assert.match(resources, /id="station-name"/);
  assert.match(resources, /id="station-slogan"/);
  assert.match(functionLine('redraw'), /sum\.difficulty==='challenge'/);
});

test('one icon-only opening-status button sits beside the heart and the three choices exist only in its dialog', () => {
  const nav = section(/<nav class="side-nav"[^>]*>[\s\S]*?<\/nav>/);
  assert.match(nav, /<button\b[^>]*id="strategy-shortcut"[^>]*>[\s\S]*?<\/button>\s*<button\b[^>]*data-action="registration"/);
  const shortcut = nav.match(/<button\b[^>]*id="registration-shortcut"[^>]*>[\s\S]*?<\/button>/)?.[0];
  assert.ok(shortcut);
  assert.match(shortcut, /aria-label="开放状态/);
  assert.match(shortcut, /aria-haspopup="dialog"/);
  assert.equal([...app.matchAll(/id="registration-shortcut"/g)].length, 1);
  assert.doesNotMatch(nav, /id="registrations"|data-registration=|class="management-bar"/);
  assert.doesNotMatch(app, /<section class="management-bar"/);
  assert.equal([...app.matchAll(/id="registrations"/g)].length, 1);
  assert.doesNotMatch(app, /#ops-state/);
  const source = functionLine('registration'), opened = [];
  let refreshes = 0;
  renderFunction('open', 'renderManagement', 'state', 'REGISTRATIONS', 'esc', 'icon', `${source};registration();`)
    ((...args) => opened.push(args), () => refreshes++, createGame(), REGISTRATIONS, value => value, () => '');
  assert.equal(opened[0][0], '开放状态');
  assert.match(opened[0][1], /id="registrations"/);
  assert.match(opened[0][1], /role="group" aria-label="开放状态"/);
  assert.equal(refreshes, 1, 'opening the dialog initializes its three choices from the current save');
  assert.match(functionLine('dispatch'), /if\(action==='registration'\)return registration\(\)/);
  const resources = section(/<section class="resource-bar"[^>]*>[\s\S]*?<\/section>/);
  assert.match(resources, /<button\b[^>]*data-action="members"/);
  assert.match(resources, /<button\b[^>]*data-action="servers"/);
});

test('the status dialog keeps three named native choices with selection, disabled state and stable focus targets', () => {
  const start = app.indexOf(' function renderManagement('), end = app.indexOf(' function renderSceneActors(', start);
  assert.ok(start >= 0 && end > start);
  const source = app.slice(start, end);
  const root = { children: [], writes: 0,
    set innerHTML(html) {
      this.writes++;
      this.children = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(([markup]) => {
        const attrs = attributes(markup.match(/<button\b[^>]*>/)[0]), classes = new Set();
        return { markup, attributes: attrs, dataset: { registration: attrs['data-registration'] }, classes,
          setAttribute(name, value) { this.attributes[name] = value; },
          classList: { toggle(name, active) { if (active) classes.add(name); else classes.delete(name); } } };
      });
    } };
  const render = renderFunction('$', 'state', 'REGISTRATIONS', 'RULES', 'speed', 'esc', 'icon', `${source};renderManagement();`);
  const draw = state => render(selector => selector === '#registrations' ? root : null, state, REGISTRATIONS, RULES, 1, value => value, () => '');
  draw(createGame());
  const originalNodes = [...root.children];
  assert.deepEqual(originalNodes.map(button => button.dataset.registration), ['open', 'invite', 'closed']);
  for (const [index, button] of originalNodes.entries()) {
    assert.equal(button.attributes.type, 'button');
    assert.ok(button.attributes['aria-label'].includes(REGISTRATIONS[index].name));
    assert.ok(button.attributes.title.length > 0);
    assert.equal(button.attributes['data-action'], undefined, 'direct status controls must not be intercepted by menu routing');
    assert.ok(button.markup.includes(REGISTRATIONS[index].name.replace('注册', '')));
  }
  for (const registration of ['open', 'invite', 'closed']) for (const gameOver of [false, true]) {
    const state = { ...createGame(), registration, gameOver }, before = structuredClone(state);
    draw(state);
    for (const [index, button] of root.children.entries()) {
      assert.equal(button, originalNodes[index], 'a heartbeat must not replace the focused button');
      const selected = button.dataset.registration === registration;
      assert.equal(button.attributes['aria-pressed'], String(selected));
      assert.equal(button.classes.has('selected'), selected);
      assert.equal(button.disabled, gameOver);
    }
    assert.deepEqual(state, before);
  }
  assert.equal(root.writes, 1);
  assert.match(css, /\.side-nav button:focus-visible\{[^}]*outline:/);
});

test('the opening-status icon, tooltip and accessible current state update without replacing its focus target', () => {
  const start = app.indexOf(' function renderManagement('), end = app.indexOf(' function renderSceneActors(', start);
  const source = app.slice(start, end), shortcut = { dataset: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
  const symbol = { dataset: {}, writes: 0, set innerHTML(value) { this.html = value; this.writes++; } }, mobileState = {};
  const query = selector => ({ '#registration-shortcut': shortcut, '#registration-symbol': symbol, '#registration-mobile-state': mobileState })[selector] || null;
  const render = renderFunction('$', 'state', 'REGISTRATIONS', 'RULES', 'speed', 'esc', 'icon', `${source};renderManagement();`);
  for (const registration of REGISTRATIONS) {
    const state = { ...createGame(), registration: registration.id }, before = structuredClone(state);
    const draw = () => render(query, state, REGISTRATIONS, RULES, 1, value => value, id => `<svg data-icon="${id}"></svg>`);
    draw();
    assert.equal(shortcut.title, `开放状态 · ${registration.name}`);
    assert.equal(shortcut.attributes['aria-label'], shortcut.title);
    assert.equal(shortcut.dataset.registrationState, registration.id);
    assert.equal(symbol.dataset.state, registration.id);
    assert.equal(symbol.html, `<svg data-icon="${registration.id}"></svg>`);
    assert.equal(mobileState.textContent, registration.name.replace('注册', ''));
    const writes = symbol.writes;
    draw(); draw();
    assert.equal(symbol.writes, writes, 'unchanged heartbeat frames preserve the existing symbol node');
    assert.deepEqual(state, before);
  }
  assert.match(css, /\.side-nav button:hover:after,\.side-nav button:focus-visible:after\{opacity:1\}/);
  assert.match(css, /\.side-nav #registration-symbol\{[^}]*position:static/);
});

test('refreshing or switching dialog content preserves the original trigger while advancing its revision', () => {
  const focus = [], activation = [], elements = new Map();
  const trigger = { isConnected: true, focus: () => focus.push('status shortcut') };
  const inner = { isConnected: false, focus: () => focus.push('removed inner button') };
  const nextTrigger = { isConnected: true, focus: () => focus.push('event entrance') };
  const document = { activeElement: trigger };
  const dialog = { open: false, shows: 0, showModal() { this.open = true; this.shows++; }, close() { this.open = false; } };
  const query = selector => {
    if (!elements.has(selector)) elements.set(selector, { focus: () => focus.push('scene') });
    return elements.get(selector);
  };
  const h = renderFunction('document', 'dialog', '$', 'setClockActive', 'isRunning', `
    let dialogTrigger=null,dialogRevision=0;${functionLine('open')}${functionLine('close')}
    return {open,close,inspect:()=>({dialogTrigger,dialogRevision})};
  `)(document, dialog, query, active => activation.push(active), () => !dialog.open);
  h.open('开放状态', 'first content');
  assert.equal(h.inspect().dialogTrigger, trigger);
  assert.equal(h.inspect().dialogRevision, 1);
  document.activeElement = inner;
  h.open('开放状态', 'updated content');
  assert.equal(h.inspect().dialogTrigger, trigger, 'content refresh must not remember a node it is about to remove');
  assert.equal(h.inspect().dialogRevision, 2);
  assert.equal(dialog.shows, 1);
  h.close();
  assert.equal(h.inspect().dialogRevision, 3, 'closing invalidates pending dialog operations');
  assert.deepEqual(focus, ['status shortcut']);
  assert.deepEqual(activation, [false, false, true]);
  document.activeElement = nextTrigger;
  h.open('社区事件', 'event content');
  assert.equal(h.inspect().dialogTrigger, nextTrigger);
  assert.equal(h.inspect().dialogRevision, 4);
  document.activeElement = inner;
  h.open('待领取赞助', 'another panel');
  assert.equal(h.inspect().dialogTrigger, nextTrigger);
  assert.equal(h.inspect().dialogRevision, 5);
  h.close();
  assert.deepEqual(focus, ['status shortcut', 'event entrance']);
});

test('closing event dialogs restores a live board or actor and safely falls back after the actor is removed', () => {
  const focused = [], activation = [], elements = new Map();
  const scene = { focus: () => focused.push('scene') };
  const board = { dataset: { action: 'events' }, isConnected: true, focus: () => focused.push('board') };
  const actor = { dataset: { sceneEvent: 'event-character-1' }, isConnected: true, focus: () => focused.push('actor') };
  const document = { activeElement: null };
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const query = selector => {
    if (selector === '#scene-scroll') return scene;
    if (selector === '.building-board') return board;
    if (selector === '#event-panel [data-action="events"]') return null;
    if (!elements.has(selector)) elements.set(selector, {});
    return elements.get(selector);
  };
  const h = renderFunction('document', 'dialog', '$', 'setClockActive', 'isRunning', `
    let dialogTrigger=null,dialogRevision=0;${functionLine('open')}${functionLine('close')}
    return {open,close,inspect:()=>({dialogTrigger,dialogRevision})};
  `)(document, dialog, query, active => activation.push(active), () => !dialog.open);
  for (const [trigger, expected] of [[board, 'board'], [actor, 'actor']]) {
    document.activeElement = trigger;
    h.open('社区事件', 'event choices');
    document.activeElement = { isConnected: false };
    h.open('社区事件', 'refreshed choices');
    assert.equal(h.inspect().dialogTrigger, trigger, 'refreshes retain the original scene trigger');
    h.close();
    assert.equal(focused.at(-1), expected);
  }
  actor.isConnected = false;
  document.activeElement = actor;
  h.open('社区事件', 'last choice resolved');
  h.close();
  assert.equal(focused.at(-1), 'scene', 'an expired or resolved actor has no live focus target');
  document.activeElement = { isConnected: false, dataset: { action: 'events' } };
  h.open('社区事件', 'old removed central trigger');
  h.close();
  assert.ok(['scene', 'board'].includes(focused.at(-1)), 'stale event triggers use a visible scene or board fallback');
  assert.deepEqual(activation, [false, false, true, false, false, true, false, true, false, true]);
});

test('settings retain speed, rename, chatter, backups and restart without a second registration control', () => {
  const opened = [];
  let managementRefreshes = 0, clockRefreshes = 0;
  const show = renderFunction('open', 'renderManagement', 'renderClock', 'chatEnabled', 'icon', `${functionLine('operations')};operations();`);
  for (const chatEnabled of [true, false]) {
    show((...args) => opened.push(args), () => managementRefreshes++, () => clockRefreshes++, chatEnabled, () => '');
    const [title, html] = opened.at(-1);
    assert.equal(title, '游戏设置');
    assert.match(html, /id="speeds"/);
    assert.match(html, /id="rate-hint"/);
    assert.doesNotMatch(html, /id="registrations"|data-registration=|注册状态|开放状态/);
    for (const action of ['rename', 'chatter', 'backups', 'restart']) assert.match(html, new RegExp(`data-action="${action}"`));
    assert.match(html, new RegExp(`data-action="chatter"[^>]*aria-pressed="${chatEnabled}"`));
  }
  assert.equal(managementRefreshes, 2);
  assert.equal(clockRefreshes, 2);
});

test('strategy shows current atmosphere and content as numeric accessible meters in both rule modes', () => {
  const show = renderFunction('state', 'open', 'summarize', 'STRATEGIES', 'CHALLENGE', 'esc', 'icon', `${functionLine('strategy')};strategy();`);
  for (const create of [createGame, createChallengeGame]) {
    for (const [mood, content] of [[73, 41], [0, 100], [100, 0]]) {
      const state = { ...create('状态展示', 123), mood, content }, before = structuredClone(state), opened = [];
      show(state, (...args) => opened.push(args), summarize, STRATEGIES, CHALLENGE, value => value, () => '');
      assert.equal(opened.length, 1);
      const [title, html] = opened[0];
      assert.equal(title, '经营方向');
      assert.match(html, new RegExp(`id="mood">${mood}<`));
      assert.match(html, new RegExp(`id="content">${content}<`));
      const meters = [...html.matchAll(/<[^>]+\brole="meter"[^>]*>/g)].map(match => attributes(match[0]));
      assert.deepEqual(meters.map(meter => [meter['aria-label'], meter['aria-valuemin'], meter['aria-valuemax'], meter['aria-valuenow']]),
        [['社区氛围', '0', '100', String(mood)], ['内容积累', '0', '100', String(content)]]);
      for (const [kind, value] of Object.entries({ mood, content })) {
        assert.match(html, new RegExp(`id="${kind}-bar"[^>]*style="width:${value}%"`));
      }
      assert.deepEqual([...html.matchAll(/data-strategy="([^"]+)"/g)].map(match => match[1]),
        STRATEGIES.filter(strategy => !strategy.challengeOnly || state.difficulty === 'challenge').map(strategy => strategy.id));
      assert.match(html, /data-strategy="balanced" class="chosen"/);
      assert.deepEqual(state, before, 'opening the reorganized menu must not mutate the run');
    }
  }
});

test('quality refresh is safe with no dialog and updates mounted values and meter semantics in place', () => {
  const render = renderFunction('$', 'state', `${functionLine('renderQuality')};renderQuality();`);
  const nodes = {};
  for (const kind of ['mood', 'content']) {
    nodes[`#${kind}`] = { textContent: '' };
    nodes[`#${kind}-bar`] = { style: {}, parentElement: { attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } } };
  }
  for (const [mood, content] of [[0, 100], [67, 42], [100, 0]]) {
    const state = { mood, content }, before = structuredClone(state);
    assert.doesNotThrow(() => render(() => null, state), 'main scene and unrelated dialogs have no quality widgets');
    render(selector => nodes[selector], state);
    for (const [kind, value] of Object.entries(state)) {
      assert.equal(nodes[`#${kind}`].textContent, value);
      assert.equal(nodes[`#${kind}-bar`].style.width, `${value}%`);
      assert.equal(nodes[`#${kind}-bar`].parentElement.attributes['aria-valuenow'], String(value));
    }
    assert.deepEqual(state, before);
  }
  assert.match(functionLine('redraw'), /renderQuality\(\)/);
});

test('dialog choices dispatch the existing registration action directly without opening unrelated settings', async () => {
  const click = renderFunction('e', 'ownsSave', 'act', 'REGISTRATIONS', `${functionLine('onClick')};return onClick(e);`);
  for (const registration of REGISTRATIONS) {
    const actions = [], button = { dataset: { registration: registration.id } };
    const event = { target: { closest: selector => selector === '[data-registration]' ? button : null } };
    await click(event, () => true, (...args) => actions.push(args), REGISTRATIONS);
    assert.equal(actions.length, 1);
    assert.deepEqual(actions[0][0], { type: 'registration', value: registration.id });
    assert.match(actions[0][1], new RegExp(registration.name));
  }
});

test('moving the three status controls leaves registration effects, economy, time and saved progress unchanged', async () => {
  const click = renderFunction('e', 'ownsSave', 'act', 'REGISTRATIONS', `${functionLine('onClick')};return onClick(e);`);
  for (const create of [createGame, createChallengeGame]) for (const registration of REGISTRATIONS) {
    const state = { ...create('工具栏规则未变', 789), members: 20, patrons: 1, admissionsToday: 1,
      buildingActivities: { resources: { activityId: 'resources-book', day: 0 } } };
    const before = structuredClone(state), actions = [];
    let updated;
    const event = { target: { closest: selector => selector === '[data-registration]' ? { dataset: { registration: registration.id } } : null } };
    await click(event, () => true, action => { actions.push(action); updated = applyAction(state, action); }, REGISTRATIONS);
    assert.deepEqual(actions, [{ type: 'registration', value: registration.id }]);
    assert.deepEqual(updated, { ...state, registration: registration.id, revision: state.revision + 1, logs: updated.logs },
      'only the existing registration field, revision and explanatory log may change');
    assert.equal(updated.logs.length, state.logs.length + 1);
    assert.ok(updated.logs.at(-1).text.includes(registration.name));
    assert.deepEqual(state, before, 'the input save is never edited in place');
  }
});

test('started games have no central event or sponsor entrance, with or without pending events', () => {
  const render = renderFunction('$', 'state', 'started', 'icon', `let eventPanelMarkup='';${functionLine('renderEvent')};renderEvent();`);
  const base = { ...createGame('人物事件入口', 572), day: 2, members: 10 };
  const events = ['article', 'model'].map((kind, index) => {
    const definition = EVENTS.find(event => event.id === kind);
    return { id: `event-${kind}`, kind, category: definition.category, createdDay: index, expiresDay: index + 6,
      title: definition.title, description: definition.description, options: structuredClone(definition.options) };
  });
  const pendingSponsors = [{ id: 'sponsor-1', amount: 100, createdDay: 0, expiresDay: 14, patron: 1 }];
  for (const currentEvents of [[], events]) for (const sponsors of [[], pendingSponsors]) {
    const state = { ...base, events: currentEvents, pendingSponsors: sponsors }, before = structuredClone(state);
    const panel = { innerHTML: '<button data-action="events">stale central entrance</button>', hidden: false };
    render(selector => { assert.equal(selector, '#event-panel'); return panel; }, state, true, () => '');
    assert.equal(panel.hidden, true);
    assert.equal(panel.innerHTML, '', 'active games remove obsolete central content rather than only covering it');
    assert.deepEqual(state, before, 'display-only changes leave all event and sponsorship data intact');
  }
  assert.doesNotMatch(app, /event-peek/);
});

test('intro and end panels remain usable and repeated active refreshes cannot recreate a central event entrance', () => {
  const panel = { writes: 0, hidden: false,
    set innerHTML(value) { this.writes++; this.html = value; }, get innerHTML() { return this.html || ''; } };
  const draw = renderFunction('$', 'icon', `
    let state,started=false,eventPanelMarkup='';${functionLine('renderEvent')}
    return (next,active)=>{state=next;started=active;renderEvent();};
  `)(selector => { assert.equal(selector, '#event-panel'); return panel; }, () => '');
  const state = { ...createGame('开站与结束', 17), events: [{ id: 'one', title: '需要站长决定', expiresDay: 6 }] };
  draw(state, false);
  assert.equal(panel.hidden, false);
  assert.match(panel.className, /intro-panel/);
  assert.match(panel.innerHTML, /data-action="start"/);
  draw(state, true);
  assert.equal(panel.hidden, true);
  assert.equal(panel.innerHTML, '');
  const activeWrites = panel.writes;
  for (const current of [state, structuredClone(state), { ...state, events: [] }, { ...state, day: 1 }]) draw(current, true);
  assert.equal(panel.writes, activeWrites, 'heartbeat frames do not rebuild an empty central panel');
  draw({ ...state, day: 30, gameOver: true, serverDaysRemaining: 0, serverPeriodsRemaining: 0 }, true);
  assert.equal(panel.hidden, false);
  assert.match(panel.className, /end-panel/);
  assert.match(panel.innerHTML, /data-action="end"/);
  assert.match(panel.innerHTML, /社区运营了 30 天/);
  draw(state, false);
  assert.match(panel.innerHTML, /data-action="start"/);
  draw(state, true);
  assert.equal(panel.hidden, true);
  assert.equal(panel.innerHTML, '');
});

test('removing the menu shortcut preserves the content dialog and its state values', () => {
  assert.match(functionLine('dispatch'), /if\(action==='content'\)return content\(\)/);
  const opened = [], state = { ...createGame('文档仍在', 123), mood: 62, content: 37 };
  const show = renderFunction('state', 'open', 'ROOM_LAYOUT', 'icon', `${functionLine('content')};content();`);
  show(state, (...args) => opened.push(args), ROOM_LAYOUT, () => '');
  assert.equal(opened[0][0], '内容与氛围');
  assert.match(opened[0][1], />37<small>\/100<\/small>/);
  assert.match(opened[0][1], />62<small>\/100<\/small>/);
  assert.match(opened[0][1], /data-action="strategy"/);
});
import {renderFunction} from './fixtures/render-function.mjs';
