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
 if(cached){try{const data=await cached.clone().json();if(data.available&&Date.now()-Date.parse(data.updated)<300000)return json(data)}catch(e){}}
 const fallback=async(reason,status=503)=>{
  if(cached){try{const data=await cached.clone().json();if(data.available)return json({...data,stale:true,warning:reason})}catch(e){}}
  return json({available:false,reason},status);
 };
 if(!env.HELLOASSO_CLIENT_ID||!env.HELLOASSO_CLIENT_SECRET)return fallback('credentials_missing');
 try{
  const body=new URLSearchParams({grant_type:'client_credentials',client_id:String(env.HELLOASSO_CLIENT_ID).trim(),client_secret:String(env.HELLOASSO_CLIENT_SECRET).trim()});
  const auth=await fetch(API+'/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  if(!auth.ok)return fallback('authentication_failed_'+auth.status);
  const token=(await auth.json()).access_token;
  if(!token)return fallback('missing_token');
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
