import { createServer } from 'node:http';
import { HttpError } from './auth.mjs';
const MAX_BODY = 8192;
async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'JSON_REQUIRED');
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw new HttpError(413, 'BODY_TOO_LARGE'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'INVALID_JSON'); }
}
export function createApp({ store, auth }) {
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const origin = req.headers.origin;
    if (origin === auth.origin) res.setHeader('Access-Control-Allow-Origin', origin);
    const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    try {
      if (origin && origin !== auth.origin) throw new HttpError(403, 'ORIGIN_DENIED');
      const url = new URL(req.url, 'http://local.invalid');
      if (req.method === 'OPTIONS' && req.headers['access-control-request-method']) {
        if (origin !== auth.origin || !['GET', 'POST'].includes(req.headers['access-control-request-method'])) throw new HttpError(403, 'PREFLIGHT_DENIED');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST'); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.writeHead(204); res.end(); return;
      }
      if (req.method === 'GET' && url.pathname === '/health') return send(200, { ok: true, channel: auth.channel });
      const identity = await auth.authenticate(req);
      if (identity.channel !== auth.channel) throw new HttpError(401, 'CHANNEL_MISMATCH');
      if (req.method === 'GET' && url.pathname === '/api/state' && !url.search) return send(200, await store.get(identity));
      if (req.method === 'POST' && url.pathname === '/api/actions' && !url.search) return send(200, await store.act(identity, await readJson(req)));
      if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
        if ([...url.searchParams.keys()].some(k => k !== 'sort') || url.searchParams.getAll('sort').length > 1) throw new HttpError(400, 'INVALID_QUERY');
        return send(200, await store.leaderboard(url.searchParams.get('sort') || 'members'));
      }
      throw new HttpError(404, 'NOT_FOUND');
    } catch (error) {
      // No tokens, Authorization headers, cookies, or request URLs in logs/responses.
      if (!(error instanceof HttpError)) console.error('Request failed:', error.name);
      if (!res.headersSent) send(error.status || 500, { error: error.code || 'INTERNAL_ERROR', message: error instanceof HttpError ? error.message : '服务暂不可用' });
    }
  });
  server.requestTimeout = 10_000; server.headersTimeout = 10_000;
  return server;
}
