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
 const key=new Request(new URL('/api/helloasso-verified-v1',request.url).toString(),{method:'GET'});
 const cached=cache?await cache.match(key):null;
 const tokenKey=new Request(new URL('/api/helloasso-token-cache-v3',request.url).toString(),{method:'GET'});
 const cooldownKey=new Request(new URL('/api/helloasso-auth-cooldown-v2',request.url).toString(),{method:'GET'});
 const cooldown=cache?await cache.match(cooldownKey):null;
 const cooldownUntil=cooldown?Number(await cooldown.text()):0;
 const setCooldown=(ms)=>{if(cache){const response=new Response(String(Date.now()+ms),{headers:{'cache-control':'public, max-age='+Math.ceil(ms/1000)}});context?.waitUntil(cache.put(cooldownKey,response));}};
 if(cached){try{const data=await cached.clone().json();if(data.available&&Date.now()-Date.parse(data.updated)<900000)return json(data)}catch(e){}}
 const fallback=async(reason,status=503)=>{
  if(cached){try{const data=await cached.clone().json();if(data.available)return json({...data,stale:true,warning:reason})}catch(e){}}
  return json({available:false,reason},status);
 };
 if(cooldownUntil>Date.now())return fallback('authentication_rate_limited');
 if(!env.HELLOASSO_CLIENT_ID||!env.HELLOASSO_CLIENT_SECRET)return fallback('credentials_missing');
 try{
  let token=null;
  if(cache){
   const savedToken=await cache.match(tokenKey);
   if(savedToken){try{const data=await savedToken.json();if(data.token&&Number(data.expiresAt)>Date.now()+60000)token=data.token;}catch(e){}}
  }
  if(!token){
   // Réserver une fenêtre d'attente avant l'appel pour éviter des connexions en rafale.
   setCooldown(60000);
   const body=new URLSearchParams({grant_type:'client_credentials',client_id:String(env.HELLOASSO_CLIENT_ID).trim(),client_secret:String(env.HELLOASSO_CLIENT_SECRET).trim()});
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
   const payload=await auth.json();
   token=payload.access_token;
   if(!token)return fallback('missing_token');
   if(cache){
    const ttl=Math.max(60,Math.min(3600,Number(payload.expires_in)||1800)-120);
    const response=new Response(JSON.stringify({token,expiresAt:Date.now()+ttl*1000}),{headers:{'cache-control':'public, max-age='+ttl}});
    context?.waitUntil(cache.put(tokenKey,response));
   }
  }
  let cents=0,count=0,page=1,seen=new Set();
  while(page<=100){
   const url=new URL(API+'/v5/organizations/'+ORG+'/forms/Donation/'+FORM+'/payments');
   url.searchParams.set('pageIndex',String(page));url.searchParams.set('pageSize','100');url.searchParams.set('from',START);
   const response=await fetch(url,{headers:{authorization:'Bearer '+token,accept:'application/json'}});
   if(!response.ok)return fallback('form_lookup_failed_'+response.status);
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
  if(cache){const saved=json(data);saved.headers.set('cache-control','public, max-age=86400');context?.waitUntil(cache.put(key,saved));}
  return json(data);
 }catch(e){return fallback('service_unavailable')}
}
