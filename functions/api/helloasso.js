// Cloudflare Pages Function. Les identifiants HelloAsso restent côté serveur.
const API='https://api.helloasso.com';
const ORG='college-sevigne-paris';
const FORM='1';
const GOAL=150000;
// Tous les dons de ce formulaire sont inclus, y compris ceux reçus avant le lancement public.
async function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=180, s-maxage=300','x-content-type-options':'nosniff'}})}
export async function onRequestGet({env}){
 if(!env.HELLOASSO_CLIENT_ID||!env.HELLOASSO_CLIENT_SECRET)return json({available:false,reason:'credentials_missing'},503);
 try{
  const body=new URLSearchParams({grant_type:'client_credentials',client_id:env.HELLOASSO_CLIENT_ID,client_secret:env.HELLOASSO_CLIENT_SECRET});
  const auth=await fetch(API+'/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  if(!auth.ok)return json({available:false,reason:'authentication_failed'},503);
  const token=(await auth.json()).access_token;
  if(!token)return json({available:false,reason:'missing_token'},503);
  let cents=0,count=0,page=1,seen=new Set();
  while(page<=100){
   const url=new URL(API+'/v5/organizations/'+ORG+'/forms/Donation/'+FORM+'/payments');
   url.searchParams.set('pageIndex',String(page));url.searchParams.set('pageSize','100');
   const response=await fetch(url,{headers:{authorization:'Bearer '+token,accept:'application/json'}});
   if(!response.ok)return json({available:false,reason:'form_lookup_failed',httpStatus:response.status},503);
   const result=await response.json();const items=result.data||[];
   if(!Array.isArray(items))return json({available:false,reason:'invalid_response'},503);
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
  if(page>100)return json({available:false,reason:'pagination_limit'},503);
  return json({available:true,amount:cents/100,goal:GOAL,payments:count,updated:new Date().toISOString()});
 }catch(e){return json({available:false,reason:'service_unavailable'},503)}
}
