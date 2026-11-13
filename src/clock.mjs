/** Accumulate only active monotonic time. Pauses and speed changes preserve earned progress. */
export function createClock({periodMs,now=0,progressMs=0,speed=1,active=false,maxGapMs=4000}={}){
 if(!Number.isFinite(periodMs)||periodMs<=0)throw Error('periodMs must be positive');
 let last=now,earned=Math.max(0,Math.min(periodMs*2,Number(progressMs)||0)),rate=speed,running=active;
 function sample(at){const delta=at-last;last=at;if(running&&Number.isFinite(delta)&&delta>=0&&delta<=maxGapMs)earned=Math.min(periodMs*2,earned+delta*rate);return earned;}
 return {sample,setActive(value,at){sample(at);running=!!value;},setSpeed(value,at){if(![1,2,4].includes(value))throw Error('Invalid speed');sample(at);rate=value;},consume(){if(earned<periodMs)return false;earned-=periodMs;return true;},restore(value,at){earned=Math.max(0,Math.min(periodMs*2,Number(value)||0));last=at;},get progressMs(){return earned;},get ready(){return earned>=periodMs;},get fraction(){return Math.min(1,earned/periodMs);},get active(){return running;},get speed(){return rate;}};
}
