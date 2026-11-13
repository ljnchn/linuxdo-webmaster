import { createChallengeGame, migrateState, RULES } from '../src/engine.mjs';
import { HttpError } from './errors.mjs';
import { validateInput,fingerprint,identityKey,resultOf,transition } from './protocol.mjs';
import { earnedAchievements } from '../src/achievements.mjs';
export function createSharedStore(db,channel,{now=Date.now}={}) {
 if(!['development','sandbox','production','shared'].includes(channel))throw new Error('Invalid channel');
 const prepare=(sql,...values)=>db.prepare(sql).bind(...values);
 // Older databases may predate migration 0001; preserve their player snapshots.
 let backupSchema;
 function ensureBackupSchema(){
  return backupSchema??=Promise.resolve().then(()=>prepare('CREATE TABLE IF NOT EXISTS last_run_backups (identity TEXT PRIMARY KEY NOT NULL, run_id TEXT NOT NULL, channel TEXT NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL, snapshot TEXT NOT NULL, saved_at INTEGER NOT NULL)').run()).catch(error=>{backupSchema=undefined;throw error;});
 }
 function keyOf(identity){if(!(identity.channel===channel||channel==='shared'&&['sandbox','production'].includes(identity.channel))||!identity.iss||!identity.sub)throw new HttpError(401,'CHANNEL_MISMATCH');return identityKey({...identity,channel});}
 async function ensure(identity) {
  const key=keyOf(identity);let row=await prepare('SELECT * FROM players WHERE identity=?',key).first();
  if(!row){const seed=crypto.getRandomValues(new Uint32Array(1))[0]||1,state=createChallengeGame(undefined,seed);await prepare('INSERT OR IGNORE INTO players(identity,channel,public_id,run_id,state,revision,name,members,days,last_seen,started) VALUES(?,?,?,?,?,?,?,?,?,?,0)',key,channel,crypto.randomUUID(),crypto.randomUUID(),JSON.stringify(state),state.revision,state.name,state.members,state.day,now()).run();row=await prepare('SELECT * FROM players WHERE identity=?',key).first();}
  // Upgrade in place without changing revision, run ID or the historical operation ledger.
  // Comparing the exact source blob prevents a concurrent request from being overwritten.
  while(JSON.parse(row.state).version!==RULES.version) {
   if(JSON.parse(row.state).version!==3)throw new HttpError(409,'SAVE_VERSION_UNSUPPORTED');
   let migrated;try{migrated=migrateState(JSON.parse(row.state));}catch{throw new HttpError(409,'SAVE_VERSION_UNSUPPORTED');}
   await prepare('UPDATE players SET state=? WHERE identity=? AND revision=? AND state=?',JSON.stringify(migrated),key,row.revision,row.state).run();
   row=await prepare('SELECT * FROM players WHERE identity=?',key).first();
  }
  return row;
 }
 async function prior(key,input,fp){const old=await prepare('SELECT * FROM operations WHERE identity=? AND key=?',key,input.idempotencyKey).first();if(!old)return null;if(old.fingerprint!==fp)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');return JSON.parse(old.response);}
 const achievementsOf=async key=>(await prepare('SELECT achievement_id AS id,unlocked_at AS unlockedAt FROM player_achievements WHERE identity=? ORDER BY achievement_id',key).all()).results.map(entry=>({id:entry.id,unlockedAt:entry.unlockedAt}));
 const achievementWrites=(key,token,earned)=>earned.map(achievement=>prepare('INSERT OR IGNORE INTO player_achievements(identity,achievement_id,unlocked_at) SELECT identity,?,? FROM players WHERE identity=? AND commit_token=?',achievement.id,achievement.unlockedAt,key,token));
 return {
  async get(identity){const row=await ensure(identity),key=keyOf(identity),achievements=await achievementsOf(key),earned=earnedAchievements(JSON.parse(row.state)).filter(achievement=>!achievements.some(unlocked=>unlocked.id===achievement.id));await ensureBackupSchema();if(earned.length)await db.batch(earned.map(achievement=>prepare('INSERT OR IGNORE INTO player_achievements(identity,achievement_id,unlocked_at) SELECT identity,?,? FROM players WHERE identity=? AND revision=? AND state=?',achievement.id,row.last_seen,key,row.revision,row.state)));const backup=await prepare('SELECT snapshot FROM last_run_backups WHERE identity=?',key).first();return {...resultOf(row),achievements:await achievementsOf(key),backup:backup?JSON.parse(backup.snapshot):null};},
  async act(identity,input){
   validateInput(input);const key=keyOf(identity),fp=fingerprint(input),retry=await prior(key,input,fp);if(retry)return retry;
   const row=await ensure(identity);if(row.revision!==input.revision)throw new HttpError(409,'REVISION_CONFLICT');
   const timestamp=now(),next=transition(row,input.action,timestamp),token=crypto.randomUUID();
   if(input.action.type==='restart')next.run_id=crypto.randomUUID();
   // Existing snapshots use their last trusted write time, also when a read races admission.
   const earned=[...new Map([...earnedAchievements(JSON.parse(next.state)).map(achievement=>({id:achievement.id,unlockedAt:timestamp})),...earnedAchievements(JSON.parse(row.state)).map(achievement=>({id:achievement.id,unlockedAt:row.last_seen}))].map(achievement=>[achievement.id,achievement])).values()];
   const achievements=await achievementsOf(key);
   const result={...resultOf(next),achievements:[...achievements,...earned.filter(achievement=>!achievements.some(unlocked=>unlocked.id===achievement.id))].sort((a,b)=>a.id.localeCompare(b.id))};
   if(input.action.type==='restart'){await ensureBackupSchema();result.backup={...resultOf(row),runId:row.run_id,savedAt:timestamp};}
   // The SQLite batch is atomic. CAS and a commit token guard every dependent insert.
   const statements=[prepare('UPDATE players SET state=?,revision=?,name=?,members=?,days=?,speed=?,active=?,credit_ms=?,last_seen=?,commit_token=?,run_id=?,started=? WHERE identity=? AND revision=?',next.state,next.revision,next.name,next.members,next.days,next.speed,next.active,next.credit_ms,next.last_seen,token,next.run_id,next.started,key,row.revision),
    prepare('INSERT INTO operations(identity,key,fingerprint,response) SELECT identity,?,?,? FROM players WHERE identity=? AND commit_token=?',input.idempotencyKey,fp,JSON.stringify(result),key,token),
    prepare('INSERT INTO audit(identity,revision,action,created_at) SELECT identity,revision,?,? FROM players WHERE identity=? AND commit_token=?',JSON.stringify(input.action),timestamp,key,token)];
   statements.push(...achievementWrites(key,token,earned));
   if(result.backup)statements.push(prepare('INSERT INTO last_run_backups(identity,run_id,channel,state,revision,snapshot,saved_at) SELECT identity,?,channel,?,?,?,? FROM players WHERE identity=? AND commit_token=? ON CONFLICT(identity) DO UPDATE SET run_id=excluded.run_id,channel=excluded.channel,state=excluded.state,revision=excluded.revision,snapshot=excluded.snapshot,saved_at=excluded.saved_at',row.run_id,row.state,row.revision,JSON.stringify(result.backup),timestamp,key,token));
   if(result.state.gameOver)statements.push(prepare('INSERT OR IGNORE INTO completed_runs(run_id,identity,channel,public_id,name,members,days,state,finished_at) SELECT run_id,identity,channel,public_id,name,members,days,state,? FROM players WHERE identity=? AND commit_token=?',timestamp,key,token));
   let outcome;try{outcome=await db.batch(statements);}catch(error){const existing=await prior(key,input,fp);if(existing)return existing;throw error;}
   if(!outcome[0].meta.changes){const existing=await prior(key,input,fp);if(existing)return existing;throw new HttpError(409,'REVISION_CONFLICT');}
   return result;
  },
  async leaderboard(sort='members'){
   if(!['members','days'].includes(sort))throw new HttpError(400,'INVALID_SORT');
   const order=sort==='members'?'members DESC,days DESC,run_id ASC':'days DESC,members DESC,run_id ASC';
   const result=await prepare(`WITH scores AS (SELECT identity,public_id,run_id,name,members,days,0 AS finished FROM players WHERE channel=? AND json_extract(state,'$.gameOver')=0 UNION ALL SELECT identity,public_id,run_id,name,members,days,1 AS finished FROM completed_runs WHERE channel=?), ranked AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY identity ORDER BY ${order}) AS best FROM scores) SELECT identity,name,members,days,finished FROM ranked WHERE best=1 ORDER BY ${order} LIMIT 100`,channel,channel).all();
   return {channel,trusted:channel!=='development',entries:result.results.map((row,i)=>{
    const subject=JSON.parse(row.identity)[2],id=Number(subject);
    const userId=channel!=='development'&&/^[1-9]\d*$/.test(subject)&&Number.isSafeInteger(id)?id:null;
    return {rank:i+1,userId,name:row.name,members:row.members,days:row.days,finished:!!row.finished};
   })};
  }
 };
}
