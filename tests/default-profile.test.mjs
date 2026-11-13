import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as engine from '../src/engine.mjs';
import { createRunBackups } from '../src/run-backups.mjs';
import { createSaveOwner } from '../src/local-session.mjs';
import { createStore } from '../server/store.mjs';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const NAME = 'LINUX DO', SLOGAN = 'Where possible begins.';
const assertDefault = state => { assert.equal(state.name, NAME); assert.equal(state.slogan, SLOGAN); assert.equal(engine.validateState(state), true); };

test('new challenge defaults use the exact community name and slogan without changing initial rules', () => {
  const state = engine.createChallengeGame();
  assertDefault(state);
  assert.deepEqual(state, { ...engine.createGame(NAME), difficulty: 'challenge', slogan: SLOGAN });
  assertDefault(engine.createChallengeGame(undefined, 37));
  assertDefault(engine.createChallengeGame(undefined, 37, undefined));
  for (const [name, slogan] of [['我自己的站', '保留我的口号'], ['留白社区', '']]) {
    const custom = engine.createChallengeGame(name, 11, slogan);
    assert.equal(custom.name, name); assert.equal(custom.slogan, slogan); assert.equal(custom.seed, 11);
    assert.equal(engine.validateState(custom), true);
  }
});

test('old v4 and v3 names and slogans survive migration and restart, including an explicitly empty or absent slogan', () => {
  for (const version of [3, 4]) for (const slogan of [undefined, '', '这是我的旧口号']) {
    const state = { ...engine.createGame('我的旧社区', 149), version };
    if (slogan !== undefined) state.slogan = slogan;
    if (version === 3) { delete state.serverDaysRemaining; state.serverPeriodsRemaining = 71; }
    const before = structuredClone(state), migrated = engine.migrateState(state);
    assert.equal(engine.validateState(migrated), true);
    assert.equal(migrated.name, state.name);
    assert.equal(migrated.slogan, slogan);
    assert.equal(Object.hasOwn(migrated, 'slogan'), slogan !== undefined);
    const restarted = engine.applyAction(migrated, { type: 'restart', confirmed: true });
    assert.equal(restarted.name, state.name);
    assert.equal(restarted.slogan, slogan ?? '', 'restart does not replace an old blank slogan with the new default');
    assert.equal(restarted.day, 0); assert.equal(restarted.members, 0);
    assert.equal(engine.validateState(restarted), true);
    assert.deepEqual(state, before);
  }
  assertDefault(engine.applyAction(engine.createChallengeGame(), { type: 'restart', confirmed: true }));
});

const initSource = app.slice(app.indexOf(' let state,world'), app.indexOf(' const chatSchedule='));
async function initialize(entries = [], transport = null) {
  const stored = new Map(entries), writes = [];
  const localStorage = { getItem: key => stored.get(key) ?? null,
    setItem(key, value) { stored.set(key, value); writes.push({ key, value }); } };
  const run = new Function('engine', 'crypto', 'localStorage', 'createRunBackups', 'createSaveOwner', 'transport', `
    return (async()=>{const storage=localStorage,environment={};const {RULES,createChallengeGame,migrateState,validateState}=engine,
      KEY='little-community-story:v4',PREVIOUS='little-community-story:v3',LEGACY='little-community-story:v1';
      ${initSource}
      return {state,started,speed,storedProgress,memoryOnly,storageWarning};})();
  `);
  return { ...await run(engine, { randomUUID: () => 'test-tab', getRandomValues: values => { values[0] = 1963; return values; } },
    localStorage, createRunBackups, createSaveOwner, transport), stored, writes };
}

test('local first launch and temporary fallback use defaults while custom saved progress and raw storage remain unchanged', async () => {
  const first = await initialize();
  assertDefault(first.state); assert.equal(first.state.seed, 1963); assert.equal(first.started, false);
  assert.equal(first.memoryOnly, false);
  const broken = await initialize([['little-community-story:v4', 'not valid JSON']]);
  assertDefault(broken.state); assert.equal(broken.memoryOnly, true);
  assert.equal(broken.stored.get('little-community-story:v4'), 'not valid JSON');
  for (const version of [3, 4]) for (const slogan of ['', '用户自己的口号']) {
    const state = { ...engine.createChallengeGame('用户自己选的名称', 501, slogan), version };
    if (version === 3) delete state.serverDaysRemaining;
    const key = `little-community-story:v${version}`, raw = JSON.stringify({ state, speed: 4, started: true, progressMs: 18765 });
    const loaded = await initialize([[key, raw]]);
    assert.deepEqual(loaded.state, engine.migrateState(state));
    assert.equal(loaded.state.name, '用户自己选的名称'); assert.equal(loaded.state.slogan, slogan);
    assert.equal(loaded.speed, 4); assert.equal(loaded.storedProgress, 18765); assert.equal(loaded.started, true);
    assert.equal(loaded.memoryOnly, false);
    assert.equal(loaded.stored.get(key), raw, 'initialization does not rewrite the existing serialized save');
    if (version === 3) assert.equal(loaded.stored.get(key + ':pre-v4'), raw);
  }
});

test('trusted first creation gets defaults and existing custom or empty profiles persist through reads and restart', async () => {
  const store = createStore(':memory:', 'sandbox', { now: () => 1000 });
  const identity = { iss: 'https://profile-defaults.test', sub: 'profile-owner', channel: 'sandbox' };
  try {
    const first = await store.get(identity); assertDefault(first.state);
    assert.deepEqual(await store.get(identity), first, 'a later read does not reseed or recreate the run');
    let latest = first;
    for (const [index, slogan] of ['自定义口号', ''].entries()) {
      latest = await store.act(identity, { revision: latest.revision, idempotencyKey: `default-profile-rename-${index}`,
        action: { type: 'rename', name: '持久化的旧站名', slogan } });
      assert.equal((await store.get(identity)).state.name, '持久化的旧站名');
      assert.equal((await store.get(identity)).state.slogan, slogan);
      const previous = structuredClone(latest.state);
      latest = await store.act(identity, { revision: latest.revision, idempotencyKey: `default-profile-restart-${index}`,
        action: { type: 'restart', confirmed: true } });
      assert.equal(latest.state.name, previous.name); assert.equal(latest.state.slogan, slogan);
      assert.deepEqual(latest.backup.state, previous);
      const loaded = await initialize([], { getState: async () => ({ state: latest.state, timing: { speed: 2, creditMs: 4321 } }) });
      assert.deepEqual(loaded.state, latest.state); assert.equal(loaded.started, true);
      assert.equal(loaded.speed, 2); assert.equal(loaded.storedProgress, 4321);
      assert.equal(loaded.writes.length, 0, 'trusted loading does not create local state or reset a custom profile');
    }
  } finally { store.close(); }
});

function renameHarness(initial, setup = false, accept = true) {
  const line = app.split('\n').find(value => value.trimStart().startsWith('function rename('));
  assert.ok(line);
  const elements = new Map(), opened = [], actions = [], focused = [];
  const query = selector => {
    if (!elements.has(selector)) elements.set(selector, { value: '', disabled: false, reportValidity:()=>true, focus() { focused.push(selector); } });
    return elements.get(selector);
  };
  const open = (...args) => {
    opened.push(args);
    for (const [, id, value] of args[1].matchAll(/<input\b[^>]*id="([^"]+)"[^>]*value="([^"]*)"/g)) query('#' + id).value = value;
  };
  const run = new Function('initial', 'setup', '$', 'open', 'record', 'applyAction', 'accept', `
    let state=structuredClone(initial),started=!setup,saves=0,closed=0,dialogRevision=0;const dialog={open:true};
    const esc=String,endGame=()=>{throw Error('unexpected game over');},save=()=>saves++,close=()=>closed++,
      act=async action=>{record(action);if(accept)state=applyAction(state,action);return accept;};
    ${line};rename(setup);
    return {inspect:()=>({state,started,saves,closed})};
  `);
  return { ...run(initial, setup, query, open, action => actions.push(action), engine.applyAction, accept), query, opened, actions, focused };
}

test('sandbox start uses a button click, validates fields and handles Enter without native submit', async () => {
  const h=renameHarness(engine.createChallengeGame(),true);
  assert.match(h.opened[0][1],/type="button" id="save-name"/);
  h.query('#community-form').reportValidity=()=>false;
  await h.query('#save-name').onclick({preventDefault(){}});
  assert.equal(h.actions.length,0);
  h.query('#community-form').reportValidity=()=>true;
  await h.query('#save-name').onclick({preventDefault(){}});
  assert.equal(h.inspect().started,true);
  assert.equal(h.inspect().closed,1);
  let clicks=0;
  h.query('#save-name').click=()=>clicks++;
  const event={key:'Enter',isComposing:false,target:{tagName:'INPUT'},preventDefault(){}};
  h.query('#community-form').onkeydown({...event,isComposing:true});
  assert.equal(clicks,0);
  h.query('#community-form').onkeydown(event);
  assert.equal(clicks,1);
});

test('fill-defaults only edits form fields and focusing, with persistence deferred to explicit save or start', async () => {
  for (const setup of [false, true]) for (const slogan of ['', '自己的社区口号']) {
    const state = engine.createChallengeGame('自己的站名', 12, slogan), h = renameHarness(state, setup);
    const before = h.inspect();
    assert.equal(h.query('#new-name').value, state.name); assert.equal(h.query('#new-slogan').value, slogan);
    assert.match(h.opened[0][1], /<button\b[^>]*type="button"[^>]*id="default-profile"/);
    h.query('#default-profile').onclick(); h.query('#default-profile').onclick();
    assert.equal(h.query('#new-name').value, NAME); assert.equal(h.query('#new-slogan').value, SLOGAN);
    assert.deepEqual(h.actions, [], 'filling defaults cannot invoke an action or submit the form');
    assert.deepEqual(h.inspect(), before, 'saved state, clock-start status and save count remain untouched until submit');
    assert.deepEqual(h.focused, ['#new-name', '#new-name']);
    let prevented = 0;
    await h.query('#community-form').onsubmit({ preventDefault() { prevented++; } });
    assert.equal(prevented, 1);
    assert.deepEqual(h.actions, [{ type: 'rename', name: NAME, slogan: SLOGAN }]);
    assertDefault(h.inspect().state);
    assert.equal(h.inspect().started, true);
    assert.equal(h.inspect().saves, setup ? 1 : 0);
    assert.equal(h.inspect().closed, 1);
  }
});

test('editing after filling defaults preserves explicit custom text and blank slogan, while failed save keeps the dialog usable', async () => {
  const state = engine.createChallengeGame('原社区', 491, '原口号'), h = renameHarness(state);
  h.query('#default-profile').onclick();
  h.query('#new-name').value = '  最终自选名称  '; h.query('#new-slogan').value = '  ';
  await h.query('#community-form').onsubmit({ preventDefault() {} });
  assert.deepEqual(h.actions, [{ type: 'rename', name: '最终自选名称', slogan: '' }]);
  assert.equal(h.inspect().state.slogan, '');
  const rejected = renameHarness(state, true, false);
  rejected.query('#default-profile').onclick();
  await rejected.query('#community-form').onsubmit({ preventDefault() {} });
  assert.deepEqual(rejected.inspect(), { state, started: false, saves: 0, closed: 0 });
  assert.equal(rejected.query('#save-name').disabled, false);
});
