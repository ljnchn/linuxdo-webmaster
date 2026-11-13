/** A newly opened local game takes ownership; stale pages must not overwrite its save. */
export function createSaveOwner(storage,key,id){
 return {claim(){storage.setItem(key,id);},isCurrent(){return storage.getItem(key)===id;}};
}
