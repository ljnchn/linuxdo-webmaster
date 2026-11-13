// Local static preview; platform API requests use the separately deployed Node server.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',mjs:'text/javascript; charset=utf-8',js:'text/javascript; charset=utf-8',png:'image/png'};
const server=createServer(async(req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://preview').pathname);if(p.includes('..')||p.includes('\\')||!['/','/index.html','/app.css'].includes(p)&&!/^\/(src|assets|tests\/fixtures)\/[\w/-]+\.(mjs|js|html|png)$/.test(p)){res.writeHead(404);res.end('Not found');return;}const file=p==='/'?'index.html':p.startsWith('/assets/')?'public'+p:p.slice(1);const body=await readFile(file);res.writeHead(200,{'Content-Type':types[file.split('.').pop()]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}});
const args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
server.listen(Number(arg('--port',process.env.PORT||3000)),arg('--host','127.0.0.1'));

