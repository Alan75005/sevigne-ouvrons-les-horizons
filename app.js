const DON='https://www.helloasso.com/associations/college-sevigne-paris/formulaires/1';
const target=new Date('2026-12-31T23:59:59+01:00');function countdown(){const e=document.getElementById('days');if(!e)return;let d=target-new Date();e.textContent=Math.max(0,Math.ceil(d/86400000));document.getElementById('dayslabel').textContent=d>0?'jours avant la clôture':'campagne terminée'}countdown();
const io='IntersectionObserver'in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}}),{threshold:.12}):null;document.querySelectorAll('.reveal').forEach(x=>io?io.observe(x):x.classList.add('visible'));
function burst(){if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;for(let i=0;i<16;i++){const el=document.createElement('span');el.className='confetti';el.style.left=Math.random()*100+'vw';el.style.top='-20px';el.style.background=['#A64B43','#D8BA80','#B7C9D1','#355f78'][i%4];el.style.animationDelay=Math.random()*.3+'s';document.body.appendChild(el);setTimeout(()=>el.remove(),2000)}}
document.querySelectorAll('.amount').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.amount').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById('chosen').textContent='Mon intention de don : '+Number(b.dataset.amount).toLocaleString('fr-FR')+' €';burst()}));
const thresholds=[25000,50000,100000,150000],labels=['Le premier élan est lancé !','La communauté grandit !','Plus que jamais, ensemble !','Objectif atteint : bravo à tous !'];const demo=document.getElementById('demo-amount');let previousLevel=0;function updateDemo(){if(!demo)return;const value=Number(demo.value),level=thresholds.filter(t=>value>=t).length;document.getElementById('demo-value').textContent=value.toLocaleString('fr-FR')+' €';document.querySelectorAll('.step').forEach((el,i)=>{el.classList.toggle('done',i<level);el.classList.toggle('next',i===level)});document.getElementById('milestone-message').textContent=level?labels[level-1]:'Le premier palier nous attend : 25 000 € !';if(level>previousLevel)burst();previousLevel=level;/* La simulation ne doit jamais modifier la jauge HelloAsso. */}if(demo){demo.addEventListener('input',updateDemo);document.getElementById('demo-reset')?.addEventListener('click',()=>{demo.value=0;updateDemo()});updateDemo()}
const shareUrl=location.protocol.startsWith('http')?location.href:DON;async function shareCampaign(){const data={title:'Sévigné, ouvrons les horizons',text:'Participez à la chaîne de solidarité pour les Bourses Mathilde Salomon !',url:shareUrl};if(navigator.share){try{await navigator.share(data);return}catch(e){}}window.open('https://wa.me/?text='+encodeURIComponent(data.text+' '+data.url),'_blank','noopener')}async function copyLink(){try{await navigator.clipboard.writeText(shareUrl);document.getElementById('copy-status').textContent='Lien copié !'}catch(e){document.getElementById('copy-status').textContent='Copie non disponible : utilisez le bouton Partager.'}}
const wallMessage=document.getElementById('wall-message'),wallSignature=document.getElementById('wall-signature'),wallPreview=document.getElementById('wall-preview'),wallFeedback=document.getElementById('wall-feedback');function messagePayload(){return {message:wallMessage.value.trim(),signature:wallSignature.value.trim()||'Anonyme'}}
document.getElementById('wall-preview-button')?.addEventListener('click',()=>{const {message,signature}=messagePayload();wallPreview.replaceChildren();if(!message){wallFeedback.textContent='Écris d’abord un message.';return}const t=document.createElement('p');t.className='quote';t.textContent='« '+message+' »';const a=document.createElement('strong');a.textContent='— '+signature;wallPreview.append(t,a);wallPreview.classList.add('show');wallFeedback.textContent='Aperçu privé : non publié.'});
document.getElementById('wall-copy-button')?.addEventListener('click',async()=>{const {message,signature}=messagePayload();if(!message){wallFeedback.textContent='Écris d’abord un message.';return}try{await navigator.clipboard.writeText(message+'\n— '+signature);wallFeedback.textContent='Message copié.'}catch(e){wallFeedback.textContent='Copie indisponible.'}});
document.getElementById('wall-submit-button')?.addEventListener('click',async e=>{const {message,signature}=messagePayload();if(message.length<8){wallFeedback.textContent='Écris au moins huit caractères.';return}if(!document.getElementById('wall-consent').checked){wallFeedback.textContent='Coche l’autorisation de publication.';return}e.currentTarget.disabled=true;wallFeedback.textContent='Envoi en cours…';try{const r=await fetch('/api/messages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message,signature,consent:true})});const j=await r.json();if(!r.ok)throw Error(j.error||'Envoi impossible');wallFeedback.textContent='Message reçu. Il sera publié uniquement après validation.';wallMessage.value='';wallSignature.value='';document.getElementById('wall-consent').checked=false;wallPreview.replaceChildren()}catch(err){wallFeedback.textContent='Envoi indisponible : '+err.message+'. Vous pouvez copier le message et le transmettre à Sévigné.'}finally{e.currentTarget.disabled=false}});
async function loadLive(){try{const r=await fetch('/api/public',{cache:'no-store'});if(!r.ok)return;const j=await r.json();const el=document.getElementById('live-progress');if(el){if(Number.isFinite(j.amount)){el.textContent='Collecte déclarée par Sévigné : '+j.amount.toLocaleString('fr-FR')+' € sur 150 000 € ('+Math.round(j.amount/150000*100)+' %). Mise à jour : '+(j.updated||'non précisée')+'.';}else{el.textContent='Collecte en attente de connexion HelloAsso : aucun montant fictif affiché.'}}if(Array.isArray(j.messages)&&j.messages.length){const grid=document.getElementById('wall-grid');grid.replaceChildren();j.messages.forEach(m=>{const card=document.createElement('article');card.className='wall-card';const quote=document.createElement('p');quote.className='quote';quote.textContent='« '+m.message+' »';const by=document.createElement('span');by.className='author';by.textContent=m.signature;card.append(quote,by);grid.append(card)})}}catch(e){}}loadLive();
// Jauge des paiements réels : aucune estimation de progression.
async function loadHelloAssoProgress(){
 const label=document.getElementById('progress-text'),fill=document.getElementById('fill'),note=document.getElementById('progress-source'),bar=fill?.closest('[role="progressbar"]');
 if(!label||!fill)return;
 const key='sevigne_helloasso_last_verified_v1',goal=150000;
 const show=(data,stale=false)=>{
  const amount=Number(data.amount),pct=amount/goal*100;
  if(!Number.isFinite(amount)||amount<0)return false;
  fill.style.width=Math.min(100,pct)+'%';
  label.textContent=amount.toLocaleString('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0})+' collectés · '+pct.toLocaleString('fr-FR',{maximumFractionDigits:1})+' %'+(stale?' (dernier relevé)':'');
  bar?.setAttribute('aria-valuenow',String(Math.min(goal,amount)));
  bar?.setAttribute('aria-valuetext',label.textContent);
  const date=data.updated&&Number.isFinite(Date.parse(data.updated))?new Date(data.updated).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Paris'}):'non précisée';
  if(note)note.textContent=(stale?'Dernier montant vérifié sur HelloAsso le ':'Paiements HelloAsso · Actualisé le ')+date+(stale?' · Connexion momentanément indisponible.':' (heure de Paris).');
  return true;
 };
 const retrieve=async()=>{
  const response=await fetch('/api/helloasso?refresh='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('api_'+response.status);
  const data=await response.json();
  if(!data.available||!Number.isFinite(Number(data.amount))||Number(data.amount)<0)throw Error('invalid_data');
  return data;
 };
 try{
  const data=await retrieve();
  if(show(data,Boolean(data.stale))&&!data.stale){try{localStorage.setItem(key,JSON.stringify(data))}catch(e){}}
  return;
 }catch(e){}

 try{
  const saved=JSON.parse(localStorage.getItem(key)||'null');
  if(saved&&show(saved,true))return;
 }catch(e){}
 label.textContent='Connexion HelloAsso momentanément indisponible';
 fill.style.width='0%';
 bar?.removeAttribute('aria-valuenow');
 bar?.setAttribute('aria-valuetext',label.textContent);
 if(note)note.textContent='Le montant réel sera affiché dès le rétablissement de la synchronisation.';
}

loadHelloAssoProgress();


/* Engagements des ambassadeurs : enregistrement persistant via Cloudflare KV. */
const AMBASSADOR_KEY='sevigne_ambassador_uuid_v1';
let ambassadorAvailable=false;
function ambassadorId(){
 try{
  let id=localStorage.getItem(AMBASSADOR_KEY);
  if(!id){id=crypto.randomUUID();localStorage.setItem(AMBASSADOR_KEY,id);}
  return id;
 }catch{return null;}
}
function renderAmbassadors(data){
 const count=document.getElementById('ambassador-count');
 const fill=document.getElementById('ambassador-fill');
 const bar=document.getElementById('ambassador-progress');
 if(!count||!fill||!bar)return;
 const n=Math.max(0,Number(data.count)||0),goal=100;
 count.textContent=n.toLocaleString('fr-FR')+' / '+goal;
 fill.style.width=Math.min(100,n/goal*100)+'%';
 bar.setAttribute('aria-valuenow',String(Math.min(goal,n)));
 bar.setAttribute('aria-valuetext',n+' ambassadeurs sur '+goal);
}
async function loadAmbassadors(){
 const button=document.getElementById('ambassador-join');
 const count=document.getElementById('ambassador-count');
 const feedback=document.getElementById('ambassador-feedback');
 if(!button)return;
 try{
  const response=await fetch('/api/ambassadors',{cache:'no-store'});
  if(!response.ok)throw Error('unavailable');
  const data=await response.json();
  if(!data.available)throw Error('unavailable');
  ambassadorAvailable=true;
  renderAmbassadors(data);
  button.disabled=false;
  if(!ambassadorId()){button.disabled=true;feedback.textContent='Votre navigateur ne permet pas cet enregistrement.';}
 }catch{
  ambassadorAvailable=false;
  button.disabled=true;
  if(count)count.textContent='Bientôt disponible';
  if(feedback)feedback.textContent='Le compteur sera activé prochainement.';
 }
}
async function joinAmbassadors(){
 const button=document.getElementById('ambassador-join');
 const feedback=document.getElementById('ambassador-feedback');
 const id=ambassadorId();
 if(!button||!feedback||!id||!ambassadorAvailable)return;
 button.disabled=true;
 feedback.textContent='Enregistrement en cours…';
 try{
  const response=await fetch('/api/ambassadors',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id})});
  if(!response.ok)throw Error('unavailable');
  const data=await response.json();
  if(!data.registered)throw Error('unavailable');
  renderAmbassadors(data);
  button.textContent='Engagement enregistré';
  feedback.textContent='Merci ! Partagez maintenant notre appel aux dons avec votre entourage.';
 }catch{
  button.disabled=false;
  feedback.textContent='Enregistrement momentanément indisponible. Réessayez dans quelques instants.';
 }
}
loadAmbassadors();
