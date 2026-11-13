export async function loadRankProfiles(root, entries, transport, isCurrent) {
 await Promise.allSettled(entries.map(async (entry, index) => {
  const row=root.children[index],name=row.querySelector('.rank-user-name'),avatar=row.querySelector('.rank-avatar');
  if(!entry.userId||!transport.getUserProfile){name.textContent='站长资料暂不可用';return;}
  try {
   const profile=await transport.getUserProfile(entry.userId);
   if(!isCurrent())return;
   name.textContent=profile.name||profile.username;
   row.querySelector('.rank-username').textContent='@'+profile.username;
   avatar.textContent=profile.initials||Array.from(profile.name||profile.username)[0]||'?';
   if(profile.avatarUrl){
    const img=root.ownerDocument.createElement('img');
    img.alt='';img.width=40;img.height=40;
    img.addEventListener('error',()=>img.remove(),{once:true});
    img.src=profile.avatarUrl;
    avatar.append(img);
   }
  } catch {
   if(isCurrent())name.textContent='站长资料暂不可用';
  }
 }));
}
