import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {createStore} from '../server/store.mjs';
import {identityKey} from '../server/protocol.mjs';
import {databasePath} from '../server/database-path.mjs';
import {createAuthenticator} from '../server/auth.mjs';

const alice={iss:'https://shared.test',sub:'42',channel:'sandbox'};
const op={revision:0,idempotencyKey:'shared-channel-operation',action:{type:'rename',name:'共享小站'}};

test('single legacy channel migrates all durable records and exact replay without losing progress',async()=>{
 for(const channel of ['sandbox','production']){
  const directory=mkdtempSync(join(tmpdir(),'shared-migrate-')),path=join(directory,`${channel}-v3.sqlite`),identity={...alice,channel};
  let store=createStore(path,channel,{now:()=>12345});
  const db=new DatabaseSync(path);
  try{
   const fresh=await store.get(identity);
   db.prepare('UPDATE players SET state=?,members=? WHERE identity=?').run(JSON.stringify({...fresh.state,members:10}),10,identityKey(identity));
   const response=await store.act(identity,op);
   const restarted=await store.act(identity,{revision:1,idempotencyKey:'shared-channel-restart',action:{type:'restart',confirmed:true}});
   db.prepare('INSERT INTO completed_runs SELECT run_id,identity,channel,public_id,name,members,days,state,12345 FROM players').run();
   const before=db.prepare('SELECT state,revision,run_id FROM players').get();
   store.close();assert.equal(databasePath(directory,'shared'),path);
   store=createStore(path,'shared');
   assert.deepEqual(db.prepare('SELECT state,revision,run_id FROM players').get(),before);
   for(const source of ['sandbox','production']){
    const result=await store.get({...alice,channel:source});
    assert.deepEqual(result.achievements,response.achievements);
    assert.deepEqual(result.backup,restarted.backup);
    assert.deepEqual(await store.act({...alice,channel:source},op),response);
   }
   for(const table of ['players','operations','audit','completed_runs','last_run_backups','player_achievements']){
    assert.ok(db.prepare(`SELECT * FROM ${table}`).all().every(row=>JSON.parse(row.identity)[0]==='shared'));
   }
   assert.equal((await store.leaderboard()).channel,'shared');
   assert.equal((await store.leaderboard()).entries.length,1);
   assert.equal((await store.get({...alice,iss:'https://another.test',channel:'production'})).revision,0);
   await assert.rejects(store.get({...alice,channel:'unknown'}),error=>error.code==='CHANNEL_MISMATCH');
  }finally{db.close();store.close();rmSync(directory,{recursive:true,force:true});}
 }
});

test('conflicting old accounts fail before writes and explicit database choice never discards another file',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'shared-conflict-')),path=join(directory,'sandbox-v3.sqlite'),legacy=createStore(path,'sandbox');
 await legacy.get(alice);legacy.close();
 const db=new DatabaseSync(path);
 try{
  const row=db.prepare('SELECT * FROM players').get();
  db.prepare('INSERT INTO players(identity,channel,public_id,run_id,state,revision,name,members,days) VALUES(?,?,?,?,?,?,?,?,?)').run(identityKey({...alice,channel:'production'}),'production','other-public','other-run',row.state,0,'另一进度',0,0);
  const before=db.prepare('SELECT * FROM players ORDER BY identity').all();
  assert.throws(()=>createStore(path,'shared'),/Shared identity conflict/);
  assert.deepEqual(db.prepare('SELECT * FROM players ORDER BY identity').all(),before);
  assert.equal(db.prepare("SELECT value FROM metadata WHERE key='channel'").get().value,'sandbox');
  // The hosted migration also rejects the same conflict before its first UPDATE.
  db.exec(readFileSync(new URL('../drizzle/0001_last_run_backups.sql',import.meta.url),'utf8'));
  assert.throws(()=>db.exec(readFileSync(new URL('../drizzle/0003_shared_players.sql',import.meta.url),'utf8')),/malformed JSON/);
  assert.deepEqual(db.prepare('SELECT * FROM players ORDER BY identity').all(),before);
  writeFileSync(join(directory,'production-v3.sqlite'),'');
  assert.throws(()=>databasePath(directory,'shared'),/DATABASE_PATH/);
  assert.equal(databasePath(directory,'shared',path),path);
 }finally{db.close();rmSync(directory,{recursive:true,force:true});}
});

test('new shared and development databases have distinct default files',()=>{
 const directory=mkdtempSync(join(tmpdir(),'shared-path-'));
 try{
  assert.equal(databasePath(directory,'shared'),join(directory,'webmaster.sqlite'));
  assert.equal(databasePath(directory,'development'),join(directory,'development-v3.sqlite'));
  writeFileSync(join(directory,'sandbox-v3.sqlite'),'');
  assert.equal(databasePath(directory,'development'),join(directory,'development-v3.sqlite'));
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('shared server authenticates both fully signed channels and rejects unknown channel and changed app',async()=>{
 const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),kid=createHash('sha256').update(publicKey.export({type:'spki',format:'der'})).digest('hex');
 const env={PLATFORM_ISSUER:'https://auth-shared.test',PUBLIC_ORIGIN:'https://backend.test',MINI_APP_ID:'019a2a58-1234-7000-8000-000000000099'};
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({keys:[{...publicKey.export({format:'jwk'}),kid,alg:'ES256',use:'sig'}]});
 const auth=await createAuthenticator(env);
 function request(channel,app_id=env.MINI_APP_ID){
  const now=Math.floor(Date.now()/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const content=encode({alg:'ES256',typ:'mini-app-access+jwt',kid})+'.'+encode({iss:env.PLATFORM_ISSUER,aud:env.PUBLIC_ORIGIN,sub:'42',app_id,channel,version:'0.8.6',scopes:['network.request'],iat:now,nbf:now,exp:now+900,jti:'shared-auth-token-0001',htm:'GET',htu:env.PUBLIC_ORIGIN+'/api/state',query_keys:[]});
  return {url:'/api/state',method:'GET',headers:{authorization:'Bearer '+content+'.'+sign('sha256',Buffer.from(content),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')}};
 }
 try{
  assert.equal(auth.channel,'shared');
  for(const channel of ['sandbox','production']){const identity=await auth.authenticate(request(channel));assert.equal(identity.channel,'shared');assert.equal(identity.platformChannel,channel);}
  await assert.rejects(auth.authenticate(request('unknown')),error=>error.code==='INVALID_PLATFORM_REQUEST');
  await assert.rejects(auth.authenticate(request('production','other-app')),error=>error.code==='INVALID_PLATFORM_REQUEST');
 }finally{auth.close();globalThis.fetch=originalFetch;}
});
