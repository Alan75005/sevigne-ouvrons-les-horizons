const GOAL=500;
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:HEADERS});}
async function total(kv){
 let cursor,number=0;
 do{
  const page=await kv.list({prefix:'ambassador:',limit:1000,...(cursor?{cursor}:{})});
  number+=page.keys.length;
  cursor=page.list_complete?null:page.cursor;
 }while(cursor);
 return number;
}
export async function onRequestGet({env}){
 if(!env.AMBASSADORS)return json({available:false,reason:'storage_not_configured',goal:GOAL},503);
 try{return json({available:true,count:await total(env.AMBASSADORS),goal:GOAL});}
 catch{return json({available:false,reason:'storage_unavailable',goal:GOAL},503);}
}
export async function onRequestPost({request,env}){
 if(!env.AMBASSADORS)return json({available:false,reason:'storage_not_configured'},503);
 if(request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')return json({error:'invalid_content_type'},415);
 const origin=request.headers.get('origin');
 if(origin&&new URL(origin).host!==new URL(request.url).host)return json({error:'origin_not_allowed'},403);
 let data;try{data=await request.json();}catch{return json({error:'invalid_json'},400);}
 const id=data?.id;
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return json({error:'invalid_id'},400);
 try{
  const key='ambassador:'+id;
  const exists=await env.AMBASSADORS.get(key);
  if(!exists)await env.AMBASSADORS.put(key,new Date().toISOString());
  return json({available:true,registered:true,alreadyRegistered:Boolean(exists),count:await total(env.AMBASSADORS),goal:GOAL});
 }catch{return json({available:false,reason:'storage_unavailable'},503);}
}
