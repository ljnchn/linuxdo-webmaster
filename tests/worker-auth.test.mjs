// Optional offline contract test against the official SDK; no platform credentials.
// SDK_SERVER_TEST_PATH=/reviewed/official/sdk/server.mjs node --test tests/sdk-auth.optional.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('Worker WebCrypto verifies generated ES256 token and rejects forgery and wrong trust', {}, async () => {
  const { verifyPlatformRequest } = await import('../worker/platform-verifier.mjs');
  // Ephemeral test keys remain only in memory and are never printed or serialized.
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const kid = createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
  const now = Math.floor(Date.now() / 1000);
  const base = { issuer: 'https://community.test', audience: 'https://backend.test', appId: '019a2a58-1234-7000-8000-000000000099', channel: 'sandbox', scope: 'network.request', method: 'GET', url: 'https://backend.test/api/leaderboard?sort=days', publicKey: publicKey.export({format:'jwk'}), now };
  const claims = { iss: base.issuer, aud: base.audience, sub: '42', app_id: base.appId, version: '0.1.0', channel: base.channel, scopes: ['network.request'], iat: now, nbf: now, exp: now + 900, jti: 'offline-test-token-0001', htm: 'GET', htu: 'https://backend.test/api/leaderboard', query_keys: ['sort'] };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  function token(payload = claims) {
    const content = `${encode({ alg: 'ES256', typ: 'mini-app-access+jwt', kid })}.${encode(payload)}`;
    return `${content}.${sign('sha256', Buffer.from(content), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  }
  const authorization = `Bearer ${token()}`;
  const identity = await verifyPlatformRequest({ ...base, authorization });
  assert.equal(identity.iss, base.issuer); assert.equal(identity.sub, '42'); assert.equal(identity.channel, 'sandbox');
  const parts = authorization.split('.');
  const signature = Buffer.from(parts[2], 'base64url'); signature[0] ^= 1; parts[2] = signature.toString('base64url');
  await assert.rejects(verifyPlatformRequest({ ...base, authorization: parts.join('.') }), e => e.code === 'INVALID_PLATFORM_REQUEST');
  for (const override of [{ issuer: 'https://attacker.test' }, { audience: 'https://attacker.test' }, { appId: 'other-app' }, { channel: 'production' }, { method: 'POST' }, { scope: 'network.websocket' }, { url: 'https://backend.test/api/state' }, { url: 'https://backend.test/api/leaderboard?user_id=99' }, { now: now + 901 }]) {
    await assert.rejects(verifyPlatformRequest({ ...base, authorization, ...override }), e => e.code === 'INVALID_PLATFORM_REQUEST');
  }
  await assert.rejects(verifyPlatformRequest({ ...base, authorization: `Bearer ${token({ ...claims, sub: '42', members: 99999, iss: 'https://attacker.test' })}` }), e => e.code === 'INVALID_PLATFORM_REQUEST');
});
