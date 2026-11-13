// Preview adapter for the exact compiled Worker; no platform secrets or test identities.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',mjs:'text/javascript; charset=utf-8',webp:'image/webp',png:'image/png',md:'text/markdown; charset=utf-8',zip:'application/zip'};
const server=createServer(async(req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://preview').pathname);if(p.includes('..')){res.writeHead(403);res.end();return;}if(p.startsWith('/api/')){const worker=(await import('../dist/server/index.js')).default;const out=await worker.fetch(new Request('http://preview'+req.url),{});res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));return;}const file=p==='/'?'index.html':p.startsWith('/assets/')||p.startsWith('/downloads/')?'public'+p:p.slice(1);const body=await readFile(file);res.writeHead(200,{'Content-Type':types[file.split('.').pop()]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}});
const args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
server.listen(Number(arg('--port',process.env.PORT||3000)),arg('--host','127.0.0.1'));

