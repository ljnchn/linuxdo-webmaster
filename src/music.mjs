/** "小站午后" — original procedural 16-bar composition. No samples, recordings or third-party music. */
export const MUSIC = Object.freeze({title:'小站午后',bpm:76,bars:16,beatsPerBar:4});
// Each bar uses eight eighth-note positions. Original melody in D major, with breathing room.
export const MELODY = Object.freeze([
 [74,0,78,0,81,78,76,0], [73,0,76,78,76,0,73,0],
 [71,0,74,0,78,76,74,0], [69,0,73,76,73,0,0,0],
 [67,0,71,74,76,0,74,71], [69,0,73,0,76,78,76,0],
 [78,0,76,74,73,0,71,0], [69,0,0,0,0,0,0,0],
 [74,0,78,81,83,0,81,78], [76,0,73,0,76,78,76,0],
 [74,0,71,74,78,0,76,74], [73,0,69,0,73,76,0,0],
 [71,0,74,78,76,0,74,0], [73,0,76,0,81,78,76,0],
 [78,0,76,74,73,0,69,0], [74,0,0,0,0,0,0,0],
].map(Object.freeze));
const CHORDS=[[50,57,62,66],[49,57,61,64],[47,54,59,62],[45,52,57,61],[43,50,55,59],[45,52,57,61],[47,54,59,62],[45,52,57,61],[50,57,62,66],[49,57,61,64],[47,54,59,62],[45,52,57,61],[43,50,55,59],[45,52,57,61],[45,52,57,61],[50,57,62,66]];
const frequency=midi=>440*2**((midi-69)/12);
export function createMusicPlayer({AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext,setIntervalFn=setInterval,clearIntervalFn=clearInterval,onChange=()=>{}}={}){
 let ctx=null,master=null,filter=null,timer=null,enabled=false,visible=true,destroyed=false,step=0,next=0,operation=0,status='off';const voices=new Set();
 const report=value=>{status=value;onChange({status,enabled,title:MUSIC.title,contextState:ctx?.state||'uncreated'});};
 function stopVoices(){for(const o of voices){try{o.stop();}catch{}try{o.disconnect();}catch{}}voices.clear();}
 function note(midi,time,duration,level,type='sine'){
  const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=frequency(midi);g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(level,time+.018);g.gain.exponentialRampToValueAtTime(Math.max(.0001,level*.25),time+duration*.45);g.gain.exponentialRampToValueAtTime(.0001,time+duration);o.connect(g);g.connect(filter);voices.add(o);o.onended=()=>{voices.delete(o);o.disconnect();g.disconnect();};o.start(time);o.stop(time+duration+.02);
 }
 function schedule(){if(!enabled||!visible||destroyed||ctx?.state!=='running')return;const eighth=60/MUSIC.bpm/2;if(next<ctx.currentTime-.3)next=ctx.currentTime+.04;while(next<ctx.currentTime+.15){const bar=Math.floor(step/8)%16,position=step%8,chord=CHORDS[bar],melody=MELODY[bar][position];if(melody)note(melody,next,eighth*1.65,.055,'triangle');if(position%2===0)note(chord[1+((position/2)%3)],next,eighth*2.5,.023);if(position===0||position===4)note(chord[0],next,eighth*3.5,.045);if(position===0)for(const pitch of chord.slice(1))note(pitch,next,eighth*6.5,.011);step=(step+1)%128;next+=eighth;}}
 function clearSchedule(){if(timer!==null)clearIntervalFn(timer);timer=null;stopVoices();}
 async function resume(op){
  try{if(!ctx){if(!AudioContextClass){enabled=false;report('unsupported');return false;}ctx=new AudioContextClass();master=ctx.createGain();master.gain.value=.32;filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=3200;filter.Q.value=.4;filter.connect(master);master.connect(ctx.destination);ctx.onstatechange=()=>{if(enabled&&visible&&!destroyed&&ctx.state!=='running')report('blocked');};}
  await ctx.resume();if(op!==operation||!enabled||!visible||destroyed){if(!enabled||!visible)await ctx.suspend();return false;}if(ctx.state!=='running'){report('blocked');return false;}next=ctx.currentTime+.04;schedule();if(timer===null)timer=setIntervalFn(schedule,80);report('playing');return true;}catch{if(op===operation&&enabled)report('blocked');return false;}
 }
 return {
  async toggle(){if(destroyed)return false;operation++;const op=operation;if(enabled&&status!=='blocked'){enabled=false;clearSchedule();try{await ctx?.suspend();}catch{}report('off');return false;}enabled=true;if(!visible){report('paused');return false;}return resume(op);},
  async setVisible(value){visible=!!value;operation++;if(!enabled)return;if(!visible){clearSchedule();try{await ctx?.suspend();}catch{}report('paused');}else await resume(operation);},
  get status(){return status;},get enabled(){return enabled;},get contextState(){return ctx?.state||'uncreated';},get scheduledVoices(){return voices.size;},
  async destroy(){destroyed=true;enabled=false;operation++;clearSchedule();try{await ctx?.close();}catch{}report('off');}
 };
}
