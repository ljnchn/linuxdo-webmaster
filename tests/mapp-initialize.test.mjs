import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeMapp } from '../mapp/adapter.mjs';

test('SDK initialization reports failures and only signals lifecycle after a successful handshake', async t => {
  const original = globalThis.document;
  try {
    for (const failure of ['ready', 'permission', 'storage', 'asset', null]) {
      await t.test(failure || 'success', async () => {
        const calls = [], notices = [];
        globalThis.document = {
          createElement: () => ({ setAttribute: (key, value) => calls.push([key, value]), textContent: '' }),
          getElementById: () => ({ replaceChildren: notice => { notices.push(notice); calls.push('notice'); } }),
        };
        const error = new Error(`${failure} unavailable`);
        const sdk = {
          ready: { then(resolve, reject) { calls.push('handshake'); return failure === 'ready' ? reject(error) : resolve(); } },
          permissions: { has: () => failure !== 'permission' },
          localStorage: {
            exportData: async options => { calls.push(['storage', options]); if (failure === 'storage') throw error; return { entries: [] }; },
          },
          assets: {
            readBytes: async (path, options) => { calls.push(['asset', path, options]); if (failure === 'asset') throw error; return new Uint8Array(); },
          },
          files: { save() {} },
          lifecycle: { ready: async () => calls.push('lifecycle') },
        };
        const render = async (transport, environment) => {
          calls.push('render');
          assert.equal(typeof transport.getState, 'function');
          assert.equal(typeof transport.sendAction, 'function');
          assert.equal(typeof environment.storage.getItem, 'function');
          URL.revokeObjectURL(environment.sceneUrl);
          URL.revokeObjectURL(environment.museumUrl);
        };
        if (failure) {
          await assert.rejects(initializeMapp({ sdk, render }));
          assert.equal(notices.length, 1);
          assert.match(notices[0].textContent, /游戏加载失败/);
          assert.equal(calls.includes('render'), false);
          assert.equal(calls.includes('lifecycle'), failure !== 'ready');
          if (failure !== 'ready') assert.equal(calls.at(-1), 'lifecycle');
          return;
        }
        await initializeMapp({ sdk, render });
        assert.deepEqual(calls, [
          'handshake', ['storage', { timeoutMs: 15_000 }],
          ['asset', 'assets/community-sharing-day-v2.png', { timeoutMs: 15_000 }],
          ['asset', 'assets/badge-museum.png', { timeoutMs: 15_000 }],
          ['asset', 'assets/avatars/neo.jpg', { timeoutMs: 15_000 }],
          ['asset', 'assets/avatars/smnet.jpg', { timeoutMs: 15_000 }],
          ['asset', 'assets/avatars/syokatu.jpg', { timeoutMs: 15_000 }],
          'render', 'lifecycle',
        ]);
        assert.equal(notices.length, 0);
      });
    }
  } finally {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  }
});
