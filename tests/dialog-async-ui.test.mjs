import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
const click=source.slice(source.indexOf(' async function onClick(e)'),source.indexOf("\n $('#app').addEventListener"));
test('server, profile, restart and restore handlers retain dialog ownership',()=>{
 for(const name of ['servers','rename','confirmRestart','confirmRestore']){
  const line=source.split('\n').find(value=>value.startsWith(' function '+name+'('));
  assert.match(line,/const revision=dialogRevision/);
  assert.match(line,/dialogRevision(?:===|!==)revision/);
 }
 assert.match(source,/function close\(\)\{dialogRevision\+\+/);
 assert.match(source,/addEventListener\('cancel',\(\)=>\{dialogRevision\+\+/);
});
test('a delayed claim cannot reopen or replace a later dialog',async()=>{
 let finish;const pending=new Promise(resolve=>finish=resolve),effects=[];
 const h=new Function('pending','effects',`let dialogRevision=1;const dialog={open:true},ownsSave=()=>true,act=()=>pending,mail=()=>effects.push('mail');${click};return {onClick,change:()=>dialogRevision++};`)(pending,effects);
 const request=h.onClick({target:{closest:selector=>selector==='[data-claim]'?{dataset:{claim:'gift'}}:null}});
 h.change();finish(true);await request;assert.deepEqual(effects,[]);
});
test('a delayed strategy change cannot close a reopened dialog',async()=>{
 let finish;const pending=new Promise(resolve=>finish=resolve),effects=[];
 const h=new Function('pending','effects',`let dialogRevision=1;const dialog={open:true},ownsSave=()=>true,act=()=>pending,close=()=>effects.push('close');${click};return {onClick,change:()=>dialogRevision++};`)(pending,effects);
 const request=h.onClick({target:{closest:selector=>selector==='[data-strategy]'?{dataset:{strategy:'care'}}:null}});
 h.change();finish(true);await request;assert.deepEqual(effects,[]);
});
test('failed initial connection retries the same transport and environment without navigation',async()=>{
 const init=source.slice(source.indexOf(' if(transport){try{const result=await transport.getState();'),source.indexOf('\n else{try{'));
 const button={},transport={getState:async()=>{throw Error('offline');}},environment={},calls=[];
 await new (Object.getPrototypeOf(async()=>{}).constructor)('transport','environment','button','calls',`const $=()=>button,markup=()=>({set html(value){}}),logo='',esc=String,mountGame=async(...args)=>calls.push(args);${init}`)(transport,environment,button,calls);
 await button.onclick();assert.equal(button.disabled,true);assert.deepEqual(calls,[[transport,environment]]);
 assert.doesNotMatch(init,/location\.reload/);
});
