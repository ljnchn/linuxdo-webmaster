import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformTransport } from '../mapp/adapter.mjs';
import { configureManifest } from '../mapp/config.mjs';
import { readFile } from 'node:fs/promises';

test('SDK transport preserves server state, achievements and signed action contract', async () => {
  const calls = [];
  const body = { state: { revision: 4 }, achievements: [{ id: 'first', unlockedAt: 123 }], entries: [] };
  const transport = createPlatformTransport({ http: { request: async (...args) => { calls.push(args); return { status: 200, body }; } } });
  assert.equal(await transport.getState(), body);
  const action = { revision: 4, idempotencyKey: 'stable_request_key', action: { type: 'advance' } };
  assert.equal(await transport.sendAction(action), body);
  assert.equal(await transport.getLeaderboard('days'), body);
  assert.deepEqual(calls, [['getState', { timeoutMs: 15_000 }], ['sendAction', { timeoutMs: 15_000, json: action }], ['getLeaderboard', { timeoutMs: 15_000, query: { sort: 'days' } }]]);
});

test('HTTP rejection retains server error code for action recovery', async () => {
  const transport = createPlatformTransport({ http: { request: async () => ({ status: 409, body: { error: 'REVISION_CONFLICT', message: '存档已更新' } }) } });
  await assert.rejects(transport.getState(), { code: 'REVISION_CONFLICT', status: 409, message: '存档已更新' });
});

test('one manifest serves sandbox and production with the configured signed backend endpoints', async () => {
  const template = JSON.parse(await readFile(new URL('../mapp/manifest.template.json', import.meta.url)));
  assert.equal(configureManifest(template).endpoints.getState.url, 'https://linux-do-webmaster.rmb.run/api/state');
  const result = configureManifest(template, { publicOrigin: 'https://game.ljnchn.com' });
  assert.deepEqual(result.permissions.slice(-2), ['user.read', 'network.request']);
  assert.ok(result.permissions.includes('user.lookup'));
  assert.deepEqual(result.endpoints, {
    getState: { url: 'https://game.ljnchn.com/api/state', method: 'GET', auth: 'platform' },
    sendAction: { url: 'https://game.ljnchn.com/api/actions', method: 'POST', auth: 'platform' },
    getLeaderboard: { url: 'https://game.ljnchn.com/api/leaderboard', method: 'GET', query: ['sort'], auth: 'platform' },
  });
  for (const publicOrigin of ['', 'http://real.test', 'https://api.example.com', 'https://example.com', 'https://localhost', 'https://localhost.', 'https://127.0.0.1', 'https://127.1', 'https://[::1]', 'https://real.test/path', 'https://u:p@real.test']) {
    assert.throws(() => configureManifest(template, { publicOrigin }));
  }
  assert.deepEqual(template.endpoints, {});
});

test('profile lookup uses SDK permission, timeouts and session cache, and retries failed requests',async()=>{
 const calls=[];let fail=true;
 const sdk={permissions:{has:p=>p==='user.lookup'},user:{getById:async(id,options)=>{calls.push([id,options]);if(fail)throw Error('unavailable');return {id,username:'neo',name:'佬友',initials:'佬',avatarUrl:'blob:session'};}}};
 const transport=createPlatformTransport(sdk);
 await assert.rejects(transport.getUserProfile(1),/unavailable/);
 fail=false;
 const [a,b]=await Promise.all([transport.getUserProfile(1),transport.getUserProfile(1)]);
 assert.equal(a,b);assert.equal(a.avatarUrl,'blob:session');
 assert.deepEqual(calls,[[1,{timeoutMs:8000}],[1,{timeoutMs:8000}]]);
 sdk.permissions.has=()=>false;
 await assert.rejects(transport.getUserProfile(2),/暂不可用/);
 assert.equal(calls.length,2);
});
