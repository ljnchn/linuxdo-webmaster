import {mountGame} from '../../src/app.mjs';
import {markup} from '../../src/markup.mjs';

const check=(value,message)=>{if(!value)throw Error(message);};
const styleViolations=[];
document.addEventListener('securitypolicyviolation',e=>{if(e.effectiveDirective==='style-src-attr')styleViolations.push(e.violatedDirective);});
try{
  if(new URL(location.href).searchParams.has('baseline')){
    document.getElementById('app').innerHTML='<main>Original string rendering</main>';
    throw Error('Trusted Types enforcement missing');
  }
  check(!!window.trustedTypes,'Browser must support Trusted Types');
  let rejected=false;
  try{document.createElement('div').innerHTML='<b>probe</b>';}catch{rejected=true;}
  check(rejected,'CSP must reject raw HTML assignments');
  const game=await mountGame();
  check(document.querySelector('.game-shell'),'Game did not mount');
  check(document.querySelector('.scene-building').style.left!=='','Building position missing');
  document.querySelector('[data-action="start"]').click();
  check(document.querySelector('#community-form'),'Start form missing');
  document.querySelector('#new-name').value='<img src=x onerror=alert(1)>' .slice(0,24);
  document.querySelector('#new-slogan').value='A & B "quote"';
  document.querySelector('#save-name').click();
  await new Promise(resolve=>setTimeout(resolve,30));
  check(!document.querySelector('#dialog').open,'Start must finish without native form submission');
  check(game.getState().slogan==='A & B "quote"','Start did not save the submitted profile');
  check(!document.querySelector('#station-name img'),'Player name became markup');
  const actions=['help','servers','strategy','members','operations','backups','journal','events','resources','benefits','residents'];
  for(const action of actions){
    document.querySelector('[data-action="close"]')?.click();
    const button=document.createElement('button');button.dataset.action=action;document.querySelector('#app').append(button);button.click();button.remove();
    await Promise.resolve();
    check(document.querySelector('#dialog').open,'Dialog failed: '+action);
    check(document.querySelector('#dialog-body').childNodes.length,'Empty dialog: '+action);
  }
  const target=document.createElement('div');
  markup(target).html='<svg viewBox="0 0 24 24"><path d="M0 0h2"/></svg><span>&lt;img&gt; &amp; &#39;</span>';
  check(target.firstChild.namespaceURI==='http://www.w3.org/2000/svg','SVG namespace lost');
  check(target.lastChild.textContent==="<img> & '",'Escaped text changed');
  for(const unsafe of ['<script>bad</script>','<button onclick="bad()">bad</button>']){
    let blocked=false;try{markup(target).html=unsafe;}catch{blocked=true;}check(blocked,'Unsafe markup accepted');
  }
  game.destroy();
  await new Promise(resolve=>setTimeout(resolve,30));
  check(styleViolations.length===0,'Inline styles were blocked by CSP');
  document.body.dataset.result='PASS';
}catch(error){document.body.dataset.result='FAIL';const result=document.createElement('pre');result.id='test-error';result.textContent=error.stack;document.body.append(result);}
if(parent!==window)parent.postMessage({type:'game-regression',result:document.body.dataset.result,error:document.querySelector('#test-error')?.textContent},location.origin);
