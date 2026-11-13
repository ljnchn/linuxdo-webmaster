import { HttpError } from './errors.mjs';
export { HttpError } from './errors.mjs';
export const isLoopback = host => host === '127.0.0.1' || host === '::1' || host === '::ffff:127.0.0.1';
const required = (env, key) => { if (!env[key]) throw new Error(`Missing ${key}`); return env[key]; };
function https(value, originOnly = false) { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || (originOnly && u.origin !== value)) throw new Error('Expected fixed HTTPS configuration'); return value.replace(/\/$/, ''); }
export async function createAuthenticator(env = process.env) {
  if (env.DEV_MODE === 'enabled') {
    if (!isLoopback(env.HOST || '127.0.0.1')) throw new Error('Development mode must bind to loopback');
    return { channel: 'development', origin: env.DEV_ORIGIN || 'http://127.0.0.1:4173', authenticate: async req => {
      if (!isLoopback(req.socket.remoteAddress)) throw new HttpError(401, 'LOOPBACK_ONLY');
      // One configured local tester. Never accept identity supplied in headers/body.
      return { iss: 'local:development', sub: 'local-tester', channel: 'development' };
    }, close() {} };
  }
  const issuer = https(required(env, 'PLATFORM_ISSUER'));
  const audience = https(required(env, 'PUBLIC_ORIGIN'), true);
  const appId = required(env, 'MINI_APP_ID');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(appId)) throw new Error('MINI_APP_ID must be a platform-assigned UUIDv7');
  // No fallback decoder, no client-supplied trust URL, no dynamic import path.
  const { verifyPlatformRequest } = await import('./vendor/platform-server.mjs');
  let publicKey;
  async function refresh() {
    const response = await fetch(`${issuer}/mini-app-api/jwks`, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Trusted JWKS unavailable (${response.status})`);
    const raw = await response.text();
    if (raw.length > 32768) throw new Error('JWKS too large');
    const keys = JSON.parse(raw)?.keys;
    const key = Array.isArray(keys) && keys.length === 1 && keys[0];
    if (!key || key.kty !== 'EC' || key.crv !== 'P-256' || key.alg !== 'ES256' || key.use !== 'sig' || typeof key.kid !== 'string' || !key.kid || typeof key.x !== 'string' || typeof key.y !== 'string' || Object.hasOwn(key, 'd')) throw new Error('Invalid trusted public JWKS');
    publicKey = key;
  }
  await refresh();
  const timer = setInterval(() => refresh().catch(() => { /* Retain last trusted key; JWT verification remains mandatory. */ }), 300_000);
  timer.unref();
  return { channel:'shared', origin: new URL(issuer).origin, close() { clearInterval(timer); }, authenticate: async req => {
    if (!req.url?.startsWith('/') || req.url.startsWith('//')) throw new HttpError(401, 'INVALID_PLATFORM_REQUEST');
    for(const channel of ['production','sandbox']) {
      try { const identity=await verifyPlatformRequest({ issuer, audience, appId, channel, publicKey, authorization: req.headers.authorization || '', scope: 'network.request', method: req.method, url: audience + req.url });return {...identity,platformChannel:identity.channel,channel:'shared'}; }
      catch {}
    }
    throw new HttpError(401, 'INVALID_PLATFORM_REQUEST');
  } };
}
