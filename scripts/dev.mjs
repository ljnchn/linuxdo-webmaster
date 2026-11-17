// Local static preview; platform API requests use the separately deployed Node server.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',mjs:'text/javascript; charset=utf-8',js:'text/javascript; charset=utf-8',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'};
const server=createServer(async(req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://preview').pathname);if(p.includes('..')||p.includes('\\')||!['/','/index.html','/app.css'].includes(p)&&!/^\/(src|assets|tests\/fixtures)\/[\w/-]+\.(mjs|js|html|png|jpe?g)$/.test(p)){res.writeHead(404);res.end('Not found');return;}const file=p==='/'?'index.html':p.startsWith('/assets/')?'public'+p:p.slice(1);const body=await readFile(file);res.writeHead(200,{'Content-Type':types[file.split('.').pop()]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}});
const args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const host=arg('--host','127.0.0.1'),port=Number(arg('--port',process.env.PORT||4173));
server.on('error',error=>{
 console.error(`[dev] 启动失败：${error.code==='EADDRINUSE'?`端口 ${port} 已被占用，请使用 --port 指定其他端口。`:error.message}`);
 process.exitCode=1;
});
server.listen(port,host,()=>{
 const address=server.address();
 console.log(`\n[dev] 本地预览已启动\n  访问地址：http://${host.includes(':')?`[${host}]`:host}:${address.port}\n  监听端口：${address.port}\n  按 Ctrl+C 停止服务\n`);
});

