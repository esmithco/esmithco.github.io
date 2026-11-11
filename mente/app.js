/* Gimnasio Mental — all logic. Content in contenido.js. */

(function(){
'use strict';
/* ---------------- content ---------------- */
var AREAS=GM.AREAS,C=GM.C,K=GM.K,TOPICS=GM.TOPICS,LESSONS=GM.LESSONS;
var CONCEPTS={};C.forEach(function(r,i){CONCEPTS[r[0]]={id:r[0],area:r[1],n:{es:r[2],en:r[3]},d:{es:r[4],en:r[5]},x:{es:r[6],en:r[7]},order:i}});
var CASES={};K.forEach(function(r){CASES[r[0]]={id:r[0],c:r[1],q:{es:r[2],en:r[3]},w:{es:r[4],en:r[5]}}});

/* ---------------- strings ---------------- */
var T={
 es:{eyebrow:'Entrenamiento diario · 10 minutos',title:'Gimnasio Mental',subtitle:'Recordar, conectar y aplicar ideas de ciencia, historia, matemáticas, economía, psicología y lógica.',
  sStreak:'días seguidos',tKnow:'Saberes',b4:'Descubrir',discQ:'Una lección corta para hablar de cualquier tema. Mañana te pregunto lo clave.',pick:'O elige otro tema:',gen:'Preparando la lección…',genErr:'No pude preparar la lección ahora. Inténtalo más tarde o salta este bloque.',noSample:'Este bloque necesita a Claude: abre la página desde la app de Claude.',talkL:'Para sacarlo en una conversación:',perspL:'Dos miradas',keyL:'Lo clave (lo repasarás)',finish:'Terminar sesión',knowHelp:'Las lecciones que has descubierto. Sus ideas clave entran en tus repasos.',noKnow:'Aún no has descubierto ninguna lección.',factQ:'Responde sin mirar.',sLearned:'conceptos vistos',sMastered:'dominados',sAcc:'aciertos al aplicar',tToday:'Hoy',tLib:'Conceptos',tJournal:'Diario',tSet:'Ajustes',
  b1:'Recordar',b2:'Conectar',b3:'Aplicar',min:'≈ 2-3 min',start:'Empezar sesión',startSub:'Cuatro bloques de 2 a 3 minutos. Escribe con tus palabras: el esfuerzo de recordar es lo que fija la idea.',
  todayPlan:'Hoy: {r} repasos, {n} conceptos nuevos, 1 conexión, 2 casos y 1 lección nueva.',newC:'Concepto nuevo',review:'Repaso',
  recallQ:'Explícalo con tus palabras y da un ejemplo propio, sin mirar.',recallPh:'Escribe aquí lo que recuerdas…',reveal:'Ver la respuesta',
  rate0:'No lo sabía',rate1:'Más o menos',rate2:'Lo sabía',gotIt:'Entendido',newHelp:'Léelo con calma y piensa en un ejemplo de tu vida o tu trabajo. Mañana te lo pregunto.',
  feedback:'Opinión de Claude',fbWait:'Claude está leyendo…',fbErr:'No pude obtener la opinión ahora. Sigue sin ella.',
  connQ:'¿Cómo se relacionan estas dos ideas? Busca un caso real donde aparezcan juntas, o donde una explique a la otra.',connPh:'Por ejemplo: "En mi trabajo, …"',save:'Guardar y seguir',skip:'Saltar',
  applyQ:'¿Qué concepto explica mejor esta situación?',right:'Correcto.',wrong:'No exactamente. Era: {c}.',next:'Siguiente',
  doneT:'Sesión completa',doneS:'Llevas {n} días seguidos. Vuelve mañana: hay {d} repasos programados.',doneS1:'Llevas 1 día. Vuelve mañana: hay {d} repasos programados.',again:'Hacer otra ronda de casos',
  libHelp:'Todos los conceptos por área. Los puntos muestran qué tan firme lo tienes. Toca uno para leerlo.',journalHelp:'Tus conexiones guardadas. Releerlas de vez en cuando es otra forma de repaso.',noJournal:'Aún no has guardado conexiones.',
  newPerDay:'Conceptos nuevos por día',newPerDayHelp:'Con 2 por día ves todos en unos 40 días.',backup:'Respaldo',backupHelp:'El progreso se guarda en este navegador. Copia el respaldo para pasarlo a otro dispositivo.',
  copy:'Copiar respaldo',restore:'Restaurar desde el cuadro',reset:'Borrar todo',resetArm:'Toca otra vez para borrar',copied:'Respaldo copiado.',selectIt:'Selecciona y copia el texto del cuadro.',restored:'Respaldo restaurado.',badBackup:'Ese texto no es un respaldo válido.',wiped:'Se borró el progreso.',
  howTitle:'Por qué funciona',howText:'Se basa en tres hallazgos sólidos sobre aprendizaje: recordar sin mirar fija mejor que releer (práctica de recuperación), repasar justo antes de olvidar ahorra tiempo (repetición espaciada) y relacionar ideas de distintas áreas crea los modelos mentales que permiten conectar rápido. No sube el CI; construye conocimiento organizado y la costumbre de usarlo.',
  langNote:'Escribe en el idioma que quieras practicar.',dontKnow:'No lo sé',writeFirst:'Escribe al menos una frase antes de ver la respuesta: el esfuerzo de recordar es lo que entrena.',keysL:'Mencionaste {h} de {n} ideas clave.',sug0:'Sugerencia: «No lo sabía».',sug1:'Sugerencia: «Más o menos».',sug2:'Sugerencia: «Lo sabía».',backupHelp:'Tu progreso se guarda solo y sigue en cualquier dispositivo. El respaldo es por si acaso.',home:'Inicio'},
 en:{eyebrow:'Daily training · 10 minutes',title:'Gimnasio Mental',subtitle:'Recall, connect and apply ideas from science, history, math, economics, psychology and logic.',
  sStreak:'day streak',tKnow:'Knowledge',b4:'Discover',discQ:'A short lesson so you can talk about anything. Tomorrow I\'ll quiz you on the key points.',pick:'Or pick another topic:',gen:'Preparing the lesson…',genErr:'Couldn\'t prepare the lesson right now. Try later or skip this block.',noSample:'This block needs Claude: open the page from the Claude app.',talkL:'To bring it up in conversation:',perspL:'Two views',keyL:'Key points (you\'ll review these)',finish:'Finish session',knowHelp:'Lessons you\'ve discovered. Their key points go into your reviews.',noKnow:'No lessons discovered yet.',factQ:'Answer without looking.',sLearned:'concepts seen',sMastered:'mastered',sAcc:'apply accuracy',tToday:'Today',tLib:'Concepts',tJournal:'Journal',tSet:'Settings',
  b1:'Recall',b2:'Connect',b3:'Apply',min:'≈ 2-3 min',start:'Start session',startSub:'Four blocks of 2 to 3 minutes. Write in your own words: the effort of recalling is what makes ideas stick.',
  todayPlan:'Today: {r} reviews, {n} new concepts, 1 connection, 2 cases and 1 new lesson.',newC:'New concept',review:'Review',
  recallQ:'Explain it in your own words and give your own example, without looking.',recallPh:'Write what you remember…',reveal:'Show answer',
  rate0:'Didn\'t know',rate1:'Sort of',rate2:'Knew it',gotIt:'Got it',newHelp:'Read it slowly and think of an example from your life or work. I\'ll ask you tomorrow.',
  feedback:'Claude\'s take',fbWait:'Claude is reading…',fbErr:'Couldn\'t get feedback right now. Keep going without it.',
  connQ:'How are these two ideas related? Find a real case where they show up together, or where one explains the other.',connPh:'For example: "At work, …"',save:'Save and continue',skip:'Skip',
  applyQ:'Which concept best explains this situation?',right:'Correct.',wrong:'Not quite. It was: {c}.',next:'Next',
  doneT:'Session complete',doneS:'You\'re on a {n}-day streak. Come back tomorrow: {d} reviews are scheduled.',again:'Do another round of cases',
  libHelp:'Every concept by area. The dots show how solid it is. Tap one to read it.',journalHelp:'Your saved connections. Rereading them now and then is another kind of review.',noJournal:'No connections saved yet.',
  newPerDay:'New concepts per day',newPerDayHelp:'At 2 a day you\'ll see them all in about 40 days.',backup:'Backup',backupHelp:'Progress is saved in this browser. Copy the backup to move it to another device.',
  copy:'Copy backup',restore:'Restore from the box',reset:'Erase everything',resetArm:'Tap again to erase',copied:'Backup copied.',selectIt:'Select and copy the text in the box.',restored:'Backup restored.',badBackup:'That text isn\'t a valid backup.',wiped:'Progress erased.',
  howTitle:'Why it works',howText:'It\'s built on three solid findings about learning: recalling without looking beats rereading (retrieval practice), reviewing right before you forget saves time (spaced repetition), and linking ideas across fields builds the mental models that let you connect things fast. It won\'t raise your IQ; it builds organized knowledge and the habit of using it.',
  langNote:'Write in whichever language you want to practice.',dontKnow:'I don\'t know',writeFirst:'Write at least one sentence before seeing the answer: the effort of recalling is what trains you.',keysL:'You mentioned {h} of {n} key ideas.',sug0:'Suggestion: “Didn\'t know”.',sug1:'Suggestion: “Sort of”.',sug2:'Suggestion: “Knew it”.',backupHelp:'Your progress saves itself and follows you on any device. The backup is just in case.',home:'Home'}
};

/* ---------------- state ---------------- */
var KEY='gimnasio-mental.v1',DAYS=[0,1,3,7,16,35,80];
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function dayNum(s){var p=s.split('-');return Math.round(new Date(+p[0],p[1]-1,+p[2]).getTime()/864e5)}
function blank(){return {lang:'es',npd:2,cards:{},cases:{},journal:[],days:[],facts:{},lessons:[],ti:0}}
var S=blank();
try{var raw=localStorage.getItem(KEY);if(raw){S=Object.assign(blank(),JSON.parse(raw))}}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}cloudSoon()}
/* progress follows him on any device: Firebase /progress/mente (public, like the chess app). Every write = read, merge, write. */
var OPEN_URL=/^(localhost|127\.|\[::1\])/.test(location.hostname)?'':'https://chess-3ce3f-default-rtdb.firebaseio.com/progress/mente.json',cloudT=null,cloudBusy=false;
function mergeIn(R){if(!R||!R.cards)return;
  Object.keys(R.cards).forEach(function(k){var a=S.cards[k],r=R.cards[k];if(!a||(r.reps||0)>(a.reps||0)||((r.reps||0)===(a.reps||0)&&r.due>a.due))S.cards[k]=r});
  Object.keys(R.cases||{}).forEach(function(k){var a=S.cases[k],r=R.cases[k];if(!a||(r.n||0)>(a.n||0))S.cases[k]=r});
  var js={};S.journal.forEach(function(e){js[e.date+e.text]=1});(R.journal||[]).forEach(function(e){if(!js[e.date+e.text]){S.journal.push(e);js[e.date+e.text]=1}});S.journal.sort(function(a,b){return a.date<b.date?1:-1});
  (R.days||[]).forEach(function(d){if(S.days.indexOf(d)<0)S.days.push(d)});
  Object.keys(R.facts||{}).forEach(function(k){if(!S.facts[k])S.facts[k]=R.facts[k]});
  var ls={};S.lessons.forEach(function(l){ls[l.id]=1});(R.lessons||[]).forEach(function(l){if(!ls[l.id])S.lessons.push(l)});
  S.ti=Math.max(S.ti||0,R.ti||0);try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function cloudSync(keep){if(!OPEN_URL||cloudBusy)return;cloudBusy=true;
  var put=function(){return fetch(OPEN_URL,{method:'PUT',body:JSON.stringify(JSON.stringify(S)),keepalive:!!keep,headers:{'Content-Type':'application/json'}})};
  (keep?put():fetch(OPEN_URL,{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(x){if(typeof x==='string'){mergeIn(JSON.parse(x))}}).then(put))
  .catch(function(){}).then(function(){cloudBusy=false})}
function cloudSoon(){if(!OPEN_URL)return;clearTimeout(cloudT);cloudT=setTimeout(function(){cloudSync()},3000)}
document.addEventListener('visibilitychange',function(){if(document.hidden)cloudSync(true);else cloudSync()});
function L(){return S.lang}
function t(k,vars){var s=(T[L()][k]||k);if(vars)Object.keys(vars).forEach(function(v){s=s.replace('{'+v+'}',vars[v])});return s}
function cn(id){return CONCEPTS[id].n[L()]}
function isFact(id){return id.indexOf('f:')===0}

/* ---------------- sample (Claude feedback, optional) ---------------- */
var sample=null;
if(window.claude&&window.claude.use){window.claude.use('sample').then(function(s){sample=s;if(cur)render()}).catch(function(){})}

/* ---------------- scheduling ---------------- */
function dueToday(){var n=dayNum(today());return Object.keys(S.cards).filter(function(id){return S.cards[id].due<=n})}
/* new concepts rotate through areas, broad science first (physics, life, Earth), so every day is varied */
var ORDER=(function(){var by={},seq=['f','b','g','c','s','l','e','p','m'],out=[];C.forEach(function(r){(by[r[1]]=by[r[1]]||[]).push(r[0])});
  for(var i=0;out.length<C.length;i++){seq.forEach(function(a){if(by[a]&&by[a][i])out.push(by[a][i])});if(i>200)break}return out})();
function unseen(){return ORDER.filter(function(id){return !S.cards[id]})}
function conceptIds(){return Object.keys(S.cards).filter(function(id){return !isFact(id)})}
function grade(id,r){
  var c=S.cards[id];var n=dayNum(today());
  if(r===0){c.box=1;c.lapses=(c.lapses||0)+1}else if(r===2){c.box=Math.min(6,c.box+1)}else{c.box=Math.max(1,c.box)}
  c.due=n+(r===1?Math.max(1,Math.ceil(DAYS[c.box]/2)):DAYS[c.box]);c.reps=(c.reps||0)+1;save();
}
function introduce(id){S.cards[id]={box:1,due:dayNum(today())+1,reps:0,lapses:0};save()}
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var x=a[i];a[i]=a[j];a[j]=x}return a}
function pickCases(n){
  var all=K.map(function(r){return r[0]});var now=dayNum(today());
  var score=function(id){var s=S.cases[id];if(!s)return 0;return (s.ok&&s.last===now?100:0)+(s.ok?10+Math.min(20,now-(s.last||0))*-1:-5)};
  return shuffle(all).sort(function(a,b){return score(a)-score(b)}).slice(0,n);
}
function pickPair(){
  var pool=conceptIds();if(pool.length<4)pool=C.map(function(r){return r[0]});
  var a=pool[Math.floor(Math.random()*pool.length)];var others=pool.filter(function(x){return CONCEPTS[x].area!==CONCEPTS[a].area});
  return [a,others[Math.floor(Math.random()*others.length)]];
}

/* ---------------- session ---------------- */
var cur=null;
function newSession(){
  var dueAll=shuffle(dueToday());var due=dueAll.filter(function(x){return !isFact(x)}).slice(0,4).concat(dueAll.filter(isFact).slice(0,2));var fresh=unseen().slice(0,S.npd);
  var items=due.map(function(id){return {id:id,kind:'review'}}).concat(fresh.map(function(id){return {id:id,kind:'new'}}));
  cur={block:0,items:items,i:0,revealed:false,text:'',fb:null,pair:pickPair(),connText:'',cases:pickCases(2),ci:0,answered:null,lesson:null,topic:TOPICS[S.ti%TOPICS.length][0]};
}
function stats(){
  var ids=conceptIds();$('sLearned').textContent=ids.length;
  $('sMastered').textContent=ids.filter(function(id){return S.cards[id].box>=4}).length;
  var tot=0,ok=0;Object.keys(S.cases).forEach(function(k){tot+=S.cases[k].n||0;ok+=S.cases[k].okN||0});
  $('sAcc').textContent=tot?Math.round(ok/tot*100)+'%':'–';
  var days=S.days.slice().sort(),streak=0,d=dayNum(today());
  var set={};days.forEach(function(x){set[dayNum(x)]=1});if(!set[d])d--;while(set[d]){streak++;d--}
  $('sStreak').textContent=streak;return streak;
}
function areaTag(id){var a=CONCEPTS[id].area;return '<span class="area '+a+'">'+esc(AREAS[a][L()])+'</span>'}
function defBox(id){var c=CONCEPTS[id];return '<div class="def"><p>'+esc(c.d[L()])+'</p><p class="ex">'+esc(c.x[L()])+'</p></div>'}
function steps(){var s=$('steps').children;for(var i=0;i<4;i++){s[i].className=!cur?'':i<cur.block-1?'done':i===cur.block-1?'on':''}}
function render(){
  stats();steps();var st=$('stage');
  if(!cur){var r=Math.min(6,dueToday().length),n=Math.min(S.npd,unseen().length);
    st.innerHTML='<h2>'+t('start')+'</h2><p class="small">'+t('startSub')+'</p><p>'+t('todayPlan',{r:r,n:n})+'</p><div class="row"><button class="btn primary" id="go">'+t('start')+'</button></div>';
    $('go').onclick=function(){newSession();cur.block=1;if(!cur.items.length)cur.block=2;render()};return}
  if(cur.block===1)return renderRecall(st);
  if(cur.block===2)return renderConnect(st);
  if(cur.block===3)return renderApply(st);
  if(cur.block===4)return renderDiscover(st);
  return renderDone(st);
}
function head(k,extra){return '<div class="blockhead"><span class="kicker">'+t(k)+' · '+t('min')+'</span><span class="small">'+(extra||'')+'</span></div>'}
function fbHtml(){if(!cur.fb)return '';return '<div class="fb'+(cur.fb.wait?' wait':'')+'" id="fbOut">'+esc(cur.fb.text)+'</div>'}
function askClaude(prompt){
  if(!sample)return;cur.fb={wait:true,text:t('fbWait')};render();
  sample(prompt,{cache:false,modelTier:'quick',onText:function(u){cur.fb={wait:false,text:u.text};var o=$('fbOut');if(o){o.textContent=u.text;o.className='fb'}}})
  .then(function(r){cur.fb={wait:false,text:r.text};render()})
  .catch(function(e){cur.fb={wait:false,text:t('fbErr')};render()});
}
function langLine(){return L()==='en'?'Reply in English. If the learner wrote in English and made a real grammar or word-choice error, add one line at the end starting with "English fix:" with the single most useful correction (American English).':'Responde en español. Si el estudiante escribió en inglés y cometió un error real de gramática o vocabulario, agrega al final una línea "English fix:" con la corrección más útil (inglés americano).'}
function renderRecall(st){
  var it=cur.items[cur.i];if(isFact(it.id))return renderFact(st,it);var c=CONCEPTS[it.id];
  var h=head('b1',(cur.i+1)+' / '+cur.items.length)+'<div class="row">'+areaTag(it.id)+' <span class="small">'+(it.kind==='new'?t('newC'):t('review'))+'</span></div><div class="concept">'+esc(c.n[L()])+'</div>';
  if(it.kind==='new'){
    h+=defBox(it.id)+'<p class="small">'+t('newHelp')+'</p><div class="row"><button class="btn primary" id="ok">'+t('gotIt')+'</button></div>';
    st.innerHTML=h;$('ok').onclick=function(){introduce(it.id);nextItem()};return;
  }
  h+='<p>'+t('recallQ')+'</p><textarea id="rt" placeholder="'+esc(t('recallPh'))+'" aria-label="'+esc(t('recallQ'))+'">'+esc(cur.text)+'</textarea>';
  if(!cur.revealed){h+='<div class="row"><button class="btn primary" id="rv" disabled>'+t('reveal')+'</button><button class="btn" id="dk">'+t('dontKnow')+'</button></div><p class="small">'+t('writeFirst')+'</p>';st.innerHTML=h;
    var rvb=$('rv');rvb.disabled=cur.text.trim().length<12;
    $('rt').oninput=function(e){cur.text=e.target.value;rvb.disabled=cur.text.trim().length<12};$('rv').onclick=function(){cur.text=$('rt').value;cur.revealed=true;render()};
    $('dk').onclick=function(){cur.text='';cur.revealed=true;cur.dk=true;render()};return}
  h+=defBox(it.id)+keyHits(c.d[L()],cur.text,c.n[L()])+fbHtml();
  h+='<div class="row">'+(sample&&cur.text.trim().length>15&&!cur.fb?'<button class="btn" id="fb">'+t('feedback')+'</button>':'')+
     '<button class="btn rate-0" data-r="0">'+t('rate0')+'</button><button class="btn rate-1" data-r="1">'+t('rate1')+'</button><button class="btn rate-2" data-r="2">'+t('rate2')+'</button></div>';
  st.innerHTML=h;$('rt').oninput=function(e){cur.text=e.target.value};
  var sb=st.querySelector('[data-r="'+(cur.sug==null?1:cur.sug)+'"]');if(sb)sb.classList.add('sugg');
  if($('fb'))$('fb').onclick=function(){askClaude('You are a concise, honest tutor. Concept: "'+c.n.en+'". Reference definition: '+c.d.en+' Example: '+c.x.en+'\nThe learner explained it from memory:\n"""'+cur.text+'"""\nIn 2-4 short sentences: say what they got right, the single most important thing missing or wrong, and whether their own example fits. No praise filler. '+langLine())};
  st.querySelectorAll('[data-r]').forEach(function(b){b.onclick=function(){grade(it.id,+b.getAttribute('data-r'));nextItem()}});
}
/* key words of the answer and which of them his own text mentions (accents and case ignored, first 5 letters) */
var STOP=('porque cuando aunque entonces donde mientras siempre ninguna ninguno nuestro nuestra puede pueden tiene tienen hacer hacen sobre entre desde hasta otros otras todos todas mucho muchos menos parte forma manera cosas because without through another between their there these those which while where would could should about other every always never often being makes things something').split(' ');
function norm(x){return String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function keyWords(ref){var seen={},out=[],min=ref.length<80?4:6;norm(ref).split(/[^a-z0-9ñ]+/).forEach(function(w){if((w.length<min&&!/^[0-9]{2,}$/.test(w))||STOP.indexOf(w)>=0)return;var k=w.slice(0,5);if(seen[k])return;seen[k]=1;out.push(w)});return out.sort(function(a,b){return b.length-a.length}).slice(0,6)}
function keyHits(ref,text,exclude){var ex=exclude?norm(exclude):'',ks=keyWords(ref).filter(function(w){return ex.indexOf(w.slice(0,5))<0});if(!ks.length)return '';var tx=norm(text),hit=ks.filter(function(w){return tx.indexOf(w.slice(0,5))>=0});
  var sug=!text.trim()||hit.length===0?0:hit.length>=Math.ceil(ks.length/2)?2:1;cur.sug=sug;
  return '<div class="keys"><p class="small">'+t('keysL',{h:hit.length,n:ks.length})+' '+t('sug'+sug)+'</p><div class="kw">'+ks.map(function(w){return '<span class="'+(hit.indexOf(w)>=0?'on':'')+'">'+esc(w)+'</span>'}).join('')+'</div></div>'}
function renderFact(st,it){
  var f=S.facts[it.id];if(!f){nextItem();return}
  var h=head('b1',(cur.i+1)+' / '+cur.items.length)+'<div class="row"><span class="area c">'+esc(f.topic)+'</span> <span class="small">'+t('review')+'</span></div><div class="concept">'+esc(f.q)+'</div><p class="small">'+t('factQ')+'</p><textarea id="rt" aria-label="'+esc(f.q)+'">'+esc(cur.text)+'</textarea>';
  if(!cur.revealed){h+='<div class="row"><button class="btn primary" id="rv" disabled>'+t('reveal')+'</button><button class="btn" id="dk">'+t('dontKnow')+'</button></div>';st.innerHTML=h;
    var rvb=$('rv');rvb.disabled=cur.text.trim().length<3;$('rt').oninput=function(e){cur.text=e.target.value;rvb.disabled=cur.text.trim().length<3};
    $('rv').onclick=function(){cur.text=$('rt').value;cur.revealed=true;render()};$('dk').onclick=function(){cur.text='';cur.revealed=true;render()};return}
  h+='<div class="def"><p>'+esc(f.a)+'</p></div>'+keyHits(f.a,cur.text,f.q)+'<div class="row"><button class="btn rate-0" data-r="0">'+t('rate0')+'</button><button class="btn rate-1" data-r="1">'+t('rate1')+'</button><button class="btn rate-2" data-r="2">'+t('rate2')+'</button></div>';
  st.innerHTML=h;var sf=st.querySelector('[data-r="'+(cur.sug==null?1:cur.sug)+'"]');if(sf)sf.classList.add('sugg');
  st.querySelectorAll('[data-r]').forEach(function(b){b.onclick=function(){grade(it.id,+b.getAttribute('data-r'));nextItem()}});
}
function topicName(id){var r=TOPICS.filter(function(x){return x[0]===id})[0];return r?(L()==='en'?r[2]:r[1]):id}
function makeLesson(){var id=cur.topic,ls=LESSONS[id];if(!ls){cur.lesson={err:true};render();return}var x=ls[L()];
  cur.lesson={topic:id,title:x.t,lesson:x.l,perspectives:x.p||null,talk:x.talk||'',facts:x.f.map(function(f){return {q:f[0],a:f[1]}})};render();window.scrollTo(0,0)}
function saveLesson(){
  var ls=cur.lesson,n=dayNum(today()),lid=today()+'-'+ls.topic;
  ls.facts.forEach(function(f,i){var fid='f:'+lid+':'+i;S.facts[fid]={q:f.q,a:f.a,topic:ls.title};S.cards[fid]={box:1,due:n+1,reps:0,lapses:0}});
  S.lessons.unshift({id:lid,date:today(),topic:ls.topic,title:ls.title,lesson:ls.lesson,perspectives:ls.perspectives,talk:ls.talk,lang:L()});
  if(ls.topic===TOPICS[S.ti%TOPICS.length][0])S.ti++;save();
}
function finishSession(){if(S.days.indexOf(today())<0)S.days.push(today());save();cur.block=5;render();window.scrollTo(0,0)}
function renderDiscover(st){
  var h=head('b4')+'<p class="small">'+t('discQ')+'</p>';
  var ls=cur.lesson;
  if(!ls){h+='<div class="concept">'+esc(topicName(cur.topic))+'</div><div class="row"><button class="btn primary" id="mk">'+t('b4')+'</button><button class="btn" id="fin">'+t('skip')+'</button></div><p class="small">'+t('pick')+'</p><div class="topics">'+
      TOPICS.map(function(r){return '<button class="btn" data-tp="'+r[0]+'">'+esc(L()==='en'?r[2]:r[1])+'</button>'}).join('')+'</div>';
    st.innerHTML=h;$('mk').onclick=makeLesson;$('fin').onclick=finishSession;
    st.querySelectorAll('[data-tp]').forEach(function(b){b.onclick=function(){cur.topic=b.getAttribute('data-tp');makeLesson()}});return}
  if(ls.wait){st.innerHTML=h+'<p class="fb wait">'+t('gen')+'</p>';return}
  if(ls.err){st.innerHTML=h+'<p class="small">'+t('genErr')+'</p><div class="row"><button class="btn" id="re">'+t('b4')+'</button><button class="btn primary" id="fin">'+t('finish')+'</button></div>';$('re').onclick=makeLesson;$('fin').onclick=finishSession;return}
  h+='<div class="concept">'+esc(ls.title)+'</div><div class="lesson">'+esc(ls.lesson)+'</div>';
  if(ls.perspectives&&ls.perspectives.length===2)h+='<h3>'+t('perspL')+'</h3><div class="persp"><div>'+esc(ls.perspectives[0])+'</div><div>'+esc(ls.perspectives[1])+'</div></div>';
  if(ls.talk)h+='<p class="small">'+t('talkL')+'</p><p class="talk">'+esc(ls.talk)+'</p>';
  h+='<h3>'+t('keyL')+'</h3><ul>'+ls.facts.map(function(f){return '<li>'+esc(f.q)+'</li>'}).join('')+'</ul><div class="row"><button class="btn primary" id="fin">'+t('finish')+'</button></div>';
  st.innerHTML=h;$('fin').onclick=function(){saveLesson();finishSession()};
}
function renderKnow(){
  if(!S.lessons.length){$('know').innerHTML='<p class="empty">'+t('noKnow')+'</p>';return}
  $('know').innerHTML=S.lessons.map(function(l){return '<details class="entry"><summary><span class="meta">'+esc(l.date)+'</span><br><b>'+esc(l.title)+'</b></summary><div class="lesson">'+esc(l.lesson)+'</div>'+(l.talk?'<p class="talk">'+esc(l.talk)+'</p>':'')+'</details>'}).join('');
}
function nextItem(){cur.i++;cur.revealed=false;cur.text='';cur.dk=false;cur.sug=null;cur.fb=null;if(cur.i>=cur.items.length)cur.block=2;render();window.scrollTo(0,0)}
function renderConnect(st){
  var a=cur.pair[0],b=cur.pair[1];
  var h=head('b2')+'<div class="pair"><div class="c">'+areaTag(a)+'<b>'+esc(cn(a))+'</b></div><span class="plus">+</span><div class="c">'+areaTag(b)+'<b>'+esc(cn(b))+'</b></div></div>'+
    '<p>'+t('connQ')+'</p><p class="small">'+t('langNote')+'</p><textarea id="ct" placeholder="'+esc(t('connPh'))+'" aria-label="'+esc(t('connQ'))+'">'+esc(cur.connText)+'</textarea>'+fbHtml()+
    '<details><summary class="small">'+esc(cn(a))+' / '+esc(cn(b))+'</summary>'+defBox(a)+defBox(b)+'</details>'+
    '<div class="row">'+(sample?'<button class="btn" id="fb"'+(cur.fb?' disabled':'')+'>'+t('feedback')+'</button>':'')+'<button class="btn primary" id="sv">'+t('save')+'</button><button class="btn" id="sk">'+t('skip')+'</button></div>';
  st.innerHTML=h;var ta=$('ct');ta.oninput=function(e){cur.connText=e.target.value};
  if($('fb'))$('fb').onclick=function(){cur.connText=ta.value;if(cur.connText.trim().length<15)return;askClaude('You are a sharp, encouraging thinking coach. The learner was asked to connect two ideas: "'+CONCEPTS[a].n.en+'" ('+CONCEPTS[a].d.en+') and "'+CONCEPTS[b].n.en+'" ('+CONCEPTS[b].d.en+'). Their answer:\n"""'+cur.connText+'"""\nIn 3-5 short sentences: judge whether the link is real and correctly reasoned, point out any misunderstanding, and offer one sharper or more surprising connection they could explore. No filler. '+langLine())};
  $('sv').onclick=function(){cur.connText=ta.value;if(cur.connText.trim()){S.journal.unshift({date:today(),a:a,b:b,text:cur.connText.trim(),fb:cur.fb&&!cur.fb.wait?cur.fb.text:null});save()}cur.fb=null;cur.block=3;render();window.scrollTo(0,0)};
  $('sk').onclick=function(){cur.fb=null;cur.block=3;render()};
}
function renderApply(st){
  var k=CASES[cur.cases[cur.ci]];
  if(!cur.choices||cur.choices.k!==k.id){
    var same=C.filter(function(r){return r[0]!==k.c&&r[1]===CONCEPTS[k.c].area}).map(function(r){return r[0]});
    var rest=C.filter(function(r){return r[0]!==k.c&&r[1]!==CONCEPTS[k.c].area}).map(function(r){return r[0]});
    var d=shuffle(same).slice(0,2).concat(shuffle(rest).slice(0,1));cur.choices={k:k.id,list:shuffle(d.concat(k.c))};
  }
  var h=head('b3',(cur.ci+1)+' / '+cur.cases.length)+'<p class="scenario">'+esc(k.q[L()])+'</p><p class="small">'+t('applyQ')+'</p><div class="choices">'+
    cur.choices.list.map(function(id){var cls='choice';if(cur.answered){if(id===k.c)cls+=' ok';else if(id===cur.answered)cls+=' no'}
      return '<button class="'+cls+'" data-c="'+id+'"'+(cur.answered?' disabled':'')+'>'+esc(cn(id))+'</button>'}).join('')+'</div>';
  if(cur.answered){var ok=cur.answered===k.c;
    h+='<p class="result '+(ok?'ok':'no')+'">'+(ok?t('right'):esc(t('wrong',{c:cn(k.c)})))+'</p><p class="why">'+esc(k.w[L()])+'</p><div class="row"><button class="btn primary" id="nx">'+t('next')+'</button></div>'}
  st.innerHTML=h;
  st.querySelectorAll('[data-c]').forEach(function(b){b.onclick=function(){if(cur.answered)return;cur.answered=b.getAttribute('data-c');var ok=cur.answered===k.c;
    var s=S.cases[k.id]||(S.cases[k.id]={n:0,okN:0});s.n++;if(ok)s.okN++;s.ok=ok;s.last=dayNum(today());
    if(S.cards[k.c]&&!ok){S.cards[k.c].due=Math.min(S.cards[k.c].due,dayNum(today())+1)}save();render()}});
  if($('nx'))$('nx').onclick=function(){cur.ci++;cur.answered=null;if(cur.ci>=cur.cases.length){cur.block=cur.again?5:4}render();window.scrollTo(0,0)};
}
function renderDone(st){
  var n=stats();var d=dayNum(today())+1;var tomorrow=Object.keys(S.cards).filter(function(id){return S.cards[id].due<=d}).length;
  st.innerHTML='<div class="done-hero"><div class="big">'+n+'</div><h2>'+t('doneT')+'</h2><p class="small">'+t(n===1&&L()==='es'?'doneS1':'doneS',{n:n,d:tomorrow})+'</p></div><div class="row" style="justify-content:center"><button class="btn" id="ag">'+t('again')+'</button></div>';
  $('ag').onclick=function(){cur.cases=pickCases(3);cur.ci=0;cur.answered=null;cur.block=3;cur.again=true;render()};
}

/* ---------------- library + journal + settings ---------------- */
function renderLib(){
  var h='';Object.keys(AREAS).forEach(function(a){
    h+='<div class="libgroup"><span class="area '+a+'" style="align-self:flex-start">'+esc(AREAS[a][L()])+'</span>';
    C.filter(function(r){return r[1]===a}).forEach(function(r){var c=CONCEPTS[r[0]],s=S.cards[r[0]],box=s?s.box:0,dots='';
      for(var i=1;i<=5;i++)dots+='<i class="'+(box>=i?'on':'')+'"></i>';
      h+='<button class="libitem" data-id="'+c.id+'"><span class="nm">'+esc(c.n[L()])+'</span><span class="dots" aria-label="'+box+'/5">'+dots+'</span><span class="dd" hidden>'+esc(c.d[L()])+'<br><i>'+esc(c.x[L()])+'</i></span></button>'});
    h+='</div>'});
  $('lib').innerHTML=h;
  $('lib').querySelectorAll('.libitem').forEach(function(b){b.onclick=function(){var d=b.querySelector('.dd');d.hidden=!d.hidden}});
}
function renderJournal(){
  if(!S.journal.length){$('journal').innerHTML='<p class="empty">'+t('noJournal')+'</p>';return}
  $('journal').innerHTML=S.journal.map(function(j){return '<div class="entry"><span class="meta">'+esc(j.date)+' · '+esc(cn(j.a))+' + '+esc(cn(j.b))+'</span><div>'+esc(j.text)+'</div>'+(j.fb?'<div class="fb">'+esc(j.fb)+'</div>':'')+'</div>'}).join('');
}
function renderSet(){
  $('npd').innerHTML=[1,2,3,4].map(function(n){return '<button class="btn'+(S.npd===n?' primary':'')+'" data-n="'+n+'">'+n+'</button>'}).join('');
  $('npd').querySelectorAll('[data-n]').forEach(function(b){b.onclick=function(){S.npd=+b.getAttribute('data-n');save();renderSet()}});
}
$('bCopy').onclick=function(){var s=JSON.stringify(S);$('iBackup').value=s;
  try{navigator.clipboard.writeText(s).then(function(){$('bkMsg').textContent=t('copied')},function(){$('iBackup').select();$('bkMsg').textContent=t('selectIt')})}catch(e){$('iBackup').select();$('bkMsg').textContent=t('selectIt')}};
$('bRestore').onclick=function(){try{var o=JSON.parse($('iBackup').value);if(!o.cards)throw 0;S=Object.assign(blank(),o);save();cur=null;applyLang();$('bkMsg').textContent=t('restored')}catch(e){$('bkMsg').textContent=t('badBackup')}};
var armed=false;$('bReset').onclick=function(){if(!armed){armed=true;$('bReset').textContent=t('resetArm');setTimeout(function(){armed=false;$('bReset').textContent=t('reset')},4000);return}
  var lang=S.lang;S=blank();S.lang=lang;save();cur=null;armed=false;applyLang();$('bkMsg').textContent=t('wiped')};

/* ---------------- tabs + language ---------------- */
function openTab(id){document.querySelectorAll('.tab').forEach(function(x){var on=x.dataset.p===id;x.setAttribute('aria-selected',on);$(x.dataset.p).hidden=!on});
  if(id==='p-lib')renderLib();if(id==='p-know')renderKnow();if(id==='p-journal')renderJournal();if(id==='p-set')renderSet()}
document.querySelectorAll('.tab').forEach(function(x){x.onclick=function(){openTab(x.dataset.p)}});
function applyLang(){
  document.documentElement.lang=L();
  document.querySelectorAll('[data-t]').forEach(function(el){el.textContent=t(el.getAttribute('data-t'))});
  $('lEs').setAttribute('aria-pressed',L()==='es');$('lEn').setAttribute('aria-pressed',L()==='en');
  render();var open=document.querySelector('.tab[aria-selected="true"]');if(open)openTab(open.dataset.p);
}
$('lEs').onclick=function(){S.lang='es';save();applyLang()};
$('lEn').onclick=function(){S.lang='en';save();applyLang()};
applyLang();
if(OPEN_URL){fetch(OPEN_URL,{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(x){if(typeof x==='string'){mergeIn(JSON.parse(x));if(!cur)render()}}).catch(function(){}).then(function(){cloudSync()})}
})();
