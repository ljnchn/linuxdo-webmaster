import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createSharedStore } from './shared-store.mjs';
export { validateInput } from './protocol.mjs';
// SQLite statements and atomic transactions for the game store.
export function createStore(path,channel,options={}) {
 const sqlite=new DatabaseSync(path);sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
 if(channel==='shared'&&sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='players'").get()){
  const conflict=sqlite.prepare("SELECT json_extract(identity,'$[1]') AS issuer,json_extract(identity,'$[2]') AS subject FROM players WHERE channel IN ('sandbox','production','shared') GROUP BY issuer,subject HAVING COUNT(*)>1 LIMIT 1").get();
  if(conflict){sqlite.close();throw new Error('Shared identity conflict: sandbox and production saves exist for the same account; explicitly select the authoritative save before migration. No player data was changed.');}
 }
 sqlite.exec('BEGIN IMMEDIATE');
 try {
 sqlite.exec('CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 const saved=sqlite.prepare('SELECT value FROM metadata WHERE key=?').get('channel');if(saved&&saved.value!==channel&&!(channel==='shared'&&['sandbox','production'].includes(saved.value)))throw new Error('Refusing to mix database channels');
 sqlite.prepare('INSERT OR IGNORE INTO metadata VALUES(?,?)').run('channel',channel);
 if(!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='players'").get())sqlite.exec(readFileSync(new URL('../drizzle/0000_trusted_runs.sql',import.meta.url),'utf8'));
 else if(!sqlite.prepare('PRAGMA table_info(players)').all().some(c=>c.name==='commit_token'))throw new Error('Legacy database requires an explicit migration; use a fresh v3 database');
 if(!sqlite.prepare('PRAGMA table_info(players)').all().some(c=>c.name==='started'))sqlite.exec(readFileSync(new URL('../drizzle/0002_player_achievements.sql',import.meta.url),'utf8'));
 if(!sqlite.prepare('PRAGMA table_info(players)').all().some(c=>c.name==='street_tv'))sqlite.exec(readFileSync(new URL('../drizzle/0004_street_television.sql',import.meta.url),'utf8'));
 if(channel==='shared'){
  sqlite.exec(readFileSync(new URL('../drizzle/0001_last_run_backups.sql',import.meta.url),'utf8'));
  sqlite.exec(readFileSync(new URL('../drizzle/0003_shared_players.sql',import.meta.url),'utf8'));
  sqlite.prepare("UPDATE metadata SET value='shared' WHERE key='channel'").run();
 }
 sqlite.exec('COMMIT');
 } catch(error) {sqlite.exec('ROLLBACK');sqlite.close();throw error;}
 const wrap=sql=>({bind(...args){
  const stmt=sqlite.prepare(sql);
  return {first:()=>stmt.get(...args)||null,all:()=>({results:stmt.all(...args)}),run:()=>({meta:{changes:Number(stmt.run(...args).changes)}})};
 }});
 const db={prepare:wrap,async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=[];for(const stmt of statements)results.push(stmt.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return {...createSharedStore(db,channel,options),close(){sqlite.close();}};
}
