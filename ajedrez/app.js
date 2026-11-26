/* Taller de Aperturas — all app logic. Static, no build: chess.js (0.10.3 API) + Stockfish in a Web Worker. */
(function(){
'use strict';
var KEY='taller-aperturas.v2', LKEY='taller-aperturas.lang';
var DAYS=[0,1,3,7,16,35,80];
var LOSS={checkmated:1,resigned:1,timeout:1,abandoned:1,lose:1};
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function now(){return Date.now()}
function fmt(s,a){return String(s).replace(/\{(\d)\}/g,function(_,i){return a[i]==null?'':a[i]})}

/* ---------- language ---------- */
var LANG='es';try{LANG=localStorage.getItem(LKEY)||'es'}catch(e){}
function t(k){var v=TXT[LANG][k];if(v==null)v=TXT.es[k];return fmt(v,[].slice.call(arguments,1))}
function tt(o){return o?(o[LANG]||o.es):''}
function pcName(p){return TXT[LANG].pc[p]}
function applyStatic(){
  document.documentElement.lang=LANG;
  document.querySelectorAll('[data-t]').forEach(function(el){el.innerHTML=t(el.getAttribute('data-t'))});
  document.querySelectorAll('[data-ph]').forEach(function(el){el.placeholder=t(el.getAttribute('data-ph'))});
  $('bLang').textContent=t('langBtn');$('bLang').title=t('langName');
}
$('bLang').onclick=function(){LANG=LANG==='es'?'en':'es';try{localStorage.setItem(LKEY,LANG)}catch(e){}applyStatic();rerender()};

/* ---------- state ---------- */
function blank(){return {days:{},pend:{},rating:null,v:3,user:'Esmithco',games:{},cards:{},gambits:{},rep:{},ideas:{},puz:{},tech:{},drill:{},quiz:{},plan:{},seenLesson:{},log:[],daily:null,streak:{n:0,last:''},base:0,lastSync:0}}
var S=blank(),DATA={stats:{}};
function upgrade(){
  var noDays=!S.days;var b=blank();Object.keys(b).forEach(function(k){if(S[k]==null)S[k]=b[k]});
  Object.keys(S.cards).forEach(function(k){var c=S.cards[k];if(!c.kind)c.kind='mine';if(c.last==null&&(c.box||0)>=2)c.last=1});S.v=3;
  if(S.daily)S.daily.date=padKey(S.daily.date);
  if(noDays){S.days={};
    /* rebuild finished days: from the old streak record and from days with a real session in the log */
    var st=S.streak||{};if(st.last&&st.n){var p=padKey(st.last).split('-'),d=new Date(+p[0],+p[1]-1,+p[2]);for(var i=0;i<st.n;i++){S.days[dkey(d)]=1;d.setDate(d.getDate()-1)}}
    var per={};(S.log||[]).forEach(function(e){if(e[1]==='theory')return;var k=dkey(new Date(e[0]));per[k]=(per[k]||0)+1});
    Object.keys(per).forEach(function(k){if(per[k]>=6)S.days[k]=1});
    if(S.daily&&S.daily.done&&S.daily.date)S.days[S.daily.date]=1;
  }
  Object.keys(S.drill||{}).forEach(function(k){var d=S.drill[k];if(d&&d.tot==null)d.tot=d.best||0});
  syncStreak();
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}if(typeof cloudSoon==='function')cloudSoon()}
/* what counts as a mistake (his view, before -> after his move): not "a better move existed", but a move that leaves him clearly worse
   (≤ −1.5) or throws away a clear advantage (from ≥ +2 to ≤ 0), with a drop of ≥ 15 win-probability points. Same rule offline (tools/build.py). */
function isMistake(s0,s1){if(s0<-500)return false;var d=wp(s0)-wp(s1);return d>=15&&(s1<=-150||(s0>=200&&s1<=0))}
function isPunish(s0,s1){if(s0>400)return false;var g=wp(s1)-wp(s0);return g>=15&&(s1>=150||(s0<=-200&&s1>=0))}
function applyRule(){ /* one-time: drop old app-analysed cards that are only small slips, recount errors of app games */
  if(S.rule>=3)return;var per={};
  Object.keys(S.cards).forEach(function(k){var c=S.cards[k];if(c.src!=='app')return;
    if(c.kind==='mine'?!isMistake(c.s0,c.s1):!isPunish(c.s0,c.s1)){delete S.cards[k];return}
    if(c.kind==='mine'&&visOf(c)!=='deep')(c.games||[]).forEach(function(g){per[g]=(per[g]||0)+1})});
  Object.keys(S.games).forEach(function(k){var g=S.games[k];if(g.src==='app'&&g.op)g.errors=per[k]||0});
  S.rule=3;
}
function mergeBase(D){
  var nc={};
  Object.keys(D.cards||{}).forEach(function(k){var c=D.cards[k],o=S.cards[k];if(o){c.box=o.box||0;c.due=o.due||0;c.reps=o.reps||0;c.lapses=o.lapses||0;c.last=o.last!=null?o.last:((o.box||0)>=2?1:0)}nc[k]=c});
  Object.keys(S.cards).forEach(function(k){var o=S.cards[k];if(!nc[k]&&o.src==='app')nc[k]=o});
  S.cards=nc;
  Object.keys(D.games||{}).forEach(function(k){var g=S.games[k],d=D.games[k];if(!g)S.games[k]=d;else{g.op=1;g.tr=1;g.errors=d.errors;if(d.rt){g.rt=d.rt;g.tc=d.tc}}});
  if(D.gambits)S.gambits=D.gambits;S.base=D.base||0;
}
function connectFromLink(){var h=location.hash;if(h.indexOf('#connect=')!==0)return;var tok=decodeURIComponent(h.slice(9));
  try{history.replaceState(null,'',location.pathname+'#home')}catch(e){location.hash='home'}
  if(tok&&tok!==CL.token)setTimeout(function(){cloudConnect(tok)},300)}
function boot(){connectFromLink();
  var raw=null;try{raw=localStorage.getItem(KEY)}catch(e){}
  if(raw){try{S=JSON.parse(raw)}catch(e){S=blank()}}
  upgrade();applyRule();
  fetch('datos.json?v=13',{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(D){
    DATA.stats=D.stats||{};
    if(!S.base||S.base<(D.base||0)){mergeBase(D);save()}
  }).catch(function(){}).then(function(){route();clStatus();cloudPull();
    setTimeout(function(){if(now()-(S.lastSync||0)>20*6e4)syncGames();else analyzePending()},2500);
    document.addEventListener('visibilitychange',function(){if(!document.hidden&&now()-(S.lastSync||0)>20*6e4)setTimeout(syncGames,1500)})});
}

/* ---------- chess helpers ---------- */
var VAL={p:1,n:3,b:3,r:5,q:9,k:0};
function fenOf(line){var c=new Chess();for(var i=0;i<line.length;i++)c.move(line[i],{sloppy:true});return c.fen()}
function posKey(fen){return fen.split(' ').slice(0,4).join(' ')}
function bal(c,col){var s=0;c.board().forEach(function(r){r.forEach(function(p){if(p)s+=(p.color===col?1:-1)*VAL[p.type]})});return s}
function wp(cp){cp=Math.max(-1000,Math.min(1000,cp));return 50+50*(2/(1+Math.exp(-0.00368208*cp))-1)}
function evalTxt(cpW){if(Math.abs(cpW)>=9000){var n=10000-Math.abs(cpW);return (cpW>0?'+M':'−M')+Math.max(1,n)}var v=cpW/100;return (v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(1)}
function toW(s,side){return side==='w'?s:-s}
function mateN(s){return Math.max(1,10000-Math.abs(s))}
function pvText(fen,pv,n){var c=new Chess(fen),num=+fen.split(' ')[5],o='';n=Math.min(n||6,pv.length);
  for(var i=0;i<n;i++){var w=c.turn()==='w';if(w)o+=num+'.';else if(i===0)o+=num+'… ';var m=c.move(pv[i],{sloppy:true});if(!m)break;o+=m.san+' ';if(!w)num++}return '<span class="mono">'+esc(o.trim())+'</span>'}
function uciToSan(fen,u){if(!u)return null;var c=new Chess(fen);var m=c.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]||'q'});return m?m.san:null}
function uciPv(fen,list){var c=new Chess(fen),o=[];for(var i=0;i<list.length&&i<8;i++){var u=list[i];var m=c.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]||'q'});if(!m)break;o.push(m.san)}return o}
function flipTurn(fen,col){var p=fen.split(' ');p[1]=col;p[3]='-';return p.join(' ')}
function matTxt(d){d=Math.abs(d);return d>=8?t('mat9'):d>=5?t('mat5'):d>=3?t('mat3'):d===2?t('mat2'):t('mat1')}
function outcome(fen,pv,col,n){var c=new Chess(fen),b0=bal(c,col);for(var i=0;i<Math.min(n||6,pv.length);i++){if(!c.move(pv[i],{sloppy:true}))break}return {delta:bal(c,col)-b0,mate:c.in_checkmate()}}

/* ---------- engine ---------- */
var Engine=(function(){
  var w=null,ready=null,listeners=[],busy=Promise.resolve();
  function attach(worker){return new Promise(function(res,rej){var tm=setTimeout(function(){rej(new Error('timeout'))},20000);
    worker.onmessage=function(e){var l=String(e.data);if(l==='uciok'){clearTimeout(tm);res(worker)}listeners.slice().forEach(function(f){f(l)})};
    worker.onerror=function(){clearTimeout(tm);rej(new Error('worker'))};worker.postMessage('uci')})}
  function make(){var tries=[function(){return new Worker('stockfish.asm.js')},
      function(){return new Worker(URL.createObjectURL(new Blob(['importScripts("https://cdn.jsdelivr.net/npm/stockfish@10.0.2/src/stockfish.asm.js")'],{type:'text/javascript'})))}];
    var i=0;function next(){if(i>=tries.length)return Promise.reject(new Error('no engine'));var wk;try{wk=tries[i++]()}catch(e){return next()}
      return attach(wk).catch(function(){try{wk.terminate()}catch(e){}return next()})}return next()}
  function init(){if(!ready){ready=make().then(function(wk){w=wk;w.postMessage('setoption name Hash value 32');return true}).catch(function(){ready=null;return false})}return ready}
  function go(fen,ms){
    var job=busy.then(init).then(function(ok){if(!ok)return null;return new Promise(function(res){
      var last={score:0,pv:[]};
      function on(l){
        if(l.indexOf('info')===0&&l.indexOf(' pv ')>0){var m=l.match(/score (cp|mate) (-?\d+)/),p=l.match(/ pv (.+)$/);
          if(m){var v=parseInt(m[2],10);last.score=m[1]==='cp'?v:(v>0?10000-v:-10000-v)}if(p)last.pv=p[1].trim().split(/\s+/)}
        else if(l.indexOf('bestmove')===0){listeners.splice(listeners.indexOf(on),1);var b=l.split(' ')[1];
          if(b&&b!=='(none)'&&last.pv[0]!==b)last.pv=[b];res({score:last.score,pv:last.pv})}}
      listeners.push(on);w.postMessage('position fen '+fen);w.postMessage('go movetime '+ms)})});
    busy=job.catch(function(){});return job}
  return {init:init,go:go};
})();
/* score from side to move + SAN pv */
function analyse(fen,ms){var c=new Chess(fen);
  if(c.in_checkmate())return Promise.resolve({s:-10000,pv:[]});
  if(c.in_draw()||c.in_stalemate())return Promise.resolve({s:0,pv:[]});
  return Engine.go(fen,ms||800).then(function(r){return r?{s:r.score,pv:uciPv(fen,r.pv||[])}:null})}

/* ---------- board ---------- */
var APP_VER=129;
var HINTS=(function(){try{return localStorage.getItem('taller-aperturas.hints')==='1'}catch(e){return false}})();
var B={chess:null,flip:false,sel:null,targets:[],marks:{},onMove:null,onTap:null,locked:true,drag:null,arrows:[]};
var boardEl=$('board'),arrowEl=$('arrows');
/* small static board picture (thumbnails / previews) */
function miniBoard(fen,flip,last,cls){var c=new Chess(fen),bd=c.board(),h='<svg class="'+(cls||'mini')+'" viewBox="0 0 8 8" aria-hidden="true">';
  for(var r=0;r<8;r++)for(var f=0;f<8;f++){var x=flip?7-f:f,y=flip?7-r:r,sq='abcdefgh'[f]+(8-r),p=bd[r][f];
    var col=last&&(last.from===sq||last.to===sq)?((r+f)%2?'#BBCB2B':'#F5F682'):((r+f)%2?'#739552':'#EBECD0');
    h+='<rect x="'+x+'" y="'+y+'" width="1" height="1" fill="'+col+'"/>';
    if(p)h+='<svg x="'+x+'" y="'+y+'" width="1" height="1" viewBox="0 0 40 40"><use href="#'+p.color+p.type+'"/></svg>'}
  return h+'</svg>'}
function lineEnd(l){var c=new Chess();var last=null;l.moves.forEach(function(m){var x=c.move(m,{sloppy:true});if(x)last=x});return {fen:c.fen(),last:last}}
function piece(p){return '<svg class="pc" viewBox="0 0 40 40"><use href="#'+p.color+p.type+'"/></svg>'}
function drawBoard(){
  var h='';
  for(var vr=0;vr<8;vr++)for(var vf=0;vf<8;vf++){
    var f=B.flip?7-vf:vf,r=B.flip?vr:7-vr,n='abcdefgh'[f]+(r+1);var pc=B.chess?B.chess.get(n):null;
    var cls='sq '+((f+r)%2?'l':'d')+(B.marks[n]?' '+B.marks[n]:'')+(B.sel===n?' sel':'')+(B.drag&&B.drag.from===n?' drag-from':'');
    var inner=pc?piece(pc):'';if(B.rings&&B.rings[n])cls+=' gring-'+B.rings[n];if(B.badges&&B.badges[n])inner+='<span class="gbadge">'+B.badges[n]+'</span>';
    if(HINTS&&B.targets.indexOf(n)>=0)inner+=pc?'<span class="ring"></span>':'<span class="dot"></span>';
    if(vr===7)inner+='<span class="cf">'+'abcdefgh'[f]+'</span>';if(vf===0)inner+='<span class="cr">'+(r+1)+'</span>';
    h+='<div class="'+cls+'" data-sq="'+n+'">'+inner+'</div>';
  }
  boardEl.innerHTML=h;if(B.drag&&B.drag.ghost)boardEl.appendChild(B.drag.ghost);drawArrows();
  /* coordinates outside the board (they no longer cover the pieces) and a clear "you play white/black" badge */
  var fl=B.flip?'hgfedcba':'abcdefgh',rk=B.flip?'12345678':'87654321';
  $('files').innerHTML=fl.split('').map(function(x){return '<span>'+x+'</span>'}).join('');$('ranks').innerHTML=rk.split('').map(function(x){return '<span>'+x+'</span>'}).join('');
  var sb=$('sideBadge'),side=B.flip?'b':'w';sb.className='sidebadge '+side+(boardEl.classList.contains('nocoords')||boardEl.classList.contains('nopieces')||!B.chess||B.chess.board().every(function(r){return r.every(function(q){return !q})})?' must':'');
  sb.innerHTML=boardEl.classList.contains('nocoords')?t(side==='w'?'whiteBottom':'blackBottom'):t('youPlayBig',t(side==='w'?'White':'Black').toUpperCase());
}
function sqXY(n){var f='abcdefgh'.indexOf(n[0]),r=+n[1]-1;return B.flip?[7-f+.5,r+.5]:[f+.5,7-r+.5]}
function drawArrows(){
  arrowEl.innerHTML=B.arrows.map(function(a){var p=sqXY(a.from),q=sqXY(a.to),dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
    var ex=q[0]-ux*.3,ey=q[1]-uy*.3;
    return '<line x1="'+p[0]+'" y1="'+p[1]+'" x2="'+ex+'" y2="'+ey+'" stroke="'+a.c+'" stroke-width=".14" stroke-linecap="round" opacity=".62"/>'+
      '<polygon points="'+(q[0]+ux*.05)+','+(q[1]+uy*.05)+' '+(ex-uy*.28)+','+(ey+ux*.28)+' '+(ex+uy*.26)+','+(ey-ux*.26)+'" fill="'+a.c+'" opacity=".62"/>'}).join('');
}
function arrowFor(fen,san,c){var x=new Chess(fen);var m=x.move(san,{sloppy:true});return m?{from:m.from,to:m.to,c:c}:null}
function sqAt(x,y){var r=boardEl.getBoundingClientRect();if(x<r.left||y<r.top||x>=r.right||y>=r.bottom)return null;
  var vf=Math.floor((x-r.left)/r.width*8),vr=Math.floor((y-r.top)/r.height*8);var f=B.flip?7-vf:vf,rk=B.flip?vr:7-vr;return 'abcdefgh'[f]+(rk+1)}
function tryMove(from,to){
  var mv=B.chess.move({from:from,to:to,promotion:'q'});B.sel=null;B.targets=[];
  if(mv){B.marks={};B.marks[from]='last';B.marks[to]='last';B.arrows=[];drawBoard();if(B.onMove)B.onMove(mv);return true}
  drawBoard();return false;
}
function select(n){B.sel=n;B.targets=B.chess.moves({square:n,verbose:true}).map(function(m){return m.to})}
boardEl.addEventListener('pointerdown',function(e){
  if(B.onTap&&!B.locked){var s=sqAt(e.clientX,e.clientY);if(s){e.preventDefault();B.onTap(s)}return}
  if(B.locked||!B.chess)return;var n=sqAt(e.clientX,e.clientY);if(!n)return;e.preventDefault();
  if(B.sel&&B.targets.indexOf(n)>=0){tryMove(B.sel,n);return}
  var pc=B.chess.get(n);
  if(pc&&pc.color===B.chess.turn()){
    var wasSel=B.sel===n;select(n);
    var g=document.createElement('div');g.className='ghost';g.innerHTML=piece(pc);
    var r=boardEl.getBoundingClientRect();g.style.left=(e.clientX-r.left)+'px';g.style.top=(e.clientY-r.top)+'px';
    B.drag={from:n,ghost:g,moved:false,wasSel:wasSel};try{boardEl.setPointerCapture(e.pointerId)}catch(_){}drawBoard();
  }else{B.sel=null;B.targets=[];drawBoard()}
});
boardEl.addEventListener('pointermove',function(e){if(!B.drag)return;var r=boardEl.getBoundingClientRect();B.drag.moved=true;B.drag.ghost.style.left=(e.clientX-r.left)+'px';B.drag.ghost.style.top=(e.clientY-r.top)+'px'});
function endDrag(e){if(!B.drag)return;var d=B.drag;B.drag=null;var to=e&&e.type==='pointerup'?sqAt(e.clientX,e.clientY):null;
  if(to&&to!==d.from&&B.targets.indexOf(to)>=0){tryMove(d.from,to);return}
  if(to===d.from&&d.wasSel&&!d.moved){B.sel=null;B.targets=[]}drawBoard()}
boardEl.addEventListener('pointerup',endDrag);boardEl.addEventListener('pointercancel',endDrag);
function setBoard(fen,flip,lastSan,prevFen){
  B.chess=new Chess(fen);B.flip=flip;B.sel=null;B.targets=[];B.marks={};B.arrows=[];B.drag=null;B.onTap=null;B.badges={};B.rings={};
  if(lastSan&&prevFen){var m=new Chess(prevFen).move(lastSan,{sloppy:true});if(m){B.marks[m.from]='last';B.marks[m.to]='last'}}
  drawBoard();
}
/* eval bar: cp from White's point of view */
var barCp=null;
function setBar(cpW,on){
  var el=$('evalbar');el.hidden=on===false;if(on===false)return;
  var p=cpW==null?50:wp(cpW);el.classList.toggle('flip',B.flip);
  $('evfill').style.height=p+'%';el.style.setProperty('--p',p+'%');$('evtxt').textContent=cpW==null?'…':evalTxt(B.flip?-cpW:cpW);
  el.classList.remove('pulse');if(barCp!=null&&cpW!=null&&Math.abs(wp(cpW)-wp(barCp))>=10){void el.offsetWidth;el.classList.add('pulse')}
  barCp=cpW;
}
function classOf(drop){return drop<=2?['best','cBest']:drop<=5?['good','cGood']:drop<=10?['inacc','cInacc']:drop<=20?['mist','cMist']:['blun','cBlun']}
function chip(san,drop,cpW){var c=classOf(drop);return '<span class="chip '+c[0]+'"><b class="mono">'+esc(san)+'</b> '+t(c[1])+'</span>'}

/* ---------- explanations ---------- */
/* step by step: what each move of a line does, in words (checks, captures, double attacks, only moves, mate threats) */
function pcA(p){return TXT[LANG].pcA[p]}
function canTake(c,sq){return c.moves({verbose:true}).some(function(x){return x.to===sq})}
function describe(before,m,c,mine,legal,prevTo){
  if(c.in_checkmate())return t('stMateMv');
  var parts=[];
  if(m.captured){if(prevTo===m.to)parts.push(t('stRecap',pcA(m.captured)));else parts.push(canTake(c,m.to)?t('stTakes',pcA(m.captured)):t('stTakesFree',pcA(m.captured)))}
  if(m.promotion)parts.push(t('stPromo'));
  var chk=c.in_check();if(chk)parts.push(t('stCheck'));
  /* what the moved piece attacks now */
  var tg=[];try{var x=new Chess(flipTurn(c.fen(),m.color));x.moves({square:m.to,verbose:true}).forEach(function(a){if(!a.captured||a.captured==='k')return;
    x.move(a.san);var def=canTake(x,a.to);x.undo();if(VAL[a.captured]>VAL[m.piece]||(!def&&VAL[a.captured]>=1))tg.push(pcA(a.captured)+' ('+a.to+')')})}catch(e){}
  if(tg.length+(chk?1:0)>=2&&tg.length)parts.push(t('stFork',chk?pcA('k'):tg[0],chk?tg[0]:tg[1]));else if(tg.length===1&&!chk)parts.push(t('stAttacks',tg[0]));
  if(!mine&&legal===1)parts.push(t('stOnly'));
  if(mine&&!chk&&!m.captured){try{var y=new Chess(flipTurn(c.fen(),m.color));if(y.moves().some(function(z){y.move(z);var mt=y.in_checkmate();y.undo();return mt}))parts.push(t('stThreatMate'))}catch(e){}}
  var o=parts.join(', ');if(LANG==='es')o=o.replace(/\ba el /g,'al ');return o?o.charAt(0).toUpperCase()+o.slice(1)+'.':'';
}
function story(fen,moves,col,n){
  var c=new Chess(fen),num=+fen.split(' ')[5]||1,items=[],prevTo=null,any=false,b0=bal(c,col);n=Math.min(n||6,moves.length);
  for(var i=0;i<n;i++){var w=c.turn()==='w',mine=c.turn()===col,legal=c.moves().length,before=c.fen(),m=c.move(moves[i],{sloppy:true});if(!m)break;
    var d=describe(before,m,c,mine,legal,prevTo);prevTo=m.captured?m.to:null;if(d)any=true;
    items.push('<li class="'+(mine?'me':'op')+'"><b class="mono">'+(w?num+'.':num+'…')+' '+esc(m.san)+'</b>'+(mine?'':' <span class="small">('+t('stOpp')+')</span>')+(d?' — '+d:'')+'</li>');
    if(!w)num++;if(c.game_over())break}
  var r=bal(c,col)-b0,res=c.in_checkmate()?(c.turn()===col?t('stMated'):t('stMate')):r>=1?t('stWin',matTxt(r)):r<=-1?t('stLose',matTxt(r)):t('stEven');
  if(!any&&!r&&!c.in_checkmate())return '<p class="small">'+pvText(fen,moves,n)+' — '+t('stQuiet')+'</p>';
  return '<ol class="story">'+items.join('')+'</ol><p class="small"><b>'+res+'</b></p>';
}
function attacked(c,sq,col){ /* pieces of col attacked by the piece on sq */
  var p=c.get(sq);if(!p)return[];var x;try{x=new Chess(flipTurn(c.fen(),p.color))}catch(e){return[]}
  var out=[];x.moves({square:sq,verbose:true}).forEach(function(m){if(m.captured){var v=x.get(m.to);if(v&&v.color===col&&(VAL[v.type]>=3||v.type==='k'))out.push({sq:m.to,type:v.type})}});
  if(c.in_check()&&c.turn()===col&&!out.some(function(o){return o.type==='k'}))out.push({sq:'',type:'k'});
  return out;
}
/* why the move `san` from fen0 is bad: pv = opponent's best line after it; s1 = eval after it (mover's view) */
function explainBad(fen0,san,pv,s1,col,ply){
  var o=[],c1=new Chess(fen0);var mv=c1.move(san,{sloppy:true});if(!mv)return o;var fen1=c1.fen();
  if(s1<=-9000&&pv.length){o.push(t('mate','<span class="mono">'+esc(pv[0])+'</span>',mateN(s1)));return o}
  if(!pv.length)return o;
  var res=outcome(fen1,pv,col,6),c2=new Chess(fen1),r=c2.move(pv[0],{sloppy:true});
  if(res.delta<=-1&&r){
    var hang=false;
    if(r.captured&&VAL[r.captured]>=1){var recap=c2.moves({verbose:true}).some(function(m){return m.to===r.to});
      if(!recap&&-res.delta>=VAL[r.captured]-0.5){o.push(t('hanging',pcName(r.captured),r.to,'<span class="mono">'+esc(r.san)+'</span>'));hang=true}}
    if(!hang){var at=attacked(c2,r.to,col);
      if(at.length>=2||(c2.in_check()&&at.length>=1&&at.some(function(a){return a.type!=='k'}))){
        var nk=at.filter(function(a){return a.type!=='k'});
        o.push(c2.in_check()?t('forkCheck','<span class="mono">'+esc(r.san)+'</span>',pcName(nk[0].type)+(nk[0].sq?' ('+nk[0].sq+')':'')):
          t('fork','<span class="mono">'+esc(r.san)+'</span>',pcName(at[0].type)+(at[0].sq?' ('+at[0].sq+')':''),pcName(at[1].type)+(at[1].sq?' ('+at[1].sq+')':'')))}
      o.push(t('loses',esc(pv[0]),matTxt(res.delta))+' '+pvText(fen1,pv,6))}
  }else{
    o.push(t('noMat',esc(pv[0]),evalTxt(s1))+' '+pvText(fen1,pv,6));
    var h=heuristic(fen0,mv,col,ply);if(h)o.push(t(h));
  }
  return o;
}
function heuristic(fen0,mv,col,ply){
  var c=new Chess(fen0),king=null;c.board().forEach(function(r,ri){r.forEach(function(p,fi){if(p&&p.type==='k'&&p.color===col)king='abcdefgh'[fi]})});
  if(mv.piece==='p'&&'fgh'.indexOf(mv.from[0])>=0&&king&&'efgh'.indexOf(king)>=0)return 'hKing';
  if(mv.piece==='q'&&ply<16)return 'hQueen';
  if(mv.captured==='p'&&ply<20)return 'hGrab';
  if(ply<16&&'nb'.indexOf(mv.piece)>=0){var home=col==='w'?'1':'8';if(mv.from[1]!==home)return 'hTwice'}
  return null;
}
function explainBest(fen0,best,pv,sBest,col,threat,s0){
  var o=[];
  if(threat&&threat.pv&&threat.pv.length&&wp(threat.s)-wp(-s0)>=10){
    var opp=col==='w'?'b':'w',desc;
    if(threat.s>=9000)desc=t('threatMate');else{var r=outcome(flipTurn(fen0,opp),threat.pv,opp,4);desc=r.delta>=1?t('threatWins',matTxt(r.delta)):t('threatPos')}
    o.push(t('threat',esc(threat.pv[0]),desc,'<span class="mono">'+esc(best)+'</span>'));
  }
  if(sBest>=9000){o.push(t('mateFor','<span class="mono">'+esc(best)+'</span>',mateN(sBest)));return o}
  var line=pv&&pv.length?pv:[best];var r2=outcome(fen0,line,col,6);
  o.push(r2.delta>=1?t('bestWins',esc(best),matTxt(r2.delta),pvText(fen0,line,6)):t('bestKeeps',esc(best),evalTxt(sBest),pvText(fen0,line,6)));
  return o;
}


/* ---------- teacher: name the idea behind a mistake or a good move (fork, pin, undefended piece…), the rule, and the habit ---------- */
var DIRS={b:[[1,1],[1,-1],[-1,1],[-1,-1]],r:[[1,0],[-1,0],[0,1],[0,-1]]};DIRS.q=DIRS.b.concat(DIRS.r);
function sqFR(f,r){return f>=0&&f<8&&r>=0&&r<8?'abcdefgh'[f]+(r+1):null}
function sanH(x){return '<b class="mono">'+esc(x)+'</b>'}
function defendedBy(c,sq,col){try{var x=new Chess(flipTurn(c.fen(),col));x.remove(sq);x.put({type:'n',color:col==='w'?'b':'w'},sq);return x.moves({verbose:true}).some(function(m){return m.to===sq})}catch(e){return false}}
function lineTactic(c,sq){
  var p=c.get(sq);if(!p||!DIRS[p.type])return null;var f0='abcdefgh'.indexOf(sq[0]),r0=+sq[1]-1,V=function(q){return q.type==='k'?100:VAL[q.type]};
  for(var i=0;i<DIRS[p.type].length;i++){var d=DIRS[p.type][i],a=null,b=null,f=f0,r=r0;
    while(true){f+=d[0];r+=d[1];var s=sqFR(f,r);if(!s)break;var q=c.get(s);if(!q)continue;
      if(!a){if(q.color===p.color)break;a={sq:s,p:q};continue}
      if(q.color===p.color)break;b={sq:s,p:q};break}
    if(!a||!b)continue;
    if(V(b.p)>V(a.p)&&V(a.p)>=3&&(b.p.type==='k'||V(b.p)>=5))return {k:'pin',a:a,b:b};
    if(V(a.p)>V(b.p)&&V(a.p)>=9&&V(b.p)>=3&&!(b.p.type==='p'))return {k:'skewer',a:a,b:b};
  }
  return null;
}
function capsBy(c,col,exceptSq){var x,o={};try{x=new Chess(flipTurn(c.fen(),col))}catch(e){return o}
  x.moves({verbose:true}).forEach(function(m){if(m.captured&&m.from!==exceptSq&&VAL[m.captured]>=3)o[m.to]=m.from});return o}
function discovered(cB,cA,m){var b=capsBy(cB,m.color,m.from),a=capsBy(cA,m.color,m.to);for(var k in a){if(!b[k])return {sq:k,p:cA.get(k)}}return null}
function joinY(a){return a.length<2?a.join(''):a.slice(0,-1).join(', ')+(LANG==='es'?' y ':' and ')+a[a.length-1]}
function tgtName(o){return o.type==='k'?pcA('k'):pcA(o.type)+' ('+o.sq+')'}
function mateIn(fen,pv,n,who){var x=new Chess(fen);for(var i=0;i<Math.min(n,pv.length);i++){var m=x.move(pv[i],{sloppy:true});if(!m)return null;if(x.in_checkmate())return m.color===who?{i:i,m:m,c:x}:null}return null}
function isBackRank(x,m){var k=null,col=x.turn();x.board().forEach(function(r,ri){r.forEach(function(p,fi){if(p&&p.type==='k'&&p.color===col)k='abcdefgh'[fi]+(8-ri)})});
  return k&&(k[1]==='1'||k[1]==='8')&&(m.piece==='r'||m.piece==='q')&&m.to[1]===k[1]}
/* why `san` (by col, from fen0) is bad; pv = the opponent's best answer line */
function teachBad(fen0,san,pv,col){
  var c0=new Chess(fen0),opp=col==='w'?'b':'w',mv=c0.move(san,{sloppy:true});if(!mv)return null;var fen1=c0.fen();pv=pv||[];
  var mt=mateIn(fen1,pv,5,opp);if(mt)return {k:isBackRank(mt.c,mt.m)?'backrank':'mate',txt:t('tMate',sanH(san),pvText(fen1,pv,mt.i+1))};
  if(!pv.length)return null;
  var c1=new Chess(fen1),r=c1.move(pv[0],{sloppy:true});if(!r)return null;
  if(mv.captured&&r.to===mv.to&&VAL[mv.piece]>VAL[mv.captured])return {k:'badtrade',txt:t('tBadTrade',sanH(san),pcA(mv.captured),pcA(mv.piece),sanH(r.san))};
  if(r.captured&&VAL[r.captured]>=1){var re=canTake(c1,r.to);
    if(!re){
      if(r.to!==mv.to&&defendedBy(new Chess(fen0),r.to,col)&&!defendedBy(new Chess(fen1),r.to,col)){
        var wasDef=false;try{var y=new Chess(flipTurn(fen0,col));y.remove(r.to);y.put({type:'n',color:opp},r.to);wasDef=y.moves({square:mv.from,verbose:true}).some(function(z){return z.to===r.to})}catch(e){}
        return {k:'leftdef',txt:wasDef?t('tLeftDef',pcA(mv.piece),mv.from,pcA(r.captured),r.to,sanH(r.san)):t('tBlocked',sanH(san),pcA(r.captured),r.to,sanH(r.san))}}
      if(r.to===mv.to)return {k:'hanging',txt:t('tHangMoved',sanH(san),pcA(mv.piece),mv.to,sanH(r.san))};
      return {k:'hanging',txt:t('tHang',pcA(r.captured),r.to,sanH(r.san))}}
    if(VAL[r.captured]-VAL[r.piece]>=2)return {k:'material',txt:t('tTakesBig',sanH(r.san),pcA(r.captured),pcA(r.piece))};
  }
  var at=attacked(c1,r.to,col);if(at.length>=2)return {k:'fork',txt:t('tFork',sanH(r.san),joinY(at.map(tgtName)))};
  var lt=lineTactic(c1,r.to);if(lt&&lt.a.p.color===col)return {k:lt.k,txt:t(lt.k==='pin'?'tPin':'tSkewer',sanH(r.san),pcA(lt.a.p.type),lt.a.sq,pcA(lt.b.p.type))};
  var dc=discovered(new Chess(fen1),c1,r);if(dc&&dc.p&&dc.p.color===col)return {k:'discovered',txt:t('tDisc',sanH(r.san),pcA(dc.p.type),dc.sq)};
  if(mv.piece==='p'&&'fgh'.indexOf(mv.from[0])>=0){var kc=new Chess(fen0),ks=null;kc.board().forEach(function(rw,ri){rw.forEach(function(p,fi){if(p&&p.type==='k'&&p.color===col)ks='abcdefgh'[fi]})});
    if(ks&&'fgh'.indexOf(ks)>=0)return {k:'king',txt:t('tKing',sanH(san),pvText(fen1,pv,4))}}
  var o=outcome(fen1,pv,col,4);if(o.delta<=-1)return {k:'material',txt:t('tMaterial',sanH(san),matTxt(o.delta),pvText(fen1,pv,4))};
  return null;
}
/* why the line pv (starting with col's move from fen0) is good */
function teachWin(fen0,pv,col){
  if(!pv||!pv.length)return null;var opp=col==='w'?'b':'w';
  var mt=mateIn(fen0,pv,5,col);if(mt)return {k:isBackRank(mt.c,mt.m)?'backrank':'mate',txt:t('tWinMate',pvText(fen0,pv,mt.i+1))};
  var c0=new Chess(fen0),c1=new Chess(fen0),m=c1.move(pv[0],{sloppy:true});if(!m)return null;
  if(m.captured&&VAL[m.captured]>=1&&!canTake(c1,m.to))return {k:'free',txt:t('tWinFree',pcA(m.captured),m.to,sanH(m.san))};
  var at=attacked(c1,m.to,opp);if(at.length>=2)return {k:'fork',txt:t('tWinFork',sanH(m.san),joinY(at.map(tgtName)))};
  var lt=lineTactic(c1,m.to);if(lt&&lt.a.p.color===opp)return {k:lt.k,txt:t(lt.k==='pin'?'tWinPin':'tWinSkewer',sanH(m.san),pcA(lt.a.p.type),lt.a.sq,pcA(lt.b.p.type))};
  var dc=discovered(c0,c1,m);if(dc&&dc.p&&dc.p.color===opp)return {k:'discovered',txt:t('tWinDisc',sanH(m.san),pcA(dc.p.type),dc.sq)};
  if(m.captured&&VAL[m.captured]-VAL[m.piece]>=2)return {k:'free',txt:t('tWinFree',pcA(m.captured),m.to,sanH(m.san))};
  var o=outcome(fen0,pv,col,5);if(o.delta>=2)return {k:'material',txt:t('tWinMat',sanH(m.san),matTxt(o.delta),pvText(fen0,pv,5))};
  return null;
}
function esFix(x){return LANG==='es'?x.replace(/\bde el /g,'del ').replace(/\ba el /g,'al '):x}
function fold(title,html){return html?'<details class="fold"><summary>'+title+'</summary>'+html+'</details>':''}
function teachBox(o,lead){
  if(!o||!CONCEPT[o.k])return '';if(cur&&!cur.gk)cur.gk=o.k;var C=CONCEPT[o.k],x=esFix(o.txt.charAt(0).toUpperCase()+o.txt.slice(1));
  S.cseen=S.cseen||{};var n=S.cseen[o.k]=(S.cseen[o.k]||0)+1,rule='<b>'+t('tRule')+':</b> '+esc(tt(C.rule));
  return '<div class="teach"><div class="teachT">📘 '+esc(tt(C.t))+'</div><p>'+(lead?lead+' ':'')+x+'</p>'+(n<=2?'<p class="small">'+rule+'</p>':'')+'<p class="small"><b>'+t('tHabit')+':</b> '+esc(tt(C.habit))+'</p>'+(n>2?'<details class="fold"><summary>'+t('tRule')+'</summary><p class="small">'+esc(tt(C.rule))+'</p></details>':'')+'</div>';
}
/* which mistakes can be seen within a move or two (lose: punished in ≤3 plies; win: the best move wins in ≤3 plies); the rest is "deep" and left out of practice */
function punishedJS(fen,moves,col,n){var c=new Chess(fen),b0=bal(c,col);for(var i=0;i<Math.min(n,moves.length);i++){var m=c.move(moves[i],{sloppy:true});if(!m)break;if(c.in_checkmate())return c.turn()===col;if(c.turn()===col&&attacked(c,m.to,col).length>=2)return true}return bal(c,col)-b0<=-2}
function winsJS(fen,moves,col,n){var c=new Chess(fen),b0=bal(c,col);for(var i=0;i<Math.min(n,moves.length);i++){var m=c.move(moves[i],{sloppy:true});if(!m)break;if(c.in_checkmate())return c.turn()!==col;if(c.turn()!==col&&attacked(c,m.to,c.turn()).length>=2)return true}return bal(c,col)-b0>=2}
function visOf(c){
  if(c.vis)return c.vis;
  try{var b=new Chess();(c.line||[]).forEach(function(m){b.move(m,{sloppy:true})});var f=b.fen(),col=c.side;
    if(c.kind==='mine'){var b1=new Chess(f);if(!b1.move(c.played,{sloppy:true}))return c.vis='deep';var f1=b1.fen();
      if(punishedJS(f1,c.pvBad||[],col,3))return c.vis='lose';
      var bb=new Chess(f1);(c.pvBad||[]).slice(0,3).forEach(function(m){bb.move(m,{sloppy:true})});if(bal(bb,col)-bal(new Chess(f),col)<=-2)return c.vis='lose';
      return c.vis=winsJS(f,c.pvBest||[],col,3)?'win':'deep'}
    return c.vis=winsJS(f,c.pvBest||[],col,3)?'win':'deep'}catch(e){return c.vis='deep'}
}

/* Nov 25 ("I don't like when the board or something moves"): on phones the question line above the board is replaced by the verdict
   once answered; the verdict keeps the question's height so the board stays exactly where it was */
(function(){var lastPH=0;function lock(){var tb=$('trBody'),fb=$('fb'),pr=$('prompt');if(!tb||!fb||!pr)return;
  if(innerWidth>979){fb.style.minHeight='';return}
  if(tb.classList.contains('answered'))fb.style.minHeight=lastPH?lastPH+'px':'';else{fb.style.minHeight='';if(pr.offsetHeight)lastPH=pr.offsetHeight}}
  function init(){var tb=$('trBody'),pr=$('prompt');if(!tb||!pr)return setTimeout(init,200);
    new MutationObserver(lock).observe(tb,{attributes:true,attributeFilter:['class']});
    if(window.ResizeObserver)new ResizeObserver(function(){if(!tb.classList.contains('answered')&&pr.offsetHeight)lastPH=pr.offsetHeight}).observe(pr)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init()})();
/* ---------- spaced repetition ---------- */
function gradeObj(o,ok){
  if(ok){o.box=Math.min(6,(o.box||0)+1);o.due=now()+DAYS[o.box]*864e5-36e5}
  else{o.lapses=(o.lapses||0)+1;o.box=1;o.due=now()+20*36e5}   /* Nov 19: was 10 min — he remembered the answer instead of understanding it; now ~tomorrow */
  o.reps=(o.reps||0)+1;o.last=ok?1:0;save();
}
/* a card worth practising: visible within a move or two, and (own mistakes) from a position that was still playable —
   if the best move still leaves him clearly lost (below −1.0), there is nothing to learn there */
/* Nov 23 (he was asked to judge a forced move — the only legal reply to a check — and told it was 'a mistake'): a position is an
   exercise only if there is a real choice: not in check with 3+ legal moves (cached per FEN) */
var RC={};function realChoice(fen){if(RC[fen]!=null)return RC[fen];var ok=false;try{var c=new Chess(fen);ok=!c.in_check()&&c.moves().length>=3}catch(e){}return RC[fen]=ok}
function usable(c){return !c.hide&&visOf(c)!=='deep'&&!(c.kind==='mine'&&(c.s0||0)<-100)&&(!c.line||realChoice(fenOf(c.line)))}
function cardsOf(kind){return Object.keys(S.cards).map(function(k){return S.cards[k]}).filter(function(c){return c.kind===kind&&usable(c)})}
function prio(c){return (c.rep?1e6:0)+(c.kind==='punish'?(c.mat>=1?2e5:0)+(c.missed?1e5:0):(c.trap?2e5:0)+(c.sev==='blunder'?1e5:0))+(c.count||1)*5e4+(c.date||0)/1e5}
function dueList(kind,onlyRep){var sn=S.seen||{},rec=now()-20*36e5;
  return cardsOf(kind).filter(function(c){return (c.due||0)<=now()&&(!onlyRep||c.rep)}).map(function(c){return {c:c,k:((sn[c.id]||0)>rec?100:0)+((c.reps||0)>0?0:10)-Math.min(9,prio(c)/10)+Math.random()*4}})
    .sort(function(a,b){return a.k-b.k}).map(function(x){return x.c})}
/* Nov 25 ("I do the same mistakes over and over instead of continuing; if I did it right, move on"): his 7 'Mis errores' cards today were
   all reviews of cards he had already solved, while 15 were never tried — due reviews used to come before new ones. Now the queue is:
   cards he got WRONG last time (back after ~20 h) -> cards never tried (most important first) -> only then reviews of solved cards.
   'todo' = not solved yet (never tried or wrong last time): solving one takes it off the count at once. */
function cardQueue(kind){var sn=S.seen||{},rec=now()-20*36e5,cs=cardsOf(kind),fresh=function(c){return (sn[c.id]||0)<rec};
  var wrong=cs.filter(function(c){return (c.reps||0)>0&&c.last!==1&&(c.due||0)<=now()&&fresh(c)}).sort(function(){return Math.random()-.5});
  var nw=cs.filter(function(c){return !(c.reps>0)&&fresh(c)}).sort(function(a,b){return prio(b)-prio(a)+(Math.random()-.5)*5e4});
  var rev=cs.filter(function(c){return (c.reps||0)>0&&c.last===1&&(c.due||0)<=now()&&fresh(c)}).sort(function(a,b){return (a.box||0)-(b.box||0)||Math.random()-.5});
  return wrong.concat(nw,rev)}
function counts(kind){var cs=cardsOf(kind),due=0,nw=0,todo=0;cs.forEach(function(c){if((c.reps||0)===0)nw++;else if((c.due||0)<=now())due++;if(c.last!==1)todo++});return {due:due,nw:nw,all:cs.length,todo:todo}}

/* repertoire */
function lineId(op,i){return op+':'+i}
function repState(id){return S.rep[id]||(S.rep[id]={box:0,due:0})}
function repLines(op){return REP[op].lines.map(function(l,i){return {op:op,i:i,l:l,id:lineId(op,i),st:S.rep[lineId(op,i)]}}).filter(function(x){return !x.l.off})}   /* off = retired line (Nov 23: line london:4 replaced by the O-O-O attack) */
function allLines(){var o=[];Object.keys(REP).forEach(function(k){o=o.concat(repLines(k))});return o}
function lineDue(x){return !x.st||(x.st.due||0)<=now()}

/* ---------- daily ---------- */
/* dates are local 'YYYY-MM-DD' (zero-padded, so they sort as text). Old builds wrote '2026-11-9', which compared as later than '2026-11-10'. */
function dkey(d){return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function padKey(s){if(!s)return '';var p=String(s).split('-');return p.length===3?p[0]+'-'+('0'+p[1]).slice(-2)+'-'+('0'+p[2]).slice(-2):s}
function today(){return dkey(new Date())}
function yesterday(){var d=new Date();d.setDate(d.getDate()-1);return dkey(d)}
/* streak = consecutive days with the daily session finished, counted back from today (or yesterday if today is not done yet) */
function streakN(){var D=S.days||{},d=new Date();if(!D[dkey(d)])d.setDate(d.getDate()-1);var n=0;while(D[dkey(d)]){n++;d.setDate(d.getDate()-1)}return n}
function syncStreak(){S.streak={n:streakN(),last:Object.keys(S.days||{}).sort().pop()||''}}
function buildToday(n){
  n=n||1;
  var lines=allLines().filter(lineDue).sort(function(a,b){
    var ak=a.l.kind!=='main'?1:0,bk=b.l.kind!=='main'?1:0;var an=a.st?1:0,bn=b.st?1:0;
    return (an-bn)||((a.st&&a.st.box||0)-(b.st&&b.st.box||0))||(bk-ak)});
  var trapL=lines.filter(function(x){return x.l.kind!=='main'})[0];
  var pickL=[];if(trapL)pickL.push(trapL);lines.forEach(function(x){if(pickL.length<2&&pickL.indexOf(x)<0)pickL.push(x)});
  var mine=dueList('mine',true);if(mine.length<4)mine=mine.concat(cardQueue('mine').filter(function(c){return mine.indexOf(c)<0}));
  /* weak-spot themes are trained on their own screen: keep the daily different */
  var wtop=weakRank().filter(function(x){return x.k!=='calc'}).slice(0,2).map(function(x){return x.k});mine=mine.filter(function(c){return wtop.indexOf(cardWk(c))<0});
  var pun=dueList('punish',true).filter(function(c){return c.mat>=1});if(pun.length<2)pun=pun.concat(cardQueue('punish').filter(function(c){return pun.indexOf(c)<0}));
  var idea=IDEAS.filter(function(x){var s=S.ideas[x.id];return !s})[0]||IDEAS.filter(function(x){var s=S.ideas[x.id];return s&&(s.due||0)<=now()})[0];
  var L=function(x){return x?{t:'line',op:x.op,i:x.i}:null},C=function(c){return c?{t:'card',id:c.id}:null};
  var seen=seenLines(),nq=seen.length>=3?seen[Math.floor(Math.random()*seen.length)]:null;
  var cl=curLesson(),pz=lessonItems(cl,3),rv=reviewPuz(1);pz=pz.concat(rv);
  /* second front: the current lesson of another unit (mates, combinations, endgames…), rotating by day */
  var ou=CURSO.units.filter(function(u){return u.id!==cl.unit}),u2=ou[(new Date().getDate()+(n||1))%ou.length],ls2=CURSO.lessons.filter(function(l){return l.unit===u2.id}),
      cl2=ls2.filter(function(l){return lessonProg(l).pct<.6})[0]||ls2[0],pz2=lessonItems(cl2,1);
  var grab=function(arr){var x=arr.shift();if(x&&x.t==='theory'){var y=arr.shift();return y?[x,y]:[x]}return x?[x]:[]};
  var P=function(i){return pz[i]||null};
  var vis=['game','flash','defend','rush'],basics=['coord','nota','sqname'],dd=new Date().getDate(),dr=vis[(dd+n-1)%4];
  var weak=coachStats().weak,wk=weak?weak.k:'',extra=wk==='aMine'?C(mine[3]):wk==='aPuz'?(reviewPuz(2)[1]?reviewPuz(2)[1]:null):wk==='aLine'?L(pickL[1]):wk==='aDrill'?{t:'drill',f:vis[(dd+n+1)%4]}:null;
  var qz=QUIZ.filter(function(q){var s=S.quiz[q.id];return !s||(s.due||0)<=now()})[0];
  var cs=curStrat(),pl=cs?stratItems(cs.id,1):[];var vq=VOCAB.filter(function(q){var s=S.quiz[q.id];return !s||(s.due||0)<=now()})[0];
  /* a bit of everything, never more than ~10 minutes: mini-drills of 2-5 positions + openings + his mistakes + punish + one concept.
     Trimmed from the end (least important last) using his own timings. */
  var o=(n-1)*2,rot=[qz?{t:'quiz',id:qz.id}:null,pl[0],vq?{t:'quiz',id:vq.id}:null,nq?{t:'name',op:nq.op,i:nq.i}:null,idea?{t:'idea',id:idea.id}:null].filter(Boolean),r1=rot[(dd+n)%Math.max(1,rot.length)]||null;
  var speed=(dd+n)%2?{t:'drill',f:'flash',n:3}:{t:'drill',f:'rush',n:3};
  var pzA=pz.slice(),g1=grab(pzA),g2=grab(pz2);
  /* Nov 19 review of his games (341 since Oct 1): simple one-move blunders went down (25% -> 17% of blunders), but 70% of what is left
     are 2-3-move tactics, mostly with checks, made with 5+ minutes on the clock, and 1/3 of losses are on time. His opening scores are fine
     and he gets 100% of lines and 90% of puzzles right. So the daily is now: calculation first, the opponent's checks (Defense),
     punish cards (forcing lines for him; the biggest backlog), Game mode, his own mistakes; openings and concepts only every other day.
     Coordinates/notation/flash are dropped from the daily (he has them; still in Aprender). Weak themes stay on the weak-spots screen. */
  var po=(n-1)*2;
  /* Nov 19: he wants the notation drill back in the daily ("it's good for me, I like it"): notation every day + coordinates or square names
     rotating; the course lesson puzzle moved to its own home button (courseItems) */
  var bas=dd%2?'coord':'sqname';
  /* Nov 25 ("the daily and the weak spots have the same exercises, calculation and all that — it's doing the same thing twice"):
     one simple rule. DAILY = only YOUR chess: your games (mistakes, punish, good moves, winning positions) and your openings.
     WEAK SPOTS = only NEW positions from the puzzle bank (calculation, Game mode, Defense, counting, judging, pins, sacrifices, themes). */
  if(wk==='aDrill')extra=null;
  var cvf=dd%2?'convfast':'conv',cvi=window.CONV?[S.seenLesson.f_conv?null:{t:'ftheory',f:'conv'},{t:'drill',f:cvf,n:2}]:[];
  var it=[{t:'drill',f:'nota',n:3},C(pun[po])].concat(opunPick(2),lposItems(['london','caro','slav'][dd%3],null,3),oqPick(['london','caro','slav'][dd%3],1),[window.GOOD&&GOOD.length?{t:'drill',f:'mygames',n:3}:null,C(mine[o])],cvi,[C(pun[po+1]),   /* Nov 20: coordinates/square names dropped — calc, trade, judge and notation already read squares in notation */
      dd%2?L(pickL[n>1?1:0]||pickL[0]):r1,C(mine[o+1]),C(pun[po+2]),extra]).filter(Boolean);   /* Nov 23: + 2 'punish in the opening' moments from his lines */
  while(it.length>5&&estSec(it)>720)it.splice(it.length-1,1);
  while(it.length&&it[it.length-1].t==='theory')it.pop();
  S.daily={v:23,date:today(),items:it,idx:0,ok:0,done:false,n:n};save();
}
/* how long things take him: median of his last logged times per type, defaults otherwise */
var EST={lpos:20,opun:30,drill:75,line:80,puz:60,card:90,plan:60,quiz:25,idea:60,name:25,theory:40,ftheory:40,stheory:40,play:150};
function estOne(it){
  var med=function(a){a=a.slice(-15).map(function(e){return Math.min(240,e[3])}).sort(function(x,y){return x-y});return a[Math.floor(a.length/2)]};
  var full=(S.log||[]).filter(function(e){return e[4]===1});
  if(it.t==='drill'){var key=it.f+':'+(it.n||0),d=full.filter(function(e){return e[5]===key});if(d.length>=2)return med(d);
    var per={trade:40,convfast:20,conv:30,judge:40,calc:55,game:25,defend:22,flash:15,rush:12,coord:5,sqname:5,nota:10}[it.f]||8;return 10+per*(it.n||8)}
  var a=full.filter(function(e){return e[1]===it.t});
  return a.length>=4?med(a):(EST[it.t]||60);
}
function estSec(items){return items.reduce(function(a,x){return a+estOne(x)},0)}
function dailyNow(){if(!S.daily||S.daily.date!==today()||((S.daily.v||0)<23&&!S.daily.idx&&!S.daily.done))buildToday();return S.daily}

/* ---------- routing / screens ---------- */
var SCREENS=['home','train','rep','learn','progress','data','weak'],LISTS={mine:1,punish:1},TABS={weak:'weakScrT',home:'navToday',rep:'navRep',learn:'navLearn',progress:'navProg',data:'tData'};
function route(){
  var h=(location.hash||'#home').slice(1).split('/');var s=h[0];if(SCREENS.indexOf(s)<0)s='home';
  if(s==='train'&&!X.items.length)s='home';
  if(s!=='train')stopTimers();
  if(LISTS[s]){quickSession(s);return}
  SCREENS.forEach(function(x){$('s-'+x).hidden=x!==s});
  $('tabbar').hidden=s==='train';$('bClose').hidden=s!=='train'&&s!=='data'&&s!=='weak';$('bSite').hidden=!$('bClose').hidden;
  $('topTitle').textContent=s==='train'?'':s==='home'?t('title'):t(TABS[s]);
  document.querySelectorAll('#tabbar button').forEach(function(b){if(b.getAttribute('data-tab')===s)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  if(s==='home')renderHome();if(s==='rep')renderRep(h[1]);if(s==='learn')renderLearn();if(s==='progress')renderProgress();
  if(s==='data')renderData();if(s==='weak')renderWeakScr();if(s==='train')renderItem();
  window.scrollTo(0,0);
}
function go(s){if(location.hash==='#'+s)route();else location.hash=s}
window.addEventListener('hashchange',route);
$('bClose').onclick=function(){if(location.hash==='#data'){go('progress');return}if(location.hash==='#weak'){go('home');return}closeItemTime();stopTimers();go(X.back||'home')};
document.querySelectorAll('#tabbar button').forEach(function(b){b.onclick=function(){go(b.getAttribute('data-tab'))}});
function rerender(){route()}

/* ---------- critical fixes: the few kinds of mistakes that cost him the most games lately ---------- */
/* each own-mistake card gets the idea behind it (same teacher logic as the explanations), grouped into themes */
var THEMES={hang:{k:['hanging','leftdef','material','badtrade'],ls:['hanging','defender']},forkd:{k:['fork'],ls:['fork']},lines:{k:['pin','skewer','discovered'],ls:['pin','skewer','discovered']},
  matek:{k:['mate','backrank','king'],ls:['backrank','mate1']},missfree:{k:['w:free'],ls:['hanging']},misstac:{k:['w:fork','w:pin','w:skewer','w:discovered','w:material'],ls:['fork','pin']},missmate:{k:['w:mate','w:backrank'],ls:['mate1','mate2']}};
function cardTheme(c){
  if(c.th!==undefined)return c.th;var th=null;
  try{var b=new Chess();(c.line||[]).forEach(function(m){b.move(m,{sloppy:true})});var f=b.fen(),o=null;
    if(visOf(c)==='win'){o=teachWin(f,c.pvBest&&c.pvBest.length?c.pvBest:[c.best],c.side);if(o)o='w:'+o.k}
    else{o=teachBad(f,c.played,c.pvBad,c.side);if(o)o=o.k}
    Object.keys(THEMES).forEach(function(k){if(o&&THEMES[k].k.indexOf(o)>=0)th=k})}catch(e){}
  return c.th=th;
}
function gameDate(id){var g=S.games[id];return g&&g.date||0}
function criticalThemes(){
  /* only mistakes from the last 30 days of games; a theme shows while some of those are still unsolved (last try wrong or never tried) */
  var t30=now()/1000-30*86400,by={};
  cardsOf('mine').forEach(function(c){var th=cardTheme(c);if(!th)return;var n=0,seen={};(c.games||[]).forEach(function(g){if(!g||seen[g])return;seen[g]=1;if((gameDate(g)||c.date||0)>=t30)n++});if(!n)return;
    var o=by[th]||(by[th]={id:th,pool:[],recent:0});o.pool.push(c);o.recent+=n});
  return Object.keys(by).map(function(k){var o=by[k];o.todo=o.pool.filter(function(c){return c.last!==1}).length;return o})
    .filter(function(o){return o.todo>0}).sort(function(a,b){return b.recent-a.recent||b.todo-a.todo}).slice(0,3);
}
function critSession(o){
  var cs=o.pool.filter(function(c){return c.last!==1}).sort(function(a,b){return ((a.due||0)<=now()?0:1)-((b.due||0)<=now()?0:1)||(b.date||0)-(a.date||0)}).slice(0,8);
  if(cs.length<8)cs=cs.concat(o.pool.filter(function(c){return cs.indexOf(c)<0}).slice(0,8-cs.length));
  var it=cs.map(function(c){return {t:'card',id:c.id}});
  S.crit=S.crit||{};S.crit[o.id]=Object.assign(S.crit[o.id]||{},{lastRun:now()});save();
  startSession(it,'mine');X.back='home';
}
/* ---------- Weak spots (Nov 17): its own screen and its own big bank (debiles.js, ~2,400 Lichess puzzles in his weak themes,
   none of them in the course). Daily practice = keep sharp (openings, reviews, course, Game mode); weak spots = calculation + the themes
   his own mistakes show, ranked. Everything shares state: a card or puzzle solved anywhere (S.cards / S.puz by id) counts everywhere. ---------- */
var WK=['calc','hang','forkd','lines','matek'],WALIAS={missfree:'hang',misstac:'forkd',missmate:'matek'},WEAKL={};
(function(){if(!window.WEAKDB)return;Object.keys(WEAKDB).forEach(function(k){WEAKL[k]={id:'w_'+k,weak:k,t:{es:'',en:''},body:{es:[],en:[]},
  p:WEAKDB[k].map(function(r){return {id:r[0],fen:r[1],m:r[2].split(' '),r:r[3]}})}})})();
function weakL(k){var l=WEAKL[k];if(!l)return null;if(/^d_/.test(k)){var src={d_mate1:'mate1',d_hang:'hanging',d_fork:'fork',d_back:'backrank',d_mate2:'mate2'}[k],cl=CURSO.lessons.filter(function(x){return x.id===src})[0];if(cl){l.t=cl.t;l.body=cl.body}return l}l.t={es:TXT.es['wt_'+k],en:TXT.en['wt_'+k]};l.body={es:[TXT.es['wb_'+k]],en:[TXT.en['wb_'+k]]};return l}
function cardWk(c){var th=cardTheme(c);return th?(WALIAS[th]||th):null}
function weakCards(k){return cardsOf('mine').filter(function(c){return cardWk(c)===k})}
function weakAll(k){return judgeCards().filter(function(c){return cardWk(c)===k})}
function weakRank(){
  var t30=now()/1000-30*86400,sc={};WK.forEach(function(k){sc[k]=0});
  judgeCards().forEach(function(c){var k=cardWk(c);if(!k||sc[k]==null)return;sc[k]+=((c.date||0)>=t30?3:1)});
  var to=Object.keys(S.games).map(function(k){return S.games[k]}).filter(function(g){return (g.date||0)>=t30&&g.r==='L'&&g.how==='timeout'}).length;
  sc.calc=Math.max(sc.calc,to*3+1);   /* slow calculation shows up as losses on time */
  return WK.slice().sort(function(a,b){return sc[b]-sc[a]}).map(function(k){return {k:k,score:sc[k],timeouts:k==='calc'?to:0}});
}
function weakProg(k){var l=WEAKL[k],n=l?l.p.length:0,ok=l?l.p.filter(function(p){var s=S.puz[p.id];return s&&s.box>=1}).length:0,cs=k==='calc'?[]:weakAll(k),cf=cs.filter(function(c){return c.last===1}).length;
  return {n:n,ok:ok,cards:cs.length,cfix:cf}}
/* bank puzzles for a theme: due reviews first, then new ones near his level (target rating rises as he solves more of the theme) */
function weakPuz(k,max){var l=WEAKL[k];if(!l)return [];var pr=weakProg(k),tgt=1050+Math.min(400,pr.ok*4),cap=1550+Math.min(150,pr.ok);
  /* Nov 23 ("the same exercise over and over, I already know the answer"): bank puzzles are never repeated — only ones he has never seen */
  var sn=S.seen||{},due=[],fresh=l.p.filter(function(p){return !S.puz[p.id]&&!sn[p.id]&&p.r<=cap}).sort(function(a,b){return Math.abs(a.r-tgt)-Math.abs(b.r-tgt)+(Math.random()-.5)*120});
  return due.slice(0,Math.ceil(max/2)).concat(fresh).slice(0,max).sort(function(a,b){return a.r-b.r}).map(function(p){return {t:'puz',l:'w_'+k,id:p.id}})}
function weakCardItems(k,max){var sn=S.seen||{},rec=now()-20*36e5;return weakCards(k).filter(function(c){return (c.last!==1||(c.due||0)<=now())&&(c.due||0)<=now()+6*36e5&&(sn[c.id]||0)<rec}).sort(function(a,b){return (a.last===1?1:0)-(b.last===1?1:0)||Math.random()-.5}).slice(0,max).map(function(c){return {t:'card',id:c.id}})}
function weakTheme(k){
  if(k==='calc')return [S.seenLesson.f_calc?null:{t:'ftheory',f:'calc'},{t:'drill',f:'calc',n:6}].filter(Boolean);
  var c=[],p=weakPuz(k,10),o=[],i=0,j=0;while(i<c.length||j<p.length){if(j<p.length)o.push(p[j++]);if(j<p.length)o.push(p[j++]);if(i<c.length)o.push(c[i++])}return o}
/* Nov 22 ("similar exercises in the daily and in weak spots"): trade / Remata / Remata fast rotate in the daily (one per day);
   the weak-spots screen takes the other two, so the two screens never run the same drill on the same day */
function dayDrill(dd){var o=['trade','conv','convfast','conv'].filter(function(f){return f==='trade'?window.TRADES:window.CONV});return o.length?o[dd%o.length]:null}
function todayDrill(){return S.daily&&padKey(S.daily.date)===today()?(S.daily.items||[]).filter(function(x){return x.t==='drill'&&/^(trade|conv|convfast)$/.test(x.f)}).map(function(x){return x.f}):[]}
/* Nov 23 ("I don't take a pawn with my queen because it looks defended… but the defender is pinned to the king"):
   clavados.js = Lichess puzzles whose first move captures something whose defender cannot recapture because it is pinned */
function pindItems(n){return bankItems('pind',n)}
/* theory the first time, then never-seen puzzles of a bank (pind = pinned defender, sac = sacrifices) */
function bankItems(k,n){var o=[];if(!WEAKL[k])return o;if(!S.seenLesson['w_'+k])o.push({t:'theory',l:'w_'+k});return o.concat(weakPuz(k,n))}
function weakItems(){
  var R=weakRank().filter(function(x){return x.k!=='calc'}),a=R[0]&&R[0].k,b=R[1]&&R[1].k;
  /* Nov 24 ("the daily and the weak spots are basically the same routine"): two different jobs. DAILY = your games and openings
     (calc, notation, opening punish, your cards, Tus partidas, Defense, Game mode, a line). WEAK SPOTS = the special banks only:
     counting trades, finishing won games (with time and the no-time ladder), judging a move, pinned defenders, sacrifices, the top theme. */
  var it=[],dd=new Date().getDate(),ft=function(f){if(!S.seenLesson['f_'+f])it.push({t:'ftheory',f:f})};
  ft('calc');it.push({t:'drill',f:'calc',n:3});
  if(window.TRADES){ft('trade');it.push({t:'drill',f:'trade',n:3})}
  it.push({t:'drill',f:'game',n:3});
  ft('judge');it.push({t:'drill',f:'judge',n:3});
  var rot=[function(){it.push({t:'drill',f:'defend',n:2})},function(){it=it.concat(bankItems('pind',2))},function(){it=it.concat(bankItems('sac',2))}];rot[dd%3]();
  if(a)it=it.concat(weakPuz(a,3));if(b)it=it.concat(weakPuz(b,2));
  it=it.filter(Boolean);while(it.length>6&&estSec(it)>780)it.splice(it.length-1,1);
  return {items:it.filter(Boolean)};
}
function renderWeak(){
  var b=$('bWeak');if(!b)return;var R=weakRank();
  $('weakSub').textContent=t('weakJob');
  var top=R.filter(function(x){return x.k!=='calc'})[0],pr=top?weakProg(top.k):null;$('weakBar').style.width=(pr?Math.round(pr.ok/Math.max(1,pr.n)*100):0)+'%';
  b.onclick=function(){go('weak')};
}
/* ---------- Course (Nov 19, "something like weak spots, but to go through Aprender, which I don't usually open") ----------
   One button on home: ~10 items that walk through Aprender in order — the current course lesson (theory the first time + puzzles),
   one strategy position, every other day an endgame technique, and a concept (key idea or commentator word). Same S.puz / S.plan /
   S.tech / S.quiz state as everywhere, so what he solves here counts in Aprender and the other way round. */
/* Nov 20 ("the title says mate in 1 but I got other things"): ONE topic per course session. The course is a single ordered path —
   the course lessons in order, a strategy lesson after every 4 of them, the endgame techniques after the endgame lessons, and a key idea
   now and then — and each session is only the first unfinished step, named exactly on the button. */
function coursePath(){
  var out=[],st=STRAT.filter(function(x){return plansOf(x.id).length}),si=0,ii=0,k=0;
  CURSO.lessons.forEach(function(l){out.push({k:'l',l:l});k++;
    if(l.unit==='end'&&CURSO.lessons.filter(function(x){return x.unit==='end'}).slice(-1)[0]===l)CURSO.tech.forEach(function(x){out.push({k:'tech',x:x})});
    if(k%4===0&&si<st.length)out.push({k:'s',s:st[si++]});
    if(k%3===0&&ii<IDEAS.length)out.push({k:'idea',x:IDEAS[ii++]})});
  while(si<st.length)out.push({k:'s',s:st[si++]});while(ii<IDEAS.length)out.push({k:'idea',x:IDEAS[ii++]});
  return out}
function stepDone(p){if(p.k==='l')return lessonProg(p.l).pct>=.6;if(p.k==='s')return planProg(p.s.id).pct>=.6;if(p.k==='tech'){var s=S.tech[p.x.id];return !!(s&&s.box>=2)}var q=S.ideas[p.x.id];return !!(q&&q.box>=2)}
function curStep(){var P=coursePath();return P.filter(function(p){return !stepDone(p)})[0]||P[0]}
function stepName(p){return p.k==='l'?tt(p.l.t):p.k==='s'?tt(p.s.t):p.k==='tech'?tt(p.x.t):tt(p.x.t)}
function stepProg(p){if(p.k==='l'){var q=lessonProg(p.l);return [q.ok,q.n]}if(p.k==='s'){var r=planProg(p.s.id);return [r.ok,r.n]}return [stepDone(p)?1:0,1]}
function courseProg(){var P=coursePath();return {ok:P.filter(stepDone).length,n:P.length}}
function courseItems(){var p=curStep();
  if(p.k==='l')return lessonItems(p.l,6);
  if(p.k==='s'){var it=stratItems(p.s.id,5);return it.length?it:plansOf(p.s.id).slice(0,5).map(function(_,k){return {t:'plan',s:p.s.id,k:k}})}
  if(p.k==='tech')return [{t:'play',id:p.x.id}];
  return [{t:'idea',id:p.x.id}];
}
function renderCourse(){var b=$('bCourse');if(!b)return;var p=curStep(),pr=stepProg(p),cp=courseProg(),kind=t('ck_'+p.k);
  $('courseSub').textContent=t('courseSub2',kind,stepName(p),pr[0],pr[1],cp.ok,cp.n);$('courseBar').style.width=Math.round(cp.ok/Math.max(1,cp.n)*100)+'%';
  b.onclick=function(){startSession(courseItems(),'learn');X.back='home'};
}
function renderWeakScr(){
  var el=$('weakList');if(!el)return;var R=weakRank();
  $('bWeakGo').onclick=function(){startSession(weakItems().items,'weak')};
  var js=S.drill.judge,cs=S.drill.conv,thrown=(window.CONV||[]).filter(function(r){return r[4]}).length,ts=S.drill.trade;el.innerHTML=(window.TRADES?'<button class="crow critrow" id="bTrade" type="button"><span class="ci">⚖</span><span class="ct"><b>'+t('trT')+'</b><small>'+t('trRow')+(ts&&ts.tot?' · '+t('jTot',ts.tot):'')+'</small></span><span class="go">›</span></button>':'')+'<button class="crow critrow" id="bJudge" type="button"><span class="ci">🤔</span><span class="ct"><b>'+t('jT')+'</b><small>'+t('jRow')+(js&&js.tot?' · '+t('jTot',js.tot):'')+'</small></span><span class="go">›</span></button>'+(WEAKL.sac?(function(){var pr=weakProg('sac');return '<button class="crow critrow" id="bSac" type="button"><span class="ci">💥</span><span class="ct"><b>'+t('wt_sac')+'</b><small>'+t('sacRow',pr.ok,pr.n)+'</small></span><span class="go">›</span></button>'})():'')+(WEAKL.pind?(function(){var pr=weakProg('pind');return '<button class="crow critrow" id="bPind" type="button"><span class="ci">📌</span><span class="ct"><b>'+t('wt_pind')+'</b><small>'+t('pindRow',pr.ok,pr.n)+'</small></span><span class="go">›</span></button>'})():'')+R.map(function(o,i){var k=o.k,pr=weakProg(k),sub,pct;
    if(k==='calc'){var ct=calcTrend();sub=t('calcLvl',calcLvl())+(ct?' · '+t('calcAvg',ct.last):'')+(o.timeouts?' · '+t('wTimeouts',o.timeouts):'');pct=(calcLvl()-1)/4*100}
    else{sub=t('wSub',pr.cards,pr.ok,pr.n);pct=Math.round(pr.ok/Math.max(1,pr.n)*100)}
    return '<button class="crow critrow" data-wk="'+k+'" type="button"><span class="ci">'+(i+1)+'</span><span class="ct"><b>'+esc(t('wt_'+k))+'</b><small>'+sub+'</small><span class="bar2"><span style="width:'+pct+'%"></span></span></span><span class="go">›</span></button>'}).join('');
  if($('bTrade'))$('bTrade').onclick=function(){startSession([S.seenLesson.f_trade?null:{t:'ftheory',f:'trade'},{t:'drill',f:'trade',n:8}].filter(Boolean),'weak')};
  if($('bConvF'))$('bConvF').onclick=function(){startSession([{t:'drill',f:'convfast',n:8}],'weak')};
  if($('bConv'))$('bConv').onclick=function(){startSession([S.seenLesson.f_conv?null:{t:'ftheory',f:'conv'},{t:'drill',f:'conv',n:8}].filter(Boolean),'weak')};
  if($('bMyG'))$('bMyG').onclick=function(){startSession([{t:'drill',f:'mygames',n:8}],'weak')};
  if($('bSac'))$('bSac').onclick=function(){startSession(bankItems('sac',10),'weak')};
  if($('bPind'))$('bPind').onclick=function(){startSession(pindItems(10),'weak')};
  $('bJudge').onclick=function(){startSession([S.seenLesson.f_judge?null:{t:'ftheory',f:'judge'},{t:'drill',f:'judge',n:8}].filter(Boolean),'weak')};
  el.querySelectorAll('[data-wk]').forEach(function(x){x.onclick=function(){var k=x.getAttribute('data-wk');startSession(weakTheme(k),'weak')}});
}
function renderCrit(){
  var el=$('crit');if(!el)return;var L=criticalThemes();if(!L.length){el.innerHTML='';el.hidden=true;return}el.hidden=false;
  el.innerHTML='<div class="chead"><b>🚨 '+t('critT')+'</b><span class="small">'+t('critSub')+'</span></div>'+L.map(function(o,i){var n=o.pool.length,f=o.pool.filter(function(c){return c.last===1}).length,pct=Math.round(f/Math.max(1,n)*100);
    return '<button class="crow critrow" data-ci="'+i+'" type="button"><span class="ci">'+['1','2','3'][i]+'</span><span class="ct"><b>'+esc(t('th_'+o.id))+'</b><small>'+t('critStat',o.recent,f,n)+'</small><span class="bar2"><span style="width:'+pct+'%"></span></span></span><span class="go">›</span></button>'}).join('');
  el.querySelectorAll('[data-ci]').forEach(function(b){b.onclick=function(){critSession(L[+b.getAttribute('data-ci')])}});
}
function renderHome(){
  try{renderWeak()}catch(e){}
  try{renderCourse()}catch(e){}
  var d=dailyNow(),n=d.items.length;
  var sn=d.n||1;$('hToday').textContent=sn>1?t('todayExtra'):t('today');
  $('hTodaySub').textContent=d.done?t(sn>1?'todayDone2':'todayDone'):(sn>1?t('todayExtraSub')+' ':'')+t('todaySub',n,Math.max(3,Math.round(estSec(d.items.slice(d.idx||0))/60)));
  $('hTodayBar').style.width=(d.idx/n*100)+'%';
  $('bToday').textContent=d.done?t('todaySecond'):d.idx>0?t('todayCont',d.idx,n):t('todayStart');
  syncStreak();$('hStreak').textContent=S.streak.n>0?'🔥 '+t(S.streak.n===1?'streak1':'streak',S.streak.n):'';
  var cm=counts('mine'),cp=counts('punish');
  $('tMineN').innerHTML=fmtCount('mine');$('tPunN').innerHTML=fmtCount('punish');
  if(!running&&!$('syncStatus').textContent)$('syncStatus').textContent=S.lastSync?t('lastSync',new Date(S.lastSync).toLocaleDateString(LANG)):t('syncHint');
}
function hintsUI(){var c=$('optHints');if(!c)return;c.checked=HINTS;c.onchange=function(){HINTS=c.checked;try{localStorage.setItem('taller-aperturas.hints',HINTS?'1':'0')}catch(e){}}}
/* coach: last-game review, weekly rhythm, weakest area */
function lastGameCards(){
  var gs=Object.keys(S.games).map(function(k){return S.games[k]}).sort(function(a,b){return (b.date||0)-(a.date||0)}).slice(0,8),by={};
  Object.keys(S.cards).forEach(function(k){var c=S.cards[k];if(!usable(c)||((c.reps||0)>0&&(c.due||0)>now()))return;(c.games||[]).forEach(function(g){(by[g]=by[g]||[]).push(c)})});
  for(var i=0;i<gs.length;i++){var cs=by[gs[i].id];if(cs&&cs.length)return {g:gs[i],cards:cs.sort(function(a,b){return (a.kind==='mine'?0:1)-(b.kind==='mine'?0:1)||a.line.length-b.line.length})}}
  return null;
}
var AREA={card:['mine','aMine'],line:['rep','aLine'],puz:['learn','aPuz'],plan:['learn','aPlan'],quiz:['learn','aQuiz'],idea:['learn','aIdea'],drill:['learn','aDrill'],name:['rep','aLine'],play:['learn','aPlay']};
function coachStats(){
  var lg=S.log||[],t0=now()-14*864e5,days={},by={},wk=now()-7*864e5;
  lg.forEach(function(e){if(e[0]>=wk)days[new Date(e[0]).toDateString()]=1;if(e[0]<t0||!AREA[e[1]])return;var k=AREA[e[1]][1];by[k]=by[k]||{n:0,ok:0,go:AREA[e[1]][0]};by[k].n++;by[k].ok+=e[2]});
  var weak=null;Object.keys(by).forEach(function(k){var x=by[k];if(x.n<6)return;x.p=Math.round(x.ok/x.n*100);x.k=k;if(!weak||x.p<weak.p)weak=x});
  var tO=[],tB=[];lg.forEach(function(e){if(e[0]>=t0&&e[3]!=null&&(e[1]==='puz'||e[1]==='card'))(e[2]?tO:tB).push(e[3])});
  var avg=function(a){return a.reduce(function(x,y){return x+y},0)/a.length},fast=null;
  if(tO.length>=5&&tB.length>=5&&avg(tB)<avg(tO)*.7)fast={bad:Math.round(avg(tB)),ok:Math.round(avg(tO))};
  return {days:Object.keys(days).length,weak:weak&&weak.p<75?weak:null,fast:fast};
}
function renderCoach(){
  var el=$('coach');if(!el)return;var cs=coachStats(),lg=lastGameCards(),trained={};
  (S.log||[]).forEach(function(e){trained[dkey(new Date(e[0]))]=1});
  var L=LANG==='es'?'DLMXJVS':'SMTWTFS',dots='',n=0;
  for(var k=6;k>=0;k--){var d=new Date();d.setDate(d.getDate()-k);var on=trained[dkey(d)];if(on)n++;
    dots+='<span class="wd'+(on?' on':'')+(k===0?' today':'')+'"><i></i>'+L[d.getDay()]+'</span>'}
  var h='<div class="chead"><b>'+t('coachT')+'</b><span class="small">'+t('coachWeek',n)+'</span></div><div class="week">'+dots+'</div>';
  if(lg){var g=lg.g,opp=g.side==='w'?g.black:g.white,res=t(g.r==='W'?'resW':g.r==='L'?'resL':'resD');
    h+='<button class="crow" id="bCoachLast" type="button"><span class="ci">♟</span><span class="ct"><b>'+t('coachLastT')+'</b><small>'+t('coachLastS',esc(opp),res,lg.cards.length)+'</small></span><span class="go">›</span></button>'}
  var g0=Object.keys(S.games).map(function(k){return S.games[k]}).sort(function(a,b){return (b.date||0)-(a.date||0)})[0];
  if(g0&&(!lg||lg.g.id!==g0.id)){var o0=g0.side==='w'?g0.black:g0.white,r0=t(g0.r==='W'?'resW':g0.r==='L'?'resL':'resD');
    if(S.pend&&S.pend[g0.id])h+='<div class="crow"><span class="ci">⏳</span><span class="ct"><b>'+t('coachPendT')+'</b><small>'+t('coachLastS0',esc(o0),r0)+'</small></span></div>';
    else if(g0.r==='L')h+='<a class="crow" href="'+esc(g0.id)+'" target="_blank" rel="noopener"><span class="ci">♟</span><span class="ct"><b>'+t('coachNoErrT')+'</b><small>'+t('coachLastS0',esc(o0),r0)+' · '+t('coachNoErrS')+'</small></span><span class="go">›</span></a>'}
  var rpt=cardsOf('mine').filter(function(c){return (c.count||1)>=2&&(c.due||0)<=now()}).sort(function(a,b){return (b.again||b.date||0)-(a.again||a.date||0)});
  if(rpt.length)h+='<button class="crow" id="bCoachRep" type="button"><span class="ci">🔁</span><span class="ct"><b>'+t('coachRepT',rpt.length)+'</b><small>'+t('coachRepS')+'</small></span><span class="go">›</span></button>';
  if(cs.weak)h+='<button class="crow" id="bCoachWeak" type="button"><span class="ci">🎯</span><span class="ct"><b>'+t('coachWeakT',t(cs.weak.k))+'</b><small>'+t('coachWeakS',cs.weak.ok,cs.weak.n)+'</small></span><span class="go">›</span></button>';
  var ct=calcTrend();h+='<button class="crow" id="bCoachCalc" type="button"><span class="ci">🧮</span><span class="ct"><b>'+t('calcT')+' · '+t('calcLvl',calcLvl())+'</b><small>'+(ct?(ct.days>1&&ct.first!==ct.last?t('coachCalc',ct.lvl,ct.last,ct.first):t('coachCalc1',ct.lvl,ct.last)).replace(/^🧮 /,''):t('calcFrozen'))+'</small></span><span class="go">›</span></button>';
  if(cs.fast)h+='<div class="ctip">⏱ '+t('coachFastS',cs.fast.bad,cs.fast.ok)+'</div>';
  el.innerHTML=h;
  if($('bCoachWeak'))$('bCoachWeak').onclick=function(){var g=cs.weak.go;if(LISTS[g])quickSession(g);else go(g)};
  if($('bCoachCalc'))$('bCoachCalc').onclick=function(){startSession([S.seenLesson.f_calc?null:{t:'ftheory',f:'calc'},{t:'drill',f:'calc',n:5}].filter(Boolean),'calc');X.back='home'};
  if($('bCoachRep'))$('bCoachRep').onclick=function(){startSession(rpt.slice(0,10).map(function(c){return {t:'card',id:c.id}}),'mine');X.back='home'};
  if($('bCoachLast'))$('bCoachLast').onclick=function(){startSession(lg.cards.slice(0,10).map(function(c){return {t:'card',id:c.id}}),'mine');X.back='home'};
}
/* Nov 20: the tile shows what the session really contains — left to master out of the whole list (it used to show only today's due cards) */
/* Nov 25 ("it says 4 of 49 — do I have 4 or 49? then it says 1/48 and gives me problems that are not my mistakes"): the tile shows ONE number —
   his own cards to solve right now — and the session is exactly those cards (no bank puzzles after them). Cards he got wrong today come
   back tomorrow ("+N mañana"); when nothing is left to solve, due reviews of solved cards; else "al día". */
function tileState(kind){var sn=S.seen||{},rec=now()-20*36e5,cs=cardsOf(kind),fresh=function(c){return (sn[c.id]||0)<rec};
  var todo=cs.filter(function(c){return c.last!==1}),nowL=cardQueue(kind).filter(function(c){return c.last!==1}),
      rev=cardQueue(kind).filter(function(c){return c.last===1});
  return {now:nowL,later:todo.length-nowL.length,rev:rev}}
function fmtCount(kind){var es=LANG==='es',st=tileState(kind);
  if(st.now.length)return '<strong>'+st.now.length+'</strong>'+(es?'por resolver':'to solve')+(st.later?'<small>+'+st.later+(es?' mañana':' tomorrow')+'</small>':'');
  if(st.rev.length)return '<strong>'+st.rev.length+'</strong>'+(es?'para repasar':'to review');
  return '<strong>✓</strong>'+(es?'al día':'all done')+(st.later?'<small>'+st.later+(es?' vuelven mañana':' back tomorrow')+'</small>':'')}
$('bToday').onclick=function(){
  var d=dailyNow();if(d.done){buildToday((d.n||1)+1);d=S.daily}
  startSession(d.items,'today',d.idx);
};
document.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){var g=b.getAttribute('data-go');if(LISTS[g])quickSession(g);else go(g)}});

/* ---------- session runner ---------- */
var X={items:[],i:0,src:'',ok:0,back:'home'};
var cur=null,timers=[];
function later(f,ms){var id=setTimeout(f,ms);timers.push(id);return id}
function stopTimers(){if(typeof stopBar==='function')stopBar();timers.forEach(clearTimeout);timers=[]}
function startSession(items,src,from){X.endless=false;X.snap=progSnap();X.items=items.slice();X.i=from||0;X.src=src;X.ok=0;X.back=src==='today'?'home':src==='ideas'?'learn':src.split(':')[0];cur=null;go('train')}
/* when he leaves an exercise, store the whole time spent on it (answer + reading), so the daily plan fits his real pace */
function closeItemTime(){if(cur&&cur.logI!=null&&S.log&&S.log[cur.logI]&&cur.t0){S.log[cur.logI][3]=Math.min(300,Math.round((now()-cur.t0)/1000));S.log[cur.logI][4]=1;cur.logI=null;save()}}
/* Nov 25 ("I don't want to scroll… use the space"): on theory screens (text + example board) the board shrinks so text, board,
   example caption and the Next button all fit on the phone screen. Exercises keep a fixed board size (no jumping). */
function fitIntro(){if(innerWidth>979||!cur||!cur.it||!/theory$/.test(cur.it.t))return;var bw=$('boardwrap');if(!bw||bw.hidden)return;
  var top=bw.getBoundingClientRect().top+scrollY,avail=innerHeight-top-150,w=bw.getBoundingClientRect().width;
  if(avail<w)bw.style.setProperty('max-width',Math.max(200,Math.round(avail))+'px','important')}
function renderItem(){
  if(PEEK)peekOff();closeItemTime();stopTimers();dclkStop();window.scrollTo(0,0);anOff();$('demoBar').hidden=true;boardEl.classList.remove('nopieces');
  if(X.i>=X.items.length){endSession();return}
  $('boardwrap').style.removeProperty('max-width');setTimeout(fitIntro,80);$('s-train').classList.remove('msgonly');
  $('trBody').classList.remove('answered');  var it=X.items[X.i];cur={it:it,answered:false,first:true,t0:now()};$('bPrevEx').disabled=X.i===0;
  $('trCount').textContent=(X.i+1)+'/'+X.items.length;$('trProg').style.width=(X.i/X.items.length*100)+'%';
  ['fb','why','choices','note'].forEach(function(id){$(id).innerHTML='';$(id).className=id==='fb'?'feedback':id;$(id).hidden=id!=='fb'});
  $('line').textContent='';$('trEnd').hidden=true;$('trBody').hidden=false;$('boardwrap').hidden=false;$('choices').classList.remove('grid');boardEl.classList.remove('nocoords');B.onMove=null;
  if(X.past===X.i&&X.revs&&X.revs[X.i]&&X.revs[X.i].length){X.past=null;cur.revs=X.revs[X.i];cur.past=true;cur.answered=true;setBtns({});showRev(cur.revs.length-1);return}
  if(it.t==='card'){var c=S.cards[it.id];if(!c){skip();return}cur.card=c;loadCard(c)}
  else if(it.t==='line'){if(!REP[it.op]||!REP[it.op].lines[it.i]||REP[it.op].lines[it.i].off){skip();return}if(it.watch)watchLine(it.op,it.i);else loadLine(it.op,it.i)}
  else if(it.t==='msg'&&(it.k==='noMine'||it.k==='noPun')){
    /* Nov 25 (his screenshot: a 'nothing left' notice dressed as a session, with an empty bar, 1/1, Anterior, Terminar and Siguiente):
       a plain card — the message, a button to the OTHER tile when it has cards to solve, and Volver */
    $('s-train').classList.add('msgonly');$('boardwrap').hidden=true;var oth=it.k==='noMine'?'punish':'mine',os=tileState(oth),on=os.now.length||os.rev.length;
    $('prompt').innerHTML='<div class="bigq">'+t(it.k+'T')+'</div><p class="lend">'+t(it.k+'D',esc(it.n||''))+'</p><div class="row msgbtns">'+
      (on?'<button class="btn primary" id="bMsgOther" type="button">'+(oth==='punish'?'⚔️ ':'🎯 ')+t(oth==='punish'?'tPun':'tMine')+': '+on+' '+t(os.now.length?'toSolve':'toReview')+' ▶</button>':'')+
      '<button class="btn" id="bMsgBack" type="button">'+t('backHome')+'</button></div>';
    cur.answered=true;setBtns({});
    if($('bMsgOther'))$('bMsgOther').onclick=function(){$('s-train').classList.remove('msgonly');quickSession(oth)};
    $('bMsgBack').onclick=function(){$('s-train').classList.remove('msgonly');X.items=[];go('home')}}
  else if(it.t==='msg'){$('boardwrap').hidden=true;$('prompt').innerHTML='<div class="bigq">'+t(it.k+'T')+'</div><p class="lend">'+t(it.k+'D',esc(it.n||''))+'</p>';cur.answered=true;setBtns({next:true})}
  else if(it.t==='lpos'){if(!REP[it.op]||!REP[it.op].lines[it.i]){skip();return}loadLPos(it.op,it.i,it.ply)}
  else if(it.t==='opun'){if(!REP[it.op]||!REP[it.op].lines[it.i]||typeof REP[it.op].lines[it.i].key!=='number'){skip();return}loadOPun(it.op,it.i)}
  else if(it.t==='name'){if(!REP[it.op]||!REP[it.op].lines[it.i]){skip();return}loadName(it.op,it.i)}
  else if(it.t==='theory'){var lt=lessonById(it.l);if(!lt){skip();return}loadTheory(lt)}
  else if(it.t==='puz'){var lp=lessonById(it.l),pp=lp&&lp.p.filter(function(x){return x.id===it.id})[0];if(!pp){skip();return}loadPuz(lp,pp)}
  else if(it.t==='ftheory'){var ff=fundById(it.f);if(!ff){skip();return}loadFTheory(ff)}
  else if(it.t==='quiz'){var qq=quizById(it.id);if(!qq){skip();return}loadQuiz(qq)}
  else if(it.t==='drill'){if(it.f==='flash')loadFlash();else if(it.f==='rush')loadRush();else if(it.f==='defend')loadDefend();else if(it.f==='game'||it.f==='mygames')loadGame();else if(it.f==='calc')loadCalc();else if(it.f==='judge')loadJudge();else if(it.f==='conv'||it.f==='convfast')loadConv();else if(it.f==='trade')loadTrade();else loadDrill(it.f)}
  else if(it.t==='stheory'){var sx=stratById(it.s);if(!sx){skip();return}loadSTheory(sx)}
  else if(it.t==='plan'){loadPlan(it.s,it.k)}
  else if(it.t==='play'){var tx=techById(it.id);if(!tx){skip();return}loadPlay(tx)}
  else if(it.t==='oplan'){if(!REP[it.op]||!window.OPLAN||!OPLAN[it.op]){skip();return}loadOPlan(it.op,it.k)}
  else if(it.t==='idea'){var idea=IDEAS.filter(function(x){return x.id===it.id})[0];if(!idea){skip();return}loadIdea(idea)}
}
function skip(){X.i++;saveDaily();renderItem()}
function saveDaily(){if(X.src==='today'&&S.daily){S.daily.idx=X.i;if(X.i>=S.daily.items.length&&!S.daily.done){S.daily.done=true;
  S.days=S.days||{};S.days[S.daily.date||today()]=1;syncStreak()}save()}}
function itemDone(ok){
  $('trBody').classList.add('answered');cur.answered=true;B.locked=true;B.onTap=null;if(ok&&cur.first)X.ok++;
  if(cur.it.t!=='theory'){S.log=S.log||[];S.log.push([now(),cur.it.t,ok&&cur.first?1:0,Math.min(600,Math.round((now()-(cur.t0||now()))/1000)),0,cur.it.t==='drill'?cur.it.f+':'+(cur.it.n||0):'']);if(S.log.length>4000)S.log=S.log.slice(-4000);cur.logI=S.log.length-1;save()}
  if(X.src==='today'&&ok&&cur.first&&S.daily)S.daily.ok=(S.daily.ok||0)+1;
  if(X.endless&&ok&&cur.first&&X.ok>0&&X.ok%10===0)$('fb').insertAdjacentHTML('beforeend',' <span class="cheer">🎉 '+t('cheer10',X.ok)+'</span>');
  setBtns({next:true});
  if(cur.anPath){var p=cur.anPath();if(p){var arr=B.arrows;anSet(p.start,p.moves,p.i==null?p.moves.length:p.i,p.base);if(p.keepArrows){B.arrows=arr;drawBoard()}B.onMove=anMove}}
  $('bNext').focus({preventScroll:true});
}
/* Nov 23 ("I tap Next by mistake because the buttons move; and Previous shows a NEW set, not the position I just saw"):
   (1) every reviewed drill position is kept (cur.revs, X.revs per item) and ‹ Anterior steps back through them — same positions, with
   their solution — before going to the previous item; (2) a next-button ignores taps for 0.7 s after it appears (tapLock). */
function tapLock(el){if(!el)return;el.disabled=true;setTimeout(function(){el.disabled=false},700)}
function keepRevs(){if(cur&&cur.revs&&cur.revs.length&&cur.it&&cur.it.t==='drill'&&!cur.past){X.revs=X.revs||{};X.revs[X.i]=cur.revs}}
function showRev(i){var r=cur.revs[i];if(!r)return;cur.revI=i;dclkPause();cur.answered=true;anOff();$('trBody').classList.add('answered');
  setBoard(r.fen,r.flip);anSet(r.fen,r.moves,Math.min(1,r.moves.length),0);B.onMove=anMove;if(r.arrows&&r.arrows.length){B.arrows=r.arrows;drawBoard()}
  $('fb').className='feedback '+(r.ok?'good':'bad');$('fb').innerHTML='<span class="pill revp">'+t('revPast',i+1,cur.revs.length)+'</span> '+r.html;
  if(r.why){$('why').innerHTML='';showWhy([r.why])}else $('why').hidden=true;
  var last=i>=cur.revs.length-1,ch=$('choices');ch.hidden=false;ch.classList.remove('grid');
  ch.innerHTML='<button class="btn primary" id="bRevNext">'+(last&&!cur.past&&!cur.inPause?t('revBack'):t('flashNextR'))+'</button>';tapLock($('bRevNext'));
  $('bRevNext').onclick=function(){
    if(!last){showRev(i+1);return}
    if(cur.past){X.i++;saveDaily();renderItem();return}
    anOff();cur.answered=false;cur.revI=null;cur.inPause=false;$('trBody').classList.remove('answered');B.onMove=null;B.arrows=[];$('why').hidden=true;
    if(cur.revNext)cur.revNext();dclkResume()};
}
$('bPrevEx').onclick=function(){
  if(cur&&cur.revs&&cur.revs.length){var i=cur.revI!=null?cur.revI-1:cur.inPause?cur.revs.length-2:cur.revs.length-1;if(i>=0){showRev(i);return}}
  if(X.i>0){keepRevs();X.i--;if(X.items[X.i].t==='drill'&&X.revs&&X.revs[X.i])X.past=X.i;saveDaily();renderItem()}};
$('bNext').onclick=function(){keepRevs();X.i++;saveDaily();renderItem()};
function endSession(){closeItemTime();
  $('trBody').hidden=true;$('trEnd').hidden=false;$('trProg').style.width='100%';
  $('trEndT').textContent=X.items.length?t('sessDone'):t('sessEmpty');
  $('trEndS').textContent=X.items.length?t('sessSum',X.ok,X.items.length):'';
  if(X.src==='today'){saveDaily();$('trEndS').textContent+=S.streak.n?'  🔥 '+t(S.streak.n===1?'streak1':'streak',S.streak.n):''}
  $('trEndA').innerHTML=advTxt();
}
$('bEndHome').onclick=function(){go(X.back||'home')};
function setBtns(o){
  var map={hint:'bHint',show:'bShow',bad:'bBad',good:'bGood',next:'bNext',retry:'bRetry',scan:'bScan',yours:'bYours'};
  var wasHidden=$('bNext').hidden;Object.keys(map).forEach(function(k){$(map[k]).hidden=!o[k]});if(o.next&&wasHidden)tapLock($('bNext'));
}
function kindPill(k,extra){var m={mine:['kMine','mist'],punish:['kPun','good'],rep:['kRep','rep'],name:['kName','rep'],puz:['kPuz','idea'],trap:['kTrap','blun'],idea:['kIdea','idea']}[k];
  return '<span class="pill '+m[1]+'">'+t(m[0])+'</span>'+(extra?' <span class="small">'+extra+'</span>':'')}
function sideTxt(side){return ''}  /* the big badge above the board already says it */

/* the analysis bar's quick engine (about a second) can disagree with the deep check (depth 18) behind each card;
   seed the deep numbers so the best move / equally good moves are never called mistakes and the bar matches the explanation */
function seedDeep(c,fen){try{
  var v=c.kind==='mine'?c.s0:c.s1;if(v==null||!c.best)return;var w=toW(v,c.side);
  AN.ev[fen]={w:w,pv:(c.pvBest&&c.pvBest.length?c.pvBest:[c.best]).slice()};
  var after=function(san){var b=new Chess(fen);return b.move(san,{sloppy:true})?b.fen():null};
  var f1=after(c.best);if(f1){AN.ev[f1]={w:w,pv:(c.pvBest||[]).slice(1)};AN.good[f1]=1}
  (c.alts||[]).forEach(function(a){var f=after(a);if(f){AN.good[f]=1;if(!AN.ev[f])AN.ev[f]={w:w,pv:[]}}});
  if(c.kind==='mine'&&c.played&&c.s1!=null){var fp=after(c.played);if(fp&&fp!==f1)AN.ev[fp]={w:toW(c.s1,c.side),pv:(c.pvBad||[]).slice()}}
}catch(e){}}
/* card: own mistake or punish */
function loadCard(c){
  seenPuz(c.id);
  var fen=fenOf(c.line),prev=c.line.length?fenOf(c.line.slice(0,-1)):null;
  setBoard(fen,c.side==='b',c.line[c.line.length-1],prev);
  var ref=c.kind==='mine'?c.s0:c.s1;cur.fen=fen;cur.ref=ref;
  setBar(toW(ref,c.side),false);
  var head=kindPill(c.kind==='mine'?(c.trap?'trap':'mine'):'punish',sideTxt(c.side));
  if(c.kind==='punish'&&(c.s0||0)<=-150)head+=' <span class="pill come">'+t('kComeback')+'</span>';
  var p=c.kind==='mine'?(c.line.length?t('oppJust',esc(c.line[c.line.length-1]))+' ':'')+t('pMineFind'):t('pPun2',esc(c.oppMove));
  $('prompt').innerHTML='<div class="op">'+head+'</div>'+p;
  cur.anPath=function(){return {start:INIT,moves:c.line.concat(cur.okMove?[cur.okMove]:[]),i:c.line.length+(cur.okMove?1:0),base:c.line.length,keepArrows:true}};
  seedDeep(c,fen);
  anSet(INIT,c.line,c.line.length);B.onMove=onCardMove;
  setBtns({scan:true,hint:true,show:true});Engine.init();
}
function moveLine(line,n){var o='';n=n==null?line.length:n;for(var i=0;i<n;i++){if(i%2===0)o+=(i/2+1)+'. ';o+=esc(line[i])+' '}return o+(n%2===0?'':'…')}
function onCardMove(mv){
  var c=cur.card;if(cur.answered)return;B.locked=true;
  var col=c.side,fen0=cur.fen;
  if(mv.san===c.best){B.marks[mv.to]='ok';drawBoard();cardResult(true,mv.san,c.kind==='mine'?c.s0:c.s1,c.pvBest?c.pvBest.slice(1):null);return}
  if((c.alts||[]).indexOf(mv.san)>=0){B.marks[mv.to]='ok';drawBoard();cardResult(true,mv.san,cur.ref,null);return}
  if(c.kind==='mine'&&mv.san===c.played&&c.pvBad){B.marks[mv.to]='bad';drawBoard();cardResult(false,mv.san,c.s1,c.pvBad);return}
  $('fb').className='feedback';$('fb').textContent=t('checking',mv.san);
  analyse(B.chess.fen(),1800).then(function(r){
    if(!r){B.marks[mv.to]='bad';drawBoard();cardResult(false,mv.san,null,null);return}
    var s=-r.s,drop=wp(cur.ref)-wp(s);
    B.marks[mv.to]=drop<8?'ok':'bad';drawBoard();cardResult(drop<8,mv.san,s,r.pv);
  });
}
function cardResult(ok,san,sAfter,pvAfter){
  var c=cur.card,col=c.side,fen0=cur.fen,best=c.best;
  var first=!(c.reps>0);gradeObj(c,ok);
  if(ok&&first&&(c.box||0)<2){c.box=2;c.due=now()+DAYS[2]*864e5-36e5;save()}   /* Nov 25: right the first time = done for now (back in 3 days, after the new ones) */
  var drop=sAfter==null?30:Math.max(0,wp(cur.ref)-wp(sAfter));
  if(sAfter!=null)setBar(toW(sAfter,col));
  var msg=san==='—'?t('bestWas',esc(best)):ok?(san===best?t('correct','<span class="mono">'+esc(san)+'</span>'):t('alsoGood','<span class="mono">'+esc(san)+'</span>','<span class="mono">'+esc(best)+'</span>'))
    :(c.kind==='mine'&&san===c.played?t('wrongPlayed','<span class="mono">'+esc(san)+'</span>'):t('wrong','<span class="mono">'+esc(san)+'</span>'))+' '+t('bestWas',esc(best))+' '+t('again');
  $('fb').className='feedback '+(ok?'good':'bad');$('fb').innerHTML=(san==='—'?'':chip(san,drop,sAfter)+' ')+msg;
  if(ok&&san!=='—')cur.okMove=san;
  var ba=arrowFor(fen0,best,'#0E9488');B.arrows=ba&&(!ok||san!==best)?[ba]:[];
  /* why */
  var w=[],ply=c.line.length,bestPv=c.pvBest&&c.pvBest.length?c.pvBest:[best];
  if(c.kind==='mine'){
    var tb=visOf(c)==='win'?teachWin(fen0,bestPv,col):teachBad(fen0,c.played,c.pvBad,col);
    var box=visOf(c)==='win'?teachBox(tb,t('tMissed',sanH(c.played))):teachBox(tb);if(!box&&visOf(c)!=='win')box=teachBox(teachWin(fen0,bestPv,col),t('tMissed',sanH(c.played)));
    w.push(box||t('tNoIdea'));
    if(!ok&&san!=='—'&&san!==c.played&&pvAfter){var t2=teachBad(fen0,san,pvAfter,col);if(t2)w.push('<b>'+t('tYours',sanH(san))+'</b>'+teachBox(t2))}
    var th=c.threat&&c.threat.pv&&c.threat.pv.length?explainBest(fen0,best,null,c.s0,col,c.threat,c.s0)[0]:null;if(th&&/threat|amenaza/i.test(th))w.push(th);
    if(c.pvBad&&visOf(c)!=='win')w.push(fold(t('stIf',esc(c.played)),story(fen0,[c.played].concat(c.pvBad),col,4)));
    w.push(fold(t('stBest',esc(best)),story(fen0,bestPv,col,5)));
  }else{
    w.push(teachBox(teachWin(fen0,bestPv,col),t('tPunLead',sanH(c.oppMove)))||t('tNoIdea'));
    if(!ok&&san!=='—'&&pvAfter){var t3=teachBad(fen0,san,pvAfter,col);if(t3)w.push('<b>'+t('tYours',sanH(san))+'</b>'+teachBox(t3))}
    if(c.oppBest&&c.oppBest!==c.oppMove)w.push(t('oppShould','<span class="mono">'+esc(c.oppBest)+'</span>'));
    w.push(fold(t('stBest',esc(best)),story(fen0,bestPv,col,5)));
  }
  showWhy(w);
  cur.badLine=c.kind==='mine'&&c.pvBad?[c.played].concat(c.pvBad.slice(0,6)):(!ok&&pvAfter?[san].concat(pvAfter.slice(0,6)):null);
  /* Nov 19: show only the start of the good line (3 plies) so the idea is clear; long engine lines confused him */
  cur.goodLine=c.pvBest?c.pvBest.slice(0,c.kind==='punish'?6:3):[best];   /* punish: show it until the material is actually won */
  /* your own idea (not the game move, not the best): its line too, so you can see why it is (or isn't) as good */
  cur.yourLine=san!=='—'&&san!==best&&san!==(cur.badLine&&cur.badLine[0])&&pvAfter&&pvAfter.length?[san].concat(pvAfter.slice(0,6)):null;
  itemDone(ok);
  setBtns({next:true,bad:!!cur.badLine,good:true,yours:!!cur.yourLine});
  $('bBad').textContent=t('bBadLine',cur.badLine?cur.badLine[0]:'');if(cur.yourLine)$('bYours').textContent=t('bYourLine',san);
  /* load the line he needs to see right away, so the coach bubble above the board can walk him through it with ▶ */
  /* Nov 19 fix: open the line AFTER his move so the board keeps what he played (it used to jump back to the position before it) */
  var auto=ok?(san!=='—'&&san!==best&&pvAfter&&pvAfter.length?[san].concat(pvAfter.slice(0,6)):cur.goodLine):(c.kind==='punish'?null:(san===c.played?cur.badLine:(cur.yourLine||cur.badLine)));
  if(auto&&auto.length>1&&san!=='—'&&auto[0]===san){try{showLine(auto);AN.i=Math.min(AN.moves.length,AN.base+1);anRender()}catch(e){}}
  /* punish missed: the lesson is HOW to punish — walk him through the winning line from the exercise position */
  else if(!ok&&c.kind==='punish'&&cur.goodLine&&cur.goodLine.length>1){try{cur.punMiss=true;showLine(cur.goodLine);AN.i=AN.base;anRender()}catch(e){}}
}
function showWhy(list){if(!list.length)return;$('why').hidden=false;var body='<ul>'+list.map(function(x){return '<li>'+x+'</li>'}).join('')+'</ul>';
  /* phones: folded, the coach bubble above the board is the main explanation */
  $('why').innerHTML=window.innerWidth<980?'<details><summary>📖 '+t('gReadAll')+'</summary>'+body+'</details>':'<h3>'+t('why')+'</h3>'+body;if(AN.on)guideRender()}
/* ---------- analysis board: step through any line yourself (◀ ▶), and after answering move freely with live engine ---------- */
var INIT=new Chess().fen();
var AN={on:false,start:INIT,moves:[],i:0,base:0,tok:0,ev:{},good:{}};
function anSet(start,moves,i,base){AN.known=moves.length;AN.on=true;AN.start=start;AN.moves=moves.slice();AN.i=Math.max(0,Math.min(i,AN.moves.length));AN.base=base==null?AN.i:base;$('anBar').hidden=false;$('line').hidden=true;anRender()}
/* Nov 20 ("the bar says mate in 1, so counting is easy"): the eval bar never shows before he answers — every new position starts hidden */
function anOff(){AN.on=false;AN.tok++;setBar(null,false);$('anBar').hidden=true;if($('guide'))$('guide').hidden=true;B.badges={};B.rings={};$('anStory').innerHTML='';$('line').hidden=false;$('anEval').innerHTML=''}
function anChess(n){var c=new Chess(AN.start);for(var k=0;k<n&&k<AN.moves.length;k++){if(!c.move(AN.moves[k],{sloppy:true}))break}return c}
/* ---------- Coach bubble (Nov 19, "too much text, square names and numbers; I don't see text that is elsewhere; show it on the board") ----------
   After he answers, a bubble right above the board explains the line one move at a time, in one short sentence with an icon,
   with no square names or move notation: rings and badges on the board show WHERE. Big ◀ ▶ in the bubble step through the line
   (it drives the analysis bar). The long written explanation stays below, folded on phones. */
var GN={es:{p:'peón',n:'caballo',b:'alfil',r:'torre',q:'dama',k:'rey'},en:{p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'}};
function gPc(type,mine){var es=LANG==='es';return (mine?(es?'tu ':'your '):(es?'su ':'their '))+GN[es?'es':'en'][type]}
function kingSq(c,col){var o=null;c.board().forEach(function(r){r.forEach(function(p){if(p&&p.type==='k'&&p.color===col)o=p.square})});return o}
function guideStep(c0,m,c1,col,prevTo){
  var mine=m.color===col,me=mine,parts=[],ic='',badges={},rings={},bad=mine?'g':'r',good=mine?'g':'r';
  var ofMe=function(type){return gPc(type,!mine)};   /* the captured/attacked piece belongs to the other side */
  if(c1.in_checkmate()){var ks=kingSq(c1,c1.turn());if(ks){badges[ks]='#';rings[ks]=mine?'g':'r'}return {ic:'♚',txt:t(mine?'gMateMe':'gMateOpp'),badges:badges,rings:rings,who:mine?'me':'op'}}   /* Nov 23: 'who' was missing, so his own mates showed as RIVAL */
  if(m.captured){badges[m.to]='💰';
    if(prevTo===m.to){ic='↩';parts.push(t(mine?'gRecapMe':'gRecapOpp',ofMe(m.captured)))}
    else if(!canTake(c1,m.to)){ic='💰';parts.push(t(mine?'gFreeMe':'gFreeOpp',ofMe(m.captured)))}
    else{ic='⚖';parts.push(t(mine?'gTakeMe':'gTakeOpp',ofMe(m.captured)))}}
  if(m.promotion){ic=ic||'⭐';parts.push(t('gPromo'))}
  var chk=c1.in_check();
  var tg=[];try{var x=new Chess(flipTurn(c1.fen(),m.color));x.moves({square:m.to,verbose:true}).forEach(function(a){if(!a.captured||a.captured==='k')return;
    x.move(a.san);var def=canTake(x,a.to);x.undo();if(VAL[a.captured]>=3&&(VAL[a.captured]>VAL[m.piece]||!def))tg.push({sq:a.to,type:a.captured})})}catch(e){}
  if(chk){var ks2=kingSq(c1,c1.turn());if(ks2){rings[ks2]='r';badges[ks2]='+'}}
  if((tg.length>=2)||(chk&&tg.length>=1)){ic='⚔';var A=chk?'k':tg[0].type,Bt=chk?tg[0].type:tg[1].type;tg.forEach(function(o){rings[o.sq]=mine?'g':'r'});badges[m.to]='⚔';
    parts.push(t('gFork',gPc(m.piece,mine),ofMe(A),ofMe(Bt)))}
  else{if(chk){ic=ic||'✚';parts.push(t(mine?'gCheckMe':'gCheckOpp'))}
    if(tg.length===1){ic=ic||'👀';rings[tg[0].sq]=mine?'g':'r';parts.push(t('gAtt',gPc(m.piece,mine),ofMe(tg[0].type)))}}
  if(!parts.length||(parts.length===1&&m.captured)){var lt=lineTactic(c1,m.to);if(lt){ic=ic||'📌';rings[lt.a.sq]=mine?'g':'r';rings[lt.b.sq]=mine?'g':'r';badges[m.to]=lt.k==='pin'?'📌':'➶';
    parts.push(t(lt.k==='pin'?'gPin':'gSkewer',gPc(m.piece,mine),ofMe(lt.a.p.type),ofMe(lt.b.p.type)))}}
  if(!chk&&!m.captured){try{var y=new Chess(flipTurn(c1.fen(),m.color));if(y.moves().some(function(z){y.move(z);var mt=y.in_checkmate();y.undo();return mt})){ic=ic||'⚠';parts.push(t(mine?'gMateThrMe':'gMateThrOpp'))}}catch(e){}}
  if(!parts.length){ic='·';parts.push(t(mine?'gQuietMe':'gQuietOpp',gPc(m.piece,mine)))}
  var s=parts.slice(0,2).join(LANG==='es'?' y ':' and ');s=s.charAt(0).toUpperCase()+s.slice(1)+'.';
  return {ic:ic,txt:s,badges:badges,rings:rings,who:mine?'me':'op'};
}
/* what the line wins or loses from the exercise position to here */
function guideResult(col){var a=anChess(AN.base),b=anChess(AN.i);if(b.in_checkmate())return '';var d=bal(b,col)-bal(a,col);
  return d>=1?t('gResWin',matTxt(d)):d<=-1?t('gResLose',matTxt(d)):''}
function guideRender(){
  var el=$('guide');if(!el)return;if(cur&&(cur.rep||cur.oplan)&&!AN.i_moved){if(cur.oplan)return;if(cur.rep&&AN.i===AN.moves.length)return}
  if(!AN.on||!cur||!cur.answered||!AN.moves.length){el.hidden=true;B.badges={};B.rings={};return}
  var col=B.flip?'b':'w',h='',st=null;B.badges={};B.rings={};
  if(AN.i>0&&AN.i>AN.base){var c0=anChess(AN.i-1),hist=anChess(AN.i).history({verbose:true}),m=hist[hist.length-1],prevTo=null;
    if(AN.i-2>=0){var hp=anChess(AN.i-1).history({verbose:true}),pm=hp[hp.length-1];if(pm&&pm.captured)prevTo=pm.to}
    if(m)st=guideStep(c0,m,anChess(AN.i),col,prevTo)}
  var n=AN.moves.length-AN.base,k=AN.i-AN.base;
  if(st){B.badges=st.badges;B.rings=st.rings;var res=AN.i>=AN.moves.length?guideResult(col):'';
    /* Nov 20: running material count from the exercise position ("I don't hold the pieces I'm taking") */
    var md=bal(anChess(AN.i),col)-bal(anChess(AN.base),col),mtag='<span class="gmat '+(md>0?'up':md<0?'down':'')+'">⚖ '+(md>0?'+'+md:md<0?String(md).replace('-','−'):'=')+'</span>';
    var pf=anChess(AN.i-1).fen().split(' '),mvTag=pf[5]+(pf[1]==='w'?'. ':'… ')+(m?m.san:'');
    h='<div class="gtxt '+st.who+'"><span class="gic">'+st.ic+'</span><span><small>'+t(st.who==='me'?'gYou':'gOpp')+' <b class="gsan mono">'+esc(mvTag)+'</b> '+mtag+'</small>'+esc(st.txt)+(res?'<b class="gres">'+esc(res)+'</b>':'')+'</span></div>'}
  else if(AN.i===AN.base&&cur.punMiss)h='<div class="gtxt"><span class="gic">⚔</span><span><b>'+esc(t('gHowPunish'))+'</b><small class="gsub">'+esc(t('gStart'))+'</small></span></div>';
  else if(AN.i>=AN.base&&cur.gk&&CONCEPT[cur.gk])h='<div class="gtxt"><span class="gic">📘</span><span><b>'+esc(tt(CONCEPT[cur.gk].t))+'</b> — '+esc(tt(CONCEPT[cur.gk].habit))+'<small class="gsub">'+esc(t('gStart'))+'</small></span></div>';
  else h='<div class="gtxt"><span class="gic">▶</span><span>'+esc(AN.i<AN.base?t('gBefore'):t('gStart'))+'</span></div>';
  /* Nov 24 ("the arrows move because of the text"): the ◀ ▶ row goes on TOP of the bubble, so the text below never pushes it */
  h='<div class="gnav"><button class="btn" id="gPrev" type="button"'+(AN.i<=0?' disabled':'')+'>◀</button><span class="small">'+(n>0&&k>=0?k+' / '+n:'')+'</span><button class="btn primary" id="gNext" type="button"'+(AN.i>=AN.moves.length?' disabled':'')+'>▶</button>'+
     ($('why')&&!$('why').hidden&&$('why').innerHTML?'<button class="btn" id="gRead" type="button">📖 '+t('gRead')+'</button>':'')+'</div>'+h;
  el.innerHTML=h;el.hidden=false;
  $('gPrev').onclick=function(){$('anPrev').click()};$('gNext').onclick=function(){$('anNext').click()};
  if($('gRead'))$('gRead').onclick=function(){var w=$('why'),d=w.querySelector('details');if(d)d.open=true;w.scrollIntoView({behavior:'smooth',block:'start'})};
  drawBoard();
}
function anRender(keepArrows){
  var c=anChess(AN.i),arr=keepArrows?B.arrows:[];B.chess=c;B.sel=null;B.targets=[];B.marks={};B.arrows=arr;B.drag=null;
  var h=c.history({verbose:true}),last=h[h.length-1];if(last){B.marks[last.from]='last';B.marks[last.to]='last'}
  B.locked=cur&&!cur.answered?AN.i!==AN.base:false;$('anCont').hidden=!!(cur&&!cur.answered);
  drawBoard();anList();
  $('anFirst').disabled=$('anPrev').disabled=AN.i===0;$('anNext').disabled=$('anLast').disabled=AN.i>=AN.moves.length;
  $('anBase').hidden=AN.i===AN.base||AN.base>AN.moves.length;
  if(cur&&cur.answered)anEval();else $('anEval').innerHTML=AN.i!==AN.base?t('anBack'):'';
  guideRender();
}
function anList(){
  var c=new Chess(AN.start),p=AN.start.split(' '),num=+p[5],o='';
  for(var k=0;k<AN.moves.length;k++){var w=c.turn()==='w';if(w)o+='<span class="mn">'+num+'.</span>';else if(k===0)o+='<span class="mn">'+num+'…</span>';
    var m=c.move(AN.moves[k],{sloppy:true});if(!m)break;
    o+='<button type="button" class="mv'+(k+1===AN.i?' cur':'')+(k>=AN.base&&AN.base>0?' new':'')+'" data-k="'+(k+1)+'">'+esc(m.san)+'</button>';if(!w)num++}
  $('anMoves').innerHTML=o||'<span class="small">'+t('anStart')+'</span>';
  var cu=$('anMoves').querySelector('.cur');if(cu&&cu.scrollIntoView&&cu.offsetParent)cu.scrollIntoView({block:'nearest',inline:'nearest'});
}
$('anMoves').onclick=function(e){var b=e.target.closest('[data-k]');if(!b)return;AN.i=+b.getAttribute('data-k');anRender()};
$('anFirst').onclick=function(){AN.i=0;anRender()};
$('anPrev').onclick=function(){if(AN.i>0){AN.i--;anRender()}};
$('anNext').onclick=function(){if(AN.i<AN.moves.length){AN.i++;anRender()}};
$('anLast').onclick=function(){AN.i=AN.moves.length;anRender()};
$('anBase').onclick=function(){AN.i=AN.base;anRender()};
/* a move on the board while analysing (after the exercise is answered) */
function anMove(mv){$('anStory').innerHTML='';AN.known=Math.min(AN.known||0,AN.i);AN.moves=AN.moves.slice(0,AN.i).concat([mv.san]);AN.i++;anRender()}
function sameMove(f,a,b){try{var x=new Chess(f).move(a,{sloppy:true}),y=new Chess(f).move(b,{sloppy:true});return !!(x&&y&&x.from===y.from&&x.to===y.to&&(x.promotion||'')===(y.promotion||''))}catch(e){return false}}
function anEval(){
  var c=anChess(AN.i),fen=c.fen(),tok=++AN.tok,side=c.turn();
  var prevFen=AN.i>0?anChess(AN.i-1).fen():null,lastSan=AN.i>0?AN.moves[AN.i-1]:null;
  $('anEval').innerHTML=t('thinking');
  var get=function(f){return AN.ev[f]?Promise.resolve(AN.ev[f]):analyse(f,1200).then(function(r){if(r){var cc=new Chess(f);AN.ev[f]={w:toW(r.s,cc.turn()),pv:r.pv}}return AN.ev[f]})};
  get(fen).then(function(e){
    if(tok!==AN.tok||!e)return;setBar(e.w);
    var h='';
    if(AN.i===AN.base&&cur&&cur.answered){$('anEval').innerHTML='';return}
    if(e.pv&&e.pv.length){var a=arrowFor(fen,e.pv[0],'#2563EB');B.arrows=a?[a]:[];drawBoard();h+=t('engineBest',pvText(fen,e.pv,4))}
    if(!prevFen||AN.i<=AN.base||AN.i<=(AN.known||0)){$('anEval').innerHTML=h;return}
    get(prevFen).then(function(p){if(tok!==AN.tok||!p)return;var mover=side==='w'?'b':'w',d=mover==='w'?wp(p.w)-wp(e.w):wp(-p.w)-wp(-e.w);if(AN.good[fen]||(p.pv&&p.pv[0]&&sameMove(prevFen,p.pv[0],lastSan)))d=0;
      $('anEval').innerHTML=chip(lastSan,Math.max(0,d),mover==='w'?e.w:-e.w)+' '+h});
  });
}
/* show a line from the exercise position, then let the user step with ▶ */
function anLine(moves){var p=cur.anPath?cur.anPath():null;if(!p)return;anSet(p.start,p.moves.slice(0,p.base).concat(moves),p.base,p.base);$('anEval').innerHTML=cur.answered?$('anEval').innerHTML:'';flashTip()}
function flashTip(){var el=$('anTip');el.hidden=false;clearTimeout(el._t);el._t=setTimeout(function(){el.hidden=true},3500)}

/* show a line on the board and explain it step by step underneath */
function showLine(moves){anLine(moves);var f=anChess(AN.base).fen();$('anStory').innerHTML=story(f,moves,B.flip?'b':'w',7)}
$('bBad').onclick=function(){if(cur&&cur.badLine)showLine(cur.badLine)};
$('bGood').onclick=function(){if(cur&&cur.goodLine)showLine(cur.goodLine)};
$('bYours').onclick=function(){if(cur&&cur.yourLine)showLine(cur.yourLine)};
/* "how does it go on?": the engine continues from wherever you are (your own idea included), then you step with ▶ */
$('anCont').onclick=function(){if(!AN.on||(cur&&!cur.answered))return;var i=AN.i,f=anChess(i).fen(),tok=AN.tok,b=$('anCont');b.disabled=true;$('anStory').innerHTML=t('thinking');
  analyse(f,1200).then(function(r){b.disabled=false;if(tok!==AN.tok||!r||!r.pv||!r.pv.length){$('anStory').innerHTML='';return}
    var pv=r.pv.slice(0,6);AN.moves=AN.moves.slice(0,i).concat(pv);AN.i=i;anRender();
    $('anStory').innerHTML='<b>'+t('contT')+'</b>'+story(f,pv,B.flip?'b':'w',6);flashTip()})};
$('bHint').onclick=function(){if(!cur||cur.answered)return;var a=null;
  if(cur.card)a=arrowFor(cur.fen,cur.card.best,'#E8730C');else if(cur.rep){repHint('#E8730C');cur.first=false;return}
  else if(cur.idea&&cur.idea.type==='move')a=arrowFor(cur.fen,cur.idea.answer[0],'#E8730C');
  else if(cur.puz){a=arrowFor(B.chess.fen(),cur.puz.p.m[cur.puz.ply],'#E8730C')}
  else if(cur.play){var pf=B.chess.fen();cur.first=false;analyse(pf,700).then(function(r){if(r&&r.pv[0]){var x=arrowFor(pf,r.pv[0],'#E8730C');if(x){B.arrows=[x];drawBoard()}}});return}
  if(a){B.marks[a.from]='hint';drawBoard();cur.first=false}};
$('bShow').onclick=function(){if(!cur||cur.answered)return;cur.first=false;
  if(cur.card){B.locked=true;cardResult(false,'—',null,null)}
  else if(cur.idea)ideaResult(false);
  else if(cur.puz){var P=cur.puz;B.locked=true;(function step(){if(P.ply>=P.p.m.length){puzSolved();return}var m=B.chess.move(P.p.m[P.ply],{sloppy:true});P.ply++;B.marks={};if(m){B.marks[m.from]='hint';B.marks[m.to]='ok'}drawBoard();later(step,700)})()}
  else if((cur.opun||cur.lpos)&&cur.show)cur.show();
  else if(cur.rep)repHint('#0E9488')};

/* repertoire line: follow the book, but any move the engine finds fine is accepted and the game goes on from there */
var REP_OK=7; /* max win-probability drop that still counts as "fine" */
function bookMap(op){var m={};REP[op].lines.forEach(function(l,i){if(l.off)return;var c=new Chess();for(var p=0;p<l.moves.length;p++){var k=posKey(c.fen());if(!m[k])m[k]={i:i,ply:p};c.move(l.moves[p],{sloppy:true})}});return m}
function lineFamily(op,i){var g=planOf(op,i);if(!g)return '';var sib=g.g.filter(function(j){return j!==i&&REP[op].lines[j]&&!REP[op].lines[j].off}),sa=sameAs(op,i);
  return '<div class="lfam"><p>🧭 <b>'+esc(tt(g.t))+'</b></p><p class="og">'+esc(tt(g.goal))+'</p>'+
    (sa.length?'<p class="lsame">🔗 '+t('repSame',sa.slice(0,3).map(function(j){return '<b>'+esc(tt(REP[op].lines[j].name))+'</b>'}).join(', '))+'</p>':'')+
    (sib.length?'<p class="lsib">'+t('repSib',sib.length+1)+'</p>':'')+(REP[op].lines[i].video?'<p>'+vidBtn(REP[op].lines[i].video)+'</p>':(g.vid&&g.vid[0]?'<p>'+vidBtn(g.vid[0])+'</p>':''))+'</div>'}
/* Nov 23 ("at the start it says nothing, I play, and then you say something"): first the line, its plan and its connections; then he plays */
function lineIntro(op,i,fn){
  var o=REP[op],l=o.lines[i],e=lineEnd(l);anOff();$('trBody').classList.remove('answered');$('fb').innerHTML='';$('fb').className='feedback';$('demoBar').hidden=true;
  setBoard(new Chess().fen(),o.side==='b');B.locked=true;B.onMove=null;   /* Nov 24: no spoiler — the end position used to be on the board before he played */
  var k=l.kind==='trap'?'trap':l.kind==='punish'?'punish':'rep';
  $('prompt').innerHTML='<div class="op">'+kindPill(k,esc(tt(o.name)))+'</div><div class="bigq">'+esc(tt(l.name))+'</div>'+lineFamily(op,i)+
    '';
  var ch=$('choices');ch.hidden=false;ch.classList.remove('grid');ch.innerHTML='<button class="btn primary gatego" id="bGo" type="button">'+t('repStart')+'</button><button class="btn" id="bWatch" type="button">👀 '+t('watchBtn')+'</button><button class="btn" id="bLineEx" type="button">🎯 '+t('lposBtn')+'</button>';setBtns({});
  $('bLineEx').onclick=function(){X.items.splice(X.i+1,0,{t:'lineex'});var it=lposItems(op,i,6);X.items.splice.apply(X.items,[X.i+1,1].concat(it));X.i++;renderItem()};
  $('bGo').onclick=function(){ch.innerHTML='';ch.hidden=true;fn()};$('bWatch').onclick=function(){watchLine(op,i)};
}
function loadLine(op,i,played,stopAt){
  var o=REP[op],l=o.lines[i];
  if(!played&&!S.rep[lineId(op,i)]){loadDemo(op,i);return}   /* Nov 24: back to 'watch it once, then play it' — the learn-in-parts mode (learnChunk) tired him ('watching everything over and over') */
  if(!played){lineIntro(op,i,function(){loadLine(op,i,true)});return}
  $('demoBar').hidden=true;
  cur.rep={op:op,i:i,l:l,ply:0,err:0,side:o.side,book:true,hist:[],end:Math.max(l.moves.length,16),map:bookMap(op),reply:null,replyFen:null,stopAt:stopAt||0,lerr:(cur.learnErr||0)};
  setBoard(new Chess().fen(),o.side==='b');setBar(null,false);
  var k=l.kind==='trap'?'trap':l.kind==='punish'?'punish':'rep'
  $('prompt').innerHTML='<div class="op">'+kindPill(k,esc(tt(o.name))+' · '+esc(tt(l.name)))+'</div>'+(l.kind==='trap'?t('pRepTrap'):l.kind==='punish'?t('pRepPunish'):t('pRep'))+' <span class="small">'+t('pRepExact')+'</span>';
  setBtns({hint:true,show:true});B.onMove=onRepMove;
  var pg0=planOf(op,i);if(pg0){guideNote(chessLinks(esc(tt(pg0.goal))),'plan');   /* Nov 24: the plan is one tap away inside the practice (no separate screen) */
    var chp=$('choices');chp.hidden=false;chp.classList.remove('grid');chp.innerHTML='<button class="btn" id="bPlanIn" type="button">🧭 '+t('planIn')+'</button>';
    $('bPlanIn').onclick=function(){guideNote('<b>'+esc(tt(pg0.t))+'</b><br>'+chessLinks(esc(tt(pg0.goal)))+'<ul class="ideaB">'+tt(pg0.plan).map(function(x){return '<li>'+chessLinks(esc(x))+'</li>'}).join('')+'</ul>','plan')}}
  repStep();
}
/* Nov 24 ("learning a new line by watching it all and then playing it all is weird"): LEARN IN CHUNKS — watch only the next two of
   your moves (with their notes), then play the line FROM THE START up to there from memory; then two more… until the whole line. */
function learnChunks(l,side){var mine=[];l.moves.forEach(function(_,p){if((p%2===0)===(side==='w'))mine.push(p)});var ends=[];for(var k=1;k<mine.length;k+=2)ends.push(mine[k]+1);if(!ends.length||ends[ends.length-1]<l.moves.length)ends.push(l.moves.length);return ends}
function watchLine(op,i){var o=REP[op],l=o.lines[i];cur.rep=null;cur.demo={op:op,i:i,l:l,ply:0,side:o.side};setBar(null,false);B.locked=true;B.onMove=null;
  $('prompt').innerHTML='<div class="op">'+kindPill('rep',esc(tt(o.name))+' · '+esc(tt(l.name)))+'</div><div class="bigq">'+t('watchT')+'</div>';
  $('choices').innerHTML='';$('choices').hidden=true;$('demoBar').hidden=false;$('bDemoPlay').textContent=t('bDemoPlay');setBtns({});demoShow()}
function learnChunk(op,i,from){
  var o=REP[op],l=o.lines[i],ends=learnChunks(l,o.side),to=ends.filter(function(e){return e>from})[0]||l.moves.length,k=ends.indexOf(to)+1;
  if(from===0)cur.learnErr=0;
  cur.rep=null;cur.demo={op:op,i:i,l:l,ply:from,side:o.side,from:from,to:to,learn:true};setBar(null,false);B.locked=true;B.onMove=null;
  $('prompt').innerHTML='<div class="op">'+kindPill('rep',esc(tt(o.name))+' · '+esc(tt(l.name)))+'</div><div class="bigq">'+t('lrnPart',k,ends.length)+'</div><p class="lend">'+t(from?'lrnHint2':'lrnHint')+'</p>'+(from===0?lineFamily(op,i):'');
  $('demoBar').hidden=false;$('bDemoPlay').textContent=t('lrnPlay');setBtns({});demoShow();
}
/* new line: watch it first, move by move with its notes, then play it */
function loadDemo(op,i){
  var o=REP[op],l=o.lines[i];cur.demo={op:op,i:i,l:l,ply:0,side:o.side};
  setBar(null,false);B.locked=true;
  $('prompt').innerHTML='<div class="op">'+kindPill('rep',esc(tt(o.name))+' · '+esc(tt(l.name)))+'</div><b>'+t('demoT')+'</b> <span class="small">'+t('demoHint')+'</span>'+lineFamily(op,i);
  $('demoBar').hidden=false;$('bDemoPlay').textContent=t('bDemoPlay');setBtns({});demoShow();
}
function demoShow(){
  var D=cur.demo,l=D.l,mv=l.moves.slice(0,D.ply);
  setBoard(fenOf(mv),D.side==='b',mv[mv.length-1],mv.length?fenOf(mv.slice(0,-1)):null);B.locked=true;
  $('line').innerHTML=moveLine(mv);
  var n=D.ply>0?l.notes[String(D.ply-1)]:null,who=D.ply>0?(((D.ply-1)%2===0)===(D.side==='w')?'me':'opp'):'';
  $('fb').className='feedback';$('fb').innerHTML=D.ply>0?'<span class="mono">'+esc(l.moves[D.ply-1])+'</span>'+(n?' — <span class="'+who+'n">'+chessLinks(esc(tt(n)))+'</span>':''):'';
  var lo=D.learn?D.from:0,hi=D.learn?D.to:l.moves.length;$('bDemoPrev').disabled=D.ply<=lo;$('bDemoNext').disabled=D.ply>=hi;
  $('bDemoPlay').classList.toggle('primary',D.ply>=hi);$('bDemoPlay').disabled=D.learn&&D.ply<hi;
  var dg=planOf(D.op,D.i);if(D.ply>=l.moves.length&&dg){guideNote('<b>'+t('opNow')+'</b> '+esc(tt(dg.goal))+'','plan');if($('gPlan'))$('gPlan').onclick=function(){planGo(D.op,dg.k)}}else $('guide').hidden=true;
}
$('bDemoPrev').onclick=function(){var D=cur&&cur.demo;if(D&&D.ply>(D.learn?D.from:0)){D.ply--;demoShow()}};
$('bDemoNext').onclick=function(){var D=cur&&cur.demo;if(D&&D.ply<(D.learn?D.to:D.l.moves.length)){D.ply++;demoShow()}};
$('bDemoPlay').onclick=function(){if(!cur||!cur.demo)return;var D=cur.demo;cur.demo=null;$('demoBar').hidden=true;$('fb').innerHTML='';$('note').innerHTML='';$('bDemoPlay').disabled=false;$('bDemoPlay').textContent=t('bDemoPlay');loadLine(D.op,D.i,true,D.learn?D.to:0)};

/* which variation is this? final position of a line, pick its name among lines of the same opening */
function loadName(op,i){
  var o=REP[op],l=o.lines[i];cur.name={op:op,i:i};
  setBoard(fenOf(l.moves),o.side==='b',l.moves[l.moves.length-1],fenOf(l.moves.slice(0,-1)));setBar(null,false);B.locked=true;
  $('prompt').innerHTML='<div class="op">'+kindPill('name',esc(tt(o.name)))+'</div><b>'+t('nameQ')+'</b>';
  $('line').innerHTML=moveLine(l.moves);
  var others=o.lines.map(function(_,j){return j}).filter(function(j){return j!==i&&!o.lines[j].off}).sort(function(){return Math.random()-.5}).slice(0,3);
  var opts=others.concat([i]).sort(function(){return Math.random()-.5});
  var ch=$('choices');ch.hidden=false;
  ch.innerHTML=opts.map(function(j){return '<button class="btn opt" data-j="'+j+'">'+esc(tt(o.lines[j].name))+'</button>'}).join('');
  ch.querySelectorAll('button').forEach(function(b){b.onclick=function(){if(cur.answered)return;var j=+b.getAttribute('data-j'),ok=j===i;
    b.classList.add(ok?'okb':'badb');if(!ok)ch.querySelector('[data-j="'+i+'"]').classList.add('okb');
    $('fb').className='feedback '+(ok?'good':'bad');$('fb').innerHTML=ok?t('correct',esc(tt(l.name))):t('nameWas',esc(tt(l.name)));
    var keys=Object.keys(l.notes).map(Number).sort(function(a,b){return b-a});var k=keys.filter(function(x){return (x%2===0)===(o.side==='w')})[0];
    if(k!=null)showWhy(['<span class="mono">'+esc(l.moves[k])+'</span>: '+esc(tt(l.notes[String(k)]))]);
    cur.anPath=function(){return {start:INIT,moves:l.moves,base:l.moves.length}};itemDone(ok);setBtns({next:true})}});
  setBtns({});
}
function seenLines(){return allLines().filter(function(x){return !!x.st})}

function repNote(ply){var R=cur.rep;if(!R.book)return '';var n=R.l.notes[String(ply)];return n?tt(n):''}
function repRejoin(){var R=cur.rep,k=R.map[posKey(B.chess.fen())];
  if(!R.book&&k){R.book=true;R.l=REP[R.op].lines[k.i];R.ply=k.ply;addNote(t('repBack'),'me')}}
function repStep(){
  var R=cur.rep;$('line').innerHTML=moveLine(R.hist);
  if(R.book&&R.stopAt&&R.stopAt<R.l.moves.length&&R.ply>=R.stopAt){B.locked=true;cur.learnErr=(R.lerr||0)+R.err;   /* learn mode: this chunk is done -> 2 new moves */
    setBtns({});$('fb').className='feedback good';$('fb').innerHTML='✓ '+t('lrnChunkOk');var ch=$('choices');ch.hidden=false;ch.classList.remove('grid');
    ch.innerHTML='<button class="btn primary" id="bLrnNext" type="button">'+t('lrnNext')+'</button>';tapLock($('bLrnNext'));$('bLrnNext').onclick=function(){ch.innerHTML='';ch.hidden=true;learnChunk(R.op,R.i,R.stopAt)};return}
  if((R.book&&R.ply>=R.l.moves.length)||(!R.book&&R.hist.length>=R.end)||B.chess.game_over()){if(R.stopAt)R.err+=R.lerr;repFinish();return}
  if(B.chess.turn()===R.side){B.locked=false;drawBoard();return}
  B.locked=true;
  later(function(){pickOpp().then(function(san){
    if(!cur||cur.rep!==R)return;if(!san){repFinish();return}
    var fen=B.chess.fen(),m=B.chess.move(san,{sloppy:true});if(!m){repFinish();return}
    B.marks={};B.marks[m.from]='last';B.marks[m.to]='last';B.arrows=[];drawBoard();
    var st=DATA.stats[posKey(fen)],fq='';if(st){var tot=0;Object.keys(st).forEach(function(k){tot+=st[k]});if(st[m.san]&&tot>=3&&st[m.san]/tot>=.05)fq=t('freq',Math.round(st[m.san]/tot*100))}
    var nt=repNote(R.ply);addNote('<b>'+t('oppPlays',esc(m.san))+'</b>'+fq+(nt?' '+chessLinks(esc(nt)):''),'opp');
    R.hist.push(m.san);if(R.book)R.ply++;else repRejoin();repStep();
  })},R.hist.length===0?300:550);
}
/* opponent: book move, else what your real opponents played here, else the engine */
function pickOpp(){
  var R=cur.rep,fen=B.chess.fen();
  if(R.book)return Promise.resolve(R.l.moves[R.ply]);
  var st=DATA.stats[posKey(fen)],legal=B.chess.moves();
  if(st){var c=Object.keys(st).filter(function(s){return st[s]>=2&&legal.indexOf(s)>=0});
    if(c.length){var tot=0;c.forEach(function(s){tot+=st[s]});var x=Math.random()*tot;for(var i=0;i<c.length;i++){x-=st[c[i]];if(x<=0)return Promise.resolve(c[i])}return Promise.resolve(c[0])}}
  if(R.reply&&R.replyFen===fen)return Promise.resolve(R.reply);
  return analyse(fen,700).then(function(r){return r&&r.pv[0]});
}
function onRepMove(mv){
  var R=cur.rep;B.locked=true;var want=R.book?R.l.moves[R.ply]:null;
  if(want&&mv.san===want){
    B.marks[mv.to]='ok';drawBoard();var nt=repNote(R.ply);addNote(t('repOk','<b class="mono">'+esc(mv.san)+'</b>')+(nt?' '+chessLinks(esc(nt)):''),'me');
    R.hist.push(mv.san);R.ply++;$('fb').innerHTML='';repStep();return}
  var fenAfter=B.chess.fen();B.chess.undo();var fen0=B.chess.fen();B.chess.move(mv.san,{sloppy:true});
  $('fb').className='feedback';$('fb').textContent=t('checking',mv.san);
  analyse(fen0,700).then(function(b){return analyse(fenAfter,700).then(function(a){
    if(!cur||cur.rep!==R)return;
    if(!a||!b){repMistake(mv,fen0,want,null,null,null);return}
    var sBefore=b.s,sAfter=-a.s,drop=Math.max(0,wp(sBefore)-wp(sAfter));
    if(drop<REP_OK&&want){   /* Nov 23: "the point is to remember the exact line" — a good move that is not the line's: back and retry */
      R.err++;cur.first=false;R.miss=R.miss||{};R.miss[R.ply]=(R.miss[R.ply]||0)+1;B.marks[mv.to]='hint';drawBoard();
      $('fb').className='feedback bad';$('fb').innerHTML=t('repNotLine','<span class="mono">'+esc(mv.san)+'</span>')+(R.miss[R.ply]>=2?' '+t('repNo',esc(want)):'');
      later(function(){if(!cur||cur.rep!==R)return;B.chess.undo();B.marks={};var ar=R.miss[R.ply]>=2?arrowFor(fen0,want,'#0E9488'):null;B.arrows=ar?[ar]:[];drawBoard();B.locked=false},1100);
      return}
    if(drop<REP_OK){
      B.marks[mv.to]='ok';drawBoard();R.hist.push(mv.san);
      var nt=repNote(R.ply);
      $('fb').className='feedback good';
      $('fb').innerHTML=chip(mv.san,drop,sAfter)+' '+(want?t('repOwn','<span class="mono">'+esc(mv.san)+'</span>','<span class="mono">'+esc(want)+'</span>')+(nt?' <span class="small">'+esc(nt)+'</span>':''):t('repFine','<span class="mono">'+esc(mv.san)+'</span>'));
      R.book=false;R.reply=a.pv[0]||null;R.replyFen=fenAfter;repRejoin();repStep();
    }else repMistake(mv,fen0,want||b.pv[0],a,sAfter,drop);
  })});
}
function repMistake(mv,fen0,good,a,sAfter,drop){
  var R=cur.rep;R.err++;cur.first=false;B.marks[mv.to]='bad';drawBoard();R.miss=R.miss||{};R.miss[R.ply]=(R.miss[R.ply]||0)+1;var showIt=!R.book||R.miss[R.ply]>=2;
  var why=a?chip(mv.san,drop,sAfter)+' '+explainBad(fen0,mv.san,a.pv,sAfter,R.side,R.hist.length).join(' '):'';
  var nt=R.book?repNote(R.ply):'';
  $('fb').className='feedback bad';
  $('fb').innerHTML=why+'<br>'+t('repMist','<span class="mono">'+esc(mv.san)+'</span>')+(good&&showIt?' '+(R.book?t('repNo',esc(good)):t('engineBest','<span class="mono">'+esc(good)+'</span>')):'')+(nt&&showIt?' '+esc(nt):'');
  later(function(){B.chess.undo();B.marks={};var ar=good&&showIt?arrowFor(fen0,good,'#0E9488'):null;B.arrows=ar?[ar]:[];drawBoard();B.locked=false},1000);
}
function repHint(color){var R=cur.rep,f=B.chess.fen();
  if(R.book){var a=arrowFor(f,R.l.moves[R.ply],color);if(a){B.marks[a.from]='hint';B.arrows=color==='#0E9488'?[a]:[];drawBoard()}return}
  analyse(f,700).then(function(r){if(r&&r.pv[0]&&cur&&cur.rep===R){var a=arrowFor(f,r.pv[0],color);if(a){B.marks[a.from]='hint';B.arrows=color==='#0E9488'?[a]:[];drawBoard()}}})}
/* plan on the board (planes_vis.js): one short sentence per step, arrows and rings show it — like for a kid */
function visSteps(op,k){var v=window.OVIS&&OVIS[op]&&OVIS[op][k];return v||null}
function planGo(op,k){startSession([{t:'oplan',op:op,k:k}],'rep')}
function loadOPlan(op,k){
  var g=(OPLAN[op].groups.filter(function(x){return x.k===k})[0]),steps=visSteps(op,k);if(!g||!steps){skip();return}
  var e=lineEnd(REP[op].lines[g.g[0]]);cur.oplan={op:op,g:g,steps:steps,i:0,fen:e.fen};setBar(null,false);B.locked=true;
  $('prompt').innerHTML='<div class="op">'+kindPill('rep',esc(tt(REP[op].name)))+'</div><b>🧭 '+esc(tt(g.t))+'</b>';
  $('trBody').classList.add('answered');setBtns({next:true});oplanDraw();
}
function oplanDraw(){
  var P=cur.oplan,st=P.steps[P.i],es=LANG==='es';setBoard(P.fen,REP[P.op].side==='b');B.locked=true;
  B.arrows=(st[2]?st[2].split(','):[]).map(function(a){var x=a.trim().split(' ');return {from:x[0],to:x[1],c:x[2]==='r'?'#DC2626':'#0E9488'}});
  B.rings={};(st[3]?st[3].split(','):[]).forEach(function(r){var x=r.trim().split(' ');if(x[0])B.rings[x[0]]=x[1]==='r'?'r':'g'});drawBoard();
  var el=$('guide'),last=P.i>=P.steps.length-1;
  el.innerHTML='<div class="gtxt"><span class="gic">'+(st[2]&&/ r/.test(st[2])||/ r/.test(st[3]||'')?'⚠️':'🧭')+'</span><span class="gbig">'+esc(es?st[0]:st[1])+'</span></div>'+
    '<div class="gnav"><button class="btn" id="gPrev" type="button"'+(P.i===0?' disabled':'')+'>◀</button><span class="small">'+(P.i+1)+' / '+P.steps.length+'</span><button class="btn primary" id="gNext" type="button"'+(last?' disabled':'')+'>▶</button>'+
    (last?'<button class="btn" id="gPlay" type="button">♟ '+t('opPlay')+'</button>':'')+'</div>';
  el.hidden=false;
  $('gPrev').onclick=function(){if(P.i>0){P.i--;oplanDraw()}};$('gNext').onclick=function(){if(P.i<P.steps.length-1){P.i++;oplanDraw()}};
  if($('gPlay'))$('gPlay').onclick=function(){startSession([{t:'line',op:P.op,i:P.g.g[0]}],'rep')};
  $('why').hidden=false;$('why').innerHTML='<details><summary>📖 '+t('opWritten')+'</summary>'+planBox(P.g,true)+'</details>';
}
/* during line practice the notes go in the bubble above the board (they used to land below the buttons, out of sight on phones) */
function guideNote(html,cls){var el=$('guide');if(!el)return;el.innerHTML='<div class="gtxt '+(cls==='me'?'me':'')+'"><span class="gic">'+(cls==='me'?'✅':cls==='plan'?'🧭':'♟')+'</span><span>'+html+'</span></div>';el.hidden=false}
/* opening plans (planes_aperturas.js): the idea behind each setup, shown in Repertorio, in the line prompt and when a line is finished */
/* Nov 23: his favourite teacher's videos (Ajedrez Guerrero) linked from the lines and plan groups, at the exact minute */
function vidUrl(v){return 'https://www.youtube.com/watch?v='+v.v+(v.t?'&t='+v.t+'s':'')}
function vidBtn(v){return '';/* Nov 24: he finds the video buttons unnecessary */return v?'<a class="btn vidb" href="'+vidUrl(v)+'" target="_blank" rel="noopener">▶ '+t('vidSee',mmss(v.t||0))+'</a>':''}
/* "Castiga en la apertura" (Nov 23, his idea): the moment an opponent goes wrong in one of his lines; he plays the punishing move */
function opunList(){var o=[];Object.keys(REP).forEach(function(op){REP[op].lines.forEach(function(l,i){if(!l.off&&typeof l.key==='number')o.push({op:op,i:i,l:l,id:'op:'+op+':'+i})})});return o}
function opunPick(n){var sn=S.seen||{},rec=now()-20*36e5;S.opun=S.opun||{};
  return opunList().map(function(x){var st=S.opun[x.id];return {x:x,k:(st&&(st.due||0)>now()?100:0)+((sn[x.id]||0)>rec?50:0)+(st?st.box||0:-1)+Math.random()}}).sort(function(a,b){return a.k-b.k}).slice(0,n).map(function(o){return {t:'opun',op:o.x.op,i:o.x.i}})}
function loadOPun(op,i){
  var o=REP[op],l=REP[op].lines[i],k=l.key,id='op:'+op+':'+i,pre=l.moves.slice(0,k),fen=fenOf(pre),want=l.moves[k];seenPuz(id);
  setBoard(fen,o.side==='b',pre[pre.length-1],fenOf(pre.slice(0,-1)));setBar(null,false);B.locked=false;
  $('prompt').innerHTML='<div class="op">'+kindPill('punish',esc(tt(o.name)))+'</div><div class="bigq">'+t('opunQ','<b class="mono">'+esc(noMate(pre[pre.length-1]))+'</b>')+'</div>';
  setBtns({hint:false,show:true});cur.opun={op:op,i:i,want:want};
  var done=function(ok,html){S.opun=S.opun||{};var st=S.opun[id]||(S.opun[id]={box:0,due:0});gradeObj(st,ok);B.locked=true;B.onMove=null;
    var ar=arrowFor(fen,want,'#0E9488');B.arrows=ar?[ar]:[];drawBoard();
    var nt=l.notes[String(k)];$('fb').className='feedback '+(ok?'good':'bad');$('fb').innerHTML=html+(nt?' '+esc(tt(nt)):'')+' '+vidBtn(l.video);
    cur.anPath=function(){return {start:INIT,moves:l.moves,i:k+1,base:k}};itemDone(ok)};
  B.onMove=function(mv){var a=mv.san.replace(/[+#]/g,''),b=want.replace(/[+#]/g,'');
    if(a===b){done(cur.first,'✓ '+t('opunOk','<b class="mono">'+esc(want)+'</b>'));return}
    /* Nov 26 (his screenshot: Qxh5 took a free knight and was marked wrong because the line plays Bxb8): moves the engine rates as good as
       the line's punishment (depth 18, within 0.6 and ≥ +1.5; tools: opun alternatives, stored as l.ka) also count */
    if((l.ka||[]).some(function(x){return x.replace(/[+#]/g,'')===a})){done(cur.first,'✓ '+t('opunAlt','<b class="mono">'+esc(mv.san)+'</b>','<b class="mono">'+esc(want)+'</b>'));return}
    cur.first=false;B.chess.undo();done(false,'✗ '+t('opunBad','<b class="mono">'+esc(mv.san)+'</b>','<b class="mono">'+esc(want)+'</b>'))};
  cur.show=function(){cur.first=false;done(false,t('opunShow','<b class="mono">'+esc(want)+'</b>'))};
}
/* Nov 23 ("I need connections: many lines are the same plan in another order"): lines that pass through the same position
   (from move 5 on) are the same thing by another road */
var SAMEC={};
function sameAs(op,i){var key=op+':'+i;if(SAMEC[key])return SAMEC[key];
  /* only a real transposition counts: same position reached by a DIFFERENT move order (lines that just share the first moves are siblings) */
  var pos=function(l){var c=new Chess(),o={};l.moves.forEach(function(m,p){c.move(m,{sloppy:true});if(p>=8)o[posKey(c.fen())]=l.moves.slice(0,p+1).join(' ')});return o};
  var L=REP[op].lines,mine=pos(L[i]),out=[];
  L.forEach(function(l,j){if(j===i||l.off)return;var c=new Chess(),hit=false;l.moves.forEach(function(m,p){c.move(m,{sloppy:true});var k=posKey(c.fen());if(p>=8&&mine[k]&&mine[k]!==l.moves.slice(0,p+1).join(' '))hit=true});if(hit)out.push(j)});
  return SAMEC[key]=out}
function planOf(op,i){var o=window.OPLAN&&OPLAN[op];if(!o)return null;return o.groups.filter(function(g){return g.g.indexOf(i)>=0})[0]||null}
function planBox(g,open){if(!g)return '';var li=function(a){return '<ul>'+tt(a).map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul>'};
  return '<div class="oplan"><b>🧭 '+esc(tt(g.t))+'</b><p class="og">'+esc(tt(g.goal))+'</p><details'+(open?' open':'')+'><summary>'+t('opPlanS')+'</summary><p class="ol">'+t('opPlan')+'</p>'+li(g.plan)+'<p class="ol">'+t('opWatch')+'</p>'+li(g.watch)+'<p class="ol">'+t('opAvoid')+'</p><p>'+esc(tt(g.avoid))+'</p></details></div>'}
/* Nov 24 ("like Duolingo: you finished this line, a button, and I continue"): each opening is a PATH — its lines in plan-group order
   (OPLAN), then any others. 'Continuar' starts the first line never practised (else the first one due); finishing a line offers the next. */
/* Nov 24 ("how much I play each opening, wins/draws/losses, my best and my worst"): estadisticas.js (tools/ostats.py) */
/* Nov 24 ("yes, automatic"): every new game synced from Chess.com is put in its repertoire section right away (same rule as
   tools/ostats.py: the deepest repertoire position reached, >= 4 plies) and added on top of estadisticas.js (games newer than OSTATS_AT) */
var OSMAP={};
function osMap(op){if(OSMAP[op])return OSMAP[op];var m={};REP[op].lines.forEach(function(l,i){if(l.off)return;var c=new Chess();l.moves.forEach(function(mv,p){c.move(mv,{sloppy:true});var k=posKey(c.fen());if(!m[k]||m[k][1]<p+1)m[k]=[i,p+1]})});return OSMAP[op]=m}
function osClassify(sans,side){if(!sans||!sans.length)return null;var c=new Chess(),keys=[];for(var p=0;p<sans.length&&p<24;p++){if(!c.move(sans[p],{sloppy:true}))break;keys.push(posKey(c.fen()))}
  var best=null;Object.keys(REP).forEach(function(op){if(REP[op].side!==side)return;var m=osMap(op);keys.forEach(function(k){var x=m[k];if(x&&x[1]>=4&&(!best||x[1]>best.d))best={op:op,li:x[0],d:x[1]}})});
  if(!best)return null;var g=planOf(best.op,best.li);return {op:best.op,li:best.li,k:g?g.k:'other'}}
function osLive(op){var base=window.OSTATS&&OSTATS[op];var o=JSON.parse(JSON.stringify(base||{all:[0,0,0],rec:[0,0,0],groups:{},lines:{}})),at=window.OSTATS_AT||0,rec=now()/1000-60*86400;
  Object.keys(S.games).forEach(function(id){var g=S.games[id];if(!g.os||g.os.op!==op||(g.date||0)<=at||g.tc!=='rapid')return;var r=g.r==='W'?0:g.r==='L'?2:1,isRec=(g.date||0)>=rec;
    [o,(o.groups[g.os.k]=o.groups[g.os.k]||{all:[0,0,0],rec:[0,0,0]}),(o.lines[String(g.os.li)]=o.lines[String(g.os.li)]||{all:[0,0,0],rec:[0,0,0]})].forEach(function(x){x.all[r]++;if(isRec)x.rec[r]++})});
  return o}
function wdl(a){var n=a[0]+a[1]+a[2];return {n:n,w:a[0],d:a[1],l:a[2],pct:n?Math.round((a[0]+a[1]/2)/n*100):0}}
function wdlHtml(a,small){var x=wdl(a);if(!x.n)return '';var c=x.pct>=55?'good':x.pct<=45?'bad':'';
  return '<span class="wdl '+c+'">'+t(small?'stLine':'stSec',x.n,x.w,x.d,x.l,x.pct)+'</span>'}
/* Nov 24 ("I don't remember practising all those lines; a start-over button"): a line counts as done in its section's path only if it
   was finished after that section's last restart (S.pathReset['op:k'], synced). The practice history (SR) is never deleted. */
function pathDone(op,i){var st=S.rep[lineId(op,i)];if(!st)return false;var g=planOf(op,i),r=(S.pathReset||{})[op+':'+(g?g.k:'other')]||0;return r?(st.at||0)>r:true}
function sectionItems(op,L){var it=[];L.forEach(function(i){it.push({t:'line',op:op,i:i});it=it.concat(lposItems(op,i,2))});
  var g=planOf(op,L[0]),all=g?g.g.filter(function(i){return REP[op].lines[i]&&!REP[op].lines[i].off}):L,rev=[];
  all.forEach(function(i){var c=lposItems(op,i,6);if(c.length)rev.push(c[Math.floor(Math.random()*c.length)])});
  rev=rev.sort(function(){return Math.random()-.5}).slice(0,8);
  var oq=(window.OQUIZ||[]).filter(function(q){return q.op===op&&g&&q.g===g.k}).map(function(q){return {t:'quiz',id:q.id}});
  if(rev.length>1||oq.length)it=it.concat([{t:'msg',k:'secRev',n:g?tt(g.t):''}],rev,oq);return it}
function linePath(op){var seq=[],L=REP[op].lines,o=window.OPLAN&&OPLAN[op];(o?o.groups:[]).forEach(function(g){g.g.forEach(function(i){if(L[i]&&!L[i].off&&seq.indexOf(i)<0)seq.push(i)})});
  L.forEach(function(l,i){if(!l.off&&seq.indexOf(i)<0)seq.push(i)});return seq}
function pathNow(op){var seq=linePath(op);for(var k=0;k<seq.length;k++)if(!S.rep[lineId(op,seq[k])])return seq[k];
  for(k=0;k<seq.length;k++){var st=S.rep[lineId(op,seq[k])];if((st.due||0)<=now())return seq[k]}return seq[0]}
function pathNext(op,i){var seq=linePath(op),k=seq.indexOf(i);return k>=0&&k<seq.length-1?seq[k+1]:null}
/* Nov 24 (his idea, like Lotus Chess): POSITION EXERCISES — a position from the middle of one of his lines, right after the
   opponent's move: "what do you play here?". No need to replay from move 1. */
function lposItems(op,li,n){var o=REP[op],side=o.side,c=[],sn=S.seen||{};
  var lines=li!=null?[li]:linePath(op).filter(function(i){return !!S.rep[lineId(op,i)]});if(li==null&&lines.length<2)lines=linePath(op);
  lines.forEach(function(i){var l=o.lines[i];l.moves.forEach(function(_,p){if(p>=2&&(p%2===0)===(side==='w'))c.push({t:'lpos',op:op,i:i,ply:p})})});
  return freshFirst(c,function(x){return 'lp:'+x.op+':'+x.i+':'+x.ply}).slice(0,n)}
function loadLPos(op,i,ply){
  var o=REP[op],l=o.lines[i],pre=l.moves.slice(0,ply),fen=fenOf(pre),want=l.moves[ply],tries=0;seenPuz('lp:'+op+':'+i+':'+ply);
  setBoard(fen,o.side==='b',pre[pre.length-1],fenOf(pre.slice(0,-1)));setBar(null,false);B.locked=false;
  $('prompt').innerHTML='<div class="op">'+kindPill('rep',esc(tt(o.name)))+'</div><div class="bigq">'+t('lposQ','<b class="mono">'+esc(pre[pre.length-1])+'</b>')+'</div><p class="lend">'+esc(tt(l.name))+'</p>';
  setBtns({show:true});
  var fin=function(ok,html,right){B.locked=true;B.onMove=null;var ar=arrowFor(fen,want,'#0E9488');B.arrows=ar?[ar]:[];drawBoard();var nt=l.notes[String(ply)];
    $('fb').className='feedback '+(ok||right?'good':'bad');$('fb').innerHTML=html+(nt?' <span class="small">'+chessLinks(esc(tt(nt)))+'</span>':'');
    cur.anPath=function(){return {start:INIT,moves:l.moves.slice(0,Math.min(l.moves.length,ply+3)),i:ply+1,base:ply}};itemDone(ok)};
  B.onMove=function(mv){var a=mv.san.replace(/[+#]/g,''),b=want.replace(/[+#]/g,'');
    if(a===b){fin(tries===0,'✓ '+t('lposOk','<b class="mono">'+esc(want)+'</b>'),true);return}
    tries++;cur.first=false;B.chess.undo();drawBoard();
    if(tries<2){$('fb').className='feedback bad';$('fb').textContent=t('lposRetry');return}
    fin(false,'✗ '+t('lposWas','<b class="mono">'+esc(want)+'</b>'))};
  cur.show=function(){cur.first=false;fin(false,t('lposWas','<b class="mono">'+esc(want)+'</b>'))};cur.lpos=true;
}
/* Nov 24 ("if you write 'pyramid c3-d4-e3', let me touch it and see it on the board"): squares and moves inside texts are tappable —
   a square gets a ring, a move an arrow (if legal on the board) or a ring on its target square. Applied to ESCAPED plain text only. */
/* Nov 24 ("when I touch 'pyramid' I want to see how the board would be"): CONCEPT words show a position on the board where you can see
   the idea (a 'peek': the board switches, marked squares, '👀 Así se ve · toca para volver', tap to go back); square CHAINS (c3-d4-e3,
   h4–h5) light up together; single squares get a ring and moves an arrow. Applied to ESCAPED plain text only. */
var GLOSS=[
 {re:/pir[áa]mides?|pyramid/i,op:'london',g:'classic',r:'c3 d4 e3'},
 {re:/cadenas? de peones|pawn chains?/i,op:'caro',g:'adv',r:'d4 e5'},
 {re:/fianchetto/i,op:'london',g:'kid',r:'g6 g7'},
 {re:/enroque largo|long castling/i,op:'london',g:'kid',r:'c1 d1'},
 {re:/pe[oó]n aislado|isolated (?:d4 |queen.?s )?pawn/i,op:'caro',g:'panov',r:'d4 d5'},
 {re:/sacrificio griego|greek gift/i,op:'london',li:32,ply:20,r:'h7',a:'d3 h7'},
 {re:/columna c\b|c-file/i,op:'caro',g:'exch',r:'c8 c3'},
 {re:/columna h\b|h-file/i,op:'london',g:'kid',r:'h1 h7'},
 {re:/Ataque 150|150 Attack/i,op:'london',g:'kid',r:'h6 g7'}];
function glossPos(x){var o=REP[x.op];if(!o)return null;var li=x.li;if(li==null){var g=(OPLAN[x.op]||{groups:[]}).groups.filter(function(y){return y.k===x.g})[0];li=g&&g.g.filter(function(i){return o.lines[i]&&!o.lines[i].off})[0]}
  if(li==null||!o.lines[li])return null;var mv=o.lines[li].moves.slice(0,x.ply!=null?x.ply:o.lines[li].moves.length);return {fen:fenOf(mv),flip:o.side==='b'}}
function chessLinks(h){
  return String(h).replace(/((?:\b[KQRBN]?[a-h][1-8])(?:\s?[-–]\s?(?:[KQRBN]?[a-h][1-8]))+)|(O-O-O|O-O|\b[KQRBN][a-h]?[1-8]?x?[a-h][1-8][+#]?|\b[a-h]x[a-h][1-8][+#]?|\b[a-h][1-8]\b[+#]?)/g,function(m,chain){return '<span class="cl" data-c="'+m+'">'+m+'</span>'})
    .replace(/(^|>)([^<]+)(?=<|$)/g,function(all,pre,txt){GLOSS.forEach(function(x,gi){txt=txt.replace(x.re,function(w){return '<span class="cl clg" data-g="'+gi+'">'+w+'</span>'})});return pre+txt})}
var CL_T=0,PEEK=null;
function peekOff(){if(!PEEK)return;var p=PEEK;PEEK=null;B.chess=new Chess(p.fen);B.flip=p.flip;B.marks=p.marks;B.arrows=p.arrows;B.rings=p.rings;B.badges=p.badges;B.locked=p.locked;B.onMove=p.onMove;
  if(p.hidden)$('boardwrap').hidden=true;var pb=$('peekBar');if(pb)pb.remove();drawBoard()}
function peek(gi){var x=GLOSS[gi],pos=x&&glossPos(x);if(!pos)return;if(PEEK)peekOff();
  PEEK={fen:B.chess.fen(),flip:B.flip,marks:B.marks,arrows:B.arrows,rings:B.rings,badges:B.badges,locked:B.locked,onMove:B.onMove,hidden:$('boardwrap').hidden};
  $('boardwrap').hidden=false;B.chess=new Chess(pos.fen);B.flip=pos.flip;B.marks={};B.badges={};B.rings={};(x.r||'').split(' ').filter(Boolean).forEach(function(q){B.rings[q]='g'});
  B.arrows=[];if(x.a){var a=x.a.split(' ');B.arrows=[{from:a[0],to:a[1],c:'#7C3AED'}]}B.locked=true;B.onMove=null;drawBoard();
  var pb=document.createElement('button');pb.id='peekBar';pb.type='button';pb.className='peekbar';pb.textContent='👀 '+t('peekT');pb.onclick=function(ev){ev.stopPropagation();peekOff()};$('boardwrap').appendChild(pb);
  $('boardwrap').scrollIntoView({block:'nearest',behavior:'smooth'})}
function chessTap(txt){if(PEEK)peekOff();if(!B||!B.chess||$('boardwrap').hidden)return;var rings={},arrows=[],m=null,sqs=txt.match(/[a-h][1-8]/g)||[];
  if(sqs.length>1){sqs.forEach(function(q){rings[q]='g'})}   /* a chain: all its squares at once */
  else{try{var c=new Chess(B.chess.fen());m=c.move(txt,{sloppy:true});if(!m){var f=B.chess.fen().split(' ');f[1]=f[1]==='w'?'b':'w';f[3]='-';var c2=new Chess();if(c2.load(f.join(' ')))m=c2.move(txt,{sloppy:true})}}catch(e){}
    if(m){arrows=[{from:m.from,to:m.to,c:'#7C3AED'}];rings[m.to]='g'}else if(sqs[0])rings[sqs[0]]='g'}
  B.rings=Object.assign({},B.rings||{},rings);if(arrows.length)B.arrows=(B.arrows||[]).concat(arrows);drawBoard();
  clearTimeout(CL_T);CL_T=setTimeout(function(){if(PEEK)return;B.rings={};B.arrows=(B.arrows||[]).filter(function(a){return a.c!=='#7C3AED'});drawBoard()},4000)}
document.addEventListener('click',function(ev){var el=ev.target.closest&&ev.target.closest('.cl');if(!el)return;ev.stopPropagation();ev.preventDefault();if(el.hasAttribute('data-g'))peek(+el.getAttribute('data-g'));else chessTap(el.getAttribute('data-c'))},true);
function repFinish(){
  var R=cur.rep,st=repState(lineId(R.op,R.i));gradeObj(st,R.err===0);st.at=now();
  $('line').innerHTML=moveLine(R.hist);
  $('fb').className='feedback good';$('fb').innerHTML=(R.err?t('repDone'):t('repDoneClean'))+' '+t('repErrs',R.err);
  var pg=planOf(R.op,R.i),sa=sameAs(R.op,R.i);if(pg){guideNote('<b>'+t('opNow')+'</b> '+esc(tt(pg.goal))+(R.l.video?' '+vidBtn(R.l.video):'')+(sa.length?'<br>🔗 '+t('repSame',sa.slice(0,2).map(function(j){return '<b>'+esc(tt(REP[R.op].lines[j].name))+'</b>'}).join(', ')):'')+'','plan');if($('gPlan'))$('gPlan').onclick=function(){planGo(R.op,pg.k)}}
  cur.fen=B.chess.fen();cur.anPath=function(){return {start:INIT,moves:R.hist,base:R.hist.length}};itemDone(R.err===0);
  var gcur=planOf(R.op,R.i),nx=X.src==='rep'&&X.i>=X.items.length-1?pathNext(R.op,R.i):null;if(nx!=null&&gcur&&planOf(R.op,nx)!==gcur){var gl=gcur.g.filter(function(j){var L=REP[R.op].lines[j];return L&&!L.off&&!pathDone(R.op,j)});nx=gl.length?gl[0]:nx}
  if(nx!=null){var g0=planOf(R.op,R.i),g1=planOf(R.op,nx),ch=$('choices');ch.hidden=false;ch.classList.remove('grid');
    ch.innerHTML='<button class="btn primary pathnext" id="bPathNext" type="button">'+t('pathNext')+'<small>'+esc(tt(REP[R.op].lines[nx].name))+(g1&&g1!==g0?' · '+t('pathNewPlan'):'')+'</small></button>';tapLock($('bPathNext'));
    $('bPathNext').onclick=function(){X.items.splice(X.i+1,0,{t:'line',op:R.op,i:nx});X.i++;renderItem()}}
}

function addNote(html,cls){if(cur&&cur.rep&&!cur.answered){guideNote(html,cls);return}var n=$('note');n.hidden=false;n.insertAdjacentHTML('beforeend','<p class="'+(cls||'')+'">'+html+'</p>');
  var ps=n.querySelectorAll('p');if(ps.length>3)ps[0].remove()}

/* key idea */
function loadIdea(idea){
  cur.idea=idea;var fen=idea.fen||fenOf(idea.moves.split(' '));cur.fen=fen;
  var mv=idea.moves?idea.moves.split(' '):[];
  var flip=idea.orient?idea.orient==='b':new Chess(fen).turn()==='b';
  setBoard(fen,flip,mv.length?mv[mv.length-1]:null,mv.length?fenOf(mv.slice(0,-1)):null);setBar(null,false);
  $('prompt').innerHTML='<div class="op">'+kindPill('idea')+'</div><h3 class="ideaT">'+esc(tt(idea.t))+'</h3><ul class="ideaB">'+
    tt(idea.body).map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul><p><b>'+t('ideaDo')+':</b> '+esc(tt(idea.q))+'</p>';
  setBtns({hint:idea.type==='move',show:true});
  if(idea.type==='move'){B.locked=false;B.onMove=onIdeaMove}
  else if(idea.type==='square'){B.locked=false;B.onTap=function(sq){B.marks={};B.marks[sq]=idea.answer.indexOf(sq)>=0?'ok':'bad';drawBoard();ideaResult(idea.answer.indexOf(sq)>=0)}}
  else{B.locked=true;var ch=$('choices');ch.hidden=false;ch.innerHTML=tt(idea.opts).map(function(o,i){return '<button class="btn opt" data-i="'+i+'">'+esc(o)+'</button>'}).join('');
    ch.querySelectorAll('button').forEach(function(b){b.onclick=function(){if(cur.answered)return;var i=+b.getAttribute('data-i');b.classList.add(i===idea.answer?'okb':'badb');
      if(i!==idea.answer)ch.querySelector('[data-i="'+idea.answer+'"]').classList.add('okb');ideaResult(i===idea.answer)}})}
  drawBoard();
}
function onIdeaMove(mv){
  var idea=cur.idea;B.locked=true;
  if(idea.answer.indexOf(mv.san)>=0){B.marks[mv.to]='ok';drawBoard();ideaResult(true);return}
  if(!idea.tol){B.marks[mv.to]='bad';drawBoard();ideaResult(false,mv.san);return}
  $('fb').textContent=t('checking',mv.san);var after=B.chess.fen(),c=new Chess(cur.fen);c.move(idea.answer[0],{sloppy:true});
  analyse(after,700).then(function(a){return analyse(c.fen(),700).then(function(b){var ok=a&&b&&(wp(-b.s)-wp(-a.s))<idea.tol;B.marks[mv.to]=ok?'ok':'bad';drawBoard();ideaResult(ok,mv.san)})});
}
function ideaResult(ok,san){
  var idea=cur.idea,s=S.ideas[idea.id]||(S.ideas[idea.id]={box:0,due:0});gradeObj(s,ok&&cur.first);
  $('fb').className='feedback '+(ok?'good':'bad');
  $('fb').innerHTML=ok?t('correct','<span class="mono">'+esc(san||idea.answer[0]||'')+'</span>').replace(': .',' ✓'):(idea.type==='move'?t('bestWas',esc(idea.answer[0])):'');
  if(idea.type==='move'&&!ok){later(function(){B.chess=new Chess(cur.fen);B.marks={};var a=arrowFor(cur.fen,idea.answer[0],'#0E9488');B.arrows=a?[a]:[];drawBoard()},900)}
  if(idea.type==='square'&&!ok){idea.answer.forEach(function(q){B.marks[q]='ok'});drawBoard()}
  showWhy([esc(tt(idea.why))]);
  if(idea.type==='move'){cur.goodLine=[idea.answer[0]]}
  if(idea.type!=='choice'){var im=idea.moves?idea.moves.split(' '):[];cur.anPath=function(){return {start:idea.fen||INIT,moves:im.concat(ok&&idea.type==='move'?[idea.answer[0]]:[]),base:im.length,i:im.length+(ok&&idea.type==='move'?1:0)}}}
  itemDone(ok);setBtns({next:true});
}

/* ---------- repertoire screen ---------- */
var repTab='london';
/* folded sections (Repertorio sections, Aprender units): open state kept while the app is open */
var FOLD={};
function foldWire(root){root.querySelectorAll('[data-tg]').forEach(function(b){b.onclick=function(ev){ev.stopPropagation();var k=b.getAttribute('data-tg');FOLD[k]=!FOLD[k];
  var sec=b.closest('.pfam,.unit'),box=sec&&sec.querySelector('.plines');if(box)box.hidden=!FOLD[k];
  var c=b.querySelector('.chev');if(c)c.textContent=FOLD[k]?'▴':'▾';if(b.classList.contains('stog'))b.textContent=FOLD[k]?t('hideLines'):t('seeLines',box?box.querySelectorAll('.lrow').length:0)}})}
function renderRep(op){
  if(op&&REP[op])repTab=op;
  $('repTabs').innerHTML=Object.keys(REP).map(function(k){return '<button class="tab" role="tab" aria-selected="'+(k===repTab)+'" data-op="'+k+'">'+esc(tt(REP[k].name))+'</button>'}).join('');
  $('repTabs').querySelectorAll('button').forEach(function(b){b.onclick=function(){repTab=b.getAttribute('data-op');renderRep()}});
  var ls=repLines(repTab);
  var row=function(x){var st=x.st,lab=!st?t('repNew'):st.box>=3?t('repOkS'):lineDue(x)?t('repDue'):'';
    var kind=x.l.kind==='trap'?'<span class="pill blun">'+t('kindTrap')+'</span> ':x.l.kind==='punish'?'<span class="pill good">'+t('kindPunish')+'</span> ':x.l.surprise?'<span class="pill mist">'+t('kindSurprise')+'</span> ':'';
    var ls0=OS&&OS.lines[String(x.i)],sub=ls0&&wdl(ls0.all).n>=2?wdlHtml(ls0.all,1):x.l.kind==='game'&&x.l.stat?t('repStat',x.l.stat.n,Math.round(x.l.stat.score*x.l.stat.n)):'';
    var e=lineEnd(x.l);
    return '<button class="lrow rrow" data-i="'+x.i+'"><span class="dotst '+(!st?'new':st.box>=3?'ok':lineDue(x)?'due':'')+'"></span><span class="thumb" data-thumb="'+x.i+'">'+miniBoard(e.fen,REP[x.op].side==='b',e.last)+'</span><span class="lname">'+kind+esc(tt(x.l.name))+
      (sub?'<span class="small">'+sub+'</span>':'')+'</span><span class="small">'+lab+'</span></button>'};
  /* Nov 23 ("I don't want to feel I have to learn 20 openings… help me see the connection"): lines grouped by PLAN —
     one plan per family, every line under it is another road to it */
  var OP=window.OPLAN&&OPLAN[repTab],byI={},used={},html='';ls.forEach(function(x){byI[x.i]=x});
  var OS=window.OSTATS?osLive(repTab):null,best=null,worst=null;
  if(OS){html+='<div class="ostat">'+wdlHtml(OS.all)+'</div>';
    Object.keys(OS.groups).forEach(function(k){var x=wdl(OS.groups[k].all);if(x.n<5)return;if(!best||x.pct>best.p)best={k:k,p:x.pct};if(!worst||x.pct<worst.p)worst={k:k,p:x.pct}})}
  (OP?OP.groups:[]).forEach(function(g){var xs=g.g.map(function(i){return byI[i]}).filter(Boolean);if(!xs.length)return;xs.forEach(function(x){used[x.i]=1});
    /* Nov 24 ("a path per section, not one big 2 of 36"): each plan group has its own dots and its own Continue */
    var gi=xs.map(function(x){return x.i}),gnow=gi.filter(function(i){return !pathDone(repTab,i)})[0];if(gnow==null)gnow=gi.filter(function(i){return (S.rep[lineId(repTab,i)].due||0)<=now()})[0];if(gnow==null)gnow=gi[0];
    var gdone=gi.filter(function(i){return pathDone(repTab,i)}).length;
    var gs=OS&&OS.groups[g.k];
    html+='<section class="pfam"><div class="pfh"><h3 class="rgroup">🧭 '+esc(tt(g.t))+'</h3>'+(gs?'<p>'+wdlHtml(gs.all)+(best&&best.k===g.k&&best!==worst?' <span class="pill good">🏆 '+t('secBest')+'</span>':'')+(worst&&worst.k===g.k&&best!==worst?' <span class="pill blun">⚠ '+t('secWorst')+'</span>':'')+'</p>':'')+'<p class="og">'+esc(tt(g.goal))+'</p>'+
      '<div class="pathdots">'+gi.map(function(i){return '<span class="pd '+(i===gnow?'now':pathDone(repTab,i)?'ok':'')+'"></span>'}).join('')+'<span class="small">'+gdone+'/'+gi.length+'</span></div>'+
      '<button class="btn primary sgo" type="button" data-sg="'+gnow+'" data-sgl="'+(function(){var k0=gi.indexOf(gnow),rest=gi.slice(k0).filter(function(i){return !pathDone(repTab,i)});return (rest.length?rest:gi.slice(k0)).join(',')})()+'">▶ '+t(gdone?'pathGo':'pathStart')+'</button>'+(gdone?'<button class="btn sreset" type="button" data-sr="'+g.k+'">↺ '+t('pathReset')+'</button>':'')+
      (g.vid||[]).map(vidBtn).join(' ')+'<button class="btn stog" type="button" data-tg="'+repTab+':'+g.k+'">'+t('seeLines',xs.length)+'</button></div><div class="plines"'+(FOLD[repTab+':'+g.k]?'':' hidden')+'>'+xs.map(row).join('')+'</div></section>'});
  var rest=ls.filter(function(x){return !used[x.i]});if(rest.length)html+='<section class="pfam"><div class="pfh"><h3 class="rgroup">'+t('repOther')+'</h3><button class="btn stog" type="button" data-tg="'+repTab+':_rest">'+t('seeLines',rest.length)+'</button></div><div class="plines"'+(FOLD[repTab+':_rest']?'':' hidden')+'>'+rest.map(row).join('')+'</div></section>';
  /* Nov 24 ("I'm confused: which defense do I use against what?"): one small map on top, the same in every tab */
  var mapH='<details class="repmap"><summary>🗺 '+t('mapT')+'</summary><div class="mapg">'+['mapW','mapE4','mapD4','mapOther'].map(function(k){return '<p>'+t(k)+'</p>'}).join('')+'<p class="small">'+t('mapWhy')+'</p></div></details>';
  $('repList').innerHTML=mapH+html;
  /* Nov 24 ("I finished the first line and it sent me home; the bar said 1 of 1"): Continue starts a session with ALL remaining lines of the section.
     Then ("before it counts as learned I need exercises on each line, and at the end a summary of all of them"): after each line come 2 position
     exercises from THAT line, and the section ends with a mixed review (one position per line + the section's concept questions). */
  $('repList').querySelectorAll('[data-sg]').forEach(function(b){b.onclick=function(ev){ev.stopPropagation();startSession(sectionItems(repTab,(b.getAttribute('data-sgl')||b.getAttribute('data-sg')).split(',').map(Number)),'rep')}});
  foldWire($('repList'));
  $('repList').querySelectorAll('[data-sr]').forEach(function(b){b.onclick=function(ev){ev.stopPropagation();S.pathReset=S.pathReset||{};S.pathReset[repTab+':'+b.getAttribute('data-sr')]=now();save();renderRep()}});
  $('repList').querySelectorAll('.lrow').forEach(function(b){b.onclick=function(ev){var i=+b.getAttribute('data-i');
    { /* tap a line: open a bigger preview right under it, with the moves and a button to practise it */
      var nx=b.nextElementSibling;if(nx&&nx.classList.contains('rprev')){nx.remove();return}
      $('repList').querySelectorAll('.rprev').forEach(function(x){x.remove()});
      var l=REP[repTab].lines[i],e=lineEnd(l),d=document.createElement('div');d.className='rprev';
      d.innerHTML=miniBoard(e.fen,REP[repTab].side==='b',e.last,'mini big')+'<p><button class="btn" type="button" data-w="1">👀 '+t('watchBtn')+'</button></p>'+(planOf(repTab,i)?'<p class="og">🧭 '+esc(tt(planOf(repTab,i).goal))+'</p>':'')+vidBtn(l.video)+' <button class="btn primary" type="button" data-pl="1">'+t('repPlayThis')+'</button>';
      d.querySelector('[data-pl]').onclick=function(){startSession([{t:'line',op:repTab,i:i}],'rep')};d.querySelector('[data-w]').onclick=function(){startSession([{t:'line',op:repTab,i:i,watch:1}],'rep')};if(d.querySelector('[data-pv]'))d.querySelector('[data-pv]').onclick=function(){planGo(repTab,planOf(repTab,i).k)};b.after(d);d.scrollIntoView({block:'nearest',behavior:'smooth'})}}});
  $('repList').querySelectorAll('[data-pk]').forEach(function(b){b.onclick=function(ev){ev.stopPropagation();planGo(repTab,b.getAttribute('data-pk'))}});
  $('bRepGo').textContent=t('repPractice',tt(REP[repTab].name));$('bRepQuiz').textContent=t('bNameQuiz');
}
$('bRepEx')&&($('bRepEx').onclick=function(){var a=lposItems(repTab,null,8),q=oqPick(repTab,2);if(q[0])a.splice(3,0,q[0]);if(q[1])a.splice(7,0,q[1]);startSession(a,'rep')});
$('bRepQuiz').onclick=function(){
  var ls=repLines(repTab),s=ls.filter(function(x){return !!x.st});if(s.length<2)s=ls;
  startSession(s.sort(function(){return Math.random()-.5}).slice(0,5).map(function(x){return {t:'name',op:x.op,i:x.i}}),'rep');
};
$('bRepGo').onclick=function(){
  var ls=repLines(repTab).sort(function(a,b){var ad=lineDue(a)?0:1,bd=lineDue(b)?0:1;return ad-bd||((a.st&&a.st.box||0)-(b.st&&b.st.box||0))});
  startSession(ls.slice(0,5).map(function(x){return {t:'line',op:x.op,i:x.i}}),'rep');
};

/* ---------- mistakes / punish: straight into 10 exercises, no lists ---------- */
/* Nov 19: the tiles run through the WHOLE list — due cards first, then the rest (not seen in the last 20 h, shuffled), then the recent ones.
   He stops with ✕ whenever he wants; every 10 right answers a small 🎉 note. */
function quickSession(kind){
  /* Nov 25: only HIS cards (the Nov 23 bank puzzles after them confused him: "these are not my mistakes"). Unsolved first; if none, due reviews. */
  var st=tileState(kind),L=st.now.length?st.now:st.rev;
  if(!L.length){startSession([{t:'msg',k:kind==='punish'?'noPun':'noMine',n:st.later?(LANG==='es'?st.later+' que fallaste vuelven mañana.':st.later+' you missed come back tomorrow.'):''}],kind);X.back='home';return}
  startSession(L.map(function(c){return {t:'card',id:c.id}}),kind);X.back='home';X.endless=true;
}

/* ---------- fundamentals: coordinates, notation, concept quiz ---------- */
var FILES='abcdefgh';
function rndSq(){return FILES[Math.floor(Math.random()*8)]+(1+Math.floor(Math.random()*8))}
function fundById(id){return FUND.filter(function(f){return f.id===id})[0]}
function quizById(id){return QUIZ.concat(VOCAB,window.OQUIZ||[]).filter(function(q){return q.id===id})[0]}
/* Nov 24: one opening concept question (due first, then never seen) */
function oqPick(op,n){var L=(window.OQUIZ||[]).filter(function(q){return !op||q.op===op});return freshFirst(L.filter(function(q){var s=S.quiz[q.id];return !s||(s.due||0)<=now()}),function(q){return 'oq:'+q.id}).slice(0,n||1).map(function(q){return {t:'quiz',id:q.id}})}
function fundItems(id){
  var o=[];if(!S.seenLesson['f_'+id])o.push({t:'ftheory',f:id});
  if(id==='quiz'){var qs=QUIZ.filter(function(q){var s=S.quiz[q.id];return !s||(s.due||0)<=now()});if(qs.length<3)qs=QUIZ.slice();
    return o.concat(qs.slice(0,8).map(function(q){return {t:'quiz',id:q.id}}))}
  if(id==='flash'||id==='rush'||id==='defend'||id==='game'||id==='calc'||id==='judge'||id==='conv'||id==='trade')return o.concat([{t:'drill',f:id}]);
  return o.concat([{t:'drill',f:id},{t:'drill',f:id},{t:'drill',f:id}]);
}
function loadFTheory(f){
  S.seenLesson['f_'+f.id]=1;save();setBar(null,false);$('boardwrap').hidden=true;
  $('prompt').innerHTML=theoryHtml(kindPill('idea',t('unitFund')),tt(f.t),f.body);
  setBtns({next:true});cur.answered=true;
}
function loadQuiz(q){
  cur.quiz=q;setBar(null,false);$('boardwrap').hidden=true;
  if(q.op&&q.g&&window.OPLAN&&OPLAN[q.op]){var gq=OPLAN[q.op].groups.filter(function(x){return x.k===q.g})[0],li=gq&&gq.g.filter(function(i){return REP[q.op].lines[i]&&!REP[q.op].lines[i].off})[0];
    if(li!=null){var le=lineEnd(REP[q.op].lines[li]);$('boardwrap').hidden=false;setBoard(le.fen,REP[q.op].side==='b',le.last?le.last.san:null,fenOf(REP[q.op].lines[li].moves.slice(0,-1)));B.locked=true;B.onMove=null}seenPuz('oq:'+q.id)}
  $('prompt').innerHTML='<div class="op">'+kindPill('idea',q.id.indexOf('v_')===0?t('vocabT'):q.op?t('oqT')+' · '+esc(tt(REP[q.op].name)):t('unitFund'))+'</div><h3 class="ideaT">'+chessLinks(esc(tt(q.q)))+'</h3>';
  var ch=$('choices');ch.hidden=false;var order=tt(q.o).map(function(_,i){return i}).sort(function(){return Math.random()-.5});
  ch.innerHTML=order.map(function(i){return '<button class="btn opt" data-i="'+i+'">'+esc(tt(q.o)[i])+'</button>'}).join('');
  ch.querySelectorAll('button').forEach(function(b){b.onclick=function(){if(cur.answered)return;var i=+b.getAttribute('data-i'),ok=i===q.a;
    b.classList.add(ok?'okb':'badb');if(!ok)ch.querySelector('[data-i="'+q.a+'"]').classList.add('okb');
    var s=S.quiz[q.id]||(S.quiz[q.id]={box:0,due:0});gradeObj(s,ok);
    $('fb').className='feedback '+(ok?'good':'bad');if(q.op){$('fb').innerHTML=(ok?'✓ ':'✗ ')+chessLinks(esc(tt(q.w)))}else{$('fb').textContent=ok?'✓':'✗';showWhy([esc(tt(q.w))])}itemDone(ok);setBtns({next:true})}});
  setBtns({});
}
/* a drill = one timed round */
function mmss(sec){sec=Math.max(0,Math.round(sec));return Math.floor(sec/60)+':'+('0'+sec%60).slice(-2)}
var DCLK={tok:0,left:0,onOut:null,run:false};
function dclkStart(sec,onOut){DCLK.run=false;DCLK.tok++;DCLK.left=sec*1000;DCLK.onOut=onOut;$('dclk').hidden=false;dclkResume()}
function dclkResume(){if(DCLK.run||!DCLK.onOut)return;DCLK.run=true;var my=++DCLK.tok,t0=now(),l0=DCLK.left,el=$('dclk');
  (function tick(){if(my!==DCLK.tok)return;var left=Math.max(0,(l0-(now()-t0))/1000);DCLK.left=left*1000;
    el.textContent=left>=10?mmss(Math.ceil(left)):'0:0'+left.toFixed(1);el.classList.toggle('low',left<10);
    if(left<=0){DCLK.run=false;DCLK.tok++;var f=DCLK.onOut;DCLK.onOut=null;f();return}setTimeout(tick,100)})()}
function dclkPause(){if(!DCLK.run)return;DCLK.run=false;DCLK.tok++}
function dclkStop(){DCLK.run=false;DCLK.tok++;DCLK.onOut=null;var el=$('dclk');if(el)el.hidden=true}
function timeOut(){$('fb').className='feedback bad';$('fb').innerHTML='⏱ '+t('timeOut')}
function loadDrill(id){
  var D=cur.drill={id:id,n:0,ok:0,total:(cur.it&&cur.it.n)||(id==='nota'?6:id==='sqname'?8:10),t0:now()};
  setBar(null,false);boardEl.classList.toggle('nocoords',id!=='nota');
  D.flip=Math.random()<.5;setBtns({});readyGate(tt(fundById(id).t),t('gate_'+id),null,function(){drillNext();
  dclkStart(D.total*(id==='nota'?15:6),function(){if(!cur||cur.drill!==D||D.n>=D.total)return;D.total=D.n;B.onTap=null;B.onMove=null;drillEnd();$('fb').innerHTML='⏱ '+t('timeOut')+' '+$('fb').innerHTML});})
}
function drillHead(){var D=cur.drill,f=fundById(D.id);return '<div class="op">'+kindPill('idea',esc(tt(f.t)))+' <span class="counter">'+(D.n+1)+'/'+D.total+' · ✓ '+D.ok+'</span></div>'}
function drillStep(ok){var D=cur.drill;D.n++;if(ok)D.ok++;if(D.n>=D.total){drillEnd();return}later(drillNext,ok?350:1900)}
function drillNext(){
  var D=cur.drill;$('choices').hidden=true;$('choices').innerHTML='';$('fb').innerHTML='';
  if(D.id==='coord'){
    if(D.n===5)D.flip=!D.flip;var sq=rndSq();D.sq=sq;
    setBoard('8/8/8/8/8/8/8/8 w - - 0 1',D.flip);
    $('prompt').innerHTML=drillHead()+'<div class="bigq">'+t('tapSq','<b class="mono">'+sq+'</b>')+'</div><p class="small">'+(D.flip?t('blackBottom'):t('whiteBottom'))+'</p>';
    B.locked=false;B.onTap=function(s){B.locked=true;B.marks={};B.marks[sq]='ok';if(s!==sq)B.marks[s]='bad';drawBoard();
      if(s!==sq)$('fb').innerHTML='<span class="mono">'+s+'</span> ≠ <span class="mono">'+sq+'</span>';drillStep(s===sq)};
  }else if(D.id==='sqname'){
    if(D.n===4)D.flip=!D.flip;var q=rndSq(),opts=[q];while(opts.length<4){var x=rndSq();if(opts.indexOf(x)<0)opts.push(x)}opts.sort();
    setBoard('8/8/8/8/8/8/8/8 w - - 0 1',D.flip);B.marks[q]='sel';drawBoard();B.locked=true;
    $('prompt').innerHTML=drillHead()+'<div class="bigq">'+t('nameSq')+'</div><p class="small">'+(D.flip?t('blackBottom'):t('whiteBottom'))+'</p>';
    choices(opts.map(function(o){return [o,o]}),q,function(ok,pick){B.marks={};B.marks[q]='ok';if(!ok)B.marks[pick]='bad';drawBoard();drillStep(ok)});
  }else{ /* nota: alternate "play this move" and "which move was played?" */
    var c=randomPos(),mv=pickMove(c);if(!mv){drillNext();return}var fen=c.fen();
    setBoard(fen,c.turn()==='b');
    if(D.n%2===0){
      $('prompt').innerHTML=drillHead()+'<div class="bigq">'+t('playMv','<b class="mono">'+esc(mv.san)+'</b>')+'</div>';
      B.locked=false;B.onMove=function(m){B.locked=true;var ok=m.san===mv.san;
        if(!ok){B.marks[m.to]='bad';var a=arrowFor(fen,mv.san,'#0E9488');B.arrows=a?[a]:[];$('fb').innerHTML=t('wasMv','<span class="mono">'+esc(m.san)+'</span>','<span class="mono">'+esc(mv.san)+'</span>')}else B.marks[m.to]='ok';
        drawBoard();drillStep(ok)};
    }else{
      var others=c.moves().filter(function(s){return s!==mv.san}).sort(function(){return Math.random()-.5}).slice(0,3);
      c.move(mv.san);setBoard(c.fen(),c.turn()==='w',mv.san,fen);B.locked=true;
      $('prompt').innerHTML=drillHead()+'<div class="bigq">'+t('whichMv')+'</div><p class="small">'+t('markedMv')+'</p>';
      choices(others.concat([mv.san]).sort().map(function(o){return [o,o]}),mv.san,function(ok){drillStep(ok)});
    }
  }
}
function choices(opts,right,cb){var ch=$('choices');ch.hidden=false;ch.classList.add('grid');
  ch.innerHTML=opts.map(function(o){return '<button class="btn opt mono" data-v="'+esc(o[0])+'">'+esc(o[1])+'</button>'}).join('');
  ch.querySelectorAll('button').forEach(function(b){b.onclick=function(){if(ch.dataset.done)return;ch.dataset.done=1;var v=b.getAttribute('data-v'),ok=v===right;
    b.classList.add(ok?'okb':'badb');if(!ok){var r=ch.querySelector('[data-v="'+right+'"]');if(r)r.classList.add('okb')}cb(ok,v)}});delete ch.dataset.done}
function randomPos(){
  var cs=Object.keys(S.cards).map(function(k){return S.cards[k]}).filter(function(c){return c.line&&c.line.length>=6});
  var line=cs.length?cs[Math.floor(Math.random()*cs.length)].line:[];var c=new Chess();line.forEach(function(s){c.move(s,{sloppy:true})});return c;
}
function pickMove(c){var ms=c.moves({verbose:true});if(!ms.length)return null;
  var pieces=ms.filter(function(m){return m.piece!=='p'}),caps=ms.filter(function(m){return m.captured});
  var pool=Math.random()<.35&&caps.length?caps:Math.random()<.7&&pieces.length?pieces:ms;return pool[Math.floor(Math.random()*pool.length)]}
function drillEnd(){dclkStop();
  var D=cur.drill,sec=Math.round((now()-D.t0)/1000),s=S.drill[D.id]||(S.drill[D.id]={best:0,bestT:0,runs:0});s.runs++;
  var better=D.ok>s.best||(D.ok===s.best&&(!s.bestT||sec<s.bestT));if(better){s.best=D.ok;s.bestT=sec}addTot(D.id,D.ok);save();
  boardEl.classList.remove('nocoords');
  $('fb').className='feedback '+(D.ok>=D.total*.8?'good':'bad');$('fb').innerHTML=t('drillRes',D.ok,D.total,mmss(sec))+(better&&D.ok>0?' 🏆 '+t('newBest'):' · '+t('bestWas2',s.best,mmss(s.bestT||0)));
  itemDone(D.ok>=D.total*.8);setBtns({next:true});
}

/* ---------- strategy: "find the plan" (quiet moves from his own games) + commentator vocabulary ---------- */
VOCAB.forEach(function(q){if(q.id.indexOf('v_')!==0)q.id='v_'+q.id});
var OPTC=['#2563EB','#E8730C','#7C3AED'];
/* progress that the daily also feeds: every solved position counts toward its drill / lesson in Aprender */
var GOAL={coord:100,sqname:100,nota:40,flash:40,rush:60,defend:40,game:50,calc:100,judge:80,conv:60,trade:60};
function addTot(id,n){var s=S.drill[id]||(S.drill[id]={best:0,bestT:0,runs:0});s.tot=(s.tot||0)+(n||0)}
function markPuz(p,ok){if(!ok||!p)return;var s=S.puz[p.id]||(S.puz[p.id]={box:0,due:0});if(!s.box||(s.due||0)<=now())gradeObj(s,true)}
function progSnap(){var o={};
  CURSO.lessons.forEach(function(l){o['l:'+l.id]=[tt(l.t),lessonProg(l).ok]});
  FUND.forEach(function(f){if(f.id!=='quiz')o['d:'+f.id]=[tt(f.t).split(':')[0],(S.drill[f.id]&&S.drill[f.id].tot)||0]});
  o.quiz=[tt(fundById('quiz').t).split('?')[0]+'?',QUIZ.filter(function(q){return S.quiz[q.id]&&S.quiz[q.id].box>=2}).length];
  o.vocab=[t('vocabT'),VOCAB.filter(function(q){return S.quiz[q.id]&&S.quiz[q.id].box>=2}).length];
  STRAT.forEach(function(x){o['s:'+x.id]=[tt(x.t),planProg(x.id).ok]});
  o.ideas=[t('unitIdeas'),IDEAS.filter(function(x){return S.ideas[x.id]&&S.ideas[x.id].box>=2}).length];
  return o}
function advTxt(){if(!X.snap)return '';var a=progSnap(),out=[];Object.keys(a).forEach(function(k){var d=a[k][1]-((X.snap[k]||[0,0])[1]);if(d>0)out.push('<b>'+esc(a[k][0])+'</b> +'+d)});
  return out.length?t('advanced')+' '+out.join(' · '):''}
function stratById(id){return STRAT.filter(function(x){return x.id===id})[0]}
function plansOf(tag){return (window.PLANS&&PLANS[tag])||[]}
function planProg(tag){var ps=plansOf(tag),ok=ps.filter(function(_,k){var s=S.plan[tag+':'+k];return s&&s.box>=1}).length;return {ok:ok,n:ps.length,pct:ps.length?ok/ps.length:0}}
function curStrat(){return STRAT.filter(function(x){return plansOf(x.id).length&&planProg(x.id).pct<.6})[0]||STRAT.filter(function(x){return plansOf(x.id).length})[0]}
function stratItems(id,max){
  var ps=plansOf(id).map(function(_,k){return k}).filter(function(k){var s=S.plan[id+':'+k];return !s||(s.due||0)<=now()});
  var o=[];if(!S.seenLesson['s_'+id])o.push({t:'stheory',s:id});
  return o.concat(ps.slice(0,max||6).map(function(k){return {t:'plan',s:id,k:k}}));
}
function loadSTheory(x){
  S.seenLesson['s_'+x.id]=1;save();setBar(null,false);var ex=plansOf(x.id)[0];if(ex){var me=new Chess(ex.fen).turn();animExample(ex.fen,(ex.pv||[ex.best]).slice(0,4),me==='b',me)}else $('boardwrap').hidden=true;
  $('prompt').innerHTML=theoryHtml(kindPill('idea',t('unitStrat')),tt(x.t),x.body);
  setBtns({next:true});cur.answered=true;
}
function loadPlan(tag,k){
  var p=plansOf(tag)[k];if(!p){skip();return}
  var me=new Chess(p.fen).turn(),opts=[{san:p.best,s:p.s,pv:p.pv,best:true}].concat(p.opts).sort(function(){return Math.random()-.5});
  cur.plan={tag:tag,k:k,p:p,me:me,opts:opts};
  setBoard(p.fen,me==='b');setBar(toW(p.s,me),false);B.locked=true;
  B.arrows=opts.map(function(o,i){var a=arrowFor(p.fen,o.san,OPTC[i]);return a}).filter(Boolean);drawBoard();
  var x=stratById(tag);
  $('prompt').innerHTML='<div class="op">'+kindPill('idea',esc(tt(x.t)))+' <span class="small">'+sideTxt(me==='w'?'w':'b')+'</span></div>'+t('planQ');
  var ch=$('choices');ch.hidden=false;
  ch.innerHTML=opts.map(function(o,i){return '<button class="btn opt" data-i="'+i+'"><span class="odot" style="background:'+OPTC[i]+'"></span><b class="mono">'+esc(o.san)+'</b></button>'}).join('');
  ch.querySelectorAll('button').forEach(function(b){b.onclick=function(){if(!cur.answered)planAnswer(+b.getAttribute('data-i'))}});
  setBtns({});
}
function planWhy(P){
  var p=P.p,c=new Chess(p.fen),m=c.move(p.best,{sloppy:true}),pc=pcName(m.piece),w=[];
  var tpl={improve:t('pl_improve',pc,m.from,p.m0,m.to,p.m1),break:t('pl_break','<b class="mono">'+esc(p.best)+'</b>'),rook:t('pl_rook',m.to[0]),
    outpost:t('pl_outpost',m.to),prophy:t('pl_prophy','<b class="mono">'+esc(p.best)+'</b>'),king:t('pl_king',m.to),trade:t('pl_trade',pcName(m.captured||'n'),m.to)}[P.tag];
  w.push(tpl);
  w.push(t('planEvals',P.opts.map(function(o){return '<b class="mono">'+esc(o.san)+'</b> '+evalTxt(o.s)}).join(' · ')));
  w.push(t('planLine',pvText(p.fen,p.pv,6)));
  return w;
}
function planAnswer(i){
  var P=cur.plan,o=P.opts[i],ok=!!o.best,ch=$('choices');
  ch.querySelectorAll('button').forEach(function(b,j){if(P.opts[j].best)b.classList.add('okb');else if(j===i)b.classList.add('badb')});
  var s=S.plan[P.tag+':'+P.k]||(S.plan[P.tag+':'+P.k]={box:0,due:0});gradeObj(s,ok);
  var bi=P.opts.findIndex(function(x){return x.best});var a=arrowFor(P.p.fen,P.p.best,'#0E9488');B.arrows=a?[a]:[];drawBoard();
  $('fb').className='feedback '+(ok?'good':'bad');$('fb').innerHTML=ok?t('correct','<span class="mono">'+esc(o.san)+'</span>'):t('planNo','<span class="mono">'+esc(o.san)+'</span>',evalTxt(o.s),'<span class="mono">'+esc(P.p.best)+'</span>',evalTxt(P.p.s));
  showWhy(planWhy(P));cur.goodLine=P.p.pv;
  cur.anPath=function(){return {start:P.p.fen,moves:P.p.pv,base:0,i:0,keepArrows:true}};
  itemDone(ok);setBtns({next:true,good:true});setBar(toW(P.p.s,P.me));
}

/* ---------- speed & vision: Flash (see 3 s, then answer blind), Rush (timed puzzles, 3 lives), Scan (thinking routine on the board) ---------- */
/* drill pools: course puzzles + the drill banks in debiles.js (d_*), positions NOT seen in the last 7 days first (Nov 19: "you always show me the same mate") */
var DBANK={mate1:'d_mate1',hanging:'d_hang',fork:'d_fork',backrank:'d_back',mate2:'d_mate2'};
/* Nov 22 ("I'm seeing repeated exercises"): order any pool unseen-first; things seen in the last 7 days go last, oldest-seen first */
function freshFirst(arr,key){var sn=S.seen||{};return arr.map(function(x){var t=sn[key(x)]||0;return {x:x,k:t?1e13+t:Math.random()}}).sort(function(a,b){return a.k-b.k}).map(function(o){return o.x})}
/* Nov 23: every drill position he answers is kept (type, position, right?, seconds, timed out?, his move) so his practice can be reviewed */
function dlog(type,fen,ok,sec,to,san){S.dlog=S.dlog||[];S.dlog.push([now(),type,fen.split(' ').slice(0,4).join(' '),ok?1:0,sec,to?1:0,san||'']);if(S.dlog.length>600)S.dlog=S.dlog.slice(-600)}
function seenPuz(id){if(!id)return;S.seen=S.seen||{};S.seen[id]=now();var k=Object.keys(S.seen);if(k.length>4000){k.sort(function(a,b){return S.seen[a]-S.seen[b]}).slice(0,1000).forEach(function(x){delete S.seen[x]})}}
function puzPool(ids,maxR){var o=[];CURSO.lessons.forEach(function(l){if(ids.indexOf(l.id)>=0)l.p.forEach(function(p){if(p.r<=maxR)o.push({l:l,p:p})})});
  ids.forEach(function(id){var b=DBANK[id],L=b&&weakL(b);if(L)L.p.forEach(function(p){if(p.r<=maxR)o.push({l:L,p:p})})});
  /* Nov 23: anything already shown (ever) goes after every unseen puzzle, oldest-seen first */
  var sn=S.seen||{};o.forEach(function(x){var t=sn[x.p.id];x.k=t?1+t/1e13:Math.random()});return o.sort(function(a,b){return a.k-b.k})}
function afterFirst(p){var c=new Chess(p.fen);var m=c.move(p.m[0],{sloppy:true});return {c:c,m:m}}
/* Flash */
function loadFlash(){
  var pool=puzPool(['hanging','mate1'],1400);var F=cur.flash={pool:pool,n:0,ok:0,total:(cur.it&&cur.it.n)||8,t0:now()};setBar(null,false);setBtns({});flashNext();
}
/* levels: 1-3 = read the question first, "I'm ready", look 5 / 3 / 2 s; 4-5 = game mode (no question beforehand), 3 / 2 s */
var FL=[null,{q:1,s:5},{q:1,s:3},{q:1,s:2},{q:0,s:3},{q:0,s:2}];
function flashLvl(){return Math.min(5,(S.drill.flash&&S.drill.flash.lvl)||1)}
function flashNext(){
  var F=cur.flash,lvl=flashLvl();
  if(F.n>=F.total){var sec=Math.round((now()-F.t0)/1000),s=S.drill.flash||(S.drill.flash={best:0,bestT:0,runs:0,lvl:1});s.runs++;addTot('flash',F.ok);var better=F.ok>s.best;if(better){s.best=F.ok;s.bestT=sec}
    var msg='';if(F.stopped){}else if(F.ok>=F.total*.75&&lvl<5){s.lvl=lvl+1;msg=' ⬆ '+t('flashUp',s.lvl)}else if(F.ok<=F.total*.375&&lvl>1){s.lvl=lvl-1;msg=' ⬇ '+t('flashDown',s.lvl)}save();
    boardEl.classList.remove('nopieces');$('choices').hidden=true;$('fb').className='feedback '+(F.ok>=F.total*.75?'good':'bad');$('fb').innerHTML=t('drillRes',F.ok,F.total,mmss(sec))+(better&&F.ok?' 🏆 '+t('newBest'):'')+msg;itemDone(F.ok>=F.total*.75);setBtns({next:true});return}
  var it=F.pool[F.n%F.pool.length],a=afterFirst(it.p),c=a.c,me=c.turn(),sol=c.move(it.p.m[1],{sloppy:true});c.undo();seenPuz(it.p.id);
  var kind=it.l.id==='mate1'?'mate':'hang',ans=sol.to,secs=FL[lvl].s,q=t(kind==='mate'?'flashQM':'flashQH');
  setBoard(c.fen(),me==='b',a.m.san,it.p.fen);B.locked=true;$('fb').innerHTML='';
  var head='<div class="op">'+kindPill('idea',t('flashT'))+' <span class="counter">'+t('flashLvlN',lvl,secs)+' · '+(F.n+1)+'/'+F.total+' · ✓ '+F.ok+'</span></div>';
  function look(){
    $('choices').hidden=true;boardEl.classList.remove('nopieces');drawBoard();
    $('prompt').innerHTML=head+'<div class="bigq">'+(FL[lvl].q?t(kind==='mate'?'flashLookM':'flashLookH'):t('flashLookAll'))+'</div><div class="timer"><span id="tmr"></span></div><p class="small">'+sideTxt(me)+'</p>';
    timerBar(secs*1000,ask);
  }
  function ask(){
    boardEl.classList.add('nopieces');B.marks={};drawBoard();
    $('prompt').innerHTML=head+'<div class="bigq">'+q+'</div><p class="small">'+sideTxt(me)+'</p>';
    B.locked=false;B.onTap=function(sq){B.locked=true;B.onTap=null;boardEl.classList.remove('nopieces');
      var good=flashAnswers(c,kind,ans),ok=good.indexOf(sq)>=0;F.n++;if(ok){F.ok++;markPuz(it.p,true)}
      /* pause: review the position (pieces back, every valid answer marked), explore with ◀ ▶ or by moving pieces */
      cur.answered=true;anSet(c.fen(),it.p.m.slice(1),0,0);B.onMove=anMove;
      good.forEach(function(g){B.marks[g]='ok'});if(!ok)B.marks[sq]='bad';var ar=arrowFor(c.fen(),it.p.m[1],'#0E9488');B.arrows=ar?[ar]:[];drawBoard();
      $('fb').className='feedback '+(ok?'good':'bad');$('fb').innerHTML=(ok?'✓ ':'✗ ')+flashExplain(c,kind,good,sq,ok)+' <span class="small">'+t('flashReview')+'</span>';
      var ch=$('choices');ch.hidden=false;ch.classList.remove('grid');ch.innerHTML='<button class="btn primary" id="bFlashNext">'+t('flashNextR')+'</button>';
      $('bFlashNext').onclick=function(){anOff();cur.answered=false;B.onMove=null;flashNext()}};
  }
  if(FL[lvl].q){ /* question first, board hidden until "I'm ready" */
    boardEl.classList.add('nopieces');drawBoard();
    $('prompt').innerHTML=head+'<div class="bigq">'+t(kind==='mate'?'flashLookM':'flashLookH')+'</div><p class="small">'+t('flashReadyHint',secs)+'</p>';
    var ch=$('choices');ch.hidden=false;ch.classList.remove('grid');ch.innerHTML='<button class="btn primary" id="bReady">'+t('flashReady')+'</button>';
    $('bReady').onclick=look;
  }else look();
}
/* every square that answers the question, not only the puzzle's: any free piece / any mating move */
function flashAnswers(c,kind,ans){
  var out=[ans],ms=c.moves({verbose:true});
  ms.forEach(function(m){
    if(kind==='mate'){c.move(m.san);var x=c.in_checkmate();c.undo();if(x&&out.indexOf(m.to)<0)out.push(m.to)}
    else if(m.captured){c.move(m.san);var re=c.moves({verbose:true}).some(function(r){return r.to===m.to});c.undo();
      if((!re||VAL[m.captured]>VAL[m.piece])&&VAL[m.captured]>=1&&out.indexOf(m.to)<0)out.push(m.to)}
  });return out;
}
function flashExplain(c,kind,good,sq,ok){
  var ms=c.moves({verbose:true}),E=good.map(function(g){var m=ms.filter(function(x){return x.to===g&&(kind!=='mate'||(function(){c.move(x.san);var y=c.in_checkmate();c.undo();return y})())})[0];
    return {sq:g,m:m,v:m&&m.captured?VAL[m.captured]:0}}).filter(function(e){return e.m});
  var fmt=function(e){return kind==='mate'?'<b class="mono">'+esc(e.m.san)+'</b>':pcA(e.m.captured)+' '+e.sq+' (<span class="mono">'+esc(e.m.san)+'</span>)'};
  if(ok){ /* he saw one: that is the point. Others are a tip, not a mistake. */
    var mine=E.filter(function(e){return e.sq===sq})[0],rest=E.filter(function(e){return e.sq!==sq});
    var h=kind==='mate'?t('flashOkMate',mine?fmt(mine):sq):t('flashOkFree',mine?fmt(mine):sq);
    if(rest.length){var big=kind!=='mate'&&mine&&rest.some(function(e){return e.v>mine.v});
      h+=' '+(big?t('flashTipBig',rest.filter(function(e){return e.v>mine.v}).map(fmt).join(', ')):t('flashAlso',rest.map(fmt).join(', ')))}
    return h}
  var h2=kind==='mate'?t('flashMates',E.map(fmt).join(', ')):t('flashFree',E.map(fmt).join(', '));
  var p=c.get(sq);h2+=' · '+(!p?t('flashEmpty',sq):p.color===c.turn()?t('flashOwn',sq):t('flashDefended',pcName(p.type),sq));
  return h2;
}
var TBAR=0;function stopBar(){TBAR++}
function timerBar(ms,cb){var el=$('tmr');if(!el){later(cb,ms);return}var t0=now(),ck=$('clk'),my=++TBAR;
  (function tick(){if(my!==TBAR)return;var left=Math.max(0,1-(now()-t0)/ms);el.style.width=(left*100)+'%';el.classList.toggle('low',left<.3);
    if(ck){var sc=left*ms/1000;ck.textContent=sc>=10?'0:'+Math.floor(sc):'0:0'+sc.toFixed(1);ck.classList.toggle('low',sc<5)}if(left<=0){cb();return}later(tick,100)})()}
/* Rush */
function loadRush(){
  var pool=puzPool(['hanging','mate1','fork','backrank','pin'],1350).concat(puzPool(['mate2'],1300)).sort(function(a,b){return a.k-b.k});
  if(cur.it&&cur.it.n)pool=pool.slice(0,cur.it.n+3);
  cur.rush={max:(cur.it&&cur.it.n)||99,pool:pool,n:0,ok:0,lives:3,sec:rushSec(),missed:[],times:[]};setBar(null,false);setBtns({});readyGate(t('rushT'),t('gateRush'),String((S.drill.rush&&S.drill.rush.sec)||20),rushNext);
}
function rushSec(){var s=S.drill.rush;return Math.max(8,Math.min(30,(s&&s.sec)||20))}
function rushHead(){var R=cur.rush;return '<div class="op">'+kindPill('idea',t('rushT'))+' <span class="counter">'+'❤️'.repeat(R.lives)+'🤍'.repeat(3-R.lives)+' · ✓ '+R.ok+'</span></div>'}
function rushNext(){
  var R=cur.rush;if(R.lives<=0||R.n>=R.pool.length||R.ok>=R.max){rushEnd();return}
  var it=R.pool[R.n++],a=afterFirst(it.p),c=a.c,me=c.turn();R.cur={p:it.p,ply:1,me:me,done:false};seenPuz(it.p.id);
  setBoard(c.fen(),me==='b',a.m.san,it.p.fen);B.locked=false;$('fb').innerHTML='';
  $('prompt').innerHTML=rushHead()+'<div class="bigq">'+t('rushQ')+'</div><div class="clockrow"><span class="clock" id="clk"></span><div class="timer"><span id="tmr"></span></div></div>';
  var tok=R.tok=(R.tok||0)+1;R.t0=now();
  timerBar(R.sec*1000,function(){if(R.tok===tok&&!R.cur.done)rushFail(t('rushTime'))});
  B.onMove=function(mv){var P=R.cur;if(P.done)return;var want=P.p.m[P.ply];
    var ok=mv.san===want||(P.ply===P.p.m.length-1&&B.chess.in_checkmate());
    if(!ok){B.marks[mv.to]='bad';drawBoard();rushFail('',mv.san);return}
    P.ply++;B.marks[mv.to]='ok';drawBoard();
    if(P.ply>=P.p.m.length){P.done=true;stopBar();R.ok++;markPuz(P.p,true);R.times.push((now()-R.t0)/1000);R.tok++;B.locked=true;$('fb').className='feedback good';$('fb').textContent='✓';later(rushNext,500);return}
    B.locked=true;later(function(){var m=B.chess.move(P.p.m[P.ply],{sloppy:true});P.ply++;B.marks={};if(m){B.marks[m.from]='last';B.marks[m.to]='last'}drawBoard();B.locked=false},300)};
}
function rushFail(msg,wrong){stopBar();var R=cur.rush,P=R.cur;P.done=true;R.lives--;B.locked=true;R.tok++;R.missed.push({p:P.p,ply:P.ply,wrong:wrong||null,t:R.n});
  var f=B.chess.fen();try{B.chess.undo()}catch(e){}var ar=arrowFor(B.chess.fen(),P.p.m[P.ply],'#0E9488');if(!ar){B.chess=new Chess(f)}B.arrows=ar?[ar]:[];drawBoard();
  $('fb').className='feedback bad';$('fb').innerHTML=(msg?msg+' ':'')+'✗ '+t('bestWas',esc(P.p.m[P.ply]))+' <span class="small">'+t('flashReview')+'</span>';$('prompt').querySelector('.counter').textContent='❤️'.repeat(Math.max(0,R.lives))+'🤍'.repeat(3-Math.max(0,R.lives))+' · ✓ '+R.ok;
  /* pause: the clock is stopped; see the solution, step it with ▶, explained in words, then continue */
  cur.answered=true;anSet(P.p.fen,P.p.m,P.ply,P.ply);B.onMove=anMove;var a0=arrowFor(anChess(P.ply).fen(),P.p.m[P.ply],'#0E9488');if(a0){B.arrows=[a0];drawBoard()}
  var f0=anChess(P.ply).fen();$('why').innerHTML='';showWhy([fold(t('stStep'),story(f0,P.p.m.slice(P.ply),new Chess(f0).turn(),8))]);
  var ch=$('choices');ch.hidden=false;ch.classList.remove('grid');ch.innerHTML='<button class="btn primary" id="bRushNext">'+t('flashNextR')+'</button>';
  $('bRushNext').onclick=function(){anOff();cur.answered=false;B.onMove=null;$('why').hidden=true;$('choices').hidden=true;rushNext()}}
function rushEnd(){stopBar();var R=cur.rush;R.ended=true;var s=S.drill.rush||(S.drill.rush={best:0,bestT:0,runs:0});s.runs++;addTot('rush',R.ok);var better=R.ok>s.best;if(better)s.best=R.ok;
  /* the clock adapts: solving comfortably -> less time next run; struggling -> a bit more */
  var avg=R.times.length?R.times.reduce(function(a,b){return a+b},0)/R.times.length:0,sec=R.sec,msg='';s.sec=sec;
  if(R.ok>=Math.min(8,R.max)&&avg<sec*.5&&sec>8){s.sec=Math.max(8,sec-(avg<sec*.3?5:3));msg='<br>⬆ '+t('rushFaster',s.sec)}
  else if(!R.stopped&&R.ok<Math.min(4,R.max*.6)&&sec<30){s.sec=Math.min(30,sec+3);msg='<br>⬇ '+t('rushSlower',s.sec)}
  save();B.locked=true;B.onMove=null;
  $('fb').className='feedback good';$('fb').innerHTML=t('rushRes',R.ok)+(avg?' · '+t('rushAvg',avg.toFixed(1)):'')+(better&&R.ok?' 🏆 '+t('newBest'):' · '+t('rushBest',s.best))+msg;itemDone(R.ok>=5);setBtns({next:true});
  if(R.missed.length){var ch=$('choices');ch.hidden=false;ch.classList.remove('grid');
    ch.innerHTML='<p class="small">'+t('rushMissed')+'</p>'+R.missed.map(function(x,k){return '<button class="btn opt" data-k="'+k+'">'+t('rushRevBtn',k+1,x.wrong?esc(x.wrong):t('rushTime'),esc(x.p.m[x.ply]))+'</button>'}).join('');
    ch.querySelectorAll('[data-k]').forEach(function(b){b.onclick=function(){var x=R.missed[+b.getAttribute('data-k')];
      anSet(x.p.fen,x.p.m,x.ply,x.ply);B.onMove=anMove;var a=arrowFor(anChess(x.ply).fen(),x.p.m[x.ply],'#0E9488');if(a){B.arrows=[a];drawBoard()}
      $('fb').className='feedback';$('fb').innerHTML=t('rushRev',x.wrong?'<span class="mono">'+esc(x.wrong)+'</span>':t('rushTime'),'<span class="mono">'+esc(x.p.m[x.ply])+'</span>')+' <span class="small">'+t('flashReview')+'</span>';var f0=anChess(x.ply).fen();$('why').innerHTML='';showWhy([fold(t('stStep'),story(f0,x.p.m.slice(x.ply),new Chess(f0).turn(),8))]);window.scrollTo(0,0)}})}
}
/* Defend: the opponent has a threat (mate in 1 or winning material). 1) name it, 2) play a move that stops it.
   Positions = course puzzles with the move handed to the victim (side to move swapped). */
function oppThreats(c){
  var mates=[],free=[],max=0;c.moves({verbose:true}).forEach(function(m){c.move(m.san);var mate=c.in_checkmate(),re=!mate&&m.captured&&c.moves({verbose:true}).some(function(r){return r.to===m.to});c.undo();
    if(mate){mates.push(m);return}if(!m.captured)return;var g=VAL[m.captured]-(re?VAL[m.piece]:0);m.gain=g;if(g>max)max=g;if(g>=2)free.push(m)});
  free.sort(function(a,b){return b.gain-a.gain});return {mates:mates,free:free,max:max};
}
function defMake(it){
  var a=afterFirst(it.p);if(!a.m||a.c.in_check())return null;var th=oppThreats(a.c),kind=th.mates.length?'mate':th.free.length?'hang':null;if(!kind)return null;
  var f=a.c.fen().split(' ');f[1]=f[1]==='w'?'b':'w';f[3]='-';var d=new Chess();if(!d.load(f.join(' '))||d.game_over())return null;
  var ms=d.moves({verbose:true}),good=[];if(d.in_check()||ms.length<3)return null;
  ms.forEach(function(m){d.move(m.san);var ok=d.in_checkmate();if(!ok&&!d.game_over()){var t2=oppThreats(d);ok=!t2.mates.length&&t2.max-(m.captured?VAL[m.captured]:0)<2}d.undo();if(ok)good.push(m.san)});
  if(!good.length||good.length>ms.length*.6)return null;
  return {d:d,kind:kind,th:kind==='mate'?th.mates:th.free,good:good,pid:it.p.id};
}
function loadDefend(){
  var pool=puzPool(['mate1','hanging','backrank','fork'],1500),list=[],cnt={mate:0,hang:0};
  var N=(cur.it&&cur.it.n)||8,cap=Math.ceil(N*.6);for(var i=0;i<pool.length&&list.length<N;i++){var x=defMake(pool[i]);if(x&&cnt[x.kind]<cap){cnt[x.kind]++;list.push(x)}}
  cur.def={list:list,n:0,ok:0,total:list.length,t0:now()};setBar(null,false);setBtns({});readyGate(t('defT'),t('gateDef'),'35',defNext);

}
function defHead(){var D=cur.def;return '<div class="op">'+kindPill('idea',t('defT'))+' <span class="counter">'+Math.min(D.n+1,D.total)+'/'+D.total+' · ✓ '+D.ok+'</span></div>'}
function sanList(ms){return ms.slice(0,4).map(function(m){return '<b class="mono">'+esc(m.san||m)+'</b>'}).join(', ')}
function defNext(){
  var D=cur.def;if(D.n>=D.total){defEnd();return}
  var x=D.list[D.n],me=x.d.turn();seenPuz(x.pid);anOff();cur.answered=false;$('choices').hidden=true;
  setBoard(x.d.fen(),me==='b');$('fb').innerHTML='';$('fb').className='feedback';
  $('prompt').innerHTML=defHead()+'<div class="bigq">'+t('defQ')+'</div><p class="small">'+sideTxt(me)+'</p>';
  B.locked=false;B.onMove=function(mv){
    var ok=x.good.indexOf(mv.san)>=0;B.locked=true;B.onMove=null;D.n++;if(ok)D.ok++;
    var th=t(x.kind==='mate'?'defIsMate':'defIsHang',sanList(x.th)),h;
    if(ok)h='✓ '+t('defGood')+' '+th;
    else{var t2=oppThreats(B.chess),bad=t2.mates[0]||t2.free[0];h='✗ '+th+' '+(bad?t(t2.mates.length?'defStillMate':'defStillHang','<b class="mono">'+esc(bad.san)+'</b>')+' ':'')+t('defGoodWere',sanList(x.good))}
    var opp=me==='w'?'b':'w';pauseReview(x.d.fen(),[mv.san],ok,h,x.th.slice(0,2).map(function(m){return {from:m.from,to:m.to,c:'#C0392B'}}),defNext,fold(t('stThreat'),story(flipTurn(x.d.fen(),opp),[x.th[0].san],me,1)));
  };
  var myPos=D.n;dclkStart(35,function(){if(!cur||cur.def!==D||D.n!==myPos||cur.answered)return;B.locked=true;B.onMove=null;D.n++;
    var opp=me==='w'?'b':'w',th=t(x.kind==='mate'?'defIsMate':'defIsHang',sanList(x.th)),ga=arrowFor(x.d.fen(),x.good[0],'#0E9488');
    pauseReview(x.d.fen(),[],false,'⏱ '+t('timeOut')+' '+th+' '+t('defGoodWere',sanList(x.good)),x.th.slice(0,2).map(function(m){return {from:m.from,to:m.to,c:'#C0392B'}}).concat(ga?[ga]:[]),defNext,fold(t('stThreat'),story(flipTurn(x.d.fen(),opp),[x.th[0].san],me,1)))});
}
/* shared pause after an answer: pieces stay, analysis bar on, threat/answer arrows, "Next ▶" */
function pauseReview(fen,moves,ok,html,arrows,next,why){
  dclkPause();cur.answered=true;cur.inPause=true;cur.revI=null;cur.revs=cur.revs||[];cur.revs.push({fen:fen,moves:moves.slice(),ok:ok,html:html,arrows:(arrows||[]).slice(),why:why,flip:B.flip});cur.revNext=next;$('bPrevEx').disabled=false;
  $('trBody').classList.add('answered');if(why){$('why').innerHTML='';showWhy([why])}else{$('why').hidden=true}anSet(fen,moves,Math.min(1,moves.length),0);B.onMove=anMove;
  if(arrows&&arrows.length){B.arrows=arrows;drawBoard()}
  $('fb').className='feedback '+(ok?'good':'bad');$('fb').innerHTML=html+' <span class="small">'+t('flashReview')+'</span>';
  var ch=$('choices');ch.hidden=false;ch.classList.remove('grid');ch.innerHTML='<button class="btn primary" id="bPauseNext">'+t('flashNextR')+'</button>';
  tapLock($('bPauseNext'));
  $('bPauseNext').onclick=function(){anOff();cur.answered=false;cur.inPause=false;$('trBody').classList.remove('answered');B.onMove=null;B.arrows=[];$('why').hidden=true;next();dclkResume()};
}
/* Game mode: no hints at all. A mix of positions — a threat against you, a tactic for you, or nothing special (a quiet move from his own games).
   He is told nothing; he has to find out what is going on, like in a real game. */
function loadGame(){
  if(cur.it&&cur.it.f==='mygames'){   /* Nov 23 (his idea): positions from HIS games, unlabeled — the moments he found the only good move
     (buenas.js) mixed with his mistake positions. Repeating a good move proves it was not luck. */
    var N0=(cur.it&&cur.it.n)||8,sh0=function(a){return a.sort(function(){return Math.random()-.5})},M=[];
    var gAll=freshFirst((window.GOOD||[]).slice(),function(r){return 'gd:'+r[0]}),gSac=gAll.filter(function(r){return r[7]}),gOk=gAll.filter(function(r){return !r[7]});
    /* at least one sacrifice he missed per round (Nov 23: "a good sacrifice is really difficult to see") */
    var goods=(gSac.length?[gSac[0]]:[]).concat(gOk).slice(0,Math.ceil(N0/2)).map(function(r){return {type:'good',r:r}});
    var mines=freshFirst(cardsOf('mine').filter(function(c){return c.pvBad&&c.line&&c.line.length}),function(c){return c.id}).slice(0,N0-goods.length).map(function(c){return {type:'mine',c:c}});
    M=sh0(goods.concat(mines));cur.game={list:M,n:0,ok:0,total:M.length,t0:now()};setBar(null,false);setBtns({});readyGate(t('mgT'),t('mgQ'),'45',gameNext);return}
  var L=[],shuf=function(a){return a.sort(function(){return Math.random()-.5})};
  var N=(cur.it&&cur.it.n)||10,ND=Math.round(N*.3),NT=Math.round(N*.4),NQ=Math.max(1,N-ND-NT);
  var dp=puzPool(['mate1','hanging','backrank','fork'],1500),nd=0;for(var i=0;i<dp.length&&nd<ND;i++){var x=defMake(dp[i]);if(x){x.type='def';L.push(x);nd++}}
  puzPool(['hanging','fork','pin','skewer','discovered','backrank','mate1','mate2','trapped','defender','smothered'],1450).slice(0,NT).forEach(function(it){L.push({type:'tac',it:it})});
  /* the moment in his own games right before it fell apart (he asked: "show me the 1-2 moves that destroy everything") */
  var mc=freshFirst(cardsOf('mine').filter(function(c){return visOf(c)!=='win'&&c.pvBad&&c.line&&c.line.length}),function(c){return c.id}).slice(0,Math.min(2,NQ-1));mc.forEach(function(c){L.push({type:'mine',c:c})});
  var qs=[];Object.keys(PLANS).forEach(function(k){PLANS[k].forEach(function(p){qs.push({type:'quiet',p:p,tag:k})})});freshFirst(qs,function(q){return 'pl:'+q.p.fen}).slice(0,NQ-mc.length).forEach(function(q){L.push(q)});
  cur.game={list:shuf(L),n:0,ok:0,total:L.length,t0:now()};setBar(null,false);setBtns({});readyGate(t('gameT'),t('gateGame'),'45',gameNext);

}
function gameHead(){var G=cur.game;return '<div class="op">'+kindPill('idea',t('gameT'))+' <span class="counter">'+Math.min(G.n+1,G.total)+'/'+G.total+' · ✓ '+G.ok+'</span></div>'}
function gameNext(){
  var G=cur.game;if(G.n>=G.total){gameEnd();return}
  var x=G.list[G.n],fen,me,last=null,prev=null;anOff();cur.answered=false;$('choices').hidden=true;$('fb').innerHTML='';$('fb').className='feedback';
  seenPuz(x.type==='def'?x.pid:x.type==='tac'?x.it.p.id:x.type==='quiet'?'pl:'+x.p.fen:x.type==='mine'?x.c.id:x.type==='good'?'gd:'+x.r[0]:null);  if(x.type==='def')fen=x.d.fen();else if(x.type==='quiet')fen=x.p.fen;else if(x.type==='good'){fen=x.r[0];prev=x.r[4]||null;last=prev?lastSanTo(prev,fen):null}else if(x.type==='mine'){fen=fenOf(x.c.line);last=x.c.line[x.c.line.length-1];prev=fenOf(x.c.line.slice(0,-1))}else{var a=afterFirst(x.it.p);fen=a.c.fen();last=a.m.san;prev=x.it.p.fen}
  me=new Chess(fen).turn();setBoard(fen,me==='b',last,prev);
  $('prompt').innerHTML=gameHead()+'<div class="bigq">'+t('gameQ')+'</div><p class="small">'+sideTxt(me)+'</p>';
  B.locked=false;B.onMove=function(mv){B.locked=true;B.onMove=null;G.n++;
    var done=function(ok,h,arr,moves,why){if(ok)G.ok++;pauseReview(fen,moves||[mv.san],ok,h,arr,gameNext,why)};
    if(x.type==='def'){var ok=x.good.indexOf(mv.san)>=0,th=t(x.kind==='mate'?'defIsMate':'defIsHang',sanList(x.th));
      done(ok,(ok?'✓ '+t('gameDefOk')+' ':'✗ '+t('gameWasDef')+' ')+th+(ok?'':' '+t('defGoodWere',sanList(x.good))),x.th.slice(0,2).map(function(m){return {from:m.from,to:m.to,c:'#C0392B'}}),null,fold(t('stThreat'),story(flipTurn(fen,me==='w'?'b':'w'),[x.th[0].san],me,1)));return}
    if(x.type==='tac'){var p=x.it.p,want=p.m[1],ok2=mv.san===want||(p.m.length===2&&B.chess.in_checkmate()),nm=esc(tt(x.it.l.t));
      var ar=arrowFor(fen,want,'#0E9488');
      markPuz(p,ok2);done(ok2,ok2?'✓ '+t('gameTacOk',nm):'✗ '+t('gameWasTac',nm,'<b class="mono">'+esc(want)+'</b>'),ok2?[]:(ar?[ar]:[]),ok2?p.m.slice(1):[mv.san],fold(t('stStep'),story(fen,p.m.slice(1),me,8)));return}
    if(x.type==='mine'){var c=x.c,tb=teachBad(fen,c.played,c.pvBad,me),box=tb?teachBox(tb):'',ba=arrowFor(fen,c.best,'#0E9488'),bd=arrowFor(fen,c.played,'#C0392B'),
        why=box+fold(t('stIf',esc(c.played)),story(fen,[c.played].concat(c.pvBad),me,4))+fold(t('stBest',esc(c.best)),story(fen,c.pvBest&&c.pvBest.length?c.pvBest:[c.best],me,5)),
        P='<b class="mono">'+esc(c.played)+'</b>',Bm='<b class="mono">'+esc(c.best)+'</b>',fin=function(ok){c.last=ok?1:0;save();done(ok,ok?'✓ '+t('gameMineOk',P):'✗ '+t(mv.san===c.played?'gameMineSame':'gameMineBad',P,Bm),ok?[bd]:[ba,bd],ok?[mv.san]:[c.played].concat(c.pvBad),why)};
      if(mv.san===c.best||(c.alts||[]).indexOf(mv.san)>=0){fin(true);return}
      if(mv.san===c.played){fin(false);return}
      $('fb').className='feedback';$('fb').textContent=t('thinking');
      analyse(B.chess.fen(),1200).then(function(r){fin(r?wp(-r.s)>=wp(c.s0)-8:false)});return}
    if(x.type==='good'){var g=x.r,gm='<b class="mono">'+esc(g[2])+'</b>',ga=arrowFor(fen,g[2],'#0E9488'),gwhy=fold(t('stBest',esc(g[2])),story(fen,g[3].split(' '),me,5)),
        gfin=function(ok,pv){done(ok,ok?'✓ '+(g[7]?t('gameSacOk',gm,'<b class="mono">'+esc(g[8])+'</b>'):t('gameGoodOk',gm)):'✗ '+(g[7]?t('gameSacBad',gm,'<b class="mono">'+esc(g[8])+'</b>'):t('gameGoodBad',gm)),ok?[]:(ga?[ga]:[]),ok?g[3].split(' '):[mv.san].concat(pv||[]),gwhy)};
      if(mv.san===g[2]||(g[6]||[]).indexOf(mv.san)>=0){gfin(true);return}
      $('fb').className='feedback';$('fb').textContent=t('thinking');
      analyse(B.chess.fen(),1500).then(function(r){gfin(r?wp(-r.s)>=wp(g[1])-6:false,r&&r.pv?r.pv.slice(0,4):null)});return}
    /* quiet: ask the engine whether his move keeps the position */
    var q=x.p,st=stratById(x.tag),bestA=arrowFor(fen,q.best,'#0E9488');
    if(mv.san===q.best){done(true,'✓ '+t('gameQuietBest',esc(tt(st.t))),[],q.pv,fold(t('stPlan',esc(q.best)),story(fen,q.pv,me,4)));return}
    $('fb').className='feedback';$('fb').textContent=t('thinking');
    analyse(B.chess.fen(),1200).then(function(r){var mine=r?-r.s:q.s,ok3=wp(mine)>=wp(q.s)-7,ev=evalTxt(mine);
      done(ok3,ok3?'✓ '+t('gameQuietOk2',ev,'<b class="mono">'+esc(q.best)+'</b>',esc(tt(st.t))):'✗ '+t('gameQuietBad',ev,evalTxt(q.s),'<b class="mono">'+esc(q.best)+'</b>',esc(tt(st.t))),bestA?[bestA]:[],null,fold(t('stPlan',esc(q.best)),story(fen,q.pv,me,4)))});
  };
  var myPos=G.n;dclkStart(45,function(){if(!cur||cur.game!==G||G.n!==myPos||cur.answered)return;B.locked=true;B.onMove=null;G.n++;var T='⏱ '+t('timeOut')+' ';
    if(x.type==='def'){var th=t(x.kind==='mate'?'defIsMate':'defIsHang',sanList(x.th)),ga=arrowFor(fen,x.good[0],'#0E9488');
      pauseReview(fen,[],false,T+t('gameWasDef')+' '+th+' '+t('defGoodWere',sanList(x.good)),x.th.slice(0,2).map(function(m){return {from:m.from,to:m.to,c:'#C0392B'}}).concat(ga?[ga]:[]),gameNext,fold(t('stThreat'),story(flipTurn(fen,me==='w'?'b':'w'),[x.th[0].san],me,1)));return}
    if(x.type==='tac'){var p=x.it.p,want=p.m[1],ar=arrowFor(fen,want,'#0E9488');
      pauseReview(fen,p.m.slice(1),false,T+t('gameWasTac',esc(tt(x.it.l.t)),'<b class="mono">'+esc(want)+'</b>'),ar?[ar]:[],gameNext,fold(t('stStep'),story(fen,p.m.slice(1),me,8)));return}
    if(x.type==='mine'){var c=x.c,ba2=arrowFor(fen,c.best,'#0E9488'),bd2=arrowFor(fen,c.played,'#C0392B');c.last=0;save();
      pauseReview(fen,[c.played].concat(c.pvBad),false,T+t('gameMineBad','<b class="mono">'+esc(c.played)+'</b>','<b class="mono">'+esc(c.best)+'</b>'),[ba2,bd2].filter(Boolean),gameNext,fold(t('stIf',esc(c.played)),story(fen,[c.played].concat(c.pvBad),me,4)));return}
    var q=x.p,bA=arrowFor(fen,q.best,'#0E9488');
    pauseReview(fen,q.pv||[q.best],false,T+t('gameQuietBest0','<b class="mono">'+esc(q.best)+'</b>'),bA?[bA]:[],gameNext,fold(t('stPlan',esc(q.best)),story(fen,q.pv,me,4)))});
}
function gameEnd(){dclkStop();
  var G=cur.game,gk=cur.it&&cur.it.f==='mygames'?'mygames':'game',sec=Math.round((now()-G.t0)/1000),s=S.drill[gk]||(S.drill[gk]={best:0,bestT:0,runs:0});s.runs++;addTot(gk,G.ok);var better=G.ok>s.best;if(better){s.best=G.ok;s.bestT=sec}save();
  anOff();B.locked=true;B.onMove=null;$('choices').hidden=true;G.done=true;
  $('fb').className='feedback '+(G.ok>=G.total*.7?'good':'bad');$('fb').innerHTML=t('drillRes',G.ok,G.total,mmss(sec))+(better&&G.ok?' 🏆 '+t('newBest'):'');itemDone(G.total>0&&G.ok>=G.total*.7);setBtns({next:true});
}
function defEnd(){dclkStop();
  var D=cur.def,sec=Math.round((now()-D.t0)/1000),s=S.drill.defend||(S.drill.defend={best:0,bestT:0,runs:0});s.runs++;addTot('defend',D.ok);var better=D.ok>s.best;if(better){s.best=D.ok;s.bestT=sec}save();
  anOff();B.locked=true;B.onMove=null;$('choices').hidden=true;D.done=true;
  $('fb').className='feedback '+(D.ok>=D.total*.75?'good':'bad');$('fb').innerHTML=t('drillRes',D.ok,D.total,mmss(sec))+(better&&D.ok?' 🏆 '+t('newBest'):'');itemDone(D.total>0&&D.ok>=D.total*.75);setBtns({next:true});
}
/* Calculation ladder (Nov 17, "I'm really bad at calculating, I need 3-4 tries for small calculations"): the board does NOT move.
   He picks his moves from 4 choices (the wrong ones are other checks/captures) and reads the replies as text, then checks it on the board.
   Level = how many of his moves (2-4) and puzzle rating; goes up at >=80%, down at <=40%. Every second position is an attack AGAINST him
   (his last move allowed it): he picks the ATTACKER's moves — mostly queen + another piece — so he learns to see them coming. */
/* Nov 19: he is ~1400 — puzzles stay near his level (at most ~+200) */
var CALC=[null,{len:4,r:1250,st:2},{len:4,r:1450,st:2},{len:6,r:1350,st:3},{len:6,r:1500,st:3},{len:8,r:1600,st:4}];
var CALC_ATT=['mate2','mate3','backrank','anastasia','arabian','smothered','doublecheck','attraction','deflection','fork','discovered'];
function calcLvl(){var s=S.drill.calc||(S.drill.calc={best:0,bestT:0,runs:0});return Math.max(1,Math.min(5,s.lvl||1))}
function calcPool(lvl,att){
  var out=[],LS=CURSO.lessons.concat(WEAKL.calc&&!att?[WEAKL.calc]:[]);for(var L=lvl;L>=1&&out.length<6;L--){var c=CALC[L];
    LS.forEach(function(l){if(att&&CALC_ATT.indexOf(l.id)<0)return;l.p.forEach(function(p){
      if(p.m.length!==c.len||p.r>c.r||(L<lvl&&p.r<CALC[L].r-400))return;
      if(att&&!p.m.slice(1).some(function(s,i){return i%2===0&&/^Q/.test(s)}))return;   /* attacker's queen takes part */
      out.push({l:l,p:p})})})}
  return freshFirst(out,function(x){return x.p.id});
}
/* Nov 20 ("I lose time reading what I have to do"): every timed drill starts with a ready screen — what to do in one line and the
   seconds per position, board hidden — and the clock starts only on "¡Listo!". */
function readyGate(title,line,secs,fn){
  anOff();$('boardwrap').hidden=true;$('fb').innerHTML='';$('fb').className='feedback';$('trBody').classList.remove('answered');
  $('prompt').innerHTML='<div class="op">'+kindPill('idea',esc(title))+'</div><div class="bigq">'+line+'</div>'+(secs?'<p class="gsecs">⏱ '+t('gateSecs',secs)+'</p>':'');
  var ch=$('choices');ch.hidden=false;ch.classList.remove('grid');ch.innerHTML='<button class="btn primary gatego" id="bGo" type="button">'+t('gateGo')+'</button>';
  $('bGo').onclick=function(){ch.innerHTML='';ch.hidden=true;$('boardwrap').hidden=false;fn()};
}
function loadCalc(){
  var N=(cur.it&&cur.it.n)||6,lvl=calcLvl(),A=calcPool(lvl,true),Nn=calcPool(lvl,false),list=[],used={};
  for(var i=0;i<N;i++){var att=i%2===1,src=att&&A.length?A:Nn,x=null;while(src.length&&!x){var y=src.shift();if(!used[y.p.id]){used[y.p.id]=1;x=y}}if(x)list.push({it:x,att:att&&src===A})}
  cur.calc={list:list,n:0,ok:0,total:list.length,t0:now(),secs:[],lvl:lvl};setBar(null,false);setBtns({});readyGate(t('calcT'),t('calcQ')+' '+t('gateCalc'),'30',calcNext);
}
function calcHead(){var C=cur.calc;return '<div class="op">'+kindPill('idea',t('calcT'))+' <span class="pill">'+t('calcLvl',C.lvl)+'</span> <span class="counter">'+Math.min(C.n+1,C.total)+'/'+C.total+' · ✓ '+C.ok+'</span></div>'}
function calcOpts(ch,want,final){
  var ms=ch.moves({verbose:true}),o=[],mates=function(san){ch.move(san);var m=ch.in_checkmate();ch.undo();return m};
  var wm=final&&mates(want);
  var bad=ms.filter(function(m){return m.san!==want&&!(wm&&mates(m.san))});
  var forcing=bad.filter(function(m){return /[+#x]/.test(m.san)}).sort(function(){return Math.random()-.5}),rest=bad.filter(function(m){return forcing.indexOf(m)<0}).sort(function(){return Math.random()-.5});
  o=forcing.slice(0,3);if(o.length<3)o=o.concat(rest.slice(0,3-o.length));
  return o.map(function(m){return m.san}).concat([want]).sort(function(){return Math.random()-.5});
}
function calcNext(){
  var C=cur.calc;if(C.n>=C.total){calcEnd();return}
  var x=C.list[C.n],p=x.it.p,a=afterFirst(p),fen=a.c.fen(),mover=a.c.turn(),me=x.att?(mover==='w'?'b':'w'):mover;
  anOff();cur.answered=false;$('fb').innerHTML='';$('fb').className='feedback';$('why').hidden=true;
  setBoard(fen,me==='b',a.m.san,p.fen);B.locked=true;B.onMove=null;
  var h=new Chess(fen),k=0,done=[],t0=now(),sol=p.m.slice(1);seenPuz(p.id);
  var who=function(i){return (i%2===0)!==!!x.att?t('calcYou'):t('calcOpp')};
  var draw=function(){
    var q=x.att?t('calcQAtt','<b class="mono">'+esc(a.m.san)+'</b>'):t('calcQ'),
        seq=done.map(function(s,i){return '<span class="cmv"><small>'+who(i)+'</small> <b class="mono">'+esc(noMate(s))+'</b></span>'}).join(' → ');
    seq+=(seq?' → ':'')+'<span class="cmv cq"><small>'+who(done.length)+'</small> <b>?</b></span>';
    $('prompt').innerHTML=calcHead()+'<div class="bigq">'+q+'</div><p class="small">'+t('calcFrozen')+'</p><div class="cseq">'+seq+'</div>';
    var ops=calcOpts(h,sol[2*k],2*k===sol.length-1),ch=$('choices');ch.hidden=false;ch.classList.add('grid');
    ch.innerHTML=ops.map(function(s){return '<button class="btn mono" data-s="'+esc(s)+'">'+esc(noMate(s))+'</button>'}).join('');
    ch.querySelectorAll('[data-s]').forEach(function(b){b.onclick=function(){pick(b.getAttribute('data-s'))}});
  };
  var finish=function(ok,html,wrong){
    dclkPause();var sec=Math.round((now()-t0)/1000);C.secs.push(sec);C.n++;if(ok)C.ok++;markPuz(p,ok);$('choices').hidden=true;
    var mv=sol.slice(),arr=[],a1=arrowFor(fen,sol[0],x.att?'#C0392B':'#0E9488');if(a1)arr.push(a1);
    pauseReview(fen,mv,ok,html+' <span class="small">('+sec+' s)</span>',arr,calcNext,
      fold(t('stStep'),story(fen,sol,me,8)));
  };
  var pick=function(s){
    var want=sol[2*k];
    if(s!==want&&!(2*k===sol.length-1&&(function(){h.move(s);var m=h.in_checkmate();h.undo();return m})())){
      finish(false,'✗ '+t(x.att?'calcBadAtt':'calcBad','<b class="mono">'+esc(s)+'</b>',sanSeq(sol)),null);return}
    h.move(s);done.push(s);
    if(2*k+1>=sol.length){finish(true,'✓ '+t(x.att?'calcOkAtt':'calcOk',sanSeq(sol)));return}
    h.move(sol[2*k+1]);done.push(sol[2*k+1]);k++;draw();
  };
  draw();
  var steps=Math.ceil(sol.length/2),myPos=C.n;dclkStart(30*steps+15,function(){if(!cur||cur.calc!==C||C.n!==myPos||cur.answered)return;finish(false,'⏱ '+t('timeOut')+' '+t('calcSol',sanSeq(sol)))});
}
/* Nov 20: never show '#' before he answers — the mate symbol gave the answer away ("I see the symbol of mate, so I just chose it") */
function noMate(s){return String(s).replace(/#/g,'+')}
function sanSeq(ms){return ms.map(function(m){return '<b class="mono">'+esc(m)+'</b>'}).join(' ')}
function calcEnd(){dclkStop();
  var C=cur.calc,sec=Math.round((now()-C.t0)/1000),s=S.drill.calc||(S.drill.calc={best:0,bestT:0,runs:0});s.runs++;addTot('calc',C.ok);
  var avg=C.secs.length?Math.round(C.secs.reduce(function(a,b){return a+b},0)/C.secs.length):0,pct=C.total?C.ok/C.total:0,old=C.lvl,nl=old;
  if(C.total>=3&&pct>=.8)nl=Math.min(5,old+1);else if(C.total>=3&&pct<=.4)nl=Math.max(1,old-1);
  s.lvl=nl;s.at=now();s.h=(s.h||[]).concat([[today(),C.ok,C.total,avg,old]]).slice(-60);if(C.ok>s.best){s.best=C.ok;s.bestT=sec}save();
  anOff();B.locked=true;B.onMove=null;$('choices').hidden=true;C.done=true;
  $('fb').className='feedback '+(pct>=.6?'good':'bad');
  $('fb').innerHTML=t('drillRes',C.ok,C.total,mmss(sec))+' · '+t('calcAvg',avg)+(nl>old?' 🎉 '+t('calcUp',nl):nl<old?' '+t('calcDown',nl):'');
  itemDone(C.total>0&&pct>=.6);setBtns({next:true});
}
/* his calculation trend: today vs his first days, for the coach card */
function calcTrend(){var h=(S.drill.calc&&S.drill.calc.h)||[];if(!h.length)return null;var by={};h.forEach(function(r){var o=by[r[0]]||(by[r[0]]={ok:0,n:0,s:0,c:0});o.ok+=r[1];o.n+=r[2];o.s+=r[3]*r[2];o.c+=r[2]});
  var ds=Object.keys(by).sort(),f=by[ds[0]],l=by[ds[ds.length-1]];return {lvl:calcLvl(),days:ds.length,first:Math.round(f.s/Math.max(1,f.c)),last:Math.round(l.s/Math.max(1,l.c)),pct:Math.round(l.ok/Math.max(1,l.n)*100)}}
/* "¿Es un error? ¿Por qué?" (Nov 19, his idea: "think: is this move a mistake? why? so when I play I see I shouldn't do it").
   A move is drawn on the board; he says good or mistake, and if mistake, WHY (6 reasons). Sources: his own mistakes (his game move, and the
   engine's move as a good one), course/bank puzzles (the move that allowed the tactic), and quiet positions from his games (the plan move =
   good; a clearly worse move = "no tactic, but it makes the position worse" — the moments he just moves a piece). */
/* Nov 20: the old 6 reasons overlapped (a fork also loses material…). Now 5 distinct ones; 'mat' (you lose material) is always true
   when there is a tactic, so it counts as right, and the message names the concrete pattern. */
var JR=['mat','fork','lines','mate','pos'];
var JK={hanging:'mat',leftdef:'mat',material:'mat',badtrade:'mat',fork:'fork',pin:'lines',skewer:'lines',discovered:'lines',mate:'mate',backrank:'mate',king:'mate'};
var JL={hanging:'mat',fork:'fork',pin:'lines',skewer:'lines',discovered:'lines',backrank:'mate',mate2:'mate',mate3:'mate',anastasia:'mate',arabian:'mate',smothered:'mate',doublecheck:'mate',w_forkd:'fork',w_lines:'lines',w_matek:'mate'};
function judgeCards(){return Object.keys(S.cards).map(function(k){return S.cards[k]}).filter(function(c){return c.kind==='mine'&&(!c.hide||c.jo)&&visOf(c)!=='win'&&c.pvBad&&c.line&&c.line.length&&(c.s0||0)>=-100})}
function judgeList(N){
  var sh=function(a){return a.sort(function(){return Math.random()-.5})},out=[],cs=freshFirst(judgeCards(),function(c){return 'j:'+c.id}),i;
  var nBad=Math.round(N*.3),nGood=Math.max(1,Math.round(N*.15)),nPuz=Math.round(N*.25),nPos=Math.max(1,N-nBad-nGood-nPuz-1),nQG=N-nBad-nGood-nPuz-nPos;
  for(i=0;i<cs.length&&out.filter(function(x){return x.src==='card'}).length<nBad;i++){var c=cs[i],fen=fenOf(c.line),tb=teachBad(fen,c.played,c.pvBad,c.side),r=tb&&JK[tb.k];if(!r)continue;
    out.push({src:'card',fen:fen,san:c.played,bad:true,r:r,cont:c.pvBad,tb:tb,last:c.line[c.line.length-1],prev:fenOf(c.line.slice(0,-1)),me:c.side,c:c})}
  cs.slice(i,i+nGood).forEach(function(c){var fen=fenOf(c.line);out.push({src:'cardg',fen:fen,san:c.best,bad:false,cont:(c.pvBest||[]).slice(1),last:c.line[c.line.length-1],prev:fenOf(c.line.slice(0,-1)),me:c.side,c:c})});
  var ls=CURSO.lessons.filter(function(l){return JL[l.id]}).concat(['forkd','lines','matek'].map(function(k){return WEAKL[k]}).filter(Boolean)),pz=[];
  ls.forEach(function(l){var key=l.weak?'w_'+l.weak:l.id;l.p.forEach(function(p){if(p.r<=1500&&p.m.length>=2)pz.push({l:l,p:p,r:JL[key]})})});
  freshFirst(pz.filter(function(x){return realChoice(x.p.fen)}),function(x){return x.p.id}).slice(0,nPuz).forEach(function(x){var c0=new Chess(x.p.fen);out.push({src:'puz',p0:x.p.id,fen:x.p.fen,san:x.p.m[0],bad:true,r:x.r,cont:x.p.m.slice(1),me:c0.turn(),l:x.l})});
  var qs=[];Object.keys(PLANS).forEach(function(k){PLANS[k].forEach(function(p){qs.push({p:p,tag:k})})});qs=freshFirst(qs,function(q){return 'pl:'+q.p.fen});
  qs.filter(function(q){return q.p.opts&&q.p.opts.some(function(o){return q.p.s-o.s>=120})}).slice(0,nPos).forEach(function(q){var o=q.p.opts.filter(function(o){return q.p.s-o.s>=120})[0];
    out.push({src:'pos',fen:q.p.fen,san:o.san,bad:true,r:'pos',cont:o.pv.slice(1),me:new Chess(q.p.fen).turn(),q:q,o:o})});
  qs.slice(nPos,nPos+nQG).forEach(function(q){out.push({src:'posg',fen:q.p.fen,san:q.p.best,bad:false,cont:q.p.pv.slice(1),me:new Chess(q.p.fen).turn(),q:q})});
  return sh(out.filter(function(x){return realChoice(x.fen)})).slice(0,N);
}
function loadJudge(){var N=(cur.it&&cur.it.n)||8;cur.judge={list:judgeList(N),n:0,ok:0,t0:now()};cur.judge.total=cur.judge.list.length;setBar(null,false);setBtns({});judgeNext()}
function judgeHead(){var J=cur.judge;return '<div class="op">'+kindPill('idea',t('jT'))+' <span class="counter">'+Math.min(J.n+1,J.total)+'/'+J.total+' · ✓ '+J.ok+'</span></div>'}
function judgeNext(){
  var J=cur.judge;if(J.n>=J.total){judgeEnd();return}
  var x=J.list[J.n];seenPuz(x.c?'j:'+x.c.id:x.src==='puz'?null:x.q?'pl:'+x.q.p.fen:null);if(x.src==='puz')seenPuz(x.p0);anOff();cur.answered=false;$('fb').innerHTML='';$('fb').className='feedback';$('why').hidden=true;
  setBoard(x.fen,x.me==='b',x.last||null,x.prev||null);B.locked=true;B.onMove=null;var ar=arrowFor(x.fen,x.san,'#2563EB');B.arrows=ar?[ar]:[];drawBoard();
  var ctx=x.src==='card'||x.src==='cardg'?t('jFromGame'):'';
  $('prompt').innerHTML=judgeHead()+'<div class="bigq">'+t('jQ','<b class="mono">'+esc(x.san)+'</b>')+'</div><p class="small">'+ctx+t('jHow')+'</p>';
  var ch=$('choices');ch.hidden=false;ch.classList.add('grid');
  ch.innerHTML='<button class="btn" id="jGood">✓ '+t('jGood')+'</button><button class="btn" id="jBad">✗ '+t('jBad')+'</button>';
  $('jGood').onclick=function(){judgeAns(x,false,null)};
  $('jBad').onclick=function(){if(!x.bad){judgeAns(x,true,null);return}
    $('prompt').innerHTML=judgeHead()+'<div class="bigq">'+t('jWhy','<b class="mono">'+esc(x.san)+'</b>')+'</div>';
    ch.innerHTML=JR.map(function(r){return '<button class="btn" data-r="'+r+'">'+t('jr_'+r)+'</button>'}).join('');ch.classList.remove('grid');
    ch.querySelectorAll('[data-r]').forEach(function(b){b.onclick=function(){judgeAns(x,true,b.getAttribute('data-r'))}})};
}
function judgeAns(x,saidBad,r){
  var J=cur.judge,ok,h,mv=esc(x.san);$('choices').hidden=true;J.n++;
  var general=x.bad&&saidBad&&r==='mat'&&x.r!=='mat'&&x.r!=='pos';
  if(!x.bad)ok=!saidBad;else ok=saidBad&&(r===x.r||general);
  if(ok)J.ok++;
  var best=x.src==='card'?x.c.best:x.src==='pos'?x.q.p.best:null,why='';
  if(!x.bad)h=(ok?'✓ ':'✗ ')+t(ok?'jGoodOk':'jWasGood','<b class="mono">'+mv+'</b>');
  else if(ok&&general){var rn=t('jr_'+x.r);h='✓ '+t('jGeneral','<b class="mono">'+mv+'</b>',rn.charAt(0).toLowerCase()+rn.slice(1))}
  else if(ok)h='✓ '+t('jBadOk','<b class="mono">'+mv+'</b>',t('jr_'+x.r));
  else if(saidBad)h='✗ '+t('jRightWrongWhy','<b class="mono">'+mv+'</b>',t('jr_'+x.r));
  else h='✗ '+t('jWasBad','<b class="mono">'+mv+'</b>',t('jr_'+x.r));
  if(x.bad&&best)h+=' '+t('jBetter','<b class="mono">'+esc(best)+'</b>');
  if(x.src==='card'&&x.tb)why+=teachBox(x.tb);
  else if(x.bad&&x.r!=='pos')why+='<p class="small">'+esc(t({mat:'wb_hang',fork:'wb_forkd',lines:'wb_lines',mate:'wb_matek'}[x.r]))+'</p>';
  else if(x.r==='pos')why+='<p class="small">'+esc(t('jPosRule'))+(x.q?' '+t('jPlan','<b class="mono">'+esc(x.q.p.best)+'</b>',esc(tt(stratById(x.q.tag).t))):'')+'</p>';
  why+=fold(x.bad?t('stIf',mv):t('stStep'),story(x.fen,[x.san].concat(x.cont||[]).slice(0,7),x.me,6));
  var arr=[];var a1=arrowFor(x.fen,x.san,x.bad?'#C0392B':'#0E9488');if(a1)arr.push(a1);if(best){var a2=arrowFor(x.fen,best,'#0E9488');if(a2)arr.push(a2)}
  pauseReview(x.fen,[x.san].concat(x.cont||[]).slice(0,8),ok,h,arr,judgeNext,why);
}
function judgeEnd(){dclkStop();
  var J=cur.judge,sec=Math.round((now()-J.t0)/1000),s=S.drill.judge||(S.drill.judge={best:0,bestT:0,runs:0});s.runs++;addTot('judge',J.ok);var better=J.ok>s.best;if(better){s.best=J.ok;s.bestT=sec}save();
  anOff();B.locked=true;B.onMove=null;$('choices').hidden=true;J.done=true;
  $('fb').className='feedback '+(J.ok>=J.total*.7?'good':'bad');$('fb').innerHTML=t('drillRes',J.ok,J.total,mmss(sec))+(better&&J.ok?' 🏆 '+t('newBest'):'');itemDone(J.total>0&&J.ok>=J.total*.7);setBtns({next:true});
}
/* "Remata" (Nov 19): of 225 games where he reached +5, he lost 55 and drew 21 (33 losses on time). Positions = winning moments from his own
   games (conv.js), the ones where he threw it away first. 25 s per position: any move that keeps him >= +3 is right (simple and safe beats
   brilliant). Positions not seen in the last 7 days first. */
/* Nov 23 (his idea, and the data agreed: 0 of 11 'sin tiempo' runs passed): the no-time drill is a LADDER —
   level 1 = the obvious move with seconds (free piece / mate / Lichess hanging + mate-in-1 banks), level 2 = winning positions from his games
   with several safe moves, level 3 = the real thing (moments he threw away). 2 perfect runs = up, half or more wrong = down. */
function convBasic(N){var sn=S.seen||{},o=[];['d_hang','d_mate1'].forEach(function(k){(window.WEAKDB&&WEAKDB[k]||[]).forEach(function(r){if(r[3]>1300)return;var mv=r[2].split(' ');o.push({r:r,mv:mv,mate:k==='d_mate1'})})});
  return o.map(function(x){return {x:x,k:((sn['cv:'+x.r[0]]||0)?1+(sn['cv:'+x.r[0]]/1e13):Math.random())}}).sort(function(a,b){return a.k-b.k}).slice(0,N).map(function(o){var x=o.x,c=new Chess(x.r[1]);c.move(x.mv[0],{sloppy:true});
    return [c.fen(),999,x.mv[1],x.mv.slice(1).join(' '),0,0,[x.mv[1]],null,x.r[1],null,1,x.mate?1:0]})}
function lastSanTo(prev,fen){try{var c=new Chess(prev),k=fen.split(' ')[0],ms=c.moves();for(var i=0;i<ms.length;i++){c.move(ms[i]);if(c.fen().split(' ')[0]===k)return ms[i];c.undo()}}catch(e){}return null}
function loadConv(){
  var fast=cur.it&&cur.it.f==='convfast',N=(cur.it&&cur.it.n)||6,sn=S.seen||{},wk=now()-7*864e5,dc0=S.drill.conv||{},lvl=fast?(dc0.flvl||1):0;
  var src=(window.CONV||[]).filter(function(r){return lvl===2?(r[6]||[]).length>=3&&!r[4]:lvl===3?(r[4]||(r[6]||[]).length<=2):true});
  var rows=lvl===1?convBasic(N):src.map(function(r){return {r:r,k:((sn['cv:'+r[0]]||0)>wk?10:0)+(fast?(r[7]!=null&&r[7]<90?0:4):(r[4]?0:2))+Math.random()*3}}).sort(function(a,b){return a.k-b.k}).slice(0,N).map(function(x){return x.r});
  /* Nov 23 review (0 of 11 'Remata sin tiempo' runs passed, 1 of 8 Remata): the fast clock now adapts (starts 15 s, 8-20 s) */
  var dc=S.drill.conv||(S.drill.conv={best:0,bestT:0,runs:0}),sec=fast?(dc.fsec||15):25;
  cur.conv={list:rows,n:0,ok:0,total:rows.length,t0:now(),fast:fast,sec:sec,secs:[],lvl:lvl};setBar(null,false);setBtns({});
  readyGate(t(fast?'cvTfast':'cvT'),(lvl?'<b>'+t('cvLvl',lvl)+'</b> · ':'')+(lvl===1?t('cvL1'):lvl===2?t('cvL2'):t(fast?'cvQfast':'cvQ'))+'<p class="cvhow">'+t(lvl===1?'cvHow1':'cvHow')+'</p>',String(sec),convNext);
}
function convNext(){
  var C=cur.conv;if(C.n>=C.total){convEnd();return}
  var r=C.list[C.n],fen=r[0],me=new Chess(fen).turn();seenPuz('cv:'+fen);anOff();cur.answered=false;$('trBody').classList.remove('answered');$('fb').innerHTML='';$('fb').className='feedback';$('choices').hidden=true;
  setBoard(fen,me==='b',r[8]?lastSanTo(r[8],fen):null,r[8]||null);setBar(null,false);
  $('prompt').innerHTML='<div class="op">'+kindPill('idea',t('cvT'))+' <span class="counter">'+(C.n+1)+'/'+C.total+' · ✓ '+C.ok+'</span></div><div class="bigq">'+(r[10]?t('cvL1'):t(C.fast?'cvQfast':'cvQ'))+'</div>';
  var t1=now();
  B.locked=false;B.onMove=function(mv){B.locked=true;B.onMove=null;C.n++;dclkPause();var sec=Math.round((now()-t1)/1000);C.secs.push(sec);
    var fin=function(ok,after,pv){if(ok)C.ok++;var ba=arrowFor(fen,r[2],'#0E9488');dlog(C.fast?'convfast':'conv',fen,ok,sec,0,mv.san);
      /* what HIS move allowed (the engine reply line, explained), then the simple safe line */
      var why=ok?'':(pv&&pv.length?fold(t('cvWhy','<b class="mono">'+esc(mv.san)+'</b>'),story(fen,[mv.san].concat(pv).slice(0,5),me,5)):'')+fold(t('stBest',esc(r[2])),story(fen,r[3].split(' '),me,5));
      /* Nov 26 (his screenshot: "it says I'm still winning, but was that the best? I tried moves and don't know the good one"):
         a right-but-different move now also shows the best move (teal arrow + eval) */
      var isBest=mv.san.replace(/[+#]/g,'')===r[2].replace(/[+#]/g,'');
      /* Nov 26 ("before the move I'm +4, after the best move my advantage drops"): the bar used a quick 1.2 s browser look (+2.7) while the
         verdict used the deep offline eval (+4.0). Seed the deep numbers so the bar shows the same value as the verdict. */
      try{var fa=B.chess.fen();AN.ev[fen]={w:toW(r[1],me),pv:r[3].split(' ')};if(isBest)AN.ev[fa]={w:toW(r[1],me),pv:r[3].split(' ').slice(1)};else if(after!=null&&after!==300)AN.ev[fa]={w:toW(after,me),pv:pv||[]}}catch(e){}
      var bestTxt=ok&&!r[10]?(isBest?' '+t('cvIsBest'):' '+t('cvBestWas','<b class="mono">'+esc(r[2])+'</b>',evalTxt(r[1]))):'';
      pauseReview(fen,[mv.san].concat(pv||[]).slice(0,6),ok,(ok?'✓ '+(r[10]?t('cvOkB'):t('cvOk',evalTxt(after)))+bestTxt:'✗ '+(r[10]?t('cvBadB','<b class="mono">'+esc(r[2])+'</b>'):t('cvBad',evalTxt(after),'<b class="mono">'+esc(r[2])+'</b>')))+(r[9]?' <span class="small">'+t('cvGame','<b class="mono">'+esc(r[9])+'</b>')+'</span>':''),(ok&&isBest)||!ba?[]:[ba],convNext,why)};
    if(mv.san.replace(/[+#]/g,'')===r[2].replace(/[+#]/g,'')||(r[11]&&B.chess.in_checkmate())){fin(true,r[1],r[3].split(' ').slice(1));return}
    if((r[6]||[]).indexOf(mv.san)>=0){fin(true,300,null);return}
    $('fb').className='feedback';$('fb').textContent=t('thinking');
    /* Nov 23: still clearly winning (>= +2) counts — it used to demand +3, so safe moves that kept +2.5 were marked wrong */
    analyse(B.chess.fen(),1500).then(function(a){var mine=a?-a.s:0;fin(mine>=200,mine,a&&a.pv?a.pv.slice(0,5):null)});
  };
  var myPos=C.n;dclkStart(C.sec||25,function(){if(!cur||cur.conv!==C||C.n!==myPos||cur.answered)return;B.locked=true;B.onMove=null;C.n++;C.secs.push(C.sec);dlog(C.fast?'convfast':'conv',fen,false,C.sec,1,'');var ba=arrowFor(fen,r[2],'#0E9488');
    pauseReview(fen,r[3].split(' '),false,'⏱ '+t('cvTime','<b class="mono">'+esc(r[2])+'</b>'),ba?[ba]:[],convNext,'')});
}
function convEnd(){dclkStop();
  var C=cur.conv,sec=Math.round((now()-C.t0)/1000),s=S.drill.conv||(S.drill.conv={best:0,bestT:0,runs:0});s.runs++;addTot('conv',C.ok);if(C.ok>s.best){s.best=C.ok;s.bestT=sec}
  if(C.fast&&C.total){var fs=s.fsec||15,avg=C.secs.reduce(function(a,b){return a+b},0)/Math.max(1,C.secs.length);   /* adaptive clock: all right and quick -> -2 s; half or more wrong -> +2 s */
    if(C.ok===C.total&&avg<fs*.6)fs=Math.max(8,fs-2);else if(C.ok<C.total/2)fs=Math.min(20,fs+2);s.fsec=fs;
    var lv=s.flvl||1;if(C.ok===C.total){s.fup=(s.fup||0)+1;if(s.fup>=2&&lv<3){s.flvl=lv+1;s.fup=0;C.lvUp=1}}else{s.fup=0;if(C.ok*3<=C.total&&lv>1){s.flvl=lv-1;C.lvDown=1}}}
  save();
  anOff();B.locked=true;B.onMove=null;C.done=true;$('fb').className='feedback '+(C.ok>=C.total*.7?'good':'bad');$('fb').innerHTML=t('drillRes',C.ok,C.total,mmss(sec))+(C.lvUp?' 🎉 '+t('cvUp',s.flvl):C.lvDown?' '+t('cvDown',s.flvl):'');itemDone(C.total>0&&C.ok>=C.total*.7);setBtns({next:true});
}
/* "Cuenta el cambio" (Nov 20, his words: "I choose the exchange where everything gets equal instead of the one where I get a better
   position… in my memory I don't hold the pieces I'm taking"). Several captures are possible (arrows); he picks one; then the bubble walks
   the right line with the running material count (⚖). Bank: trades.js (one capture wins >= 2 after the recaptures, another is only even). */
function loadTrade(){
  var N=(cur.it&&cur.it.n)||6,sn=S.seen||{},wk=now()-7*864e5;
  var rows=(window.TRADES||[]).map(function(r){return {r:r,k:((sn['tr:'+r[0]]||0)>wk?10:0)+(r[2]>1500?3:0)+Math.random()*3}}).sort(function(a,b){return a.k-b.k}).slice(0,N).map(function(x){return x.r});
  cur.trade={list:rows,n:0,ok:0,total:rows.length,t0:now()};setBar(null,false);setBtns({});readyGate(t('trT'),t('trQ'),'45',tradeNext);
}
function tradeNext(){
  var T=cur.trade;if(T.n>=T.total){tradeEnd();return}
  var r=T.list[T.n],fen=r[0],me=new Chess(fen).turn(),opts=r[1].slice().sort(function(){return Math.random()-.5});seenPuz('tr:'+fen);
  anOff();cur.answered=false;$('trBody').classList.remove('answered');$('fb').innerHTML='';$('fb').className='feedback';
  setBoard(fen,me==='b');B.locked=true;B.onMove=null;   /* Nov 20: no arrows on the captures — he finds them on the board from the notation, like in a game */
  $('prompt').innerHTML='<div class="op">'+kindPill('idea',t('trT'))+' <span class="counter">'+(T.n+1)+'/'+T.total+' · ✓ '+T.ok+'</span></div><div class="bigq">'+t('trQ')+'</div>';
  var ch=$('choices');ch.hidden=false;ch.classList.add('grid');
  ch.innerHTML=opts.map(function(o){return '<button class="btn mono" data-s="'+esc(o[0])+'">'+esc(noMate(o[0]))+'</button>'}).join('');
  var pick=function(san){if(cur.answered)return;dclkPause();T.n++;var best=r[1][0],mine=r[1].filter(function(o){return o[0]===san})[0],ok=san===best[0];if(ok)T.ok++;
    var sg=function(v){return v>=99?t('trMate'):v>0?'+'+v:v<0?String(v).replace('-','−'):'='};
    /* Nov 20 fix: step 1 must NOT give the count away (he was told "+6" and then asked to count it) — numbers only after step 2 */
    var h=ok?'✓ '+t('trOk1','<b class="mono">'+esc(noMate(san))+'</b>'):'✗ '+t('trBad1','<b class="mono">'+esc(noMate(san))+'</b>','<b class="mono">'+esc(noMate(best[0]))+'</b>');
    var hFull=ok?'✓ '+t('trOk','<b class="mono">'+esc(san)+'</b>',sg(best[1])):'✗ '+t('trBad','<b class="mono">'+esc(san)+'</b>',sg(mine?mine[1]:0),'<b class="mono">'+esc(best[0])+'</b>',sg(best[1]));
    var tbl='<div class="trtbl">'+r[1].map(function(o){return '<span class="'+(o===best?'best':'')+'"><b class="mono">'+esc(o[0])+'</b> → '+sg(o[1])+'</span>'}).join('')+'</div>';
    /* step 2 (Nov 20, "I have to be able to hold the material in my head"): the board does NOT move; the winning line is shown as text
       and he must say how he ends up. The ⚖ counter in the bubble only shows afterwards, to check. */
    var line=best[2].split(' ');   /* Nov 24: counts are taken when the trade is over (tools/trades_fix.py), so the whole line is shown */
    var val=best[1]>=99?99:best[1],mk=function(v){return v>=99?t('trMate'):v>0?'+'+v:v<0?String(v).replace('-','−'):'='};
    /* Nov 20: "mate" is ALWAYS one of the options and, when the answer is mate, the other options are realistic counts (it used to be the
       only odd one out next to +93/+96) */
    var ops=val===99?[99]:[val,99],cand=(val===99?[3,5,2,0,1,4,6]:[val-3,val+3,val-2,0,val-6,val+1]).sort(function(){return Math.random()-.5});
    if(val!==99)cand.sort(function(a,b){return Math.abs(a-val)-Math.abs(b-val)});
    cand.forEach(function(v){if(ops.length<4&&ops.indexOf(v)<0&&v<99&&v>-9)ops.push(v)});ops.sort(function(a,b){return a-b});
    $('prompt').innerHTML='<div class="op">'+kindPill('idea',t('trT'))+'</div><div class="bigq">'+t('trCount','<b class="mono">'+esc(noMate(best[0]))+'</b>')+'</div><div class="cseq">'+line.map(function(m,i){return '<span class="cmv"><small>'+((i%2===0)?t('calcYou'):t('calcOpp'))+'</small> <b class="mono">'+esc(noMate(m))+'</b></span>'}).join(' → ')+'</div>';
    $('fb').className='feedback '+(ok?'good':'bad');$('fb').innerHTML=h;
    ch.innerHTML=ops.map(function(v){return '<button class="btn mono" data-v="'+v+'">'+mk(v)+'</button>'}).join('');ch.hidden=false;ch.classList.add('grid');
    B.arrows=[];var ba0=arrowFor(fen,best[0],'#0E9488');if(ba0)B.arrows=[ba0];drawBoard();
    ch.querySelectorAll('[data-v]').forEach(function(b){b.onclick=function(){var v=+b.getAttribute('data-v'),cok=v===val;if(cok)T.cnt=(T.cnt||0)+1;
      $('choices').hidden=true;var ba=arrowFor(fen,best[0],'#0E9488');
      pauseReview(fen,line,ok&&cok,hFull+' '+(cok?'✓ '+t('trCountOk',mk(val)):'✗ '+t('trCountBad',mk(v),mk(val)))+tbl,ba?[ba]:[],tradeNext,'')}});
  };
  ch.querySelectorAll('[data-s]').forEach(function(b){b.onclick=function(){pick(b.getAttribute('data-s'))}});
  var myPos=T.n;dclkStart(45,function(){if(!cur||cur.trade!==T||T.n!==myPos||cur.answered)return;pick('—')});
}
function tradeEnd(){dclkStop();
  var T=cur.trade,sec=Math.round((now()-T.t0)/1000),s=S.drill.trade||(S.drill.trade={best:0,bestT:0,runs:0});s.runs++;addTot('trade',T.ok);if(T.ok>s.best){s.best=T.ok;s.bestT=sec}save();
  anOff();B.locked=true;B.onMove=null;T.done=true;$('choices').hidden=true;$('fb').className='feedback '+(T.ok>=T.total*.7?'good':'bad');$('fb').innerHTML=t('drillRes',T.ok,T.total,mmss(sec))+' · '+t('trCountRes',T.cnt||0,T.total);itemDone(T.total>0&&T.ok>=T.total*.7);setBtns({next:true});
}
/* "Finish": first tap ends the running drill (shows its result), otherwise it ends the session with a summary */
$('bFinish').onclick=function(){closeItemTime();
  if(!cur||!$('trEnd').hidden){go(X.back||'home');return}
  stopTimers();
  if(cur.rush&&!cur.rush.ended){cur.rush.ended=true;cur.rush.stopped=true;cur.rush.tok++;rushEnd();return}
  if(cur.flash&&cur.flash.n<cur.flash.total){anOff();cur.answered=false;B.onMove=null;B.onTap=null;cur.flash.stopped=true;cur.flash.total=cur.flash.n;flashNext();return}
  if(cur.drill&&cur.drill.n<cur.drill.total){cur.drill.total=cur.drill.n;B.onTap=null;B.onMove=null;drillEnd();return}
  if(cur.def&&!cur.def.done){cur.def.total=cur.def.n;defEnd();return}
  if(cur.game&&!cur.game.done){cur.game.total=cur.game.n;gameEnd();return}
  if(cur.calc&&!cur.calc.done){cur.calc.total=cur.calc.n;calcEnd();return}
  if(cur.judge&&!cur.judge.done){cur.judge.total=cur.judge.n;judgeEnd();return}
  if(cur.conv&&!cur.conv.done){cur.conv.total=cur.conv.n;convEnd();return}
  if(cur.trade&&!cur.trade.done){cur.trade.total=cur.trade.n;tradeEnd();return}
  var done=X.i+(cur.answered?1:0);anOff();$('trBody').hidden=true;$('trEnd').hidden=false;
  $('trEndT').textContent=t('sessStopT');$('trEndS').textContent=t('sessSum',X.ok,done)+(X.src==='today'&&done<X.items.length?' '+t('sessResume'):'');
  if(X.src==='today'&&S.daily){X.i=done;saveDaily()}
  $('trEndA').innerHTML=advTxt();
};
/* Scan: the thinking routine, one layer per tap */
function scanLayers(c){
  var me=c.turn(),opp=me==='w'?'b':'w',h=c.history({verbose:true}),L=[];
  /* 1. what does his last move attack? */
  var last=h[h.length-1],thr=[];
  if(last){var x;try{x=new Chess(flipTurn(c.fen(),opp))}catch(e){x=null}
    if(x)x.moves({square:last.to,verbose:true}).forEach(function(m){if(m.captured)thr.push({from:m.from,to:m.to,c:'#DC2626'})})}
  L.push({arr:thr,txt:thr.length?t('scan1',thr.map(function(a){return pcName(c.get(a.to).type)+' '+a.to}).join(', ')):t('scan1none')});
  /* 2. my checks, 3. my captures (free ones marked) */
  var ms=c.moves({verbose:true}),checks=ms.filter(function(m){return m.san.indexOf('+')>=0||m.san.indexOf('#')>=0}),caps=ms.filter(function(m){return m.captured});
  L.push({arr:checks.map(function(m){return {from:m.from,to:m.to,c:'#2563EB'}}),txt:checks.length?t('scan2',checks.map(function(m){return m.san}).join(', ')):t('scan2none')});
  L.push({arr:caps.map(function(m){return {from:m.from,to:m.to,c:'#E8730C'}}),txt:caps.length?t('scan3',caps.map(function(m){return m.san}).join(', ')):t('scan3none')});
  return L;
}
$('bScan').onclick=function(){if(!cur||cur.answered)return;var c=B.chess,L=scanLayers(c);cur.scan=((cur.scan||0)%L.length)+1;var l=L[cur.scan-1];
  B.arrows=l.arr;drawBoard();$('fb').className='feedback';$('fb').innerHTML='<b>'+cur.scan+'/3</b> '+l.txt};

/* ---------- learn: course of tactics, mates, endgames (+ strategy ideas) ---------- */
function lessonById(id){if(/^w_/.test(id))return weakL(id.slice(2));return CURSO.lessons.filter(function(l){return l.id===id})[0]}
function techById(id){return CURSO.tech.filter(function(x){return x.id===id})[0]}
function puzSt(id){return S.puz[id]}
function lessonProg(l){var n=l.p.length,ok=l.p.filter(function(p){var s=S.puz[p.id];return s&&s.box>=1}).length;return {ok:ok,n:n,pct:n?ok/n:0}}
function curLesson(){return CURSO.lessons.filter(function(l){return lessonProg(l).pct<.6})[0]||CURSO.lessons[0]}
function lessonItems(l,max){
  var due=l.p.filter(function(p){var s=S.puz[p.id];return s&&(s.due||0)<=now()&&s.box<3}),fresh=l.p.filter(function(p){return !S.puz[p.id]});
  /* too easy lately (>85% first try) -> start a little higher in the lesson; struggling stays on the easiest ones */
  var lp=(S.log||[]).filter(function(e){return e[1]==='puz'}).slice(-15);if(lp.length>=10&&lp.filter(function(e){return e[2]}).length/lp.length>.85&&fresh.length>4)fresh=fresh.slice(2).concat(fresh.slice(0,2));
  var ps=due.concat(fresh).slice(0,max||8);
  var o=[];if(!S.seenLesson[l.id])o.push({t:'theory',l:l.id});
  return o.concat(ps.map(function(p){return {t:'puz',l:l.id,id:p.id}}));
}
function reviewPuz(n){var o=[],sn=S.seen||{},old=now()-3*864e5;CURSO.lessons.forEach(function(l){l.p.forEach(function(p){var s=S.puz[p.id];if(s&&s.lapses&&(s.due||0)<=now()&&(sn[p.id]||0)<old)o.push({t:'puz',l:l.id,id:p.id})})});return o.slice(0,n)}
function renderLearn(){
  var h='<div class="unit"><h3>'+t('unitFund')+'</h3>'+FUND.map(function(f){var sub;
    if(f.id==='quiz'){var k=QUIZ.filter(function(q){return S.quiz[q.id]&&S.quiz[q.id].box>=2}).length;sub=t('learned',k,QUIZ.length)}
    var pct=null;if(f.id!=='quiz'){var d=S.drill[f.id],g=GOAL[f.id]||50,tot=(d&&d.tot)||0;pct=Math.min(1,tot/g);
      sub=t('drillProg',Math.min(tot,g),g)+(d&&d.best?' · '+(f.id==='rush'?t('rushBest',d.best):t('bestWas2',d.best,mmss(d.bestT||0))):'')}
    var ok=f.id==='quiz'?QUIZ.filter(function(q){return S.quiz[q.id]&&S.quiz[q.id].box>=2}).length>=QUIZ.length*.7:pct>=1;
    return '<button class="lrow" data-f="'+f.id+'"><span class="dotst '+(ok?'ok':S.seenLesson['f_'+f.id]||pct?'due':'new')+'"></span><span class="lname">'+esc(tt(f.t))+'<span class="small">'+sub+'</span>'+(pct!=null?'<span class="bar2"><span style="width:'+Math.round(pct*100)+'%"></span></span>':'')+'</span></button>'}).join('')+'</div>';
  CURSO.units.forEach(function(u){
    h+='<div class="unit"><h3>'+esc(tt(u.t))+'</h3>';
    CURSO.lessons.filter(function(l){return l.unit===u.id}).forEach(function(l){var p=lessonProg(l);
      h+='<button class="lrow" data-l="'+l.id+'"><span class="dotst '+(p.ok===0?'new':p.pct>=.6?'ok':'due')+'"></span><span class="lname">'+esc(tt(l.t))+
        '<span class="small">'+t('puzN',p.ok,p.n)+'</span><span class="bar2"><span style="width:'+Math.round(p.pct*100)+'%"></span></span></span></button>'});
    if(u.id==='end')CURSO.tech.forEach(function(x){var s=S.tech[x.id];
      h+='<button class="lrow" data-tech="'+x.id+'"><span class="dotst '+(!s?'new':s.box>=2?'ok':'due')+'"></span><span class="lname">'+esc(tt(x.t))+'<span class="small">'+t('techVs')+'</span></span></button>'});
    h+='</div>';
  });
  h+='<div class="unit"><h3>'+t('unitStrat')+'</h3>'+STRAT.filter(function(x){return plansOf(x.id).length}).map(function(x){var p=planProg(x.id);
    return '<button class="lrow" data-s="'+x.id+'"><span class="dotst '+(p.ok===0?'new':p.pct>=.6?'ok':'due')+'"></span><span class="lname">'+esc(tt(x.t))+'<span class="small">'+t('planN',p.ok,p.n)+'</span><span class="bar2"><span style="width:'+Math.round(p.pct*100)+'%"></span></span></span></button>'}).join('');
  var vk=VOCAB.filter(function(q){return S.quiz[q.id]&&S.quiz[q.id].box>=2}).length;
  h+='<button class="lrow" data-vocab="1"><span class="dotst '+(vk>=VOCAB.length*.7?'ok':vk?'due':'new')+'"></span><span class="lname">'+t('vocabT')+'<span class="small">'+t('learned',vk,VOCAB.length)+'</span></span></button></div>';
  h+='<div class="unit"><h3>'+t('unitIdeas')+'</h3>'+IDEAS.map(function(x,i){var s=S.ideas[x.id];return '<button class="lrow" data-i="'+i+'"><span class="dotst '+(!s?'new':s.box>=2?'ok':'due')+'"></span><span class="lname">'+esc(tt(x.t))+'<span class="small">'+esc(tt(x.body)[0])+'</span></span></button>'}).join('')+'</div>';
  $('learnList').innerHTML=h;
  /* Nov 25 ("I have to go down a lot; not everything has to be shown at first"): every unit shows only its title + how many are done; tap to open */
  $('learnList').querySelectorAll('.unit').forEach(function(u,k){var h3=u.querySelector('h3');if(!h3)return;var rows=[].slice.call(u.children).filter(function(x){return x!==h3}),
      n=u.querySelectorAll('.lrow').length,ok=u.querySelectorAll('.lrow .dotst.ok').length,key='L:'+k,box=document.createElement('div');box.className='plines';box.hidden=!FOLD[key];
    rows.forEach(function(x){box.appendChild(x)});u.appendChild(box);
    var b=document.createElement('button');b.type='button';b.className='uhead';b.setAttribute('data-tg',key);b.innerHTML='<span>'+h3.innerHTML+'</span><span class="small">'+ok+'/'+n+' <span class="chev">'+(FOLD[key]?'▴':'▾')+'</span></span>';h3.replaceWith(b)});
  foldWire($('learnList'));
  $('learnList').querySelectorAll('[data-l]').forEach(function(b){b.onclick=function(){var l=lessonById(b.getAttribute('data-l'));var it=lessonItems(l,8);if(it.length<2)it=[{t:'theory',l:l.id}].concat(l.p.slice(0,8).map(function(p){return {t:'puz',l:l.id,id:p.id}}));startSession(it,'learn')}});
  $('learnList').querySelectorAll('[data-f]').forEach(function(b){b.onclick=function(){startSession(fundItems(b.getAttribute('data-f')),'learn')}});
  $('learnList').querySelectorAll('[data-s]').forEach(function(b){b.onclick=function(){var id=b.getAttribute('data-s'),it=stratItems(id,6);if(it.length<2)it=plansOf(id).slice(0,6).map(function(_,k){return {t:'plan',s:id,k:k}});startSession(it,'learn')}});
  $('learnList').querySelectorAll('[data-vocab]').forEach(function(b){b.onclick=function(){var qs=VOCAB.filter(function(q){var s=S.quiz[q.id];return !s||(s.due||0)<=now()});if(qs.length<3)qs=VOCAB.slice();startSession(qs.slice(0,8).map(function(q){return {t:'quiz',id:q.id}}),'learn')}});
  $('learnList').querySelectorAll('[data-tech]').forEach(function(b){b.onclick=function(){startSession([{t:'play',id:b.getAttribute('data-tech')}],'learn')}});
  $('learnList').querySelectorAll('[data-i]').forEach(function(b){b.onclick=function(){startSession([{t:'idea',id:IDEAS[+b.getAttribute('data-i')].id}],'learn')}});
}
function exCap(h){$('fb').className='feedback exm';$('fb').innerHTML='<span class="exl">'+t('exLabel')+'</span> '+(h||'')}
function animExample(start,moves,flip,me){
  var i=0,c,my=cur;
  function reset(){if(cur!==my)return;c=new Chess(start);setBoard(start,flip);B.locked=true;i=0;exCap('');later(step,900)}
  function step(){if(cur!==my)return;if(i>=moves.length){later(reset,2400);return}
    var before=c.fen(),legal=c.moves().length,mv=c.move(moves[i],{sloppy:true});if(!mv){later(reset,1500);return}
    B.chess=new Chess(c.fen());B.marks={};B.marks[mv.from]='last';B.marks[mv.to]='last';B.arrows=[{from:mv.from,to:mv.to,c:mv.color===me?'#0E9488':'#C0392B'}];drawBoard();
    var d=describe(before,mv,c,mv.color===me,legal,null);exCap('<b class="mono">'+esc(mv.san)+'</b>'+(mv.color!==me?' <span class="small">('+t('stOpp')+')</span>':'')+(d?' — '+esFix(d):''));i++;later(step,1800)}
  reset();
}
/* theory = one idea, big (Nov 19, "think of me as a lazy kid"): the first sentence; the rest folded under "Más" */
function theoryHtml(pill,title,body){var b=tt(body);return '<div class="op">'+pill+'</div><h3 class="ideaT">'+esc(title)+'</h3><p class="idea1">💡 '+esc(b[0]||'')+'</p>'+(b.length>1?'<details class="fold"><summary>'+t('moreT')+'</summary><ul class="ideaB">'+b.slice(1).map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul></details>':'')}
function loadTheory(l){
  S.seenLesson[l.id]=1;save();setBar(null,false);
  var p=l.p[0];var c=new Chess(p.fen);c.move(p.m[0],{sloppy:true});var me=c.turn();animExample(p.fen,p.m,me==='b',me);
  $('prompt').innerHTML=theoryHtml(kindPill('idea',esc(tt(lessonUnit(l)))),tt(l.t),l.body);
  setBtns({next:true});cur.answered=true;
}
function lessonUnit(l){var u=CURSO.units.filter(function(u){return u.id===l.unit})[0];return u?u.t:{es:'Puntos débiles',en:'Weak spots'}}   /* weak-bank lessons (w_*) have no unit */
/* puzzle: FEN is before the opponent's move; m[0] is played automatically, then you alternate */
function loadPuz(l,p){
  seenPuz(p.id);
  var c=new Chess(p.fen),me=c.turn()==='w'?'b':'w';cur.puz={l:l,p:p,ply:0,me:me};
  setBoard(p.fen,me==='b');setBar(null,false);B.locked=true;
  /* Nov 20: outside Aprender the theme is hidden until he answers ("if you tell me it's a mate I stop looking at the position") */
  var showTheme=X.src==='learn'&&!/^w_/.test(l.id);cur.puzHidden=!showTheme;
  $('prompt').innerHTML='<div class="op">'+kindPill('puz',sideTxt(me))+(showTheme?' <b class="pth">'+esc(tt(l.t))+'</b>':'')+'</div>'+t('puzQ')+(showTheme?' <span class="small">'+t('puzRating',p.r)+'</span>':'');
  setBtns({scan:true,hint:true,show:true});B.onMove=onPuzMove;
  later(function(){puzOpp()},600);
}
function puzOpp(){var P=cur.puz,fen=B.chess.fen(),m=B.chess.move(P.p.m[P.ply],{sloppy:true});if(m){B.marks={};B.marks[m.from]='last';B.marks[m.to]='last'}P.ply++;drawBoard();
  if(P.ply>=P.p.m.length){puzSolved();return}B.locked=false;cur.fen=B.chess.fen()}
function onPuzMove(mv){
  var P=cur.puz,want=P.p.m[P.ply];B.locked=true;
  var ok=mv.san===want||(P.ply===P.p.m.length-1&&B.chess.in_checkmate());
  if(ok){B.marks[mv.to]='ok';drawBoard();P.ply++;$('fb').className='feedback good';$('fb').innerHTML=t('puzGood');
    if(P.ply>=P.p.m.length){puzSolved();return}later(puzOpp,500);return}
  cur.first=false;cur.miss=(cur.miss||0)+1;B.marks[mv.to]='bad';drawBoard();$('fb').className='feedback bad';
  var fBad=B.chess.fen(),me=P.me,miss=cur.miss;$('fb').innerHTML=t(miss>=2?'puzWrong2':'puzWrong1','<span class="mono">'+esc(mv.san)+'</span>');
  /* teacher: why that move does not work (quick engine look) */
  analyse(fBad,600).then(function(r){if(!r||!cur.puz||cur.puz!==P||cur.answered)return;B.chess.undo();var f0b=B.chess.fen();B.chess.move(mv.san,{sloppy:true});
    var tb=teachBad(f0b,mv.san,r.pv,me);if(tb){var x=esFix(tb.txt.charAt(0).toUpperCase()+tb.txt.slice(1));$('fb').innerHTML+=' <span class="small">'+t('puzWhyNot')+' '+x+'</span>'}});
  later(function(){B.chess.undo();var f0=B.chess.fen();B.marks={};if(miss>=2){var a=arrowFor(f0,want,'#E8730C');if(a)B.marks[a.from]='hint'}drawBoard();B.locked=false},900);
}
function puzSolved(){
  var P=cur.puz,s=S.puz[P.p.id]||(S.puz[P.p.id]={box:0,due:0});gradeObj(s,cur.first);
  $('fb').className='feedback '+(cur.first?'good':'bad');$('fb').innerHTML=cur.first?t('puzDone'):t('puzDoneLate');if(cur.puzHidden)$('fb').innerHTML+=' <span class="small">'+t('puzWas',esc(tt(P.l.t)))+'</span>';
  var c=new Chess(P.p.fen);c.move(P.p.m[0],{sloppy:true});var f1=c.fen(),sol=P.p.m.slice(1);
  var r=outcome(f1,sol,P.me,sol.length);
  var w=['<b>'+esc(tt(P.l.t))+':</b> '+esc(tt(P.l.body)[0]),fold(t('stStep'),story(f1,sol,P.me,8))];
  showWhy(w);cur.goodLine=sol;cur.anPath=function(){return {start:P.p.fen,moves:P.p.m,i:P.p.m.length,base:1}};itemDone(cur.first);setBtns({next:true,good:true});
}
/* endgame technique: play it out against Stockfish */
function loadPlay(x){
  var me=new Chess(x.fen).turn();cur.play={x:x,me:me,n:0,over:false};
  setBoard(x.fen,me==='b');setBar(null,false);
  $('prompt').innerHTML='<div class="op">'+kindPill('idea',t('techVs'))+'</div><h3 class="ideaT">'+esc(tt(x.t))+'</h3><ul class="ideaB">'+tt(x.body).map(function(y){return '<li>'+esc(y)+'</li>'}).join('')+'</ul><p><b>'+t('goal_'+x.goal,x.limit)+'</b> <span class="counter" id="playN"></span></p>';
  B.locked=false;B.onMove=onPlayMove;setBtns({hint:true,retry:true});playCount();Engine.init();
}
function playCount(){var P=cur.play;var el=$('playN');if(el)el.textContent=t('movesLeft',Math.max(0,P.x.limit-P.n))}
function playEnd(ok,msg){var P=cur.play;P.over=true;B.locked=true;var s=S.tech[P.x.id]||(S.tech[P.x.id]={box:0,due:0});gradeObj(s,ok);
  $('fb').className='feedback '+(ok?'good':'bad');$('fb').innerHTML=msg;var hs=B.chess.history();cur.anPath=function(){return {start:P.x.fen,moves:hs,base:0}};itemDone(ok);setBtns({next:true,retry:true})}
function onPlayMove(mv){
  var P=cur.play;if(P.over)return;B.locked=true;P.n++;playCount();var c=B.chess,g=P.x.goal;
  if(c.in_checkmate()){playEnd(g==='mate',g==='mate'?t('playMate'):t('playLost'));return}
  if(c.in_stalemate()){playEnd(false,t('playStale'));return}
  if(g==='promote'&&mv.promotion){playEnd(true,t('playPromo'));return}
  if(c.insufficient_material()&&g!=='hold'){playEnd(false,t('playDrawn'));return}
  $('fb').className='feedback';$('fb').textContent=t('thinking');
  analyse(c.fen(),500).then(function(r){
    if(!cur||cur.play!==P||P.over)return;var san=r&&r.pv[0];if(!san){playEnd(false,t('noEngine'));return}
    var m=c.move(san,{sloppy:true});B.marks={};B.marks[m.from]='last';B.marks[m.to]='last';drawBoard();$('fb').textContent='';
    if(c.in_checkmate()){playEnd(false,t('playLost'));return}
    if(c.in_stalemate()||c.insufficient_material()){playEnd(g==='hold',g==='hold'?t('playHeld'):t('playDrawn'));return}
    if(g==='hold'&&m.promotion){playEnd(false,t('playPromoted'));return}
    if(g!=='hold'&&(m.captured==='q'||m.captured==='r'&&P.x.id==='kr'||m.captured==='p'&&g==='promote')){playEnd(false,t('playLostMat'));return}
    if(P.n>=P.x.limit){playEnd(g==='hold',g==='hold'?t('playHeld'):t('playOut'));return}
    B.locked=false;
  });
}
$('bRetry').onclick=function(){if(cur&&cur.play){anOff();cur.answered=false;cur.first=false;$('fb').innerHTML='';$('why').hidden=true;loadPlay(cur.play.x)}};

/* ---------- sync new games from Chess.com (the ↻ button) ---------- */
function lastGameDate(){var d=0;Object.keys(S.games).forEach(function(k){var g=S.games[k];if((g.date||0)>d)d=g.date});return d}
/* 1) save every new game (rating, result) immediately, 2) official rating from /stats, 3) analyse pending games in the background (resumable) */
function syncGames(){
  if(running)return;var user=(S.user||'Esmithco').toLowerCase();setRunning(true);stopFlag=false;S.pend=S.pend||{};
  fetch('https://api.chess.com/pub/player/'+encodeURIComponent(user)+'/stats').then(function(r){return r.json()}).then(function(st){var r=st.chess_rapid;
    if(r&&r.last){S.rating={rapid:r.last.rating,best:r.best?r.best.rating:null,at:now()};save();if(!$('s-progress').hidden)renderProgress()}}).catch(function(){});
  var since=lastGameDate(),sd=new Date((since||0)*1000),key=sd.getUTCFullYear()*100+sd.getUTCMonth()+1;
  status('fetch',1,1);
  fetch('https://api.chess.com/pub/player/'+encodeURIComponent(user)+'/games/archives').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(a){
    var urls=(a.archives||[]).filter(function(u){var m=u.match(/(\d{4})\/(\d{2})$/);return m&&(+m[1]*100+ +m[2])>=key});if(!since)urls=urls.slice(-3);
    var out=[],i=0;return new Promise(function(res,rej){(function next(){if(i>=urls.length){res(out);return}status('fetch',i+1,urls.length);
      fetch(urls[i++]).then(function(r){return r.json()}).then(function(j){(j.games||[]).forEach(function(g){if(g.rules==='chess'&&g.pgn)out.push(g)});next()}).catch(rej)})()})
  }).then(function(games){var added=0;
    games.forEach(function(g){var side=g.white.username.toLowerCase()===user?'w':'b',me=side==='w'?g.white:g.black;
      var old=S.games[g.url];if(old){if(old.r==='L'&&old.op&&!old.full&&!S.pend[g.url]&&now()/1000-(old.date||0)<7*86400){var sv=movesOf(g.pgn);if(sv){S.pend[g.url]=sv;added++}}return}var sans=movesOf(g.pgn);
      S.games[g.url]={id:g.url,white:g.white.username,black:g.black.username,date:g.end_time,opening:openingName(g.eco),side:side,r:resultCode(me.result),how:me.result,rt:me.rating,tc:g.time_class,src:'app',op:0};
      if(sans){S.pend[g.url]=sans;try{S.games[g.url].os=osClassify(sans,side)}catch(e){}}added++});
    S.lastSync=now();save();
    if(!$('s-home').hidden)renderHome();if(!$('s-progress').hidden)renderProgress();
    status(added?'added':'upToDate',added);setRunning(false);
    if(added)later2(analyzePending,1500);
  }).catch(function(){setRunning(false);status('fail')});
}
function later2(f,ms){setTimeout(f,ms)}
function analyzePending(){
  if(running)return;var ids=Object.keys(S.pend||{}).filter(function(k){return S.games[k]}).sort(function(a,b){return (S.games[b].date||0)-(S.games[a].date||0)}).slice(0,15);
  if(!ids.length)return;setRunning(true);stopFlag=false;
  runJobs(ids.map(function(id){return {info:S.games[id],sans:S.pend[id]}}));
}
$('bSync').onclick=syncGames;

/* ---------- progress ---------- */
function lineChart(pts,opt){ /* pts: [[x,y]] */
  if(pts.length<2)return '<p class="small">'+t('noData')+'</p>';
  var W=320,H=140,P=26,xs=pts.map(function(p){return p[0]}),ys=pts.map(function(p){return p[1]});
  var x0=Math.min.apply(0,xs),x1=Math.max.apply(0,xs),y0=Math.min.apply(0,ys),y1=Math.max.apply(0,ys);if(y1-y0<20){y0-=10;y1+=10}
  var X=function(x){return P+(x-x0)/(x1-x0||1)*(W-P-6)},Y=function(y){return 8+(1-(y-y0)/(y1-y0))*(H-26)};
  var d=pts.map(function(p,i){return (i?'L':'M')+X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)}).join('');
  var lab=function(y){return '<text x="2" y="'+(Y(y)+4)+'" font-size="9" fill="#8A94A3">'+Math.round(y)+'</text><line x1="'+P+'" x2="'+W+'" y1="'+Y(y)+'" y2="'+Y(y)+'" stroke="#E3E7EF"/>'};
  var last=pts[pts.length-1];
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img">'+lab(y0)+lab(y1)+lab((y0+y1)/2)+'<path d="'+d+'" fill="none" stroke="#7C3AED" stroke-width="2.2" stroke-linejoin="round"/>'+
    '<circle cx="'+X(last[0])+'" cy="'+Y(last[1])+'" r="3.5" fill="#7C3AED"/>'+(opt&&opt.xl?opt.xl.map(function(l){return '<text x="'+X(l[0])+'" y="'+(H-4)+'" font-size="9" fill="#8A94A3" text-anchor="middle">'+l[1]+'</text>'}).join(''):'')+'</svg>';
}
function barChart(rows,fmtV,color){ /* rows: [[label,value,sub]] */
  if(!rows.length)return '<p class="small">'+t('noData')+'</p>';
  var W=320,H=130,bw=Math.min((W-10)/rows.length,46),x0=(W-bw*rows.length)/2,mx=Math.max.apply(0,rows.map(function(r){return r[1]}))||1;
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img">'+rows.map(function(r,i){var h=(r[1]/mx)*(H-34),x=x0+i*bw;
    return '<rect x="'+(x+bw*.18)+'" y="'+(H-18-h)+'" width="'+(bw*.64)+'" height="'+h+'" rx="3" fill="'+(color||'#7C3AED')+'"/>'+
      '<text x="'+(x+bw/2)+'" y="'+(H-21-h)+'" font-size="9" text-anchor="middle" fill="#172033">'+fmtV(r[1])+'</text>'+
      '<text x="'+(x+bw/2)+'" y="'+(H-5)+'" font-size="8.5" text-anchor="middle" fill="#8A94A3">'+r[0]+'</text>'}).join('')+'</svg>';
}
var MON={es:['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'],en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']};
function renderProgress(){
  var gs=Object.keys(S.games).map(function(k){return S.games[k]}).filter(function(g){return g.rt&&(!g.tc||g.tc==='rapid')}).sort(function(a,b){return a.date-b.date});
  /* rating: last game of each day, last 60 days (Nov 19: Progreso = rating, days trained, what is done; less is more) */
  var byd={},t60=now()/1000-60*86400;gs.forEach(function(g){if(g.date<t60)return;var k=Math.floor(g.date/86400);byd[k]=g.rt});
  var ks=Object.keys(byd).map(Number).sort(function(a,b){return a-b}),pts=ks.map(function(k){return [k,byd[k]]});
  var xl=ks.filter(function(k,i){return i%Math.max(1,Math.ceil(ks.length/5))===0||i===ks.length-1}).map(function(k){var d=new Date(k*864e5);return [k,d.getUTCDate()+' '+MON[LANG][d.getUTCMonth()]]});
  $('chRating').innerHTML=lineChart(pts,{xl:xl});
  var cur_=S.rating&&S.rating.rapid?S.rating.rapid:gs.length?gs[gs.length-1].rt:0,ago=gs.filter(function(g){return g.date<now()/1000-30*86400}).pop(),best=Math.max(gs.reduce(function(m,g){return Math.max(m,g.rt)},0),S.rating&&S.rating.best||0);
  $('capRating').textContent=gs.length?t('ratingCap',cur_,ago?(cur_-ago.rt>=0?'+':'')+(cur_-ago.rt):'—',best):'';
  /* kpis */
  var L=S.log||[],days=Object.keys(S.days||{}).length;
  $('kpis').innerHTML='<div class="kpi"><b>'+(cur_||'—')+'</b><span>'+t('kRating')+'</span></div><div class="kpi"><b>'+streakN()+'</b><span>'+t('kStreak')+'</span></div><div class="kpi"><b>'+days+'</b><span>'+t('kDays')+'</span></div>';
  /* course */
  var rows=CURSO.units.map(function(u){var ls=CURSO.lessons.filter(function(l){return l.unit===u.id}),ok=0,n=0;ls.forEach(function(l){var p=lessonProg(l);ok+=p.ok;n+=p.n});return [tt(u.t),ok,n]});
  var rl=allLines(),rok=rl.filter(function(x){return x.st&&x.st.box>=3}).length;rows.push([t('tRep'),rok,rl.length]);
  var ik=IDEAS.filter(function(x){return S.ideas[x.id]&&S.ideas[x.id].box>=2}).length;rows.push([t('unitIdeas'),ik,IDEAS.length]);
  var sp=0,sn=0;STRAT.forEach(function(x){var p=planProg(x.id);sp+=p.ok;sn+=p.n});rows.push([t('unitStrat'),sp,sn]);
  /* Nov 25 (screenshot: the tile said 'nothing to solve' while this bar said x/101): same cards and same rule as the home tiles — his usable cards, solved = last answer right */
  var cm=cardsOf('mine'),cp=cardsOf('punish'),solved=function(L){return L.filter(function(c){return c.last===1}).length};rows.unshift([t('tPun'),solved(cp),cp.length]);rows.unshift([t('tMine'),solved(cm),cm.length]);
  rows.unshift([t('unitFund'),QUIZ.filter(function(q){return S.quiz[q.id]&&S.quiz[q.id].box>=2}).length,QUIZ.length]);
  rows.splice(2,0,rows.shift());   /* your mistakes and punish first */
  $('chCourse').innerHTML=rows.map(function(r){return '<div><div class="small" style="display:flex;justify-content:space-between"><span>'+esc(r[0])+'</span><span>'+r[1]+'/'+r[2]+'</span></div><div class="bar2"><span style="width:'+(r[2]?Math.round(r[1]/r[2]*100):0)+'%"></span></div></div>'}).join('');
}

/* ---------- data screen: analysis, stats, backup ---------- */
function renderData(){hintsUI();if($('appVer'))$('appVer').textContent=t('appVer',APP_VER);
  if(S.user)$('iUser').value=S.user;
  var by={};Object.keys(S.games).forEach(function(k){var g=S.games[k];var key=g.side+'|'+g.opening;var o=by[key]||(by[key]={side:g.side,name:g.opening,n:0,W:0,D:0,L:0,err:0});o.n++;o[g.r||'D']++;o.err+=g.errors||0});
  var rows=Object.keys(by).map(function(k){return by[k]}).sort(function(a,b){return b.n-a.n}).slice(0,20);
  $('tOpen').innerHTML=rows.length?'<thead><tr><th>'+t('colOpening')+'</th><th>'+t('colColor')+'</th><th class="n">'+t('colGames')+'</th><th class="n">'+t('colWDL')+'</th><th class="n">'+t('colErr')+'</th></tr></thead><tbody>'+
    rows.map(function(o){return '<tr><td>'+esc(o.name)+'</td><td>'+(o.side==='w'?t('White'):t('Black'))+'</td><td class="n">'+o.n+'</td><td class="n">'+o.W+'-'+o.D+'-'+o.L+'</td><td class="n">'+o.err+'</td></tr>'}).join('')+'</tbody>':'<tr><td class="empty">'+t('noData')+'</td></tr>';
  var gm=Object.keys(S.gambits||{}).map(function(k){return S.gambits[k]}).sort(function(a,b){return b.n-a.n}).slice(0,12);
  $('tGambits').innerHTML=gm.length?'<thead><tr><th>'+t('colOpening')+'</th><th>'+t('colColor')+'</th><th class="n">'+t('colGames')+'</th><th class="n">'+t('colWDL')+'</th></tr></thead><tbody>'+
    gm.map(function(o){return '<tr><td>'+esc(o.name)+'</td><td>'+(o.side==='w'?t('White'):t('Black'))+'</td><td class="n">'+o.n+'</td><td class="n">'+o.W+'-'+o.D+'-'+o.L+'</td></tr>'}).join('')+'</tbody>':'<tr><td class="empty">'+t('noData')+'</td></tr>';
}
function openingName(url){var seg=decodeURIComponent((url||'').split('/').pop()||'');if(!seg)return '?';
  var parts=seg.split('-'),keep=[];for(var i=0;i<parts.length;i++){if(/\d|\.\.\./.test(parts[i]))break;keep.push(parts[i])}return keep.join(' ').trim()||'?'}
function cleanPgn(p){return p.replace(/\{[^}]*\}/g,'').replace(/\s\d+\.\.\.\s/g,' ')}
function movesOf(pgn){var c=new Chess();if(!c.load_pgn(cleanPgn(pgn),{sloppy:true}))return null;return c.history()}
function resultCode(r){return r==='win'?'W':LOSS[r]?'L':'D'}
function status(k){var a=[].slice.call(arguments,1),tx=fmt(TXT[LANG].st[k]||k,a);$('impStatus').textContent=tx;$('syncStatus').textContent=tx}
function isRep(side,sans){return (side==='w'&&sans[0]==='d4')||(side==='b'&&((sans[0]==='e4'&&sans[1]==='c6')||sans[0]==='d4'))}
function fetchGames(user,months){
  return fetch('https://api.chess.com/pub/player/'+encodeURIComponent(user)+'/games/archives').then(function(r){if(!r.ok)throw new Error('user');return r.json()}).then(function(a){
    var urls=(a.archives||[]).slice(-months),out=[],i=0;
    return new Promise(function(res,rej){(function next(){if(i>=urls.length){res(out);return}status('fetch',i+1,urls.length);
      fetch(urls[i++]).then(function(r){return r.json()}).then(function(j){(j.games||[]).forEach(function(g){if(g.rules==='chess'&&g.pgn)out.push(g)});next()}).catch(rej)})()})})}
var running=false,stopFlag=false;
function setRunning(on){running=on;$('bRecent').disabled=on;$('bPgn').disabled=on;$('bSync').disabled=on;$('bStop').hidden=!on}
/* same criteria as the offline analysis: your moves that drop ≥10 points, opponent moves that drop ≥15 */
function analyseGame(info,sans,ms){
  var n=Math.min(sans.length,info.r==='L'?120:30),c=new Chess(),fens=[c.fen()];for(var i=0;i<n;i++){c.move(sans[i],{sloppy:true});fens.push(c.fen())}
  var R=[],found=0,errs=0,us=info.side==='w'?0:1,p=0;
  function ev(k){if(R[k])return Promise.resolve();return analyse(fens[k],ms).then(function(r){R[k]=r||{s:0,pv:[]}})}
  return new Promise(function(resolve){(function next(){
    if(stopFlag||p>=n){resolve({found:found,errs:errs,stopped:stopFlag&&p<n});return}
    ev(p).then(function(){return ev(p+1)}).then(function(){
      var s0=R[p].s,s1=-R[p+1].s,drop=wp(s0)-wp(s1),best=R[p].pv[0],rep=isRep(info.side,sans);
      if(p%2===us){
        if(isMistake(s0,s1)&&best&&best!==sans[p]){var k=posKey(fens[p])+'|'+sans[p];
          if(S.cards[k]){var e=S.cards[k];if((e.games||[]).indexOf(info.id)<0){e.games=(e.games||[]).concat(info.id);e.count=(e.count||1)+1;e.due=0;e.box=Math.max(0,(e.box||0)-2);e.last=0;e.again=info.date}}
          else{S.cards[k]={id:k,kind:'mine',src:'app',side:info.side,opening:info.opening,line:sans.slice(0,p),played:sans[p],best:best,s0:s0,s1:s1,drop:Math.round(drop),
            sev:(s1<=-300||drop>=25)?'blunder':'mistake',trap:s0>=-200&&s1<=-300,pvBest:R[p].pv,pvBad:R[p+1].pv,threat:null,games:[info.id],count:1,date:info.date,rep:rep,
            mat:outcome(fens[p+1],R[p+1].pv,info.side,6).delta,box:0,due:0};found++}if(visOf(S.cards[k])!=='deep')errs++}
      }else if(p+1<=n&&R[p+1].pv.length&&isPunish(-s0,R[p+1].s)){
        var kp='P|'+posKey(fens[p+1]);
        if(!S.cards[kp]){S.cards[kp]={id:kp,kind:'punish',src:'app',side:info.side,opening:info.opening,line:sans.slice(0,p+1),oppMove:sans[p],oppBest:best,best:R[p+1].pv[0],
          s0:-s0,s1:R[p+1].s,gain:Math.round(wp(R[p+1].s)-wp(-s0)),pvBest:R[p+1].pv,gameMove:sans[p+1]||null,missed:sans[p+1]!==R[p+1].pv[0],games:[info.id],count:1,date:info.date,rep:rep,
          mat:outcome(fens[p+1],R[p+1].pv,info.side,6).delta,box:0,due:0};found++}
      }
      p++;next();
    })})()});
}
function runJobs(jobs){
  var ms=+$('iDepth').value,total=jobs.length,done=0,found=0;
  if(!total){status('none');setRunning(false);return}
  status('loading');
  Engine.init().then(function(ok){if(!ok){$('impStatus').textContent=t('noEngine');setRunning(false);return}
    (function next(){
      if(stopFlag||!jobs.length){status(stopFlag?'stopped':'done',done,total,found);setRunning(false);save();if(!$('s-home').hidden)renderHome();if(!$('s-progress').hidden)renderProgress();return}
      var j=jobs.shift();status('game',done+1,total,j.info.white,j.info.black);
      analyseGame(j.info,j.sans,ms).then(function(r){if(r.stopped){next();return}
        var g=S.games[j.info.id]||j.info;if(!S.games[j.info.id])g.src='app';if(S.pend)delete S.pend[j.info.id];g.op=1;g.tr=1;g.errors=r.errs;if(g.r==='L')g.full=1;S.games[j.info.id]=g;found+=r.found;done++;save();
        $('prog').style.width=(done/total*100)+'%';next()})})()});
}
$('bRecent').onclick=function(){
  if(running)return;var user=$('iUser').value.trim().toLowerCase();if(!user){status('noUser');return}
  S.user=$('iUser').value.trim();setRunning(true);stopFlag=false;$('prog').style.width='0';
  fetchGames(user,3).then(function(games){var jobs=[];
    games.forEach(function(g){var side=g.white.username.toLowerCase()===user?'w':'b',me=side==='w'?g.white:g.black;
      var info={id:g.url,white:g.white.username,black:g.black.username,date:g.end_time,opening:openingName(g.eco),side:side,r:resultCode(me.result),how:me.result};
      if(S.games[info.id]&&S.games[info.id].op)return;var sans=movesOf(g.pgn);if(sans)jobs.push({info:info,sans:sans})});
    jobs.sort(function(a,b){return (b.info.date||0)-(a.info.date||0)});runJobs(jobs)})
  .catch(function(){setRunning(false);status('fail')});
};
$('bStop').onclick=function(){stopFlag=true;status('stopping')};
$('bPgn').onclick=function(){
  if(running)return;var user=$('iUser').value.trim().toLowerCase();
  var chunks=$('iPgn').value.replace(/\r/g,'').split(/(?=\[Event\s)/).map(function(s){return s.trim()}).filter(function(s){return /\d+\.\s*\S/.test(s)});
  var jobs=[];chunks.forEach(function(p){var c=new Chess();if(!c.load_pgn(cleanPgn(p),{sloppy:true}))return;var h=c.header();
    var side=(h.White||'').toLowerCase()===user?'w':(h.Black||'').toLowerCase()===user?'b':null;if(!side)return;
    var id=h.Link||[h.White,h.Black,h.Date,h.UTCTime||'',c.history().slice(0,16).join('')].join('|');if(S.games[id]&&S.games[id].op)return;
    var won=h.Result==='1-0'?'w':h.Result==='0-1'?'b':null;
    jobs.push({info:{id:id,white:h.White,black:h.Black,date:0,opening:openingName(h.ECOUrl)!=='?'?openingName(h.ECOUrl):(h.Opening||'?'),side:side,r:won?(won===side?'W':'L'):'D'},sans:c.history()})});
  if(!jobs.length){status('noPgn');return}setRunning(true);stopFlag=false;runJobs(jobs);
};
$('bBackup').onclick=function(){var tx=JSON.stringify(S);$('iBackup').value=tx;
  try{navigator.clipboard.writeText(tx).then(function(){$('bkStatus').textContent=t('bkCopied')},function(){$('iBackup').select();$('bkStatus').textContent=t('bkSelect')})}catch(e){$('iBackup').select()}};
$('bRestore').onclick=function(){try{var o=JSON.parse($('iBackup').value);if(!o.cards||!o.games)throw 0;S=o;upgrade();save();$('bkStatus').textContent=t('bkRestored')}catch(e){$('bkStatus').textContent=t('bkBad')}};
$('bBase').onclick=function(){fetch('datos.json?v=13',{cache:'no-cache'}).then(function(r){return r.json()}).then(function(D){DATA.stats=D.stats||{};mergeBase(D);save();$('bkStatus').textContent=t('bkLoaded')}).catch(function(){$('bkStatus').textContent=t('bkNone')})};
var armed=false;
$('bReset').onclick=function(){if(!armed){armed=true;$('bReset').textContent=t('bkResetSure');setTimeout(function(){armed=false;$('bReset').textContent=t('bkReset')},4000);return}
  S=blank();save();armed=false;$('bReset').textContent=t('bkReset');$('bkStatus').textContent=t('bkWiped')};

/* ---------- cloud save: progress in a private GitHub gist (token stays on this device only) ---------- */
var CKEY='taller-aperturas.cloud',GDESC='taller-aperturas-progress',GFILE='progress.json';
var CL={token:'',gist:'',at:0};try{var cj=JSON.parse(localStorage.getItem(CKEY)||'{}');CL.token=cj.token||'';CL.gist=cj.gist||'';CL.at=cj.at||0}catch(e){}
var clTimer=null,clBusy=false,clPulled=0,clErr='';
function clSave(){try{localStorage.setItem(CKEY,JSON.stringify(CL))}catch(e){}}
/* OPEN progress (by request: "anyone who opens the page continues my progress"): a Firebase Realtime Database whose rules allow
   read/write only under /progress. Stored as ONE JSON string (Firebase keys can't contain '.', '/', '#'… and card ids/game urls do). */
var OPEN_URL=/^(localhost|127\.|\[::1\])/.test(location.hostname)?'':'https://chess-3ce3f-default-rtdb.firebaseio.com/progress/esmithco.json';  /* local testing never touches his real progress */
function cloudOn(){return !!OPEN_URL||!!(CL.token&&CL.gist)}
function openPayload(){var p=payload();p.log=(p.log||[]).slice(-1200);return p}
function fbGet(){return fetch(OPEN_URL,{cache:'no-store'}).then(function(r){if(!r.ok)throw r.status;return r.json()}).then(function(x){return typeof x==='string'?JSON.parse(x):null})}
function fbPut(keep){var body=JSON.stringify(JSON.stringify(openPayload()));
  return fetch(OPEN_URL,{method:'PUT',body:body,keepalive:!!keep&&body.length<60000,headers:{'Content-Type':'application/json'}}).then(function(r){if(!r.ok)throw r.status})}
/* every save = read, merge, write, so two devices never erase each other's work */
function openPush(keep){clearTimeout(clTimer);clBusy=true;clStatus();
  var p=keep?fbPut(true):fbGet().then(function(R){if(R)mergeProgress(R)}).then(function(){return fbPut(false)});
  return p.then(function(){CL.at=now();clErr='';clSave()}).catch(function(e){clErr=String(e)}).then(function(){clBusy=false;clStatus()})}
function openPull(){clBusy=true;clStatus();
  return fbGet().then(function(R){if(R)mergeProgress(R);clPulled=now();clErr=''}).catch(function(e){clErr=String(e)})
    .then(function(){clBusy=false;return openPush()}).then(function(){if(!$('s-home').hidden)renderHome()})}
function prog(o){var r={box:o.box||0,due:o.due||0,reps:o.reps||0,lapses:o.lapses||0,last:o.last||0};if(o.at)r.at=o.at;return r}
function payload(){
  var cards={},app={},games={};
  Object.keys(S.cards).forEach(function(k){var c=S.cards[k];if(c.src==='app')app[k]=c;else if(c.reps)cards[k]=prog(c)});
  Object.keys(S.games).forEach(function(k){if(S.games[k].src==='app')games[k]=S.games[k]});
  var m=function(o){var r={};Object.keys(o||{}).forEach(function(k){r[k]=prog(o[k])});return r};
  return {v:1,at:now(),user:S.user,cards:cards,appCards:app,games:games,rep:m(S.rep),ideas:m(S.ideas),puz:m(S.puz),tech:m(S.tech),quiz:m(S.quiz),plan:m(S.plan),opun:m(S.opun),dlog:(S.dlog||[]).slice(-400),pathReset:S.pathReset||{},drill:S.drill,
    seenLesson:S.seenLesson,log:S.log,daily:S.daily,streak:S.streak,days:S.days,lastSync:S.lastSync};
}
function newer(a,b){return (a.reps||0)>(b.reps||0)||((a.reps||0)===(b.reps||0)&&(a.due||0)>(b.due||0))}
function mergeProgress(R){
  if(!R||!R.v)return;
  Object.keys(R.appCards||{}).forEach(function(k){var c=R.appCards[k];if(!S.cards[k]&&(c.kind==='mine'?isMistake(c.s0,c.s1):isPunish(c.s0,c.s1)))S.cards[k]=c});
  Object.keys(R.games||{}).forEach(function(k){if(!S.games[k])S.games[k]=R.games[k]});
  Object.keys(R.cards||{}).forEach(function(k){var c=S.cards[k],r=R.cards[k];if(c&&newer(r,c)){c.box=r.box;c.due=r.due;c.reps=r.reps;c.lapses=r.lapses;c.last=r.last||0}});
  Object.keys(R.drill||{}).forEach(function(k){var a=S.drill[k],r=R.drill[k];
    if(k==='calc'&&a){var seen={},h=(a.h||[]).concat(r.h||[]).filter(function(x){var key=x.join('|');if(seen[key])return false;seen[key]=1;return true});if((r.at||0)>(a.at||0)){a.lvl=r.lvl;a.at=r.at}a.h=h.slice(-60);a.tot=Math.max(a.tot||0,r.tot||0);a.runs=Math.max(a.runs||0,r.runs||0);a.best=Math.max(a.best||0,r.best||0);return}
    if(!a||r.best>a.best||(r.best===a.best&&r.bestT&&r.bestT<a.bestT))S.drill[k]=r});
  ['rep','ideas','puz','tech','quiz','plan','opun'].forEach(function(f){S[f]=S[f]||{};Object.keys(R[f]||{}).forEach(function(k){var a=S[f][k],r=R[f][k];if(!a||newer(r,a))S[f][k]=r})});
  S.pathReset=S.pathReset||{};Object.keys(R.pathReset||{}).forEach(function(k){if((R.pathReset[k]||0)>(S.pathReset[k]||0))S.pathReset[k]=R.pathReset[k]});
  Object.keys(R.seenLesson||{}).forEach(function(k){S.seenLesson[k]=1});
  var seen={};S.log=(S.log||[]).concat(R.log||[]).filter(function(e){var k=e[0]+e[1];if(seen[k])return false;seen[k]=1;return true}).sort(function(a,b){return a[0]-b[0]}).slice(-4000);
  if(R.dlog){var dk={};S.dlog=(S.dlog||[]).concat(R.dlog).filter(function(e){var k=e[0]+e[2];if(dk[k])return false;dk[k]=1;return true}).sort(function(a,b){return a[0]-b[0]}).slice(-600)}
  S.days=S.days||{};Object.keys(R.days||{}).forEach(function(k){S.days[padKey(k)]=1});
  if(R.streak&&R.streak.last&&R.streak.n&&!R.days){var p=padKey(R.streak.last).split('-'),d=new Date(+p[0],+p[1]-1,+p[2]);for(var i=0;i<R.streak.n;i++){S.days[dkey(d)]=1;d.setDate(d.getDate()-1)}}
  syncStreak();
  if(R.daily){var rd=padKey(R.daily.date),sd=S.daily?padKey(S.daily.date):'';
    if(!S.daily||rd>sd||(rd===sd&&(R.daily.n||1)===(S.daily.n||1)&&(R.daily.idx||0)>(S.daily.idx||0))){S.daily=R.daily;S.daily.date=rd}}
  if((R.lastSync||0)>(S.lastSync||0))S.lastSync=R.lastSync;
  try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}
}
function gh(path,method,body,keep){
  return fetch('https://api.github.com'+path,{method:method||'GET',keepalive:!!keep,headers:{'Authorization':'token '+CL.token,'Accept':'application/vnd.github+json'},body:body?JSON.stringify(body):undefined})
    .then(function(r){if(!r.ok)throw r.status;return r.json()});
}
function clStatus(){
  if(OPEN_URL){var ox=clErr?t('clErr',clErr):clBusy?t('clBusy'):CL.at?t('clOpenOk',new Date(CL.at).toLocaleTimeString(LANG,{hour:'2-digit',minute:'2-digit'})):t('clBusy');
    ['clStatus','clHome'].forEach(function(id){var el=$(id);if(el)el.textContent=ox});
    $('clSetup').hidden=true;$('clOn').hidden=false;$('bClLink').hidden=true;$('bClOff').hidden=true;$('clHome').classList.remove('warn');return}
  var tx=!CL.token?t('clOff'):clErr?t('clErr',clErr):clBusy?t('clBusy'):CL.at?t('clOk',new Date(CL.at).toLocaleTimeString(LANG,{hour:'2-digit',minute:'2-digit'})):t('clBusy');
  ['clStatus','clHome'].forEach(function(id){var el=$(id);if(el)el.textContent=tx});
  $('clSetup').hidden=!!CL.token;$('clOn').hidden=!CL.token;$('clHome').classList.toggle('warn',!CL.token);
}
function cloudPush(keep){
  if(OPEN_URL)return openPush(keep);
  if(!cloudOn())return Promise.resolve();clearTimeout(clTimer);clBusy=true;clStatus();
  var files={};files[GFILE]={content:JSON.stringify(payload())};
  return gh('/gists/'+CL.gist,'PATCH',{files:files},keep).then(function(){CL.at=now();clErr='';clSave()}).catch(function(e){clErr=String(e)}).then(function(){clBusy=false;clStatus()});
}
function cloudPull(){
  if(OPEN_URL)return openPull();
  if(!cloudOn())return Promise.resolve();clBusy=true;clStatus();
  return gh('/gists/'+CL.gist).then(function(g){var f=g.files&&g.files[GFILE];if(!f)return null;
    return f.truncated?fetch(f.raw_url).then(function(r){return r.text()}):f.content}).then(function(tx){
    if(tx){mergeProgress(JSON.parse(tx));clPulled=now()}clErr='';
  }).catch(function(e){clErr=String(e)}).then(function(){clBusy=false;return cloudPush()}).then(function(){if(!$('s-home').hidden)renderHome()});
}
function cloudSoon(){if(!cloudOn())return;clearTimeout(clTimer);clTimer=setTimeout(function(){cloudPush()},4000)}
function cloudConnect(token){
  CL.token=token.trim();CL.gist='';clErr='';clBusy=true;clStatus();
  return gh('/gists?per_page=100').then(function(list){
    var g=list.filter(function(x){return x.description===GDESC&&x.files&&x.files[GFILE]})[0];
    if(g){CL.gist=g.id;clSave();return cloudPull()}
    var files={};files[GFILE]={content:JSON.stringify(payload())};
    return gh('/gists','POST',{description:GDESC,public:false,files:files}).then(function(n){CL.gist=n.id;CL.at=now();clSave()});
  }).then(function(){clBusy=false;clStatus()}).catch(function(e){clBusy=false;CL.token='';clSave();clErr='';clStatus();$('clStatus').textContent=t('clBad',e)});
}
$('bClConnect').onclick=function(){var v=$('iToken').value.trim();if(!v)return;var m=v.match(/#connect=([^&\s]+)/);if(m)v=decodeURIComponent(m[1]);$('iToken').value='';cloudConnect(v)};
/* connect another device in one step: a private link that carries the token in the #fragment (never sent to any server) */
$('bClLink').onclick=function(){if(!CL.token)return;var url=location.origin+location.pathname+'#connect='+encodeURIComponent(CL.token);
  var done=function(){$('clLinkNote').hidden=false};
  if(navigator.share){navigator.share({title:t('clLinkT'),url:url}).then(done).catch(function(){})}
  else if(navigator.clipboard){navigator.clipboard.writeText(url).then(done).catch(function(){prompt('',url);done()})}else{prompt('',url);done()}};
$('bClOff').onclick=function(){CL={token:'',gist:'',at:0};clSave();clStatus()};
$('bClNow').onclick=function(){cloudPull()};
$('clHome').onclick=function(){if(!CL.token)go('data')};
document.addEventListener('visibilitychange',function(){if(!cloudOn())return;
  if(document.hidden)cloudPush(true);else if(now()-clPulled>60000)cloudPull()});

/* ---------- start ---------- */
applyStatic();B.chess=new Chess();drawBoard();boot();
/* updates: check for a new version on start and whenever the app comes back; when the new one takes over, reload once (unless mid-exercise) */
if('serviceWorker' in navigator&&location.protocol==='https:'){
  var hadSW=!!navigator.serviceWorker.controller,reloaded=false;
  navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(function(reg){
    reg.update();document.addEventListener('visibilitychange',function(){if(!document.hidden)reg.update()})}).catch(function(){});
  navigator.serviceWorker.addEventListener('controllerchange',function(){if(!hadSW||reloaded)return;reloaded=true;
    if(location.hash==='#train')$('syncStatus').textContent=t('newVer');else location.reload()});
}
})();
