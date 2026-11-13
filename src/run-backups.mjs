import {validateState,RULES} from './engine.mjs';
export const BACKUP_KEY='little-community-story:v4:backups';
export function validSave(save){return !!save&&validateState(save.state)&&RULES.speeds.includes(save.speed)&&typeof save.started==='boolean'&&Number.isFinite(save.progressMs)&&save.progressMs>=0&&save.progressMs<=RULES.secondsPerPeriod*2000;}
export function createRunBackups(storage,key=BACKUP_KEY){
 const list=()=>{const raw=storage.getItem(key);if(raw===null)return [];const value=JSON.parse(raw);if(!Array.isArray(value)||!value.every(x=>typeof x.id==='string'&&typeof x.createdAt==='string'&&validSave(x.save)))throw Error('备份记录无法读取，未覆盖。请先导出当前存档。');return value;};
 const capture=(save)=>{if(!validSave(save))throw Error('当前存档无法验证，未重新开始。');const entries=list(),entry={id:globalThis.crypto.randomUUID(),createdAt:new Date().toISOString(),save:structuredClone(save)};entries.push(entry);const raw=JSON.stringify(entries);storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('备份未能保存，未重新开始。');return entry;};
 const replace=(gameKey,current,target)=>{if(!validSave(target))throw Error('备份无效，当前进度未改变。');capture(current);const raw=JSON.stringify(target);storage.setItem(gameKey,raw);if(storage.getItem(gameKey)!==raw)throw Error('存档未能保存；原进度已备份。');return structuredClone(target);};
 return {list,capture,replace};
}
