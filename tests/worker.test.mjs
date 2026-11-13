import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
const {default:worker}=await import(process.env.WORKER_TEST_MODULE || '../worker/index.mjs');
function database(){const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0000_trusted_runs.sql',import.meta.url),'utf8'));sqlite.exec(readFileSync(new URL('../drizzle/0002_player_achievements.sql',import.meta.url),'utf8'));return {close:()=>sqlite.close(),prepare(sql){return {bind(...args){return {first:()=>sqlite.prepare(sql).get(...args)||null,all:()=>({results:sqlite.prepare(sql).all(...args)}),run:()=>({meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}})};}};},async batch(statements){sqlite.exec('BEGIN');try{const out=statements.map(s=>s.run());sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};}
test('unconfigured Worker never accepts spoofed identity, developer bypass or local scores',async()=>{
 for(const env of [{},{DEV_MODE:'enabled'},{DB:{}},{PLATFORM_ISSUER:'http://evil.test',PUBLIC_ORIGIN:'https://backend.test',MINI_APP_ID:'sample',PLATFORM_CHANNEL:'sandbox',DB:{}}]){
  let response=await worker.fetch(new Request('https://backend.test/api/health'),env);const health=await response.json();assert.equal(response.status,200);assert.equal(health.status,'unconfigured');assert.equal(health.trustedLeaderboard,false);
  for(const path of ['/api/state','/api/leaderboard']){response=await worker.fetch(new Request('https://backend.test'+path,{headers:{'x-user-id':'42','oai-authenticated-user-id':'42',Authorization:'Bearer fake'}}),env);assert.equal(response.status,503);}
 }
});
test('Worker signed JWT + D1 requests enforce identity, method, URL, concurrency and JSON limits',async()=>{
 const db=database(),{publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),kid=createHash('sha256').update(publicKey.export({type:'spki',format:'der'})).digest('hex');
 const env={DB:db,PLATFORM_ISSUER:'https://forum.worker-test',PUBLIC_ORIGIN:'https://backend.test',MINI_APP_ID:'019a2a58-1234-7000-8000-000000000099'};
 const originalFetch=globalThis.fetch;let fetchCount=0;globalThis.fetch=async url=>{assert.equal(url,env.PLATFORM_ISSUER+'/mini-app-api/jwks');fetchCount++;return Response.json({keys:[{...publicKey.export({format:'jwk'}),kid,alg:'ES256',use:'sig'}]});};
 function token(path,method='GET',sub='42',channel='sandbox') {const now=Math.floor(Date.now()/1000),claims={iss:env.PLATFORM_ISSUER,aud:env.PUBLIC_ORIGIN,sub,app_id:env.MINI_APP_ID,version:'0.3.0',channel,scopes:['network.request'],iat:now,nbf:now,exp:now+900,jti:'test-only-token-0001',htm:method,htu:env.PUBLIC_ORIGIN+path,query_keys:[]};const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),content=enc({alg:'ES256',typ:'mini-app-access+jwt',kid})+'.'+enc(claims);return 'Bearer '+content+'.'+sign('sha256',Buffer.from(content),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');}
 const request=(path,method='GET',body,sub='42',headers={})=>worker.fetch(new Request(env.PUBLIC_ORIGIN+path,{method,headers:{Authorization:token(path,method,sub),'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}),env);
 try{
  let response=await request('/api/state');assert.equal(response.status,200);assert.equal((await response.json()).state.members,0);
  const op={revision:0,idempotencyKey:'worker-operation-0001',action:{type:'rename',name:'真实签名小站'}};
  response=await request('/api/actions','POST',op);const state=await response.json();assert.equal(response.status,200);assert.equal(state.state.name,'真实签名小站');assert.deepEqual(await (await request('/api/actions','POST',op)).json(),state);
  const production=await (await request('/api/state','GET',undefined,'42',{Authorization:token('/api/state','GET','42','production')})).json();assert.equal(production.state.name,state.state.name);assert.equal(production.revision,state.revision);assert.deepEqual(production.achievements,state.achievements);
  assert.deepEqual(await (await request('/api/actions','POST',op,'42',{Authorization:token('/api/actions','POST','42','production')})).json(),state);
  assert.equal((await request('/api/state','GET',undefined,'42',{Authorization:token('/api/state','GET','42','unknown')})).status,401);
  assert.equal((await request('/api/actions','POST',{...op,idempotencyKey:'worker-operation-0002'})).status,409);
  assert.equal((await (await request('/api/state','GET',undefined,'43')).json()).revision,0);
  const board=await (await request('/api/leaderboard')).json();assert.equal(board.trusted,true);assert.equal(board.channel,'shared');assert.equal(board.entries.length,2);
  assert.equal((await request('/api/actions','POST','x'.repeat(9000))).status,413);
  assert.equal((await request('/api/actions','POST','{bad')).status,400);
  assert.equal((await request('/api/state','GET',undefined,'42',{Authorization:token('/api/leaderboard')})).status,401);
  assert.equal((await request('/api/state','GET',undefined,'42',{Authorization:'Bearer fake'})).status,401);
  assert.equal((await request('/api/state','GET',undefined,'42',{Origin:'https://evil.test'})).status,403);
  assert.equal(fetchCount,1);
 }finally{globalThis.fetch=originalFetch;db.close();}
});
