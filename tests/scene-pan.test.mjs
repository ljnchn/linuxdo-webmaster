import test from 'node:test';
import assert from 'node:assert/strict';
import {attachScenePan} from '../src/scene-pan.mjs';
function fixture(){
 const listeners=new Map(),classes=new Set(),captures=new Set();
 const scene={scrollLeft:200,classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)},
  addEventListener:(type,handler)=>listeners.set(type,handler),removeEventListener:type=>listeners.delete(type),
  setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
 const destroy=attachScenePan(scene);
 const emit=(type,patch={})=>{const event={pointerId:1,isPrimary:true,button:0,pointerType:'mouse',clientX:200,clientY:50,detail:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...patch};listeners.get(type)?.(event);return event;};
 return {scene,classes,captures,listeners,emit,destroy};
}
test('drag pans after a threshold and consumes its click, while taps and keyboard clicks still work',()=>{
 const h=fixture();h.emit('pointerdown');h.emit('pointermove',{clientX:203});assert.equal(h.scene.scrollLeft,200);
 assert.equal(h.emit('click').stopped,undefined);
 h.emit('pointermove',{clientX:100});assert.equal(h.scene.scrollLeft,300);assert.ok(h.captures.has(1));
 h.emit('pointerup');assert.equal(h.classes.size,0);assert.equal(h.emit('click').stopped,true);
 h.emit('pointerdown');h.emit('pointerup');assert.equal(h.emit('click').stopped,undefined);
 assert.equal(h.emit('click',{detail:0}).stopped,undefined);h.destroy();assert.equal(h.listeners.size,0);
});
test('native touch scroll, secondary pointers and vertical movement do not start mouse panning',()=>{
 for(const patch of [{pointerType:'touch'},{isPrimary:false},{button:2}]){const h=fixture();h.emit('pointerdown',patch);h.emit('pointermove',{clientX:100});assert.equal(h.scene.scrollLeft,200);h.destroy();}
 const h=fixture();h.emit('pointerdown');h.emit('pointermove',{clientX:210,clientY:100});assert.equal(h.scene.scrollLeft,200);
 h.emit('pointerleave');h.emit('pointermove',{clientX:100});assert.equal(h.scene.scrollLeft,200);h.destroy();
});
