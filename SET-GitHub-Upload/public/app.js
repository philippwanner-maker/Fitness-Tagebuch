'use strict';
/* SET Glass Edition. Keine externen Bibliotheken, keine Übertragung von Trainingsdaten. */
const KEY = 'set-fitness-v1';
const uid = () => crypto.randomUUID();
const copy = x => JSON.parse(JSON.stringify(x));
const norm = s => s.trim().toLocaleLowerCase('de-DE');
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = d => new Date(d+'T12:00:00').toLocaleDateString('de-DE',{day:'numeric',month:'long',year:'numeric'});
const monthFmt = d => new Date(d.slice(0,7)+'-01T12:00:00').toLocaleDateString('de-DE',{month:'long',year:'numeric'});
const presets = {Push:['Brustpresse','Schrägbankdrücken','Schulterdrücken','Seitheben','Trizepsdrücken'],Pull:['Klimmzüge','Latzug','Rudern','Face Pulls','Bizepscurls'],Leg:['Kniebeugen','Beinpresse','Beinstrecker','Beinbeuger','Wadenheben']};
const bodyNames = ['Klimmzüge','Liegestütze','Dips','Crunches','Sit-ups','Beinheben','Glute Bridge','Inverted Rows','Ausfallschritte ohne Gewicht'];
const names = [...new Set([...Object.values(presets).flat(),...bodyNames,'Bankdrücken','Kurzhantel-Bankdrücken','Butterfly','Kabel-Flys','Arnold Press','Frontheben','Reverse Flys','Trizeps-Kickbacks','French Press','Enges Bankdrücken','Überzüge','Kreuzheben','Rumänisches Kreuzheben','Sumo-Kreuzheben','T-Bar-Rudern','Kurzhantel-Rudern','Kabelrudern','Hammer Curls','Scott Curls','Konzentrationscurls','Reverse Curls','Frontkniebeugen','Hackenschmidt-Kniebeugen','Ausfallschritte','Bulgarische Kniebeugen','Hip Thrusts','Goblet Squats','Step-ups','Adduktoren','Abduktoren','Wadenheben sitzend','Kabel-Crunches','Back Extensions','Good Mornings'])];
const palette = ['#f77979','#78adff','#9bdc87','#c29bff','#ffbd75','#6bd8ce','#ee8dcc','#d1d77d'];
const REST_DAY = {id:'rest-day',name:'Rest Day',color:'#4a5553',exercises:[]};
const makeProfileCode = () => 'SET-'+Array.from(crypto.getRandomValues(new Uint8Array(4)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
const emptyCommunity = () => ({profileCode:makeProfileCode(),displayName:'',friends:[],posts:[],directory:[]});
const blank = () => ({id:uid(),date:localDate(),type:'',dayId:'',color:'#929b99',exercises:[],image:'',createdAt:Date.now()});
const emptyDB = () => ({version:3,workouts:[],draft:null,custom:[],plans:[],activePlanId:null,avatar:'',community:emptyCommunity()});
const sorted = ws => [...ws].sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||0)-(a.createdAt||0));
const validName = s => typeof s==='string' && s.trim().length>0 && s.length<=80;
const validColor = s => /^#[\da-f]{6}$/i.test(s);
const validImage = s => s==='' || typeof s==='string' && s.length<=180000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
function validWorkout(w, complete=false) {
  return !!(w && typeof w.id==='string' && /^\d{4}-\d{2}-\d{2}$/.test(w.date) && localDate(new Date(w.date+'T12:00:00'))===w.date && typeof w.type==='string' && w.type.length<=80 && typeof w.dayId==='string' && validColor(w.color) && validImage(w.image) && Array.isArray(w.exercises) && w.exercises.length<=200 && (!complete||w.dayId===REST_DAY.id||w.exercises.length) && w.exercises.every(e=>typeof e.id==='string' && validName(e.name) && typeof e.body==='boolean' && Array.isArray(e.sets) && e.sets.length<=100 && (!complete||e.sets.length) && e.sets.every(s=>typeof s.id==='string' && ['weight','reps'].every(k=>s[k]==='' ? !complete : typeof s[k]==='number' && Number.isFinite(s[k]) && (k==='weight' ? s[k]>=0&&s[k]<=2000 : complete ? Number.isInteger(s[k])&&s[k]>0&&s[k]<=10000 : s[k]>=0&&s[k]<=10000)))));
}
function validPlan(p) {
  return p && typeof p.id==='string' && validName(p.name) && Array.isArray(p.days) && p.days.length>0 && p.days.length<=100 && p.days.every(d=>typeof d.id==='string' && validName(d.name) && validColor(d.color) && Array.isArray(d.exercises) && d.exercises.length>0 && d.exercises.length<=200 && d.exercises.every(e=>validName(e.name)&&typeof e.body==='boolean'&&Number.isInteger(e.sets)&&e.sets>=1&&e.sets<=100));
}
const validProfileCode = s => /^SET-[A-Z2-9]{4}$/.test(s);
function validCommunity(c) {
  const validPerson=p=>p&&validProfileCode(p.code)&&typeof p.name==='string'&&p.name.length<=80&&validImage(p.avatar||'');
  return !!(c&&validProfileCode(c.profileCode)&&typeof c.displayName==='string'&&c.displayName.length<=40&&Array.isArray(c.friends)&&c.friends.length<=500&&c.friends.every(validPerson)&&Array.isArray(c.directory)&&c.directory.length<=500&&c.directory.every(p=>validPerson(p)&&Array.isArray(p.phones||[])&&p.phones.every(n=>typeof n==='string'&&n.length<=30))&&Array.isArray(c.posts)&&c.posts.length<=500&&c.posts.every(p=>p&&typeof p.id==='string'&&validProfileCode(p.ownerCode)&&typeof p.ownerName==='string'&&p.ownerName.length<=80&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isFinite(p.createdAt)&&validImage(p.image)));
}
const phoneKey = s => String(s||'').replace(/\D/g,'').slice(-10);
function findRegisteredContacts(contacts,directory) {
  const names=new Set(contacts.flatMap(c=>c.name||[]).map(norm)),phones=new Set(contacts.flatMap(c=>c.tel||[]).map(phoneKey).filter(Boolean));
  return directory.filter(p=>(p.name&&names.has(norm(p.name)))||(p.phones||[]).some(n=>phones.has(phoneKey(n))));
}
function migrate(raw) {
  const x=copy(raw);
  if(x.version===1){
    x.version=3; x.plans=[]; x.avatar='';
    const types=[...new Set([...x.workouts,...(x.draft?[x.draft]:[])].map(w=>w.type).filter(t=>presets[t]))];
    if(types.length)x.plans=[{id:'legacy-split',name:'Bisheriger Split',days:types.map(t=>({id:'legacy-'+t,name:t,color:{Push:'#f77979',Pull:'#78adff',Leg:'#9bdc87'}[t],exercises:presets[t].map(name=>({name,body:bodyNames.includes(name),sets:1}))}))}];
    [...x.workouts,...(x.draft?[x.draft]:[])].forEach((w,i)=>Object.assign(w,{dayId:w.type?'legacy-'+w.type:'',color:{Push:'#f77979',Pull:'#78adff',Leg:'#9bdc87'}[w.type]||'#929b99',image:'',createdAt:i}));
  }
  if(x&&!x.community)x.community=emptyCommunity();
  if(!x || x.version!==3 || !Array.isArray(x.workouts) || !x.workouts.every(w=>validWorkout(w,true)) || new Set(x.workouts.map(w=>w.id)).size!==x.workouts.length || (x.draft&&!validWorkout(x.draft)) || !Array.isArray(x.custom) || !x.custom.every(e=>validName(e.name)&&typeof e.body==='boolean') || !Array.isArray(x.plans) || !x.plans.every(validPlan) || !validImage(x.avatar) || !validCommunity(x.community))throw Error('Ungültiges Datenformat');
  const ids=x.plans.flatMap(p=>p.days.map(d=>d.id)); if(new Set(ids).size!==ids.length)throw Error('Doppelte Trainingstag-ID');
  if(!x.plans.some(p=>p.id===x.activePlanId))x.activePlanId=x.plans[0]?.id||null;
  return x;
}
function lastWeight(ws,name,index,date,exclude) {
  for(const w of sorted(ws).filter(w=>w.id!==exclude&&w.date<=date)){
    const s=w.exercises.find(e=>norm(e.name)===norm(name))?.sets[index];
    if(s && typeof s.weight==='number' && s.reps>0)return s.weight;
  }
  return undefined;
}
const completedSet=s=>Number.isFinite(s.weight)&&s.weight>=0&&Number.isInteger(s.reps)&&s.reps>0;
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
function dailyProgress(ws,today=localDate()){
  const groups=new Map();
  for(const w of ws.filter(w=>w.date<=today&&w.dayId!==REST_DAY.id))for(const e of w.exercises){
    const sets=e.sets.filter(completedSet);if(!sets.length)continue;
    const key=norm(e.name),id=w.date+'|'+key;
    if(!groups.has(id))groups.set(id,{date:w.date,key,name:e.name,sets:[],estimates:[]});
    const group=groups.get(id);group.sets.push(...sets);
    if(!e.body)group.estimates.push(...sets.filter(s=>s.weight>0&&s.reps<=12).map(s=>s.weight*(s.reps===1?1:1+s.reps/30)));
  }
  return [...groups.values()].map(g=>({date:g.date,key:g.key,name:g.name,value:mean(g.sets.map(s=>s.weight)),reps:mean(g.sets.map(s=>s.reps)),sets:g.sets.length,e1rm:g.estimates.length?mean(g.estimates):null})).sort((a,b)=>a.date.localeCompare(b.date)||a.key.localeCompare(b.key));
}
function pointsFor(ws,name){return dailyProgress(ws).filter(p=>p.key===norm(name));}
function overallProgress(ws){
  const rows=dailyProgress(ws),dates=[...new Set(rows.map(p=>p.date))],baselines=new Map(),latest=new Map(),points=[];
  for(const date of dates){
    for(const p of rows.filter(p=>p.date===date)){
      if(!baselines.has(p.key)){if(p.value<=0)continue;baselines.set(p.key,p.value);}
      latest.set(p.key,p.value/baselines.get(p.key)*100);
    }
    if(latest.size)points.push({date,value:mean([...latest.values()]),exercises:latest.size});
  }
  return points;
}
const muscleRules=[
  ['Brust',/brust|bankdrück|bench|butterfly|flys|flies|liegestütz|push.?up|dips/],
  ['Rücken',/rücken|ruder|row|latzug|klimm|pull.?up|kreuzheben|deadlift|back extension|überzüg/],
  ['Beine',/bein|kniebeug|squat|ausfall|lunge|waden|calf|hip thrust|glute|adduktor|abduktor|step.?up|good morning/],
  ['Schultern',/schulter|seitheb|frontheb|reverse fly|face pull|arnold|overhead|military/],
  ['Arme',/bizeps|trizeps|curl|kickback|french press|enges bank/]
];
function muscleGroup(name){const n=norm(name);if(/enges bank/.test(n))return 'Arme';if(/reverse fly/.test(n))return 'Schultern';return muscleRules.find(([,rule])=>rule.test(n))?.[0]||null;}
function muscleActivity(ws,today=localDate()){
  const start=new Date(today+'T12:00:00');start.setDate(start.getDate()-29);const cutoff=localDate(start);
  const rows=dailyProgress(ws,today).filter(p=>p.date>=cutoff);
  return muscleRules.map(([name])=>{
    const sets=rows.filter(p=>muscleGroup(p.name)===name).reduce((n,p)=>n+p.sets,0);
    return {name,sets,intensity:sets/(sets+12)};
  });
}
function personalRecords(ws,today=localDate()){
  const records=new Map();
  for(const w of [...ws].filter(w=>w.date<=today&&w.dayId!==REST_DAY.id).sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt||0)-(b.createdAt||0))){
    for(const e of w.exercises)for(const s of e.sets.filter(completedSet)){
      const key=norm(e.name);
      if(!records.has(key))records.set(key,{key,name:e.name,weight:null,peak:null});
      const r=records.get(key);
      if(!r.weight||s.weight>r.weight.value)r.weight={value:s.weight,date:w.date};
      if(!e.body&&s.weight>0&&s.reps<=12){const value=s.weight*(s.reps===1?1:1+s.reps/30);if(!r.peak||value>r.peak.value)r.peak={value,date:w.date};}
    }
  }
  return [...records.values()].sort((a,b)=>(b.peak?.value??b.weight.value)-(a.peak?.value??a.weight.value)||a.name.localeCompare(b.name,'de'));
}
function streak(ws,today=localDate()) {
  const day=s=>Math.round(Date.parse(s+'T00:00:00Z')/86400000),days=new Set(ws.map(w=>day(w.date)));let n=day(today),count=0;
  if(!days.has(n))n--; while(days.has(n)){count++;n--;}return count;
}
function lastExercise(ws,name,date,exclude){
  for(const w of sorted(ws).filter(w=>w.id!==exclude&&w.date<=date)){
    const e=w.exercises.find(e=>norm(e.name)===norm(name));
    if(e)return e;
  }
}
function exerciseSets(ws,item,date,exclude){
  const previous=lastExercise(ws,item.name,date,exclude);
  return previous?.sets.length?previous.sets.map(s=>({id:uid(),weight:s.weight,reps:s.reps})):Array.from({length:item.sets||3},()=>({id:uid(),weight:item.body?0:'',reps:''}));
}
function plateLabel(weight){
  if(weight===''||!Number.isFinite(weight))return '20-kg-Langhantel · Gesamtgewicht eingeben';
  if(weight<20)return 'Unter 20 kg · mit dieser Langhantel nicht möglich';
  if(weight===20)return '20-kg-Langhantel · ohne Scheiben';
  let remaining=Math.round((weight-20)*50);const plates=[];
  for(const size of [25,20,15,10,5,2.5,1.25]){const count=Math.floor(remaining/(size*100));if(count){plates.push(count+' × '+String(size).replace('.',',')+' kg');remaining-=count*size*100;}}
  if(remaining||Math.abs(weight*100-Math.round(weight*100))>.001)return 'Mit Scheiben ab 1,25 kg nicht exakt steckbar';
  return 'Pro Seite: '+plates.join(' + ')+' · Stange 20 kg';
}
function applyDay(w,d,ws=[],exclude) {
  if(w.dayId===(d?.id||''))return w;
  w.dayId=d?.id||'';w.type=d?.name||'';w.color=d?.color||'#929b99';
  if(d)w.exercises=d.exercises.map(e=>({id:uid(),name:e.name,body:e.body,sets:exerciseSets(ws,e,w.date,exclude)}));
  return w;
}
if(typeof module!=='undefined')module.exports={personalRecords,migrate,validWorkout,lastWeight,lastExercise,exerciseSets,plateLabel,pointsFor,dailyProgress,overallProgress,muscleActivity,muscleGroup,streak,applyDay,makeProfileCode,findRegisteredContacts};
if(typeof document!=='undefined')boot();
function boot(){
  const $=s=>document.querySelector(s);
  let db=emptyDB(),blocked=false,notificationTimer,current,editing=null,planDraft=null,expanded=false,cal=new Date(),selected=localDate();cal.setDate(1);
  function notify(message,error=false){clearTimeout(notificationTimer);$('#toast').textContent=message;$('#toast').classList.toggle('error',error);notificationTimer=setTimeout(()=>{$('#toast').textContent='';$('#toast').classList.remove('error');},5000);}
  function warning(message){$('#storageWarning').hidden=false;$('#storageWarning').textContent=message;}
  try{const raw=localStorage.getItem(KEY);if(raw)db=migrate(JSON.parse(raw));localStorage.setItem(KEY,JSON.stringify(db));}catch(e){blocked=true;warning('Deine gespeicherten Daten konnten nicht gelesen werden. Sie werden nicht überschrieben. Exportiere zuerst ein Backup und prüfe den Browser-Speicher.');}
  function commit(next){if(blocked){notify('Speichern gesperrt. Bitte den Hinweis oben beachten.',true);return false;}try{localStorage.setItem(KEY,JSON.stringify(next));db=next;$('#storageWarning').hidden=true;return true;}catch(e){warning('Speichern fehlgeschlagen: Der lokale Speicher ist voll oder gesperrt. Deine Eingaben bleiben geöffnet. Exportiere ein Backup; entferne gegebenenfalls gespeicherte Fotos.');notify('Nicht gespeichert: Browser-Speicher prüfen.',true);return false;}}
  current=copy(db.draft||blank());
  function draft(){if(!editing){$('#draftStatus').textContent=commit({...db,draft:copy(current)})?'Entwurf · gespeichert':'Entwurf · nicht gespeichert';}else $('#draftStatus').textContent='Änderungen noch ungespeichert';}
  function show(tab){document.querySelectorAll('main>section').forEach(el=>el.hidden=el.id!==tab);document.querySelectorAll('nav [data-tab]').forEach(el=>{el.classList.toggle('active',el.dataset.tab===tab);if(el.dataset.tab===tab)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});if(tab==='profile')renderProfile();if(tab==='home')renderHome();if(tab==='friends')renderFriends();window.scrollTo({top:0});}
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>show(b.dataset.tab));$('.brand').onclick=e=>{e.preventDefault();show('home');};
  const catalogue=()=>[...names.map(name=>({name,body:bodyNames.includes(name)})),...db.custom,...db.plans.flatMap(p=>p.days.flatMap(d=>d.exercises))].filter((x,i,a)=>a.findIndex(y=>norm(y.name)===norm(x.name))===i);
  function renderDays(){
    const active=db.plans.find(p=>p.id===db.activePlanId);
    $('#workoutDay').innerHTML=`<option value="">Freies Training</option><option value="${REST_DAY.id}">${REST_DAY.name}</option>`+(active?`<optgroup label="${esc(active.name)}">${active.days.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</optgroup>`:'');
    if(current.dayId!==REST_DAY.id&&current.dayId&&!active?.days.some(d=>d.id===current.dayId))$('#workoutDay').insertAdjacentHTML('beforeend',`<option value="${esc(current.dayId)}" disabled>${esc(current.type)} (aktuelles Training)</option>`);
    $('#workoutDay').value=current.dayId;
  }
  function renderEditor(){
    $('#date').value=current.date;$('#date').max=localDate();$('#editorTitle').textContent=editing?'Training bearbeiten':'Los geht’s.';$('#saveWorkout').textContent=editing?'Änderungen speichern →':'Training beenden & speichern →';$('#cancelEdit').hidden=!editing;$('#discardDraft').hidden=!!editing;renderDays();
    $('#exerciseCount').textContent=`${current.exercises.length} Übungen`;
    $('#exercises').innerHTML=current.exercises.map((e,i)=>`<article class="exercise" data-e="${i}"><div class="row"><h3>${esc(e.name)}</h3><button type="button" data-action="remove" class="quiet small">Entfernen</button></div><div class="set-head"><span>#</span><span>Gewicht · kg</span><span>Wdh.</span><span></span></div>${e.sets.map((s,j)=>{const hint=lastWeight(db.workouts,e.name,j,current.date,editing);return `<div class="set" data-s="${j}"><span class="set-number">${j+1}</span><div><div class="weight-control"><button type="button" data-action="minus" aria-label="Gewicht Satz ${j+1} ${esc(e.name)} um 2,5 kg senken">−2,5</button><input type="number" inputmode="decimal" min="0" max="2000" step="0.1" data-field="weight" aria-label="Gewicht Satz ${j+1} ${esc(e.name)}" value="${s.weight}" placeholder="${hint??'kg'}"><button type="button" data-action="plus" aria-label="Gewicht Satz ${j+1} ${esc(e.name)} um 2,5 kg erhöhen">+2,5</button></div><span class="plate-badge" hidden aria-live="polite"></span><span class="micro weight-note">${s.weight===0?'Körpergewicht':hint!==undefined?'Zuletzt: '+hint+' kg':''}</span></div><input type="number" inputmode="numeric" min="1" max="10000" data-field="reps" aria-label="Wiederholungen Satz ${j+1} ${esc(e.name)}" value="${s.reps}" placeholder="Wdh."><button type="button" class="delete-set" data-action="deleteSet" aria-label="Satz ${j+1} ${esc(e.name)} löschen">×</button></div>`;}).join('')}<button type="button" class="secondary full" data-action="addSet">＋ Satz hinzufügen</button></article>`).join('')||'<div class="empty">Wähle einen Trainingstag oder deine erste Übung.</div>';renderSearch();
  }
  function addExercise(item){if(current.exercises.some(e=>norm(e.name)===norm(item.name))){notify('Diese Übung ist bereits im Training. Füge dort weitere Sätze hinzu.');return;}current.exercises.push({id:uid(),name:item.name,body:item.body,sets:exerciseSets(db.workouts,item,current.date,editing)});draft();renderEditor();}
  function renderSearch(){const q=norm($('#exerciseSearch').value);$('#exerciseResults').replaceChildren();catalogue().filter(x=>norm(x.name).includes(q)).slice(0,q?40:6).forEach(item=>{const b=document.createElement('button');b.type='button';b.textContent='＋ '+item.name;b.onclick=()=>addExercise(item);$('#exerciseResults').append(b);});}
  $('#exerciseSearch').oninput=renderSearch;
  $('#date').onchange=()=>{current.date=$('#date').value;draft();renderEditor();};
  $('#workoutDay').onchange=()=>{const id=$('#workoutDay').value;applyDay(current,id===REST_DAY.id?REST_DAY:db.plans.find(p=>p.id===db.activePlanId)?.days.find(d=>d.id===id),db.workouts,editing);draft();renderEditor();};
  function showPlates(input){const badge=input.closest('.set').querySelector('.plate-badge');badge.textContent=plateLabel(input.value===''?'':Number(input.value));badge.hidden=false;}
  $('#exercises').addEventListener('focusin',ev=>{if(ev.target.matches('[data-field="weight"]'))showPlates(ev.target);});
  $('#exercises').oninput=ev=>{const el=ev.target;if(!el.dataset.field)return;const e=current.exercises[el.closest('[data-e]').dataset.e],s=e.sets[el.closest('[data-s]').dataset.s];s[el.dataset.field]=el.value===''?'':Number(el.value);if(el.dataset.field==='weight'){el.closest('.set').querySelector('.weight-note').textContent=s.weight===0?'Körpergewicht':'';showPlates(el);}draft();};
  $('#exercises').addEventListener('pointerdown',ev=>{if(ev.target.closest('[data-action="plus"],[data-action="minus"]'))ev.preventDefault();});
  $('#exercises').onclick=ev=>{const b=ev.target.closest('[data-action]');if(!b)return;const i=+b.closest('[data-e]').dataset.e,e=current.exercises[i],j=+b.closest('[data-s]')?.dataset.s;switch(b.dataset.action){case'remove':if(!confirm(e.name+' entfernen?'))return;current.exercises.splice(i,1);break;case'addSet':e.sets.push({id:uid(),weight:e.body?0:'',reps:''});break;case'deleteSet':e.sets.splice(j,1);break;default:{const s=e.sets[j],base=s.weight===''?(lastWeight(db.workouts,e.name,j,current.date,editing)??0):s.weight;s.weight=Math.max(0,Math.min(2000,Math.round((base+(b.dataset.action==='plus'?2.5:-2.5))*100)/100));const row=b.closest('.set'),input=row.querySelector('[data-field="weight"]');input.value=s.weight;row.querySelector('.weight-note').textContent=s.weight===0?'Körpergewicht':'';showPlates(input);draft();return;}}draft();renderEditor();};
  $('#customExercise').onclick=()=>{$('#exerciseForm').reset();$('#exerciseDialog').showModal();};
  $('#exerciseForm').onsubmit=ev=>{ev.preventDefault();const item={name:$('#exerciseName').value.trim(),body:$('#exerciseBody').checked};if(!validName(item.name))return;if(!catalogue().some(e=>norm(e.name)===norm(item.name))&&!commit({...db,custom:[...db.custom,item]}))return;$('#exerciseDialog').close();addExercise(item);};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
  $('#workoutForm').onsubmit=ev=>{ev.preventDefault();if(!validWorkout(current,true)||current.date>localDate()){notify('Bitte Datum, Übungen und alle Sätze ausfüllen: Gewicht ab 0 und positive, ganze Wiederholungen.',true);return;}const w=copy(current);if(!editing)w.createdAt=Date.now();const next={...db,workouts:editing?db.workouts.map(x=>x.id===editing?w:x):[...db.workouts,w],draft:editing?db.draft:null};if(!commit(next))return;editing=null;current=copy(db.draft||blank());renderEditor();show('profile');notify('Training gespeichert. Stark gemacht!');};
  $('#cancelEdit').onclick=()=>{editing=null;current=copy(db.draft||blank());renderEditor();show('profile');};
  $('#discardDraft').onclick=()=>{if(confirm('Trainingsentwurf verwerfen?')&&commit({...db,draft:null})){current=blank();renderEditor();}};
  // Pläne werden getrennt vom laufenden Training bearbeitet. Historische Namen/Farben bleiben Momentaufnahmen.
  function nextColor(){const n=db.plans.flatMap(p=>p.days).length+(planDraft?.days.length||0);return n<palette.length?palette[n]:'#'+Array.from({length:3},(_,i)=>Math.round(150+70*Math.sin(n*2.399+i*2.094)).toString(16).padStart(2,'0')).join('');}
  const newPlanExercise=()=>({name:'',body:false,sets:3});
  function addDay(){planDraft.days.push({id:uid(),name:'',color:nextColor(),exercises:[newPlanExercise()]});renderPlan();}
  function openPlan(p){planDraft=p?copy(p):{id:uid(),name:'',days:[]};$('#planName').value=planDraft.name;$('#planError').textContent='';$('#planTitle').textContent=p?'Plan bearbeiten':'Dein neuer Plan';if(!p)addDay();else renderPlan();$('#plansDialog').close();$('#planDialog').showModal();}
  $('#createPlan').onclick=()=>openPlan();$('#addPlanDay').onclick=addDay;
  function renderPlan(){ $('#exerciseOptions').innerHTML=catalogue().map(e=>`<option value="${esc(e.name)}"></option>`).join('');$('#planDays').innerHTML=planDraft.days.map((d,i)=>`<section class="plan-day" data-d="${i}"><div class="row"><h3>Trainingstag ${i+1}</h3><button type="button" class="quiet small" data-plan-action="deleteDay">Entfernen</button></div><div class="two-col"><label>Name<input data-day-field="name" value="${esc(d.name)}" maxlength="80" placeholder="z. B. Oberkörper A"></label><label>Kalenderfarbe<input type="color" data-day-field="color" value="${d.color}"></label></div>${d.exercises.map((e,j)=>`<div class="plan-exercise" data-pe="${j}"><label>Übung<input list="exerciseOptions" data-plan-field="name" value="${esc(e.name)}" maxlength="80" placeholder="Suchen oder eigenen Namen eingeben"></label><label>Sätze<input type="number" min="1" max="100" data-plan-field="sets" value="${e.sets}"></label><button type="button" data-plan-action="deleteExercise" aria-label="Übung entfernen">×</button><label class="check"><input type="checkbox" data-plan-field="body" ${e.body?'checked':''}> Eigengewicht</label></div>`).join('')}<button type="button" class="secondary full" data-plan-action="addExercise">＋ Übung hinzufügen</button></section>`).join('');}
  $('#planDays').oninput=ev=>{const el=ev.target,d=planDraft.days[el.closest('[data-d]')?.dataset.d];if(!d)return;if(el.dataset.dayField)d[el.dataset.dayField]=el.value;if(el.dataset.planField){const e=d.exercises[el.closest('[data-pe]').dataset.pe],k=el.dataset.planField;e[k]=k==='body'?el.checked:k==='sets'?Number(el.value):el.value;if(k==='name'){e.body=catalogue().find(x=>norm(x.name)===norm(e.name))?.body||false;el.closest('[data-pe]').querySelector('[data-plan-field="body"]').checked=e.body;}}};
  $('#planDays').onclick=ev=>{const b=ev.target.closest('[data-plan-action]');if(!b)return;const i=+b.closest('[data-d]').dataset.d,d=planDraft.days[i];if(b.dataset.planAction==='deleteDay')planDraft.days.splice(i,1);if(b.dataset.planAction==='addExercise')d.exercises.push(newPlanExercise());if(b.dataset.planAction==='deleteExercise')d.exercises.splice(+b.closest('[data-pe]').dataset.pe,1);renderPlan();};
  $('#planForm').onsubmit=ev=>{ev.preventDefault();planDraft.name=$('#planName').value.trim();planDraft.days.forEach(d=>{d.name=d.name.trim();d.exercises.forEach(e=>e.name=e.name.trim());});if(!validPlan(planDraft)||planDraft.days.some(d=>new Set(d.exercises.map(e=>norm(e.name))).size!==d.exercises.length)){$('#planError').textContent='Bitte benenne den Plan und jeden Tag. Jeder Tag braucht mindestens eine Übung (einmal je Name) mit 1–100 Sätzen.';return;}const plans=db.plans.filter(p=>p.id!==planDraft.id).concat(copy(planDraft));if(commit({...db,plans,activePlanId:planDraft.id})){$('#planDialog').close();renderDays();notify('Plan gespeichert und aktiviert.');}};
  function renderPlans(){ $('#planList').innerHTML=db.plans.map(p=>{const active=p.id===db.activePlanId;return `<article class="panel plan-choice ${active?'is-active':''}"><button type="button" class="plan-activate" data-plan-activate="${esc(p.id)}" aria-pressed="${active}"><strong>${esc(p.name)}</strong><span class="micro">${p.days.map(d=>esc(d.name)).join(' · ')}</span><span class="plan-status">${active?'✓ Aktiv':'Aktivieren'}</span></button><div class="button-row"><button type="button" data-plan-edit="${esc(p.id)}" class="quiet small">Bearbeiten</button>${active?'':`<button type="button" data-plan-delete="${esc(p.id)}" class="quiet small">Löschen</button>`}</div></article>`;}).join('')||'<p class="empty">Noch keine Pläne. Erstelle deinen eigenen Split.</p>';}
  $('#managePlans').onclick=()=>{renderPlans();$('#plansDialog').showModal();};
  $('#planList').onclick=ev=>{const activate=ev.target.closest('[data-plan-activate]'),edit=ev.target.closest('[data-plan-edit]'),del=ev.target.closest('[data-plan-delete]');if(activate&&db.plans.some(p=>p.id===activate.dataset.planActivate)&&commit({...db,activePlanId:activate.dataset.planActivate})){renderPlans();renderDays();notify('Plan aktiviert.');}if(edit)openPlan(db.plans.find(p=>p.id===edit.dataset.planEdit));if(del&&del.dataset.planDelete!==db.activePlanId&&confirm('Inaktiven Plan löschen? Gespeicherte Trainings bleiben erhalten.')&&commit({...db,plans:db.plans.filter(p=>p.id!==del.dataset.planDelete)})){renderPlans();renderDays();}};
  function cards(ws){return ws.map(w=>`<article class="history-card" style="--day-color:${w.color}"><div class="row"><h3>${esc(fmt(w.date))}<br><span class="muted">${esc(w.type||'Freies Training')}</span></h3><button class="small" data-edit="${esc(w.id)}">Bearbeiten</button></div>${w.dayId===REST_DAY.id?'<p class="exercise-log muted" style="text-align: center; padding: 12px 0;"><i>Regeneration &amp; Erholung 🔋 Speicher werden geladen.</i></p>':w.exercises.map(e=>`<p class="exercise-log"><strong>${esc(e.name)}</strong><br>${e.sets.map((s,i)=>`${i+1}. Satz: ${s.reps} × ${s.weight===0?'Körpergewicht':s.weight+' kg'}`).join('<br>')}</p>`).join('')}${w.image?`<img class="log-photo" src="${w.image}" alt="Dein Trainingsfoto">`:''}<div class="photo-controls"><label class="file-button small">${w.image?'Foto ersetzen':'＋ Trainingsfoto'}<input type="file" accept="image/jpeg,image/png,image/webp" data-photo="${esc(w.id)}" class="visually-hidden"></label>${w.image?`<button class="quiet small" data-remove-photo="${esc(w.id)}">Foto entfernen</button>`:''}</div></article>`).join('');}
  function renderDiary(){const diary=$('#diaryTile');const ws=sorted(db.workouts);diary.querySelector('#diaryCount').textContent=ws.length+' Trainings';diary.querySelector('#diaryLatest').innerHTML=ws.length?cards(ws.slice(0,1))+(!expanded&&ws.length>1?'<div class="diary-fade" aria-hidden="true"></div>':''):'<p class="empty">Dein erstes Training wartet auf dich.</p>';const groups={};ws.slice(1).forEach(w=>(groups[w.date.slice(0,7)]??=[]).push(w));diary.querySelector('#diaryOlder').innerHTML=Object.entries(groups).map(([m,items])=>`<h3>${esc(monthFmt(m))}</h3>${cards(items)}`).join('');diary.querySelector('#diaryOlder').hidden=!expanded;diary.querySelector('#toggleDiary').hidden=ws.length<2;diary.querySelector('#toggleDiary').textContent=expanded?'Verlauf einklappen ↑':'Verlauf ausklappen ↓';diary.querySelector('#toggleDiary').setAttribute('aria-expanded',String(expanded));}
  $('#toggleDiary').onclick=()=>{expanded=!expanded;renderDiary();};
  document.addEventListener('click',ev=>{const b=ev.target.closest('[data-edit]'),remove=ev.target.closest('[data-remove-photo]');if(b){if(editing&&!confirm('Ungespeicherte Bearbeitung verwerfen?'))return;const w=db.workouts.find(w=>w.id===b.dataset.edit);if(w){editing=w.id;current=copy(w);renderEditor();show('training');}}if(remove)savePhoto(remove.dataset.removePhoto,'');});
  function renderCalendar(){const y=cal.getFullYear(),m=cal.getMonth();$('#calendarMonth').textContent=monthFmt(localDate(cal));let html='<span></span>'.repeat((new Date(y,m,1).getDay()+6)%7);for(let d=1;d<=new Date(y,m+1,0).getDate();d++){const date=localDate(new Date(y,m,d)),ws=db.workouts.filter(w=>w.date===date);html+=`<button data-date="${date}" class="${date===localDate()?'today ':''}${date===selected?'selected':''}" aria-pressed="${date===selected}" aria-label="${esc(fmt(date))}, ${ws.length} Trainings">${d}<span class="dots">${[...new Set(ws.map(w=>w.color))].map(c=>`<i class="dot" style="--day-color:${c}"></i>`).join('')}</span></button>`;}$('#calendarGrid').innerHTML=html;const legend=new Map();db.workouts.filter(w=>w.date.startsWith(localDate(cal).slice(0,7))).forEach(w=>legend.set(w.type+'|'+w.color,w));$('#calendarLegend').innerHTML=[...legend.values()].map(w=>`<span><i class="dot" style="--day-color:${w.color}"></i> ${esc(w.type||'Frei')}</span>`).join('');$('#calendarDetails').innerHTML=`<h3>${esc(fmt(selected))}</h3>`+(cards(sorted(db.workouts.filter(w=>w.date===selected)))||'<p class="muted">Kein Training an diesem Tag.</p>');}
  $('#calendarGrid').onclick=ev=>{const b=ev.target.closest('[data-date]');if(b){selected=b.dataset.date;renderCalendar();}};
  $('#previousMonth').onclick=()=>{cal.setMonth(cal.getMonth()-1);renderCalendar();};$('#nextMonth').onclick=()=>{cal.setMonth(cal.getMonth()+1);renderCalendar();};$('#calendarToday').onclick=()=>{cal=new Date();cal.setDate(1);selected=localDate();renderCalendar();};
  const numberLabel=n=>n.toLocaleString('de-DE',{maximumFractionDigits:1});
  function renderStats(){
    const n=streak(db.workouts),month=localDate().slice(0,7),count=db.workouts.filter(w=>w.date.startsWith(month)).length;
    $('#statsPreview').textContent=n?`🔥 ${n} Tage in Folge`:'Deine Entwicklung auf einen Blick.';
    $('#statsNumbers').innerHTML=`<div class="panel stat"><strong>🔥 ${n}</strong><span>Tage Streak</span></div><div class="panel stat"><strong>${count}</strong><span>Trainings diesen Monat</span></div><div class="panel stat"><strong>${db.workouts.length}</strong><span>Trainings insgesamt</span></div>`;
    const prev=$('#chartExercise').value,ex=[...new Map(db.workouts.flatMap(w=>w.exercises.map(e=>[norm(e.name),e.name]))).values()];
    $('#chartExercise').innerHTML='<option value="">Gesamtfortschritt</option>'+ex.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
    if(ex.includes(prev))$('#chartExercise').value=prev;
    renderChart();renderMuscles();
  }
  function renderMuscles(){
    SetMuscleMap.render($('#muscleGrid'),db.workouts,localDate());
  }
  function renderRecords(){
    const name=$('#chartExercise').value,records=personalRecords(db.workouts),selected=name?records.filter(r=>r.key===norm(name)):records.slice(0,3);
    $('#recordsScope').textContent=name?'Allzeit · '+name:'Top 3 · nach höchstem Peak';
    $('#personalRecords').innerHTML=selected.map(r=>`<article class="panel record-card"><h4>🏆 ${esc(r.name)}</h4><div class="record-metrics"><div><span>Schwerstes Gewicht</span><strong>${numberLabel(r.weight.value)} kg</strong><time datetime="${r.weight.date}">${esc(fmt(r.weight.date))}</time></div><div><span>Maximaler Peak · geschätztes 1RM</span><strong>${r.peak?numberLabel(r.peak.value)+' kg':'—'}</strong>${r.peak?`<time datetime="${r.peak.date}">${esc(fmt(r.peak.date))}</time>`:'<small>Noch kein schätzbarer Satz</small>'}</div></div></article>`).join('')||'<p class="empty">Deine persönlichen Rekorde erscheinen nach deinem ersten abgeschlossenen Training.</p>';
  }
  function renderChart(){
    renderRecords();
    const name=$('#chartExercise').value,overall=!name,points=overall?overallProgress(db.workouts):pointsFor(db.workouts,name),unit=overall?'%':'kg',last=points.at(-1);
    $('#progressLabel').textContent=overall?'KÖRPER GESAMT':'Ø GEWICHT PRO TAG';
    $('#progressValue').textContent=last?`${numberLabel(last.value)} ${unit}`:'—';
    $('#progressChange').textContent=last?(overall?`${last.value>=100?'+':''}${numberLabel(last.value-100)} % seit Beginn · ${last.exercises} Übungen`:last.value===0?'Eigengewicht · kein Zusatzgewicht':`${last.sets} absolvierte Sätze am ${fmt(last.date)}`):'Noch keine Messwerte';
    $('#progressChange').title=overall?'Jede Übung startet bei 100 %. Zuletzt gemessene Tagesmittel werden bis zum nächsten Training fortgeführt; neue Übungen kommen mit 100 % hinzu. Übungen ohne positive Gewichtsbasis sind ausgeschlossen.':'';
    $('#e1rmSummary').hidden=overall;$('#e1rmValue').textContent=last?.e1rm!=null?`${numberLabel(last.e1rm)} kg`:'—';
    $('#chartTable').innerHTML='<table><thead><tr><th>Datum</th><th>'+ (overall?'Gesamtfortschritt':'Ø Gewicht')+'</th><th>'+(overall?'Übungen':'Sätze')+'</th></tr></thead><tbody>'+points.map(p=>`<tr><td>${esc(fmt(p.date))}</td><td>${numberLabel(p.value)} ${unit}</td><td>${overall?p.exercises:p.sets}</td></tr>`).join('')+'</tbody></table>';
    if(!last){$('#chart').innerHTML=`<p class="empty">${overall?'Dein Gesamtfortschritt startet mit dem ersten Training mit Zusatzgewicht.':'Für diese Übung liegen noch keine absolvierten Sätze vor.'}</p>`;return;}
    const values=points.map(p=>p.value),min=Math.min(...values),max=Math.max(...values),pad=Math.max(1,(max-min)*.25),lo=Math.max(0,min-pad),hi=max+pad;
    const start=Date.parse(points[0].date),end=Date.parse(last.date),x=p=>end===start?285:22+(Date.parse(p.date)-start)/(end-start)*526,y=v=>190-(v-lo)/(hi-lo)*160;
    const coords=points.map(p=>[x(p),y(p.value)]),line=coords.map(([px,py],i)=>`${i?'L':'M'}${px} ${py}`).join(' '),area=`${line} L${coords.at(-1)[0]} 195 L${coords[0][0]} 195 Z`;
    $('#chart').innerHTML=`<svg class="progress-area" viewBox="0 0 570 230" role="img" aria-label="${esc(overall?'Gesamtfortschritt':name+' – durchschnittliches Gewicht')}. Neuester Wert: ${numberLabel(last.value)} ${unit}. Alle Werte in der Tabelle."><defs><linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="area-start"/><stop offset="1" class="area-end"/></linearGradient></defs><text x="22" y="15" class="area-axis">${numberLabel(hi)} ${unit}</text><path d="${area}" fill="url(#progressFill)"/><path d="${line}" class="area-line"/><circle cx="${x(last)}" cy="${y(last.value)}" r="5" class="area-focus"><title>${esc(fmt(last.date))}: ${numberLabel(last.value)} ${unit}</title></circle><text x="22" y="218" class="area-axis">${esc(points[0].date)}</text>${points.length>1?`<text x="548" y="218" text-anchor="end" class="area-axis">${esc(last.date)}</text>`:''}</svg>`;
  }
  $('#chartExercise').onchange=renderChart;
  for(const [id,render] of [['calendarTile',renderCalendar],['progressTile',renderStats],['diaryTile',renderDiary]]){
    $('#'+id).addEventListener('toggle',event=>{if(event.currentTarget.open)render();});
  }
  function renderProfile(){const photo=db.avatar;$('#avatarImage').hidden=!photo;$('#avatarFallback').hidden=!!photo;if(photo)$('#avatarImage').src=photo;else $('#avatarImage').removeAttribute('src');$('#removeAvatar').hidden=!photo;renderProfileIdentity();$('#calendarPreview').textContent=db.workouts.filter(w=>w.date.startsWith(localDate().slice(0,7))).length+' Trainings diesen Monat';$('#storageUsage').textContent='Datenumfang: ca. '+(new Blob([JSON.stringify(db)]).size/1024).toFixed(0)+' KB (Browser-Limit variiert).';renderDiary();renderCalendar();renderStats();}
  async function photoData(file,size){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('Bitte JPG, PNG oder WebP bis 10 MB wählen.');const url=URL.createObjectURL(file),img=new Image();try{img.src=url;await img.decode();if(img.width*img.height>40000000)throw Error('Bild ist zu groß. Bitte vorher verkleinern.');const canvas=document.createElement('canvas'),scale=Math.min(1,size/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);let quality=.8,data;do{data=canvas.toDataURL('image/jpeg',quality);quality-=.1;}while(data.length>170000&&quality>.2);if(!validImage(data))throw Error('Bild lässt sich nicht ausreichend verkleinern.');return data;}finally{URL.revokeObjectURL(url);}}
  function savePhoto(id,image){if(!db.workouts.some(w=>w.id===id))return;if(commit({...db,workouts:db.workouts.map(w=>w.id===id?{...w,image}:w)})){if(editing===id)current.image=image;renderProfile();notify(image?'Trainingsfoto lokal gespeichert.':'Foto entfernt.');}}
  $('#avatarUpload').onchange=async ev=>{const file=ev.target.files[0];if(!file)return;try{const avatar=await photoData(file,384);if(commit({...db,avatar})){renderProfile();await communityApi('',{method:'POST',body:JSON.stringify({action:'update-avatar',avatar})});notify('Profilbild gespeichert.');}}catch(e){notify('Profilbild konnte nicht online gespeichert werden: '+e.message,true);}finally{ev.target.value='';}};
  $('#removeAvatar').onclick=async()=>{if(commit({...db,avatar:''})){renderProfile();try{await communityApi('',{method:'POST',body:JSON.stringify({action:'update-avatar',avatar:''})});}catch(e){notify('Profilbild online nicht entfernt. Bitte erneut versuchen.',true);}}};
  document.addEventListener('change',async ev=>{const el=ev.target;if(!el.dataset.photo||!el.files[0])return;try{savePhoto(el.dataset.photo,await photoData(el.files[0],640));}catch(e){notify(e.message,true);}finally{el.value='';}});
  // Online-Community: Trainingsdaten bleiben lokal, Profil und Freundschaften werden über die Site-API synchronisiert.
  let contactMatches=[],searchMatches=[],friendView='feed',touchStartX=0,searchTimer,nameTimer;
  let incomingRequests=[],sentRequests=[],feedPosts=[],requestsLoaded=false,communityReady=false,syncPromise=null;
  const pendingRequestActions=new Set();
  let remoteProfile={code:db.community.profileCode,name:db.community.displayName,avatar:db.avatar||''};
  const linkParams=new URLSearchParams(location.search),deepAction=linkParams.get('action'),deepCode=(linkParams.get('code')||linkParams.get('friend')||'').toUpperCase();
  const ANON_KEY='set-community-anon-v1';
  const PENDING_ADD_KEY='set-community-pending-add-v1';
  if(deepAction==='add'&&validProfileCode(deepCode))localStorage.setItem(PENDING_ADD_KEY,deepCode);
  function anonymousId(){let id=localStorage.getItem(ANON_KEY);if(!id){id=crypto.randomUUID();localStorage.setItem(ANON_KEY,id);}return id;}
  async function communityApi(query='',options={}){const response=await fetch('/api/community'+query,{...options,headers:{'content-type':'application/json','x-set-anonymous-id':anonymousId(),...(options.headers||{})}}),text=await response.text();let data;try{data=JSON.parse(text);}catch{data={error:'Community nicht erreichbar'};}if(!response.ok)throw Error(data.error||'Community nicht erreichbar');return data;}
  const personAvatar=p=>`<span class="friend-avatar">${p.avatar&&validImage(p.avatar)?`<img src="${p.avatar}" alt="" loading="lazy">`:esc((p.name||p.code).trim().charAt(0).toUpperCase())}</span>`;
  const personCard=(p,source='search')=>{const added=db.community.friends.some(f=>f.code===p.code),sent=sentRequests.includes(p.code),incoming=incomingRequests.some(r=>r.code===p.code);return `<article class="friend-person">${personAvatar(p)}<span><strong>${esc(p.name||'SET Mitglied')}</strong><small>${esc(p.code)}</small></span><button ${incoming?'data-open-requests':'data-add-friend="'+esc(p.code)+'"'} data-friend-source="${source}" ${added||sent||pendingRequestActions.has(p.code)?'disabled':''}>${added?'Befreundet':incoming?'Anfrage ansehen':sent?'Angefragt':'Hinzufügen'}</button></article>`;};
  function renderFriendRequests(){
    const count=incomingRequests.length,badge=$('#friendRequestsBadge');badge.textContent=String(count);badge.hidden=count===0;
    $('#showFriendRequests').setAttribute('aria-label',count?`Anfragen, ${count} offen`:'Anfragen');
    $('#friendRequestsList').innerHTML=incomingRequests.length?[...incomingRequests].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.code.localeCompare(b.code)).map(p=>`<article class="friend-request">${personAvatar(p)}<span class="request-person"><strong>${esc(p.name||'SET Mitglied')}</strong><small>${esc(p.code)}</small></span><div class="request-actions"><button class="primary" data-request-action="accept-request" data-code="${esc(p.code)}" aria-label="Anfrage von ${esc(p.name||p.code)} annehmen" ${pendingRequestActions.has(p.code)?'disabled':''}>Annehmen</button><button class="quiet" data-request-action="decline-request" data-code="${esc(p.code)}" aria-label="Anfrage von ${esc(p.name||p.code)} ablehnen" ${pendingRequestActions.has(p.code)?'disabled':''}>Ablehnen</button></div></article>`).join(''):`<p class="empty">${requestsLoaded?'Keine offenen Anfragen vorhanden.':'Anfragen werden geladen …'}</p>`;
  }
  function applyCommunityState(data){
    incomingRequests=data.requests||[];sentRequests=data.sent||[];requestsLoaded=true;
    feedPosts=data.posts||[];
    const friends=data.friends.map(f=>({code:f.code,name:f.name||'SET Mitglied',avatar:f.avatar||''}));
    if(JSON.stringify(db.community.friends)!==JSON.stringify(friends))commit({...db,community:{...db.community,friends}});
    renderFriendRequests();renderFriendFinder();
  }
  async function refreshCommunity(){
    if(!communityReady)return;
    if(syncPromise)return syncPromise;
    syncPromise=communityApi().then(applyCommunityState).finally(()=>{syncPromise=null;});
    return syncPromise;
  }
  async function respondToRequest(code,action){
    if(pendingRequestActions.has(code))return;
    pendingRequestActions.add(code);renderFriendRequests();
    try{
      if(syncPromise)await syncPromise.catch(()=>{});
      const result=await communityApi('',{method:'POST',body:JSON.stringify({action,code})});
      incomingRequests=incomingRequests.filter(p=>p.code!==code);
      if(result.friend){const f=result.friend;sentRequests=sentRequests.filter(c=>c!==code);commit({...db,community:{...db.community,friends:[...db.community.friends.filter(p=>p.code!==code),{code:f.code,name:f.name||'SET Mitglied',avatar:f.avatar||''}]}});}
      renderFriendRequests();renderFriendFinder();
      if(action==='accept-request')notify('Freundschaft bestätigt!');
      refreshCommunity().catch(()=>{});
    }catch(e){notify(e.message,true);refreshCommunity().catch(()=>{});}
    finally{pendingRequestActions.delete(code);renderFriendRequests();}
  }
  function renderProfileIdentity(){const name=remoteProfile.name||db.community.displayName||'',editingName=document.activeElement===$('#profileNameInput');$('#profilePersonalCode').textContent=remoteProfile.code||db.community.profileCode;if(name&&!editingName){$('#profileNameHeading').textContent=name;$('#profileNameHeading').hidden=false;$('#profileNameInput').hidden=true;}else{$('#profileNameHeading').hidden=true;$('#profileNameInput').hidden=false;if($('#profileNameInput').value!==name)$('#profileNameInput').value=name;}}
  function renderFriendFinder(){
    $('#contactsSupport').textContent='contacts'in navigator?'Du entscheidest selbst, welche Kontakte für den Abgleich freigegeben werden.':'Die Kontakte-API wird von diesem Browser nicht unterstützt. Nutze die Suche nach Name oder Kürzel.';
    $('#findContacts').hidden=!('contacts'in navigator);
    $('#contactSuggestions').innerHTML=contactMatches.length?contactMatches.map(p=>personCard(p,'contacts')).join(''):'<p class="empty">Noch keine passenden Kontakte ausgewählt.</p>';
    const q=$('#friendSearch').value.trim();$('#friendSearchResults').innerHTML=q?(searchMatches.length?searchMatches.map(p=>personCard(p)).join(''):'<p class="empty compact-empty">Kein Profil gefunden.</p>'):'';
  }
  async function runFriendSearch(){const q=$('#friendSearch').value.trim();searchMatches=[];if(q){try{searchMatches=(await communityApi('?action=search&q='+encodeURIComponent(q))).profiles;}catch(e){notify(e.message,true);}}renderFriendFinder();}
  function timeOf(iso){const d=new Date(iso);return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})+' Uhr';}
  function workoutBadge(name){return `${name==='Rest Day'?'🔋':'⚡'} ${esc(name||'Freies Training')}`;}
  function renderFriendsFeed(){
    const today=localDate(),trainedToday=db.workouts.some(w=>w.date===today&&w.dayId!==REST_DAY.id),ownToday=feedPosts.find(p=>p.code===remoteProfile.code&&p.date===today);
    $('#communityToday').textContent=new Date().toLocaleDateString('de-DE',{day:'2-digit',month:'short'});
    $('#communityPhotoButton').hidden=!trainedToday;$('#communityPhotoButton').childNodes[0].nodeValue=ownToday?'↻ Bild ersetzen':'＋ Bild hinzufügen';
    $('#communityUploadHint').textContent=trainedToday?'Training gespeichert – halte deinen heutigen Moment fest.':'Sobald du heute ein Training speicherst, kannst du hier ein Bild aufnehmen.';
    const posts=[...feedPosts].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    $('#friendsFeed').innerHTML=posts.length?posts.map(p=>`<article class="feed-card ${p.ownerId===remoteProfile.ownerId||p.code===remoteProfile.code?'own-post':''}"><div class="feed-visual"><img class="feed-photo" src="${p.image}" alt="Trainingsmoment von ${esc(p.name||'einem Freund')}"><div class="feed-gradient"></div><div class="feed-overlay"><span class="feed-author">${esc(p.name||'SET Mitglied')}${p.code===remoteProfile.code?' · Du':''}</span><time datetime="${esc(p.capturedAt)}">${esc(timeOf(p.capturedAt||p.createdAt))}</time></div><span class="workout-badge">${workoutBadge(p.workoutName)}</span>${p.code===remoteProfile.code?`<button class="feed-delete quiet" data-delete-community-post="${esc(p.id)}" aria-label="Beitrag löschen">×</button>`:''}</div></article>`).join(''):'<p class="empty feed-empty">Noch keine Bilder im Feed. Teile deinen ersten Trainingsmoment oder füge Freunde hinzu.</p>';
  }
  const friendTabs=[['feed','showFriendsFeed','friendsFeedView'],['finder','showFriendFinder','friendFinderView'],['requests','showFriendRequests','friendRequestsView']];
  function setFriendView(view){friendView=view;friendTabs.forEach(([key,button,panel])=>{const active=key===view;$('#'+panel).hidden=!active;$('#'+button).classList.toggle('active',active);$('#'+button).setAttribute('aria-selected',String(active));$('#'+button).tabIndex=active?0:-1;});if(view==='finder')renderFriendFinder();else if(view==='requests')renderFriendRequests();else renderFriendsFeed();}
  function renderFriends(){setFriendView(friendView);}
  async function addFriend(code,fromLink=false){if(code===remoteProfile.code||db.community.friends.some(f=>f.code===code)){if(fromLink)notify('Ihr seid bereits befreundet.');return;}if(pendingRequestActions.has(code))return;pendingRequestActions.add(code);renderFriendFinder();try{if(syncPromise)await syncPromise.catch(()=>{});const {friend}=await communityApi('',{method:'POST',body:JSON.stringify({action:fromLink?'add-friend':'send-request',code})});if(friend){commit({...db,community:{...db.community,friends:[...db.community.friends.filter(f=>f.code!==code),{code:friend.code,name:friend.name||'SET Mitglied',avatar:friend.avatar||''}]}});notify('Erfolgreich befreundet!');}else{sentRequests=[...new Set([...sentRequests,code])];notify('Freundschaftsanfrage gesendet.');}await refreshCommunity();}catch(e){notify(e.message==='profile not found'?'Dieses Profil wurde nicht gefunden.':e.message,true);}finally{pendingRequestActions.delete(code);renderFriendFinder();}}
  async function shareCommunityLink(action){const url=new URL(location.origin);url.searchParams.set('action',action);url.searchParams.set('code',remoteProfile.code);const data={title:action==='add'?'SET Freundschaft':'SET Profil',text:action==='add'?`Füge mich bei SET als Freund hinzu: ${remoteProfile.code}`:`Sieh dir mein SET Profil an: ${remoteProfile.code}`,url:url.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(`${data.text} ${data.url}`);notify('Link kopiert.');}}catch(e){if(e.name!=='AbortError')notify('Teilen war nicht möglich.',true);}}
  let sheetCode='';
  function closeFriendLinkSheet(){sheetCode='';$('#friendLinkSheet').classList.remove('visible');$('#friendLinkSheet').hidden=true;document.body.classList.remove('sheet-open');}
  async function openFriendLinkSheet(code){
    const matches=(await communityApi('?action=search&q='+encodeURIComponent(code))).profiles||[],person=matches.find(p=>p.code===code);
    if(!person){localStorage.removeItem(PENDING_ADD_KEY);notify('Dieses SET-Profil wurde nicht gefunden.',true);return;}
    sheetCode=code;$('#friendLinkAvatar').innerHTML=person.avatar&&validImage(person.avatar)?`<img src="${person.avatar}" alt="">`:esc((person.name||person.code).charAt(0).toUpperCase());
    $('#friendLinkTitle').textContent=person.name||'SET Mitglied';$('#friendLinkMessage').textContent=`${person.name||'Diese Person'} möchte sich mit dir auf SET verbinden.`;
    $('#friendLinkSheet').hidden=false;document.body.classList.add('sheet-open');requestAnimationFrame(()=>$('#friendLinkSheet').classList.add('visible'));
  }
  async function completePendingFriendLink(){
    const code=(localStorage.getItem(PENDING_ADD_KEY)||'').toUpperCase();
    if(!validProfileCode(code)||code===remoteProfile.code)return localStorage.removeItem(PENDING_ADD_KEY);
    if(!remoteProfile.name){show('profile');$('#profileNameInput').focus();return;}
    await openFriendLinkSheet(code);
  }
  friendTabs.forEach(([view,id])=>{$('#'+id).onclick=()=>{setFriendView(view);refreshCommunity().catch(()=>{});};});
  $('.community-switch').onkeydown=ev=>{const i=friendTabs.findIndex(([,id])=>id===ev.target.id);if(i<0||!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;ev.preventDefault();const next=ev.key==='Home'?0:ev.key==='End'?2:(i+(ev.key==='ArrowRight'?1:2))%3;setFriendView(friendTabs[next][0]);$('#'+friendTabs[next][1]).focus();};
  $('#friendSearch').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(runFriendSearch,250);};
  $('#friendFinderView').onclick=ev=>{if(ev.target.closest('[data-open-requests]')){setFriendView('requests');return;}const b=ev.target.closest('[data-add-friend]');if(b)addFriend(b.dataset.addFriend);};
  $('#friendRequestsList').onclick=ev=>{const b=ev.target.closest('[data-request-action]');if(b)respondToRequest(b.dataset.code,b.dataset.requestAction);};
  $('#shareFriendshipLink').onclick=()=>shareCommunityLink('add');$('#shareViewProfile').onclick=()=>shareCommunityLink('view');
  $('#laterFriendLink').onclick=closeFriendLinkSheet;$('#friendLinkDismiss').onclick=closeFriendLinkSheet;
  $('#acceptFriendLink').onclick=async()=>{const code=sheetCode;if(!code)return;$('#acceptFriendLink').disabled=true;try{await addFriend(code,true);localStorage.removeItem(PENDING_ADD_KEY);closeFriendLinkSheet();show('friends');setFriendView('feed');await refreshCommunity();notify('Erfolgreich befreundet!');}finally{$('#acceptFriendLink').disabled=false;}};
  $('#profileNameHeading').onclick=()=>{$('#profileNameHeading').hidden=true;$('#profileNameInput').hidden=false;$('#profileNameInput').focus();};
  $('#profileNameInput').oninput=()=>{const name=$('#profileNameInput').value.trim().slice(0,40);remoteProfile.name=name;$('#profileNameHeading').textContent=name;clearTimeout(nameTimer);nameTimer=setTimeout(async()=>{commit({...db,community:{...db.community,displayName:name}});try{await communityApi('',{method:'POST',body:JSON.stringify({action:'update-name',name})});notify('Name online gespeichert.');if(name)completePendingFriendLink().catch(e=>notify(e.message,true));}catch(e){notify('Name lokal gespeichert; Online-Speicherung derzeit nicht möglich.',true);}},500);};
  $('#profileNameInput').onblur=()=>renderProfileIdentity();
  $('#communityPhotoUpload').onchange=async ev=>{const file=ev.target.files[0];if(!file)return;try{const image=await photoData(file,1080),today=localDate(),workout=db.workouts.find(w=>w.date===today),post={id:uid(),date:today,capturedAt:new Date().toISOString(),image,workoutName:workout?.type||'Freies Training'};const result=await communityApi('',{method:'POST',body:JSON.stringify({action:'save-post',post})});feedPosts=[result.post,...feedPosts.filter(p=>p.code!==remoteProfile.code||p.date!==today)];renderFriendsFeed();notify('Dein Bild steht jetzt oben im Community-Feed.');}catch(e){notify(e.message,true);}finally{ev.target.value='';}};
  $('#friendsFeed').onclick=async ev=>{const b=ev.target.closest('[data-delete-community-post]');if(!b||!confirm('Dieses Bild aus dem Community-Feed löschen?'))return;try{await communityApi('',{method:'POST',body:JSON.stringify({action:'delete-post',post:{id:b.dataset.deleteCommunityPost}})});feedPosts=feedPosts.filter(p=>p.id!==b.dataset.deleteCommunityPost);renderFriendsFeed();notify('Bild gelöscht.');}catch(e){notify(e.message,true);}};
  $('#findContacts').onclick=async()=>{try{const contacts=await navigator.contacts.select(['name','tel'],{multiple:true}),names=contacts.flatMap(c=>c.name||[]);contactMatches=(await communityApi('',{method:'POST',body:JSON.stringify({action:'match-contacts',names})})).profiles;renderFriendFinder();notify(contactMatches.length?`${contactMatches.length} Kontakt${contactMatches.length===1?'':'e'} gefunden.`:'Keine registrierten Übereinstimmungen gefunden.');}catch(e){if(e.name!=='AbortError')notify('Kontakte konnten nicht gelesen werden.',true);}};
  let touchStartY=0;
  $('#friends').addEventListener('touchstart',ev=>{touchStartX=ev.changedTouches[0].clientX;touchStartY=ev.changedTouches[0].clientY;},{passive:true});$('#friends').addEventListener('touchend',ev=>{const dx=ev.changedTouches[0].clientX-touchStartX,dy=ev.changedTouches[0].clientY-touchStartY,i=friendTabs.findIndex(([v])=>v===friendView);if(Math.abs(dx)>80&&Math.abs(dx)>Math.abs(dy)*1.5){const next=i+(dx>0?1:-1);if(next>=0&&next<friendTabs.length)setFriendView(friendTabs[next][0]);}},{passive:true});
  async function initCommunity(){try{const oldCode=db.community.profileCode,localName=db.community.displayName;let data=await communityApi();if(!data.profile.name&&localName){await communityApi('',{method:'POST',body:JSON.stringify({action:'update-name',name:localName})});data.profile.name=localName;}if(db.avatar&&!data.profile.avatar){await communityApi('',{method:'POST',body:JSON.stringify({action:'update-avatar',avatar:db.avatar})});data.profile.avatar=db.avatar;}remoteProfile=data.profile;const community={...db.community,profileCode:data.profile.code,displayName:data.profile.name,friends:data.friends.map(f=>({code:f.code,name:f.name||'SET Mitglied',avatar:f.avatar||''})),posts:db.community.posts.map(p=>p.ownerCode===oldCode?{...p,ownerCode:data.profile.code,ownerName:data.profile.name||p.ownerName}:p)};commit({...db,avatar:data.profile.avatar||db.avatar,community});communityReady=true;applyCommunityState(data);renderProfileIdentity();renderFriends();if(deepAction==='view'&&validProfileCode(deepCode)&&deepCode!==remoteProfile.code){show('friends');setFriendView('finder');$('#friendSearch').value=deepCode;await runFriendSearch();}if(deepAction==='add'||deepAction==='view')history.replaceState({},'',location.pathname);if(localStorage.getItem(PENDING_ADD_KEY)){if(!remoteProfile.name){show('profile');$('#profileNameInput').focus();}else await completePendingFriendLink();}}catch(e){renderProfileIdentity();$('#friendRequestsList').innerHTML='<p class="empty">Anfragen können gerade nicht geladen werden. Bitte prüfe deine Internetverbindung.</p>';notify('Online-Community gerade nicht erreichbar. Deine Trainingsdaten bleiben verfügbar.',true);}}
  setInterval(()=>{if(!document.hidden&&communityReady&&!pendingRequestActions.size)refreshCommunity().catch(()=>{});},20000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&communityReady)refreshCommunity().catch(()=>{});});
  window.addEventListener('online',()=>{if(communityReady)refreshCommunity().catch(()=>{});else initCommunity();});
  const quotes=[['No human is limited.','Eliud Kipchoge','https://worldathletics.org/awards/news/eliud-kipchoge-athlete-of-year-2019'],['I’ve failed over and over and over again in my life. And that is why I succeed.','Michael Jordan','https://arnoldspumpclub.com/blogs/newsletter/failure-defines-successes'],['You can’t find greatness without a few meetings with heartbreak and failure.','Arnold Schwarzenegger','https://arnoldspumpclub.com/blogs/newsletter/the-only-real-losers-never-leave-the-sidelines']];
  const studies=[['Sport','↗','#c6f88a','Bewegung wirkt.','Eine Metaanalyse randomisierter Studien fand niedrigeren Ruheblutdruck nach verschiedenen Trainingsformen. Die mittleren Effekte sind keine individuelle Behandlungsempfehlung.','Edwards et al. · 2023','37491419'],['Ernährung','◒','#efba86','Protein mit Perspektive.','Eine Metaanalyse fand zusätzliche Muskel- und Kraftzuwächse durch Proteinergänzung beim Krafttraining. Oberhalb von rund 1,6 g/kg täglich zeigte sich im Mittel kein weiterer Muskelmasse-Vorteil.','Morton et al. · 2018','28698222'],['Schlaf','☾','#b6a3ef','Erholung zählt.','Elf College-Basketballspieler verbesserten Sprint und Wurfleistung nach einer Phase mit mehr Schlaf. Eine kleine Vorher-nachher-Studie ohne Kontrollgruppe – ein Hinweis, kein Beweis für alle.','Mah et al. · 2011','21731144'],['Biohacking','❄','#8ccbd4','Kälte hat Grenzen.','Bei 16 Männern bremste regelmäßiges kaltes Wasser direkt nach Krafttraining das Wachstum bestimmter Muskelfasern. Die Kraftzuwächse waren ähnlich. Nicht jeder Erholungstrend passt zu jedem Ziel.','Fyfe et al. · 2019','31513450']];
  function renderHome(){const q=quotes[Math.floor(Date.parse(localDate()+'T00:00:00Z')/86400000)%quotes.length];$('#quote').textContent='“'+q[0]+'”';$('#quote').lang='en';$('#quoteAuthor').textContent=q[1];$('#quoteSource').href=q[2];$('#todayLabel').textContent=new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});$('#startLabel').textContent=current.exercises.length?'Dein Training wartet auf dich.':'Dein Training beginnt hier.';$('#scienceGrid').innerHTML=studies.map(([category,icon,color,title,text,author,id])=>`<article class="science-card" style="--card-color:${color}"><div class="row"><span class="eyebrow">${category}</span><span class="science-icon">${icon}</span></div><h3>${title}</h3><p>${text}</p><span class="micro">${author}</span><a href="https://pubmed.ncbi.nlm.nih.gov/${id}/" target="_blank" rel="noopener noreferrer">Originalstudie ↗</a></article>`).join('');}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderHome();});
  $('#exportData').onclick=()=>{let data;try{data=blocked?(localStorage.getItem(KEY)||JSON.stringify(db)):JSON.stringify({...db,draft:editing?db.draft:current},null,2);}catch{data=JSON.stringify({...db,draft:current});}const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='set-backup-'+localDate()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);};
  $('#importData').onchange=async ev=>{const file=ev.target.files[0];if(!file)return;try{if(file.size>15*1024*1024)throw Error('Backup größer als 15 MB');const next=migrate(JSON.parse(await file.text()));if(!confirm('Backup ersetzt alle aktuellen Einträge, Pläne und Bilder. Vorher exportieren. Fortfahren?'))return;if(commit(next)){editing=null;current=copy(db.draft||blank());renderEditor();renderProfile();notify('Backup importiert.');}}catch(e){notify('Import fehlgeschlagen: '+e.message,true);}finally{ev.target.value='';}};
  window.addEventListener('storage',ev=>{if(ev.key===KEY||ev.key===null){blocked=true;warning('Daten wurden in einem anderen Fenster verändert. Lade diese Seite neu, bevor du speicherst. Offene Eingaben vorher sichern.');}});
  let installPrompt;window.addEventListener('beforeinstallprompt',ev=>{ev.preventDefault();installPrompt=ev;$('#install').hidden=false;});$('#install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('#install').hidden=true;}};
  renderHome();renderEditor();renderProfile();initCommunity();
  if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').then(async()=>{await navigator.serviceWorker.ready;$('#offlineStatus').textContent='Offline-Modus bereit. Nach dem ersten vollständigen Laden auch ohne Internet nutzbar.';}).catch(()=>$('#offlineStatus').textContent='Offline-Modus nicht verfügbar. Bitte über HTTPS oder localhost öffnen.');else $('#offlineStatus').textContent='Für Installation und Offline-Modus über HTTPS oder localhost öffnen.';
}
