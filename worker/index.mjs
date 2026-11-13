import { configuration,authenticate } from './auth.mjs';
import { createSharedStore } from '../server/shared-store.mjs';
import { HttpError } from '../server/errors.mjs';
import assets from './assets.mjs';
async function readJson(request){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))throw new HttpError(415,'JSON_REQUIRED');
 if(Number(request.headers.get('content-length'))>8192)throw new HttpError(413,'BODY_TOO_LARGE');
 if(!request.body)throw new HttpError(400,'INVALID_JSON');const reader=request.body.getReader();let length=0,text='';const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8192){await reader.cancel();throw new HttpError(413,'BODY_TOO_LARGE');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();try{return JSON.parse(text);}catch{throw new HttpError(400,'INVALID_JSON');}
}
export default {async fetch(request,env){
 const url=new URL(request.url),origin=request.headers.get('origin');
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Vary':'Origin'};
 let allowedOrigin;try{allowedOrigin=new URL(env.PLATFORM_ISSUER).origin;}catch{}
 if(origin&&origin===allowedOrigin)headers['Access-Control-Allow-Origin']=origin;
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
 try {
  if(url.pathname.startsWith('/api/')||url.pathname==='/health'){
   const config=configuration(env);
   if(request.method==='GET'&&['/api/health','/health'].includes(url.pathname))return json({ok:true,status:config.ready?'configured':'unconfigured',trustedLeaderboard:config.ready,platformVerified:false,channel:config.ready?'shared':null,missing:config.missing,invalidConfiguration:!!config.invalid,mode:config.ready?'signed-mapp-only':'local-preview-only'});
   if(!config.ready)throw new HttpError(503,'PLATFORM_UNCONFIGURED','真实平台身份尚未配置，共享排行榜未开放');
   if(origin&&origin!==allowedOrigin)throw new HttpError(403,'ORIGIN_DENIED');
   if(request.method==='OPTIONS'&&request.headers.has('access-control-request-method')){
    const method=request.headers.get('access-control-request-method');const requested=(request.headers.get('access-control-request-headers')||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
    if(origin!==allowedOrigin||!['GET','POST'].includes(method)||requested.some(s=>!['authorization','content-type'].includes(s)))throw new HttpError(403,'PREFLIGHT_DENIED');
    return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST','Access-Control-Allow-Headers':'Authorization, Content-Type'}});
   }
   const identity=await authenticate(request,env),store=createSharedStore(env.DB.withSession ? env.DB.withSession('first-primary') : env.DB,'shared');
   if(url.pathname==='/api/state'&&request.method==='GET'&&!url.search)return json(await store.get(identity));
   if(url.pathname==='/api/actions'&&request.method==='POST'&&!url.search)return json(await store.act(identity,await readJson(request)));
   if(url.pathname==='/api/leaderboard'&&request.method==='GET') {if([...url.searchParams.keys()].some(k=>k!=='sort')||url.searchParams.getAll('sort').length>1)throw new HttpError(400,'INVALID_QUERY');return json(await store.leaderboard(url.searchParams.get('sort')||'members'));}
   throw new HttpError(404,'NOT_FOUND');
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers});
  let path;try{path=decodeURIComponent(url.pathname);}catch{return new Response('Bad path',{status:400,headers});}
  if(path==='/')path='/index.html';const asset=assets[path];if(!asset)return new Response('Not found',{status:404,headers});
  return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)),{headers:{...headers,'Content-Type':asset.type,'Cache-Control':'private, max-age=0, must-revalidate'}});
 }catch(error){return json({error:error instanceof HttpError?error.code:'INTERNAL_ERROR',message:error instanceof HttpError?error.message:'服务暂不可用'},error instanceof HttpError?error.status:500);}
}};
