import { mountGame } from './app.mjs';
mountGame().catch(error=>{document.getElementById('app').textContent=`小站暂时未能打开：${error.message}`});
