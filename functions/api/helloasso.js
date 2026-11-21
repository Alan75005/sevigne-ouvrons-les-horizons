// Cloudflare Pages Function. Les identifiants HelloAsso restent côté serveur.
const API='https://api.helloasso.com';
const ORG='college-sevigne-paris';
const FORM='1';
const GOAL=150000;
const START='2026-11-01T00:00:00+01:00';
// La collecte affichée commence au 1er novembre 2026 (heure de Paris).
async function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public, max-age=120, s-maxage=300':'no-store','x-content-type-options':'nosniff'}})}
export async function onRequestGet({env,request,context}){
 const cache=typeof caches!=='undefined'?caches.default:null;
 const kv=env.AMBASSADORS||null;
 const kvRead=async(k)=>{if(!kv)return null;try{return await kv.get('helloasso:private:'+k,'json')}catch{return null}};
 const kvWrite=async(k,v,ttl)=>{if(!kv)return;try{await kv.put('helloasso:private:'+k,JSON.stringify(v),{expirationTtl:ttl})}catch{}};
 const key=new Request(new URL('/api/helloasso-verified-v1',request.url).toString(),{method:'GET'});
 const cached=cache?await cache.match(key):null;
 const verifiedKV=await kvRead('verified-v1');
 const tokenKey=new Request(new URL('/api/helloasso-token-cache-v3',request.url).toString(),{method:'GET'});
 const cooldownKey=new Request(new URL('/api/helloasso-auth-cooldown-v2',request.url).toString(),{method:'GET'});
 const cooldown=cache?await cache.match(cooldownKey):null;
 const cooldownKV=await kvRead('cooldown-v1');
 const cooldownUntil=Math.max(cooldown?Number(await cooldown.text()):0,Number(cooldownKV?.until)||0);
 const setCooldown=(ms)=>{const until=Date.now()+ms;const ttl=Math.ceil(ms/1000);if(cache){const response=new Response(String(until),{headers:{'cache-control':'public, max-age='+ttl}});context?.waitUntil(cache.put(cooldownKey,response).catch(()=>{}));}if(kv)context?.waitUntil(kvWrite('cooldown-v1',{until},ttl));};
 if(verifiedKV?.available&&Date.now()-Date.parse(verifiedKV.updated)<900000)return json(verifiedKV);
 if(cached){try{const data=await cached.clone().json();if(data.available&&Date.now()-Date.parse(data.updated)<900000)return json(data)}catch(e){}}
 const fallback=async(reason,status=503)=>{
  if(verifiedKV?.available)return json({...verifiedKV,stale:true,warning:reason});
  if(cached){try{const data=await cached.clone().json();if(data.available)return json({...data,stale:true,warning:reason})}catch(e){}}
  return json({available:false,reason},status);
 };
 if(cooldownUntil>Date.now())return fallback('authentication_rate_limited');
 if(!env.HELLOASSO_CLIENT_ID||!env.HELLOASSO_CLIENT_SECRET)return fallback('credentials_missing');
 let stage='initialization';
 try{
  stage='token_cache';
  let token=null;
  const tokenKV=await kvRead('token-v1');
  if(tokenKV?.token&&Number(tokenKV.expiresAt)>Date.now()+60000)token=tokenKV.token;
  if(!token&&cache){
   const savedToken=await cache.match(tokenKey);
   if(savedToken){try{const data=await savedToken.json();if(data.token&&Number(data.expiresAt)>Date.now()+60000)token=data.token;}catch(e){}}
  }
  if(!token){
   // Temporiser les authentifications concurrentes et respecter les limites HelloAsso.
   setCooldown(120000);
   const body=new URLSearchParams({grant_type:'client_credentials',client_id:String(env.HELLOASSO_CLIENT_ID).trim(),client_secret:String(env.HELLOASSO_CLIENT_SECRET).trim()});
   stage='authentication';
   const auth=await fetch(API+'/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
   if(!auth.ok){
    if(auth.status===429){
     const retry=auth.headers.get('retry-after');
     const seconds=Number(retry);
     const retryMs=Number.isFinite(seconds)&&seconds>0?seconds*1000:retry&&Number.isFinite(Date.parse(retry))?Date.parse(retry)-Date.now():900000;
     setCooldown(Math.min(3600000,Math.max(900000,retryMs)));
    }else setCooldown(300000);
    return fallback('authentication_failed_'+auth.status);
   }
   stage='authentication_response';
   const payload=await auth.json();
   token=payload.access_token;
   if(!token)return fallback('missing_token');
   const ttl=Math.max(60,Math.min(3600,Number(payload.expires_in)||1800)-120);
   if(kv)context?.waitUntil(kvWrite('token-v1',{token,expiresAt:Date.now()+ttl*1000},ttl));
   if(cache){
    const response=new Response(JSON.stringify({token,expiresAt:Date.now()+ttl*1000}),{headers:{'cache-control':'public, max-age='+ttl}});
    context?.waitUntil(cache.put(tokenKey,response));
   }
  }
  let cents=0,count=0,page=1,seen=new Set();
  while(page<=100){
   const url=new URL(API+'/v5/organizations/'+ORG+'/forms/Donation/'+FORM+'/payments');
   url.searchParams.set('pageIndex',String(page));url.searchParams.set('pageSize','100');url.searchParams.set('from',START);
   stage='payments_request';
   const response=await fetch(url,{headers:{authorization:'Bearer '+token,accept:'application/json'}});
   if(!response.ok)return fallback('form_lookup_failed_'+response.status);
   stage='payments_response';
   const result=await response.json();const items=result.data||[];
   if(!Array.isArray(items))return fallback('invalid_response');
   for(const p of items){
    if(p.state!=='Authorized'&&p.state!=='Registered')continue;
    if(p.type==='Debit')continue;
    if(seen.has(p.id))continue;
    seen.add(p.id);
    // Un formulaire Donation ne contient que des dons ; montant du paiement hors pourboire.
    const amount=Number(p.amount);
    if(Number.isFinite(amount)&&amount>0){cents+=amount;count++}
   }
   const pages=Number(result.pagination?.totalPages)||1;
   if(page>=pages||items.length===0)break;
   page++;
  }
  if(page>100)return fallback('pagination_limit');
  const data={available:true,amount:cents/100,goal:GOAL,payments:count,updated:new Date().toISOString()};
  stage='verified_cache';
  if(kv)context?.waitUntil(kvWrite('verified-v1',data,86400*7));
  // Un cache défaillant ne doit jamais masquer des paiements HelloAsso vérifiés.
  if(cache){
   try{
    const saved=new Response(JSON.stringify(data),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=86400'}});
    const task=cache.put(key,saved).catch(()=>{});
    if(context?.waitUntil)context.waitUntil(task);
   }catch(e){/* Le montant vérifié reste disponible sans cache. */}
  }
  return json(data);
 }catch(e){return fallback('service_unavailable_'+stage)}
}
