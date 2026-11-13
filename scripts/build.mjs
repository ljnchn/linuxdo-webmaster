import {mkdir,cp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});
const assets={};const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.md':'text/markdown; charset=utf-8','.zip':'application/zip','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json; charset=utf-8'};
async function collect(source,target){const entries=await readdir(source,{withFileTypes:true});for(const entry of entries){const file=path.join(source,entry.name),key=target+'/'+entry.name;if(entry.isDirectory())await collect(file,key);else assets[key]={body:(await readFile(file)).toString('base64'),type:types[path.extname(file)]||'application/octet-stream'};}}
for(const file of ['index.html','app.css'])assets['/'+file]={body:(await readFile(file)).toString('base64'),type:types[path.extname(file)]};
await collect('src','/src');
assets['/assets/community-sharing-day-v2.png']={body:(await readFile('public/assets/community-sharing-day-v2.png')).toString('base64'),type:types['.png']};
// Deterministic, dependency-free bundler for this project's relative ESM subset.
// Every module executes inside its own scope, preserving lexical isolation.
const modules=new Map();
async function bundle(file){
 if(modules.has(file))return;let source=file==='worker/assets.mjs'?`export default ${JSON.stringify(assets)};`:await readFile(file,'utf8');
 const imports=[...source.matchAll(/import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"];?/g)];
 for(const match of imports){if(!match[2].startsWith('.'))throw new Error('External import not supported: '+match[2]);const dep=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[2]));await bundle(dep);const clause=match[1].trim();let declaration=clause.startsWith('{')?clause.replace(/\bas\b/g,':'):`{default:${clause}}`;source=source.replace(match[0],`const ${declaration}=__modules[${JSON.stringify(dep)}];`);}
 const names=[];source=source.replace(/export\s+(async\s+)?(function|class|const|let)\s+(\w+)/g,(_,asyncWord,kind,name)=>{names.push(`${name}:${name}`);return `${asyncWord||''}${kind} ${name}`;});
 source=source.replace(/export\s*\{([^}]+)\};?/g,(_,list)=>{for(const item of list.split(',')){const [local,exported]=item.trim().split(/\s+as\s+/);names.push(`${exported||local}:${local}`);}return '';});
 source=source.replace(/export\s+default\s+/,()=>{names.push('default:__default');return 'const __default=';});
 // Export const declarations in this graph use one exported binding per statement.
 if(file==='server/protocol.mjs')names.push('HEARTBEAT_TIMEOUT_MS:HEARTBEAT_TIMEOUT_MS');
 modules.set(file,`__modules[${JSON.stringify(file)}]=(()=>{\n${source}\nreturn {${names.join(',')}};})();`);
}
await bundle('worker/index.mjs');await writeFile('dist/server/index.js',`const __modules={};\n${[...modules.values()].join('\n')}\nexport default __modules['worker/index.mjs'].default;\n`);
await cp('drizzle','dist/drizzle',{recursive:true});
console.log(`Built Worker with ${Object.keys(assets).length} embedded assets and D1 schema. Platform APIs remain gated until configured.`);
