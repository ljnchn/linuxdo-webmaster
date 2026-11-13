import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function databasePath(dataDir,channel,configured) {
 if(configured)return resolve(configured);
 if(channel==='development')return resolve(dataDir,'development-v3.sqlite');
 const current=resolve(dataDir,'webmaster.sqlite');
 const legacy=['sandbox-v3.sqlite','production-v3.sqlite'].map(name=>resolve(dataDir,name)).filter(path=>existsSync(path));
 if(legacy.length>1||existsSync(current)&&legacy.length)throw new Error('Multiple game databases found. Set DATABASE_PATH explicitly to select the database; no save was selected or discarded.');
 return legacy[0]||current;
}
