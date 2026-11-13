import { verifyPlatformRequest } from './platform-verifier.mjs';
import { HttpError } from '../server/errors.mjs';
const caches=new Map();
export function configuration(env){
 const missing=['PLATFORM_ISSUER','PUBLIC_ORIGIN','MINI_APP_ID'].filter(key=>!env[key]);if(!env.DB)missing.push('DB');
 if(missing.length)return {ready:false,missing};
 try {
  for(const k of ['PLATFORM_ISSUER','PUBLIC_ORIGIN']){const u=new URL(env[k]);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||env[k].endsWith('/')||(k==='PUBLIC_ORIGIN'&&u.origin!==env[k]))throw new Error();}
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(env.MINI_APP_ID))throw new Error();
  return {ready:true,missing:[]};
 }catch{return {ready:false,missing:[],invalid:true};}
}
export async function authenticate(request,env){
 if(!configuration(env).ready)throw new HttpError(503,'PLATFORM_UNCONFIGURED');
 const issuer=env.PLATFORM_ISSUER;let cached=caches.get(issuer);
 if(!cached||Date.now()-cached.at>300000){
  let response;try{response=await fetch(issuer+'/mini-app-api/jwks',{redirect:'error',signal:AbortSignal.timeout(5000),headers:{Accept:'application/json'}});}catch{throw new HttpError(503,'TRUSTED_KEYS_UNAVAILABLE');}
  if(!response.ok)throw new HttpError(503,'TRUSTED_KEYS_UNAVAILABLE');
  const reader=response.body.getReader();let size=0,text='';const decoder=new TextDecoder();while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();throw new HttpError(503,'TRUSTED_KEYS_INVALID');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
  let keys;try{keys=JSON.parse(text).keys;}catch{throw new HttpError(503,'TRUSTED_KEYS_INVALID');}
  const key=Array.isArray(keys)&&keys.length===1&&keys[0];if(!key||key.kty!=='EC'||key.crv!=='P-256'||key.alg!=='ES256'||key.use!=='sig'||typeof key.kid!=='string'||!key.kid||typeof key.x!=='string'||typeof key.y!=='string'||Object.hasOwn(key,'d'))throw new HttpError(503,'TRUSTED_KEYS_INVALID');
  cached={key,at:Date.now()};caches.set(issuer,cached);
 }
 const url=new URL(request.url);if(url.origin!==env.PUBLIC_ORIGIN)throw new HttpError(401,'INVALID_PLATFORM_REQUEST');
 for(const channel of ['production','sandbox']) {
  try{const identity=await verifyPlatformRequest({issuer,audience:env.PUBLIC_ORIGIN,appId:env.MINI_APP_ID,channel,publicKey:cached.key,authorization:request.headers.get('Authorization')||'',scope:'network.request',method:request.method,url:env.PUBLIC_ORIGIN+url.pathname+url.search});return {...identity,platformChannel:identity.channel,channel:'shared'};}catch{}
 }
 throw new HttpError(401,'INVALID_PLATFORM_REQUEST');
}
