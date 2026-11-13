import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EVENTS, createGame, validateState, migrateState, applyAction } from '../src/engine.mjs';
import { oldEvents } from './fixtures/legacy-events.mjs';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const line = name => {
  const found = app.split('\n').find(value => new RegExp(`^\\s*(?:async )?function ${name}\\(`).test(value));
  assert.ok(found, `missing ${name}`);
  return found;
};
const communityText = renderFunction(`${app.split('\n').find(value => value.startsWith('const communityText='))};return communityText;`)();
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const snapshot = (definition, day = 12) => ({ id: `event-${definition.category}-${day}`, kind: definition.id,
  category: definition.category, createdDay: day, expiresDay: day + 6, title: definition.title,
  description: definition.description, options: structuredClone(definition.options) });
const saved = definition => ({ ...createGame('虚构二字是我自己起的站名', 9583), day: 12, nextEventDay: 14,
  nextWorldEventDay: 24, members: 20, cash: 1000, events: [snapshot(definition)] });

test('successful event choices notify their actual event outcome; rejected choices never report success', async () => {
  const actSource=app.slice(app.indexOf(' async function act(action,message)'),app.indexOf('\n async function setClockActive'));
  const run=new Function('initial','action','applyAction','validateState','communityText',`
    let state=structuredClone(initial),busy=false;const local=true,transport=null,messages=[];
    const ownsSave=()=>true,save=()=>{},redraw=()=>{},notify=text=>messages.push(text);
    ${app.split('\n').find(value=>value.startsWith('const logText='))}
    ${actSource}
    return act(action).then(success=>({success,state,messages}));
  `);
  for(const definition of EVENTS)for(const option of definition.options){
    const initial=saved(definition),action={type:'resolve',eventId:initial.events[0].id,optionId:option.id};
    const result=await run(initial,action,applyAction,validateState,communityText);
    assert.equal(result.success,true,`${definition.id}/${option.id}`);
    assert.equal(result.messages.length,1);
    assert.ok(result.messages[0].includes(communityText(definition.title)));
    assert.ok(result.messages[0].includes(option.label));
    assert.ok(result.messages[0].includes('已完成'));
    const rejected=await run(initial,{...action,optionId:'missing'},applyAction,validateState,communityText);
    assert.equal(rejected.success,false);
    assert.deepEqual(rejected.state,initial);
    assert.ok(rejected.messages.every(text=>!text.includes('已完成')));
  }
});
const display = (state, id = null) => {
  const opened = [];
  renderFunction('state', 'id', 'communityText', 'esc', 'icon', 'open', `
    let selectedEvent=null;
    const notify=()=>{throw Error('unexpected stale event');},redraw=()=>{},endGame=()=>{throw Error('unexpected end');};
    ${line('eventMarkup')}${line('events')};events(id);
  `)(state, id, communityText, esc, () => '', (...args) => opened.push(args));
  assert.equal(opened.length, 1);
  return opened[0].join(' ');
};

test('all twenty current events display clean copy without mutating any trusted snapshot or economy', () => {
  assert.equal(EVENTS.length, 20);
  assert.equal(EVENTS.filter(event => event.category === 'world').length, 10);
  for (const definition of EVENTS) {
    const state = saved(definition), before = structuredClone(state);
    assert.equal(validateState(state), true, definition.id);
    for (const id of [null, state.events[0].id]) {
      const html = display(state, id);
      assert.doesNotMatch(html, /虚构|模拟/, definition.id);
      assert.ok(html.includes(esc(definition.title)));
      assert.match(html, /再过 6 天失效/);
      assert.deepEqual([...html.matchAll(/data-option="([^"]+)"/g)].map(match => match[1]), definition.options.map(option => option.id));
      for (const option of definition.options) {
        assert.ok(html.includes(esc(option.label)), `${definition.id}/${option.id}`);
        assert.ok(html.includes(esc(communityText(option.description))));
      }
    }
    assert.deepEqual(state, before, definition.id);
    assert.equal(state.name, '虚构二字是我自己起的站名', 'authored community names are never sanitized in the save');
    assert.equal(validateState(state), true);
    assert.deepEqual(migrateState(state), state);
    const next = applyAction(state, { type: 'resolve', eventId: state.events[0].id, optionId: definition.options[1].id });
    assert.equal(validateState(next), true);
    assert.equal(next.cash, state.cash - definition.options[1].cost + definition.options[1].rewards.cash);
  }
  assert.ok(EVENTS.filter(event => event.category === 'world').every(event => /虚构/.test(event.description)),
    'presentation cleanup must not rewrite immutable canonical engine snapshots');
});

test('all five historical v4/v3 snapshots retain validation and exact outcomes while using clean event display copy', () => {
  assert.equal(oldEvents.length, 5);
  for (const definition of oldEvents) for (const version of [4, 3]) {
    const state = { ...saved(definition), version };
    if (version === 3) { delete state.serverDaysRemaining; state.serverPeriodsRemaining = 71; state.timeSlot = 2; }
    const before = structuredClone(state);
    if (version === 4) {
      assert.equal(validateState(state), true, definition.id);
      assert.doesNotMatch(display(state, state.events[0].id), /虚构|模拟/);
    }
    const current = migrateState(state);
    assert.equal(validateState(current), true, `${version}/${definition.id}`);
    assert.doesNotMatch(display(current, current.events[0].id), /虚构|模拟/);
    assert.deepEqual(state, before, 'rendering and migration must leave the source save intact');
    for (const key of ['name', 'seed', 'rngState', 'cash', 'members', 'patrons', 'mood', 'content', 'revision', 'pendingSponsors'])
      assert.deepEqual(current[key], state[key], `${version}/${definition.id}/${key}`);
    for (const option of definition.options) {
      const action = { type: 'resolve', eventId: current.events[0].id, optionId: option.id };
      const result = applyAction(current, action);
      assert.equal(validateState(result), true);
      if (version === 4) assert.deepEqual(applyAction(state, action), result, 'legacy and migrated choices have identical outcomes');
    }
  }
});
import {renderFunction} from './fixtures/render-function.mjs';
