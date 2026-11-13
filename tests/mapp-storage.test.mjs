import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformStorage } from '../mapp/storage.mjs';

test('platform storage loads existing saves and confirms ordered backup writes', async () => {
  const written = [];
  const storage = await createPlatformStorage({
    exportData: async () => ({ format: 1, entries: [['game', 'old']] }),
    setItem: async (key, value) => { await Promise.resolve(); written.push([key, value]); },
  });
  assert.equal(storage.getItem('game'), 'old');
  assert.equal(storage.getItem('missing'), null);
  storage.setItem('backup', 'old');
  storage.setItem('game', 'new');
  await storage.flush();
  assert.deepEqual(written, [['backup', 'old'], ['game', 'new']]);
});

test('failed backup blocks queued replacement, rejects flush and reports storage failure', async () => {
  const written = [], reported = [];
  const failure = new Error('Storage unavailable');
  const storage = await createPlatformStorage({
    exportData: async () => ({ format: 1, entries: [] }),
    setItem: async key => { written.push(key); throw failure; },
  });
  storage.onError = error => reported.push(error);
  storage.setItem('backup', 'old');
  storage.setItem('game', 'new');
  await assert.rejects(storage.flush(), failure);
  assert.deepEqual(written, ['backup']);
  assert.deepEqual(reported, [failure]);
  assert.throws(() => storage.setItem('game', 'another'), failure);
});
