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
  Object.keys(S.cards).forEach(function(k){if(!S.cards[k].kind)S.cards[k].kind='mine'});S.v=3;
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
  Object.keys(D.cards||{}).forEach(function(k){var c=D.cards[k],o=S.cards[k];if(o){c.box=o.box||0;c.due=o.due||0;c.reps=o.reps||0;c.lapses=o.lapses||0}nc[k]=c});
  Object.keys(S.cards).forEach(function(k){var o=S.cards[k];if(!nc[k]&&o.src==='app')nc[k]=o});
  S.cards=nc;
  Object.keys(D.games||{}).forEach(function(k){var g=S.games[k],d=D.games[k];if(!g)S.games[k]=d;else{g.op=1;g.tr=1;g.errors=d.errors;if(d.rt){g.rt=d.rt;g.tc=d.tc}}});
  if(D.gambits)S.gambits=D.gambits;S.base=D.base||0;
}
function boot(){
  var raw=null;try{raw=localStorage.getItem(KEY)}catch(e){}
  if(raw){try{S=JSON.parse(raw)}catch(e){S=blank()}}
  upgrade();applyRule();
  fetch('datos.json?v=6',{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(D){
    DATA.stats=D.stats||{};
    if(!S.base||S.base<(D.base||0)){mergeBase(D);save()}
  }).catch(function(){}).then(function(){route();clStatus();cloudPull();
    setTimeout(function(){if(now()-(S.lastSync||0)>3*36e5)syncGames();else analyzePending()},2500)});
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
var APP_VER=36;
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
    var inner=pc?piece(pc):'';
    if(HINTS&&B.targets.indexOf(n)>=0)inner+=pc?'<span class="ring"></span>':'<span class="dot"></span>';
    if(vr===7)inner+='<span class="cf">'+'abcdefgh'[f]+'</span>';if(vf===0)inner+='<span class="cr">'+(r+1)+'</span>';
    h+='<div class="'+cls+'" data-sq="'+n+'">'+inner+'</div>';
  }
  boardEl.innerHTML=h;if(B.drag&&B.drag.ghost)boardEl.appendChild(B.drag.ghost);drawArrows();
  /* coordinates outside the board (they no longer cover the pieces) and a clear "you play white/black" badge */
  var fl=B.flip?'hgfedcba':'abcdefgh',rk=B.flip?'12345678':'87654321';
  $('files').innerHTML=fl.split('').map(function(x){return '<span>'+x+'</span>'}).join('');$('ranks').innerHTML=rk.split('').map(function(x){return '<span>'+x+'</span>'}).join('');
  var sb=$('sideBadge'),side=B.flip?'b':'w';sb.className='sidebadge '+side;
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
  B.chess=new Chess(fen);B.flip=flip;B.sel=null;B.targets=[];B.marks={};B.arrows=[];B.drag=null;B.onTap=null;
  if(lastSan&&prevFen){var m=new Chess(prevFen).move(lastSan,{sloppy:true});if(m){B.marks[m.from]='last';B.marks[m.to]='last'}}
  drawBoard();
}
/* eval bar: cp from White's point of view */
var barCp=null;
function setBar(cpW,on){
  var el=$('evalbar');el.hidden=on===false;if(on===false)return;
  var p=cpW==null?50:wp(cpW);el.classList.toggle('flip',B.flip);
  $('evfill').style.height=p+'%';$('evtxt').textContent=cpW==null?'…':evalTxt(B.flip?-cpW:cpW);
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
  if(!o||!CONCEPT[o.k])return '';var C=CONCEPT[o.k],x=esFix(o.txt.charAt(0).toUpperCase()+o.txt.slice(1));
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

/* ---------- spaced repetition ---------- */
function gradeObj(o,ok){
  if(ok){o.box=Math.min(6,(o.box||0)+1);o.due=now()+DAYS[o.box]*864e5-36e5}
  else{o.lapses=(o.lapses||0)+1;o.box=1;o.due=now()+10*6e4}
  o.reps=(o.reps||0)+1;save();
}
function cardsOf(kind){return Object.keys(S.cards).map(function(k){return S.cards[k]}).filter(function(c){return c.kind===kind&&visOf(c)!=='deep'})}
function prio(c){return (c.rep?1e6:0)+(c.kind==='punish'?(c.mat>=1?2e5:0)+(c.missed?1e5:0):(c.trap?2e5:0)+(c.sev==='blunder'?1e5:0))+(c.count||1)*5e4+(c.date||0)/1e5}
function dueList(kind,onlyRep){return cardsOf(kind).filter(function(c){return (c.due||0)<=now()&&(!onlyRep||c.rep)}).sort(function(a,b){
  var sa=(a.reps||0)>0,sb=(b.reps||0)>0;if(sa!==sb)return sa?-1:1;return prio(b)-prio(a)})}
function counts(kind){var cs=cardsOf(kind),due=0,nw=0;cs.forEach(function(c){if((c.reps||0)===0)nw++;else if((c.due||0)<=now())due++});return {due:due,nw:nw,all:cs.length}}

/* repertoire */
function lineId(op,i){return op+':'+i}
function repState(id){return S.rep[id]||(S.rep[id]={box:0,due:0})}
function repLines(op){return REP[op].lines.map(function(l,i){return {op:op,i:i,l:l,id:lineId(op,i),st:S.rep[lineId(op,i)]}})}
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
  var mine=dueList('mine',true);if(mine.length<4)mine=mine.concat(dueList('mine',false).filter(function(c){return mine.indexOf(c)<0}));
  var pun=dueList('punish',true).filter(function(c){return c.mat>=1});if(pun.length<2)pun=pun.concat(dueList('punish',false).filter(function(c){return pun.indexOf(c)<0}));
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
  var it=[{t:'drill',f:basics[(dd+n)%3],n:basics[(dd+n)%3]==='nota'?3:5},L(pickL[n>1?1:0]||pickL[0]),{t:'drill',f:'defend',n:2}].concat(g1,[C(mine[o]),speed,C(pun[n>1?1:0]||pun[0])],g2,[r1,
    {t:'drill',f:'game',n:3},C(mine[o+1]),extra||grab(pzA)[0]]).filter(Boolean);
  while(it.length>5&&estSec(it)>600)it.splice(it.length-1,1);
  S.daily={v:6,date:today(),items:it,idx:0,ok:0,done:false,n:n};save();
}
/* how long things take him: median of his last logged times per type, defaults otherwise */
var EST={drill:75,line:80,puz:60,card:90,plan:60,quiz:25,idea:60,name:25,theory:40,ftheory:40,stheory:40,play:150};
function estOne(it){
  var med=function(a){a=a.slice(-15).map(function(e){return Math.min(240,e[3])}).sort(function(x,y){return x-y});return a[Math.floor(a.length/2)]};
  var full=(S.log||[]).filter(function(e){return e[4]===1});
  if(it.t==='drill'){var key=it.f+':'+(it.n||0),d=full.filter(function(e){return e[5]===key});if(d.length>=2)return med(d);
    var per={game:25,defend:22,flash:15,rush:12,coord:5,sqname:5,nota:10}[it.f]||8;return 10+per*(it.n||8)}
  var a=full.filter(function(e){return e[1]===it.t});
  return a.length>=4?med(a):(EST[it.t]||60);
}
function estSec(items){return items.reduce(function(a,x){return a+estOne(x)},0)}
function dailyNow(){if(!S.daily||S.daily.date!==today()||((S.daily.v||0)<6&&!S.daily.idx&&!S.daily.done))buildToday();return S.daily}

/* ---------- routing / screens ---------- */
var SCREENS=['home','train','rep','learn','progress','data'],LISTS={mine:1,punish:1},TABS={home:'navToday',rep:'navRep',learn:'navLearn',progress:'navProg',data:'tData'};
function route(){
  var h=(location.hash||'#home').slice(1).split('/');var s=h[0];if(SCREENS.indexOf(s)<0)s='home';
  if(s==='train'&&!X.items.length)s='home';
  if(s!=='train')stopTimers();
  if(LISTS[s]){quickSession(s);return}
  SCREENS.forEach(function(x){$('s-'+x).hidden=x!==s});
  $('tabbar').hidden=s==='train';$('bClose').hidden=s!=='train'&&s!=='data';$('bSite').hidden=!$('bClose').hidden;
  $('topTitle').textContent=s==='train'?'':s==='home'?t('title'):t(TABS[s]);
  document.querySelectorAll('#tabbar button').forEach(function(b){if(b.getAttribute('data-tab')===s)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  if(s==='home')renderHome();if(s==='rep')renderRep(h[1]);if(s==='learn')renderLearn();if(s==='progress')renderProgress();
  if(s==='data')renderData();if(s==='train')renderItem();
  window.scrollTo(0,0);
}
function go(s){if(location.hash==='#'+s)route();else location.hash=s}
window.addEventListener('hashchange',route);
$('bClose').onclick=function(){if(location.hash==='#data'){go('progress');return}closeItemTime();stopTimers();go(X.back||'home')};
document.querySelectorAll('#tabbar button').forEach(function(b){b.onclick=function(){go(b.getAttribute('data-tab'))}});
function rerender(){route()}

function renderHome(){
  var d=dailyNow(),n=d.items.length;
  var sn=d.n||1;$('hToday').textContent=sn>1?t('todayExtra'):t('today');
  $('hTodaySub').textContent=d.done?t(sn>1?'todayDone2':'todayDone'):(sn>1?t('todayExtraSub')+' ':'')+t('todaySub',n,Math.max(3,Math.round(estSec(d.items.slice(d.idx||0))/60)));
  $('hTodayBar').style.width=(d.idx/n*100)+'%';
  $('bToday').textContent=d.done?t('todaySecond'):d.idx>0?t('todayCont',d.idx,n):t('todayStart');
  syncStreak();$('hStreak').textContent=S.streak.n>0?'🔥 '+t(S.streak.n===1?'streak1':'streak',S.streak.n):'';
  var cm=counts('mine'),cp=counts('punish');
  $('tMineN').innerHTML=fmtCount(cm);$('tPunN').innerHTML=fmtCount(cp);
  renderCoach();
  if(!running&&!$('syncStatus').textContent)$('syncStatus').textContent=S.lastSync?t('lastSync',new Date(S.lastSync).toLocaleDateString(LANG)):t('syncHint');
}
function hintsUI(){var c=$('optHints');if(!c)return;c.checked=HINTS;c.onchange=function(){HINTS=c.checked;try{localStorage.setItem('taller-aperturas.hints',HINTS?'1':'0')}catch(e){}}}
/* coach: last-game review, weekly rhythm, weakest area */
function lastGameCards(){
  var gs=Object.keys(S.games).map(function(k){return S.games[k]}).sort(function(a,b){return (b.date||0)-(a.date||0)}).slice(0,8),by={};
  Object.keys(S.cards).forEach(function(k){var c=S.cards[k];if(visOf(c)==='deep')return;(c.games||[]).forEach(function(g){(by[g]=by[g]||[]).push(c)})});
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
  if(cs.weak)h+='<button class="crow" id="bCoachWeak" type="button"><span class="ci">🎯</span><span class="ct"><b>'+t('coachWeakT',t(cs.weak.k))+'</b><small>'+t('coachWeakS',cs.weak.ok,cs.weak.n)+'</small></span><span class="go">›</span></button>';
  if(cs.fast)h+='<div class="ctip">⏱ '+t('coachFastS',cs.fast.bad,cs.fast.ok)+'</div>';
  el.innerHTML=h;
  if($('bCoachWeak'))$('bCoachWeak').onclick=function(){var g=cs.weak.go;if(LISTS[g])quickSession(g);else go(g)};
  if($('bCoachLast'))$('bCoachLast').onclick=function(){startSession(lg.cards.slice(0,10).map(function(c){return {t:'card',id:c.id}}),'mine');X.back='home'};
}
function fmtCount(c){var es=LANG==='es';
  return c.due?'<strong>'+c.due+'</strong>'+(es?'para repasar':'to review')+'<small>'+c.nw+(es?' nuevas':' new')+'</small>':'<strong>'+c.nw+'</strong>'+(es?'nuevas':'new')}
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
function startSession(items,src,from){X.snap=progSnap();X.items=items.slice();X.i=from||0;X.src=src;X.ok=0;X.back=src==='today'?'home':src==='ideas'?'learn':src.split(':')[0];cur=null;go('train')}
/* when he leaves an exercise, store the whole time spent on it (answer + reading), so the daily plan fits his real pace */
function closeItemTime(){if(cur&&cur.logI!=null&&S.log&&S.log[cur.logI]&&cur.t0){S.log[cur.logI][3]=Math.min(300,Math.round((now()-cur.t0)/1000));S.log[cur.logI][4]=1;cur.logI=null;save()}}
function renderItem(){
  closeItemTime();stopTimers();anOff();$('demoBar').hidden=true;boardEl.classList.remove('nopieces');
  if(X.i>=X.items.length){endSession();return}
  var it=X.items[X.i];cur={it:it,answered:false,first:true,t0:now()};$('bPrevEx').disabled=X.i===0;
  $('trCount').textContent=(X.i+1)+'/'+X.items.length;$('trProg').style.width=(X.i/X.items.length*100)+'%';
  ['fb','why','choices','note'].forEach(function(id){$(id).innerHTML='';$(id).className=id==='fb'?'feedback':id;$(id).hidden=id!=='fb'});
  $('line').textContent='';$('trEnd').hidden=true;$('trBody').hidden=false;$('boardwrap').hidden=false;$('choices').classList.remove('grid');boardEl.classList.remove('nocoords');B.onMove=null;
  if(it.t==='card'){var c=S.cards[it.id];if(!c){skip();return}cur.card=c;loadCard(c)}
  else if(it.t==='line'){if(!REP[it.op]||!REP[it.op].lines[it.i]){skip();return}loadLine(it.op,it.i)}
  else if(it.t==='name'){if(!REP[it.op]||!REP[it.op].lines[it.i]){skip();return}loadName(it.op,it.i)}
  else if(it.t==='theory'){var lt=lessonById(it.l);if(!lt){skip();return}loadTheory(lt)}
  else if(it.t==='puz'){var lp=lessonById(it.l),pp=lp&&lp.p.filter(function(x){return x.id===it.id})[0];if(!pp){skip();return}loadPuz(lp,pp)}
  else if(it.t==='ftheory'){var ff=fundById(it.f);if(!ff){skip();return}loadFTheory(ff)}
  else if(it.t==='quiz'){var qq=quizById(it.id);if(!qq){skip();return}loadQuiz(qq)}
  else if(it.t==='drill'){if(it.f==='flash')loadFlash();else if(it.f==='rush')loadRush();else if(it.f==='defend')loadDefend();else if(it.f==='game')loadGame();else loadDrill(it.f)}
  else if(it.t==='stheory'){var sx=stratById(it.s);if(!sx){skip();return}loadSTheory(sx)}
  else if(it.t==='plan'){loadPlan(it.s,it.k)}
  else if(it.t==='play'){var tx=techById(it.id);if(!tx){skip();return}loadPlay(tx)}
  else if(it.t==='idea'){var idea=IDEAS.filter(function(x){return x.id===it.id})[0];if(!idea){skip();return}loadIdea(idea)}
}
function skip(){X.i++;saveDaily();renderItem()}
function saveDaily(){if(X.src==='today'&&S.daily){S.daily.idx=X.i;if(X.i>=S.daily.items.length&&!S.daily.done){S.daily.done=true;
  S.days=S.days||{};S.days[S.daily.date||today()]=1;syncStreak()}save()}}
function itemDone(ok){
  cur.answered=true;B.locked=true;B.onTap=null;if(ok&&cur.first)X.ok++;
  if(cur.it.t!=='theory'){S.log=S.log||[];S.log.push([now(),cur.it.t,ok&&cur.first?1:0,Math.min(600,Math.round((now()-(cur.t0||now()))/1000)),0,cur.it.t==='drill'?cur.it.f+':'+(cur.it.n||0):'']);if(S.log.length>4000)S.log=S.log.slice(-4000);cur.logI=S.log.length-1;save()}
  if(X.src==='today'&&ok&&cur.first&&S.daily)S.daily.ok=(S.daily.ok||0)+1;
  setBtns({next:true});
  if(cur.anPath){var p=cur.anPath();if(p){var arr=B.arrows;anSet(p.start,p.moves,p.i==null?p.moves.length:p.i,p.base);if(p.keepArrows){B.arrows=arr;drawBoard()}B.onMove=anMove}}
  $('bNext').focus({preventScroll:true});
}
$('bPrevEx').onclick=function(){if(X.i>0){X.i--;saveDaily();renderItem()}};
$('bNext').onclick=function(){X.i++;saveDaily();renderItem()};
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
  Object.keys(map).forEach(function(k){$(map[k]).hidden=!o[k]});
}
function kindPill(k,extra){var m={mine:['kMine','mist'],punish:['kPun','good'],rep:['kRep','rep'],name:['kName','rep'],puz:['kPuz','idea'],trap:['kTrap','blun'],idea:['kIdea','idea']}[k];
  return '<span class="pill '+m[1]+'">'+t(m[0])+'</span>'+(extra?' <span class="small">'+extra+'</span>':'')}
function sideTxt(side){return t('youPlay',side==='w'?t('white'):t('black'))}

/* card: own mistake or punish */
function loadCard(c){
  var fen=fenOf(c.line),prev=c.line.length?fenOf(c.line.slice(0,-1)):null;
  setBoard(fen,c.side==='b',c.line[c.line.length-1],prev);
  var ref=c.kind==='mine'?c.s0:c.s1;cur.fen=fen;cur.ref=ref;
  setBar(toW(ref,c.side));
  var head=kindPill(c.kind==='mine'?(c.trap?'trap':'mine'):'punish',sideTxt(c.side));
  var p=c.kind==='mine'?t(visOf(c)==='win'?'pMineWin':'pMineLose',esc(c.played)):t('pPun2',esc(c.oppMove));
  $('prompt').innerHTML='<div class="op">'+head+'</div>'+p;
  cur.anPath=function(){return {start:INIT,moves:c.line.concat(cur.okMove?[cur.okMove]:[]),i:c.line.length+(cur.okMove?1:0),base:c.line.length,keepArrows:true}};
  anSet(INIT,c.line,c.line.length);B.onMove=onCardMove;
  setBtns({scan:true,hint:true,show:true});Engine.init();
}
function moveLine(line,n){var o='';n=n==null?line.length:n;for(var i=0;i<n;i++){if(i%2===0)o+=(i/2+1)+'. ';o+=esc(line[i])+' '}return o+(n%2===0?'':'…')}
function onCardMove(mv){
  var c=cur.card;if(cur.answered)return;B.locked=true;
  var col=c.side,fen0=cur.fen;
  if(mv.san===c.best){B.marks[mv.to]='ok';drawBoard();cardResult(true,mv.san,c.kind==='mine'?c.s0:c.s1,c.pvBest?c.pvBest.slice(1):null);return}
  if(c.kind==='mine'&&mv.san===c.played&&c.pvBad){B.marks[mv.to]='bad';drawBoard();cardResult(false,mv.san,c.s1,c.pvBad);return}
  $('fb').className='feedback';$('fb').textContent=t('checking',mv.san);
  analyse(B.chess.fen(),900).then(function(r){
    if(!r){B.marks[mv.to]='bad';drawBoard();cardResult(false,mv.san,null,null);return}
    var s=-r.s,drop=wp(cur.ref)-wp(s);
    B.marks[mv.to]=drop<5?'ok':'bad';drawBoard();cardResult(drop<5,mv.san,s,r.pv);
  });
}
function cardResult(ok,san,sAfter,pvAfter){
  var c=cur.card,col=c.side,fen0=cur.fen,best=c.best;
  gradeObj(c,ok);
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
  cur.goodLine=c.pvBest?c.pvBest.slice(0,7):[best];
  /* your own idea (not the game move, not the best): its line too, so you can see why it is (or isn't) as good */
  cur.yourLine=san!=='—'&&san!==best&&san!==(cur.badLine&&cur.badLine[0])&&pvAfter&&pvAfter.length?[san].concat(pvAfter.slice(0,6)):null;
  itemDone(ok);
  setBtns({next:true,bad:!!cur.badLine,good:true,yours:!!cur.yourLine});
  $('bBad').textContent=t('bBadLine',cur.badLine?cur.badLine[0]:'');if(cur.yourLine)$('bYours').textContent=t('bYourLine',san);
}
function showWhy(list){if(!list.length)return;$('why').hidden=false;$('why').innerHTML='<h3>'+t('why')+'</h3><ul>'+list.map(function(x){return '<li>'+x+'</li>'}).join('')+'</ul>'}
/* ---------- analysis board: step through any line yourself (◀ ▶), and after answering move freely with live engine ---------- */
var INIT=new Chess().fen();
var AN={on:false,start:INIT,moves:[],i:0,base:0,tok:0,ev:{}};
function anSet(start,moves,i,base){AN.known=moves.length;AN.on=true;AN.start=start;AN.moves=moves.slice();AN.i=Math.max(0,Math.min(i,AN.moves.length));AN.base=base==null?AN.i:base;$('anBar').hidden=false;$('line').hidden=true;anRender()}
function anOff(){AN.on=false;AN.tok++;$('anBar').hidden=true;$('anStory').innerHTML='';$('line').hidden=false;$('anEval').innerHTML=''}
function anChess(n){var c=new Chess(AN.start);for(var k=0;k<n&&k<AN.moves.length;k++){if(!c.move(AN.moves[k],{sloppy:true}))break}return c}
function anRender(keepArrows){
  var c=anChess(AN.i),arr=keepArrows?B.arrows:[];B.chess=c;B.sel=null;B.targets=[];B.marks={};B.arrows=arr;B.drag=null;
  var h=c.history({verbose:true}),last=h[h.length-1];if(last){B.marks[last.from]='last';B.marks[last.to]='last'}
  B.locked=cur&&!cur.answered?AN.i!==AN.base:false;$('anCont').hidden=!!(cur&&!cur.answered);
  drawBoard();anList();
  $('anFirst').disabled=$('anPrev').disabled=AN.i===0;$('anNext').disabled=$('anLast').disabled=AN.i>=AN.moves.length;
  $('anBase').hidden=AN.i===AN.base||AN.base>AN.moves.length;
  if(cur&&cur.answered)anEval();else $('anEval').innerHTML=AN.i!==AN.base?t('anBack'):'';
}
function anList(){
  var c=new Chess(AN.start),p=AN.start.split(' '),num=+p[5],o='';
  for(var k=0;k<AN.moves.length;k++){var w=c.turn()==='w';if(w)o+='<span class="mn">'+num+'.</span>';else if(k===0)o+='<span class="mn">'+num+'…</span>';
    var m=c.move(AN.moves[k],{sloppy:true});if(!m)break;
    o+='<button type="button" class="mv'+(k+1===AN.i?' cur':'')+(k>=AN.base&&AN.base>0?' new':'')+'" data-k="'+(k+1)+'">'+esc(m.san)+'</button>';if(!w)num++}
  $('anMoves').innerHTML=o||'<span class="small">'+t('anStart')+'</span>';
  var cu=$('anMoves').querySelector('.cur');if(cu&&cu.scrollIntoView)cu.scrollIntoView({block:'nearest',inline:'nearest'});
}
$('anMoves').onclick=function(e){var b=e.target.closest('[data-k]');if(!b)return;AN.i=+b.getAttribute('data-k');anRender()};
$('anFirst').onclick=function(){AN.i=0;anRender()};
$('anPrev').onclick=function(){if(AN.i>0){AN.i--;anRender()}};
$('anNext').onclick=function(){if(AN.i<AN.moves.length){AN.i++;anRender()}};
$('anLast').onclick=function(){AN.i=AN.moves.length;anRender()};
$('anBase').onclick=function(){AN.i=AN.base;anRender()};
/* a move on the board while analysing (after the exercise is answered) */
function anMove(mv){$('anStory').innerHTML='';AN.known=Math.min(AN.known||0,AN.i);AN.moves=AN.moves.slice(0,AN.i).concat([mv.san]);AN.i++;anRender()}
function anEval(){
  var c=anChess(AN.i),fen=c.fen(),tok=++AN.tok,side=c.turn();
  var prevFen=AN.i>0?anChess(AN.i-1).fen():null,lastSan=AN.i>0?AN.moves[AN.i-1]:null;
  $('anEval').innerHTML=t('thinking');
  var get=function(f){return AN.ev[f]?Promise.resolve(AN.ev[f]):analyse(f,700).then(function(r){if(r){var cc=new Chess(f);AN.ev[f]={w:toW(r.s,cc.turn()),pv:r.pv}}return AN.ev[f]})};
  get(fen).then(function(e){
    if(tok!==AN.tok||!e)return;setBar(e.w);
    var h='';
    if(e.pv&&e.pv.length){var a=arrowFor(fen,e.pv[0],'#2563EB');B.arrows=a?[a]:[];drawBoard();h+=t('engineBest',pvText(fen,e.pv,4))}
    if(!prevFen||AN.i<=AN.base||AN.i<=(AN.known||0)){$('anEval').innerHTML=h;return}
    get(prevFen).then(function(p){if(tok!==AN.tok||!p)return;var mover=side==='w'?'b':'w',d=mover==='w'?wp(p.w)-wp(e.w):wp(-p.w)-wp(-e.w);
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
  else if(cur.rep)repHint('#0E9488')};

/* repertoire line: follow the book, but any move the engine finds fine is accepted and the game goes on from there */
var REP_OK=7; /* max win-probability drop that still counts as "fine" */
function bookMap(op){var m={};REP[op].lines.forEach(function(l,i){var c=new Chess();for(var p=0;p<l.moves.length;p++){var k=posKey(c.fen());if(!m[k])m[k]={i:i,ply:p};c.move(l.moves[p],{sloppy:true})}});return m}
function loadLine(op,i,played){
  var o=REP[op],l=o.lines[i];
  if(!played&&!S.rep[lineId(op,i)]){loadDemo(op,i);return}
  $('demoBar').hidden=true;
  cur.rep={op:op,i:i,l:l,ply:0,err:0,side:o.side,book:true,hist:[],end:Math.max(l.moves.length,16),map:bookMap(op),reply:null,replyFen:null};
  setBoard(new Chess().fen(),o.side==='b');setBar(null,false);
  var k=l.kind==='trap'?'trap':l.kind==='punish'?'punish':'rep'
  $('prompt').innerHTML='<div class="op">'+kindPill(k,esc(tt(o.name))+' · '+esc(tt(l.name)))+'</div>'+(l.kind==='trap'?t('pRepTrap'):l.kind==='punish'?t('pRepPunish'):t('pRep'))+' <span class="small">'+t('pRepFree')+'</span>';
  setBtns({hint:true,show:true});B.onMove=onRepMove;repStep();
}
/* new line: watch it first, move by move with its notes, then play it */
function loadDemo(op,i){
  var o=REP[op],l=o.lines[i];cur.demo={op:op,i:i,l:l,ply:0,side:o.side};
  setBar(null,false);B.locked=true;
  $('prompt').innerHTML='<div class="op">'+kindPill('rep',esc(tt(o.name))+' · '+esc(tt(l.name)))+'</div><b>'+t('demoT')+'</b> <span class="small">'+t('demoHint')+'</span>';
  $('demoBar').hidden=false;setBtns({});demoShow();
}
function demoShow(){
  var D=cur.demo,l=D.l,mv=l.moves.slice(0,D.ply);
  setBoard(fenOf(mv),D.side==='b',mv[mv.length-1],mv.length?fenOf(mv.slice(0,-1)):null);B.locked=true;
  $('line').innerHTML=moveLine(mv);
  var n=D.ply>0?l.notes[String(D.ply-1)]:null,who=D.ply>0?(((D.ply-1)%2===0)===(D.side==='w')?'me':'opp'):'';
  $('fb').className='feedback';$('fb').innerHTML=D.ply>0?'<span class="mono">'+esc(l.moves[D.ply-1])+'</span>'+(n?' — <span class="'+who+'n">'+esc(tt(n))+'</span>':''):'';
  $('bDemoPrev').disabled=D.ply===0;$('bDemoNext').disabled=D.ply>=l.moves.length;
  $('bDemoPlay').classList.toggle('primary',D.ply>=l.moves.length);
}
$('bDemoPrev').onclick=function(){if(cur&&cur.demo&&cur.demo.ply>0){cur.demo.ply--;demoShow()}};
$('bDemoNext').onclick=function(){if(cur&&cur.demo&&cur.demo.ply<cur.demo.l.moves.length){cur.demo.ply++;demoShow()}};
$('bDemoPlay').onclick=function(){if(!cur||!cur.demo)return;var D=cur.demo;cur.demo=null;$('demoBar').hidden=true;$('fb').innerHTML='';$('note').innerHTML='';loadLine(D.op,D.i,true)};

/* which variation is this? final position of a line, pick its name among lines of the same opening */
function loadName(op,i){
  var o=REP[op],l=o.lines[i];cur.name={op:op,i:i};
  setBoard(fenOf(l.moves),o.side==='b',l.moves[l.moves.length-1],fenOf(l.moves.slice(0,-1)));setBar(null,false);B.locked=true;
  $('prompt').innerHTML='<div class="op">'+kindPill('name',esc(tt(o.name)))+'</div><b>'+t('nameQ')+'</b>';
  $('line').innerHTML=moveLine(l.moves);
  var others=o.lines.map(function(_,j){return j}).filter(function(j){return j!==i}).sort(function(){return Math.random()-.5}).slice(0,3);
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
  if((R.book&&R.ply>=R.l.moves.length)||(!R.book&&R.hist.length>=R.end)||B.chess.game_over()){repFinish();return}
  if(B.chess.turn()===R.side){B.locked=false;drawBoard();return}
  B.locked=true;
  later(function(){pickOpp().then(function(san){
    if(!cur||cur.rep!==R)return;if(!san){repFinish();return}
    var fen=B.chess.fen(),m=B.chess.move(san,{sloppy:true});if(!m){repFinish();return}
    B.marks={};B.marks[m.from]='last';B.marks[m.to]='last';B.arrows=[];drawBoard();
    var st=DATA.stats[posKey(fen)],fq='';if(st){var tot=0;Object.keys(st).forEach(function(k){tot+=st[k]});if(st[m.san]&&tot>=3&&st[m.san]/tot>=.05)fq=t('freq',Math.round(st[m.san]/tot*100))}
    var nt=repNote(R.ply);addNote('<b>'+t('oppPlays',esc(m.san))+'</b>'+fq+(nt?' '+esc(nt):''),'opp');
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
    B.marks[mv.to]='ok';drawBoard();var nt=repNote(R.ply);addNote(t('repOk','<b class="mono">'+esc(mv.san)+'</b>')+(nt?' '+esc(nt):''),'me');
    R.hist.push(mv.san);R.ply++;$('fb').innerHTML='';repStep();return}
  var fenAfter=B.chess.fen();B.chess.undo();var fen0=B.chess.fen();B.chess.move(mv.san,{sloppy:true});
  $('fb').className='feedback';$('fb').textContent=t('checking',mv.san);
  analyse(fen0,700).then(function(b){return analyse(fenAfter,700).then(function(a){
    if(!cur||cur.rep!==R)return;
    if(!a||!b){repMistake(mv,fen0,want,null,null,null);return}
    var sBefore=b.s,sAfter=-a.s,drop=Math.max(0,wp(sBefore)-wp(sAfter));
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
  var R=cur.rep;R.err++;cur.first=false;B.marks[mv.to]='bad';drawBoard();
  var why=a?chip(mv.san,drop,sAfter)+' '+explainBad(fen0,mv.san,a.pv,sAfter,R.side,R.hist.length).join(' '):'';
  var nt=R.book?repNote(R.ply):'';
  $('fb').className='feedback bad';
  $('fb').innerHTML=why+'<br>'+t('repMist','<span class="mono">'+esc(mv.san)+'</span>')+(good?' '+(R.book?t('repNo',esc(good)):t('engineBest','<span class="mono">'+esc(good)+'</span>')):'')+(nt?' '+esc(nt):'');
  later(function(){B.chess.undo();B.marks={};var ar=good?arrowFor(fen0,good,'#0E9488'):null;B.arrows=ar?[ar]:[];drawBoard();B.locked=false},1000);
}
function repHint(color){var R=cur.rep,f=B.chess.fen();
  if(R.book){var a=arrowFor(f,R.l.moves[R.ply],color);if(a){B.marks[a.from]='hint';B.arrows=color==='#0E9488'?[a]:[];drawBoard()}return}
  analyse(f,700).then(function(r){if(r&&r.pv[0]&&cur&&cur.rep===R){var a=arrowFor(f,r.pv[0],color);if(a){B.marks[a.from]='hint';B.arrows=color==='#0E9488'?[a]:[];drawBoard()}}})}
function repFinish(){
  var R=cur.rep,st=repState(lineId(R.op,R.i));gradeObj(st,R.err===0);
  $('line').innerHTML=moveLine(R.hist);
  $('fb').className='feedback good';$('fb').innerHTML=(R.err?t('repDone'):t('repDoneClean'))+' '+t('repErrs',R.err);
  cur.fen=B.chess.fen();cur.anPath=function(){return {start:INIT,moves:R.hist,base:R.hist.length}};itemDone(R.err===0);
}

function addNote(html,cls){var n=$('note');n.hidden=false;n.insertAdjacentHTML('beforeend','<p class="'+(cls||'')+'">'+html+'</p>');
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
function renderRep(op){
  if(op&&REP[op])repTab=op;
  $('repTabs').innerHTML=Object.keys(REP).map(function(k){return '<button class="tab" role="tab" aria-selected="'+(k===repTab)+'" data-op="'+k+'">'+esc(tt(REP[k].name))+'</button>'}).join('');
  $('repTabs').querySelectorAll('button').forEach(function(b){b.onclick=function(){repTab=b.getAttribute('data-op');renderRep()}});
  var ls=repLines(repTab);
  var row=function(x){var st=x.st,lab=!st?t('repNew'):st.box>=3?t('repOkS'):lineDue(x)?t('repDue'):'';
    var kind=x.l.kind==='trap'?'<span class="pill blun">'+t('kindTrap')+'</span> ':x.l.kind==='punish'?'<span class="pill good">'+t('kindPunish')+'</span> ':x.l.surprise?'<span class="pill mist">'+t('kindSurprise')+'</span> ':'';
    var sub=x.l.kind==='game'&&x.l.stat?t('repStat',x.l.stat.n,Math.round(x.l.stat.score*x.l.stat.n)):'';
    var e=lineEnd(x.l);
    return '<button class="lrow rrow" data-i="'+x.i+'"><span class="dotst '+(!st?'new':st.box>=3?'ok':lineDue(x)?'due':'')+'"></span><span class="thumb" data-thumb="'+x.i+'">'+miniBoard(e.fen,REP[x.op].side==='b',e.last)+'</span><span class="lname">'+kind+esc(tt(x.l.name))+
      (sub?'<span class="small">'+sub+'</span>':'')+'</span><span class="small">'+lab+'</span></button>'};
  var gm=ls.filter(function(x){return x.l.kind==='game'}),bk=ls.filter(function(x){return x.l.kind!=='game'});
  $('repList').innerHTML=(gm.length?'<h3 class="rgroup">'+t('repFromGames')+'</h3><p class="small">'+t('repFromGamesD')+'</p>'+gm.map(row).join(''):'')+'<h3 class="rgroup">'+t('repBook')+'</h3>'+bk.map(row).join('');
  $('repList').querySelectorAll('.lrow').forEach(function(b){b.onclick=function(ev){var i=+b.getAttribute('data-i');
    { /* tap a line: open a bigger preview right under it, with the moves and a button to practise it */
      var nx=b.nextElementSibling;if(nx&&nx.classList.contains('rprev')){nx.remove();return}
      $('repList').querySelectorAll('.rprev').forEach(function(x){x.remove()});
      var l=REP[repTab].lines[i],e=lineEnd(l),d=document.createElement('div');d.className='rprev';
      d.innerHTML=miniBoard(e.fen,REP[repTab].side==='b',e.last,'mini big')+'<p class="small mono">'+esc(l.moves.join(' '))+'</p><button class="btn primary" type="button">'+t('repPlayThis')+'</button>';
      d.querySelector('button').onclick=function(){startSession([{t:'line',op:repTab,i:i}],'rep')};b.after(d);d.scrollIntoView({block:'nearest',behavior:'smooth'})}}});
  $('bRepGo').textContent=t('repPractice',tt(REP[repTab].name));$('bRepQuiz').textContent=t('bNameQuiz');
}
$('bRepQuiz').onclick=function(){
  var ls=repLines(repTab),s=ls.filter(function(x){return !!x.st});if(s.length<2)s=ls;
  startSession(s.sort(function(){return Math.random()-.5}).slice(0,5).map(function(x){return {t:'name',op:x.op,i:x.i}}),'rep');
};
$('bRepGo').onclick=function(){
  var ls=repLines(repTab).sort(function(a,b){var ad=lineDue(a)?0:1,bd=lineDue(b)?0:1;return ad-bd||((a.st&&a.st.box||0)-(b.st&&b.st.box||0))});
  startSession(ls.slice(0,5).map(function(x){return {t:'line',op:x.op,i:x.i}}),'rep');
};

/* ---------- mistakes / punish: straight into 10 exercises, no lists ---------- */
function quickSession(kind){
  var due=dueList(kind,true);if(due.length<10)due=due.concat(dueList(kind,false).filter(function(c){return due.indexOf(c)<0}));
  if(kind==='punish')due.sort(function(a,b){return ((b.mat>=1)-(a.mat>=1))});
  startSession(due.slice(0,10).map(function(c){return {t:'card',id:c.id}}),kind);X.back='home';
}

/* ---------- fundamentals: coordinates, notation, concept quiz ---------- */
var FILES='abcdefgh';
function rndSq(){return FILES[Math.floor(Math.random()*8)]+(1+Math.floor(Math.random()*8))}
function fundById(id){return FUND.filter(function(f){return f.id===id})[0]}
function quizById(id){return QUIZ.concat(VOCAB).filter(function(q){return q.id===id})[0]}
function fundItems(id){
  var o=[];if(!S.seenLesson['f_'+id])o.push({t:'ftheory',f:id});
  if(id==='quiz'){var qs=QUIZ.filter(function(q){var s=S.quiz[q.id];return !s||(s.due||0)<=now()});if(qs.length<3)qs=QUIZ.slice();
    return o.concat(qs.slice(0,8).map(function(q){return {t:'quiz',id:q.id}}))}
  if(id==='flash'||id==='rush'||id==='defend'||id==='game')return o.concat([{t:'drill',f:id}]);
  return o.concat([{t:'drill',f:id},{t:'drill',f:id},{t:'drill',f:id}]);
}
function loadFTheory(f){
  S.seenLesson['f_'+f.id]=1;save();setBar(null,false);$('boardwrap').hidden=true;
  $('prompt').innerHTML='<div class="op">'+kindPill('idea',t('unitFund'))+'</div><h3 class="ideaT">'+esc(tt(f.t))+'</h3><ul class="ideaB">'+tt(f.body).map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul><p class="small">'+t('theoryGo')+'</p>';
  setBtns({next:true});cur.answered=true;
}
function loadQuiz(q){
  cur.quiz=q;setBar(null,false);$('boardwrap').hidden=true;
  $('prompt').innerHTML='<div class="op">'+kindPill('idea',q.id.indexOf('v_')===0?t('vocabT'):t('unitFund'))+'</div><h3 class="ideaT">'+esc(tt(q.q))+'</h3>';
  var ch=$('choices');ch.hidden=false;var order=tt(q.o).map(function(_,i){return i}).sort(function(){return Math.random()-.5});
  ch.innerHTML=order.map(function(i){return '<button class="btn opt" data-i="'+i+'">'+esc(tt(q.o)[i])+'</button>'}).join('');
  ch.querySelectorAll('button').forEach(function(b){b.onclick=function(){if(cur.answered)return;var i=+b.getAttribute('data-i'),ok=i===q.a;
    b.classList.add(ok?'okb':'badb');if(!ok)ch.querySelector('[data-i="'+q.a+'"]').classList.add('okb');
    var s=S.quiz[q.id]||(S.quiz[q.id]={box:0,due:0});gradeObj(s,ok);
    $('fb').className='feedback '+(ok?'good':'bad');$('fb').textContent=ok?'✓':'✗';showWhy([esc(tt(q.w))]);itemDone(ok);setBtns({next:true})}});
  setBtns({});
}
/* a drill = one timed round */
function loadDrill(id){
  var D=cur.drill={id:id,n:0,ok:0,total:(cur.it&&cur.it.n)||(id==='nota'?6:id==='sqname'?8:10),t0:now()};
  setBar(null,false);boardEl.classList.toggle('nocoords',id!=='nota');
  D.flip=Math.random()<.5;setBtns({});drillNext();
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
function drillEnd(){
  var D=cur.drill,sec=Math.round((now()-D.t0)/1000),s=S.drill[D.id]||(S.drill[D.id]={best:0,bestT:0,runs:0});s.runs++;
  var better=D.ok>s.best||(D.ok===s.best&&(!s.bestT||sec<s.bestT));if(better){s.best=D.ok;s.bestT=sec}addTot(D.id,D.ok);save();
  boardEl.classList.remove('nocoords');
  $('fb').className='feedback '+(D.ok>=D.total*.8?'good':'bad');$('fb').innerHTML=t('drillRes',D.ok,D.total,sec)+(better&&D.ok>0?' 🏆 '+t('newBest'):' · '+t('bestWas2',s.best,s.bestT));
  itemDone(D.ok>=D.total*.8);setBtns({next:true});
}

/* ---------- strategy: "find the plan" (quiet moves from his own games) + commentator vocabulary ---------- */
VOCAB.forEach(function(q){if(q.id.indexOf('v_')!==0)q.id='v_'+q.id});
var OPTC=['#2563EB','#E8730C','#7C3AED'];
/* progress that the daily also feeds: every solved position counts toward its drill / lesson in Aprender */
var GOAL={coord:100,sqname:100,nota:40,flash:40,rush:60,defend:40,game:50};
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
  $('prompt').innerHTML='<div class="op">'+kindPill('idea',t('unitStrat'))+'</div><h3 class="ideaT">'+esc(tt(x.t))+'</h3><ul class="ideaB">'+tt(x.body).map(function(y){return '<li>'+esc(y)+'</li>'}).join('')+'</ul><p class="small">'+t('theoryGo')+'</p>';
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
function puzPool(ids,maxR){var o=[];CURSO.lessons.forEach(function(l){if(ids.indexOf(l.id)>=0)l.p.forEach(function(p){if(p.r<=maxR)o.push({l:l,p:p})})});return o.sort(function(){return Math.random()-.5})}
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
    boardEl.classList.remove('nopieces');$('choices').hidden=true;$('fb').className='feedback '+(F.ok>=F.total*.75?'good':'bad');$('fb').innerHTML=t('drillRes',F.ok,F.total,sec)+(better&&F.ok?' 🏆 '+t('newBest'):'')+msg;itemDone(F.ok>=F.total*.75);setBtns({next:true});return}
  var it=F.pool[F.n%F.pool.length],a=afterFirst(it.p),c=a.c,me=c.turn(),sol=c.move(it.p.m[1],{sloppy:true});c.undo();
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
  var pool=puzPool(['hanging','mate1','fork','backrank','pin'],1350).concat(puzPool(['mate2'],1300)).sort(function(){return Math.random()-.5});
  if(cur.it&&cur.it.n)pool=pool.slice(0,cur.it.n+3);
  cur.rush={max:(cur.it&&cur.it.n)||99,pool:pool,n:0,ok:0,lives:3,sec:rushSec(),missed:[],times:[]};setBar(null,false);setBtns({});rushNext();
}
function rushSec(){var s=S.drill.rush;return Math.max(8,Math.min(30,(s&&s.sec)||20))}
function rushHead(){var R=cur.rush;return '<div class="op">'+kindPill('idea',t('rushT'))+' <span class="counter">'+'❤️'.repeat(R.lives)+'🤍'.repeat(3-R.lives)+' · ✓ '+R.ok+'</span></div>'}
function rushNext(){
  var R=cur.rush;if(R.lives<=0||R.n>=R.pool.length||R.ok>=R.max){rushEnd();return}
  var it=R.pool[R.n++],a=afterFirst(it.p),c=a.c,me=c.turn();R.cur={p:it.p,ply:1,me:me,done:false};
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
  $('fb').className='feedback bad';$('fb').innerHTML=(msg?msg+' ':'')+'✗ '+t('bestWas',esc(P.p.m[P.ply]));$('prompt').querySelector('.counter').textContent='❤️'.repeat(Math.max(0,R.lives))+'🤍'.repeat(3-Math.max(0,R.lives))+' · ✓ '+R.ok;
  later(rushNext,1800)}
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
  var ms=d.moves({verbose:true}),good=[];
  ms.forEach(function(m){d.move(m.san);var ok=d.in_checkmate();if(!ok&&!d.game_over()){var t2=oppThreats(d);ok=!t2.mates.length&&t2.max-(m.captured?VAL[m.captured]:0)<2}d.undo();if(ok)good.push(m.san)});
  if(!good.length||good.length>ms.length*.6)return null;
  return {d:d,kind:kind,th:kind==='mate'?th.mates:th.free,good:good};
}
function loadDefend(){
  var pool=puzPool(['mate1','hanging','backrank','fork'],1500),list=[],cnt={mate:0,hang:0};
  var N=(cur.it&&cur.it.n)||8,cap=Math.ceil(N*.6);for(var i=0;i<pool.length&&list.length<N;i++){var x=defMake(pool[i]);if(x&&cnt[x.kind]<cap){cnt[x.kind]++;list.push(x)}}
  cur.def={list:list,n:0,ok:0,total:list.length,t0:now()};setBar(null,false);setBtns({});defNext();
}
function defHead(){var D=cur.def;return '<div class="op">'+kindPill('idea',t('defT'))+' <span class="counter">'+Math.min(D.n+1,D.total)+'/'+D.total+' · ✓ '+D.ok+'</span></div>'}
function sanList(ms){return ms.slice(0,4).map(function(m){return '<b class="mono">'+esc(m.san||m)+'</b>'}).join(', ')}
function defNext(){
  var D=cur.def;if(D.n>=D.total){defEnd();return}
  var x=D.list[D.n],me=x.d.turn();anOff();cur.answered=false;$('choices').hidden=true;
  setBoard(x.d.fen(),me==='b');$('fb').innerHTML='';$('fb').className='feedback';
  $('prompt').innerHTML=defHead()+'<div class="bigq">'+t('defQ')+'</div><p class="small">'+sideTxt(me)+'</p>';
  B.locked=false;B.onMove=function(mv){
    var ok=x.good.indexOf(mv.san)>=0;B.locked=true;B.onMove=null;D.n++;if(ok)D.ok++;
    var th=t(x.kind==='mate'?'defIsMate':'defIsHang',sanList(x.th)),h;
    if(ok)h='✓ '+t('defGood')+' '+th;
    else{var t2=oppThreats(B.chess),bad=t2.mates[0]||t2.free[0];h='✗ '+th+' '+(bad?t(t2.mates.length?'defStillMate':'defStillHang','<b class="mono">'+esc(bad.san)+'</b>')+' ':'')+t('defGoodWere',sanList(x.good))}
    var opp=me==='w'?'b':'w';pauseReview(x.d.fen(),[mv.san],ok,h,x.th.slice(0,2).map(function(m){return {from:m.from,to:m.to,c:'#C0392B'}}),defNext,fold(t('stThreat'),story(flipTurn(x.d.fen(),opp),[x.th[0].san],me,1)));
  };
}
/* shared pause after an answer: pieces stay, analysis bar on, threat/answer arrows, "Next ▶" */
function pauseReview(fen,moves,ok,html,arrows,next,why){
  cur.answered=true;if(why){$('why').innerHTML='';showWhy([why])}else{$('why').hidden=true}anSet(fen,moves,Math.min(1,moves.length),0);B.onMove=anMove;
  if(arrows&&arrows.length){B.arrows=arrows;drawBoard()}
  $('fb').className='feedback '+(ok?'good':'bad');$('fb').innerHTML=html+' <span class="small">'+t('flashReview')+'</span>';
  var ch=$('choices');ch.hidden=false;ch.classList.remove('grid');ch.innerHTML='<button class="btn primary" id="bPauseNext">'+t('flashNextR')+'</button>';
  $('bPauseNext').onclick=function(){anOff();cur.answered=false;B.onMove=null;B.arrows=[];$('why').hidden=true;next()};
}
/* Game mode: no hints at all. A mix of positions — a threat against you, a tactic for you, or nothing special (a quiet move from his own games).
   He is told nothing; he has to find out what is going on, like in a real game. */
function loadGame(){
  var L=[],shuf=function(a){return a.sort(function(){return Math.random()-.5})};
  var N=(cur.it&&cur.it.n)||10,ND=Math.round(N*.3),NT=Math.round(N*.4),NQ=Math.max(1,N-ND-NT);
  var dp=puzPool(['mate1','hanging','backrank','fork'],1500),nd=0;for(var i=0;i<dp.length&&nd<ND;i++){var x=defMake(dp[i]);if(x){x.type='def';L.push(x);nd++}}
  puzPool(['hanging','fork','pin','skewer','discovered','backrank','mate1','mate2','trapped','defender','smothered'],1450).slice(0,NT).forEach(function(it){L.push({type:'tac',it:it})});
  var qs=[];Object.keys(PLANS).forEach(function(k){PLANS[k].forEach(function(p){qs.push({type:'quiet',p:p,tag:k})})});shuf(qs).slice(0,NQ).forEach(function(q){L.push(q)});
  cur.game={list:shuf(L),n:0,ok:0,total:L.length,t0:now()};setBar(null,false);setBtns({});gameNext();
}
function gameHead(){var G=cur.game;return '<div class="op">'+kindPill('idea',t('gameT'))+' <span class="counter">'+Math.min(G.n+1,G.total)+'/'+G.total+' · ✓ '+G.ok+'</span></div>'}
function gameNext(){
  var G=cur.game;if(G.n>=G.total){gameEnd();return}
  var x=G.list[G.n],fen,me,last=null,prev=null;anOff();cur.answered=false;$('choices').hidden=true;$('fb').innerHTML='';$('fb').className='feedback';
  if(x.type==='def')fen=x.d.fen();else if(x.type==='quiet')fen=x.p.fen;else{var a=afterFirst(x.it.p);fen=a.c.fen();last=a.m.san;prev=x.it.p.fen}
  me=new Chess(fen).turn();setBoard(fen,me==='b',last,prev);
  $('prompt').innerHTML=gameHead()+'<div class="bigq">'+t('gameQ')+'</div><p class="small">'+sideTxt(me)+'</p>';
  B.locked=false;B.onMove=function(mv){B.locked=true;B.onMove=null;G.n++;
    var done=function(ok,h,arr,moves,why){if(ok)G.ok++;pauseReview(fen,moves||[mv.san],ok,h,arr,gameNext,why)};
    if(x.type==='def'){var ok=x.good.indexOf(mv.san)>=0,th=t(x.kind==='mate'?'defIsMate':'defIsHang',sanList(x.th));
      done(ok,(ok?'✓ '+t('gameDefOk')+' ':'✗ '+t('gameWasDef')+' ')+th+(ok?'':' '+t('defGoodWere',sanList(x.good))),x.th.slice(0,2).map(function(m){return {from:m.from,to:m.to,c:'#C0392B'}}),null,fold(t('stThreat'),story(flipTurn(fen,me==='w'?'b':'w'),[x.th[0].san],me,1)));return}
    if(x.type==='tac'){var p=x.it.p,want=p.m[1],ok2=mv.san===want||(p.m.length===2&&B.chess.in_checkmate()),nm=esc(tt(x.it.l.t));
      var ar=arrowFor(fen,want,'#0E9488');
      markPuz(p,ok2);done(ok2,ok2?'✓ '+t('gameTacOk',nm):'✗ '+t('gameWasTac',nm,'<b class="mono">'+esc(want)+'</b>'),ok2?[]:(ar?[ar]:[]),ok2?p.m.slice(1):[mv.san],fold(t('stStep'),story(fen,p.m.slice(1),me,8)));return}
    /* quiet: ask the engine whether his move keeps the position */
    var q=x.p,st=stratById(x.tag),bestA=arrowFor(fen,q.best,'#0E9488');
    if(mv.san===q.best){done(true,'✓ '+t('gameQuietBest',esc(tt(st.t))),[],q.pv,fold(t('stPlan',esc(q.best)),story(fen,q.pv,me,4)));return}
    $('fb').className='feedback';$('fb').textContent=t('thinking');
    analyse(B.chess.fen(),1200).then(function(r){var mine=r?-r.s:q.s,ok3=wp(mine)>=wp(q.s)-7,ev=evalTxt(mine);
      done(ok3,ok3?'✓ '+t('gameQuietOk2',ev,'<b class="mono">'+esc(q.best)+'</b>',esc(tt(st.t))):'✗ '+t('gameQuietBad',ev,evalTxt(q.s),'<b class="mono">'+esc(q.best)+'</b>',esc(tt(st.t))),bestA?[bestA]:[],null,fold(t('stPlan',esc(q.best)),story(fen,q.pv,me,4)))});
  };
}
function gameEnd(){
  var G=cur.game,sec=Math.round((now()-G.t0)/1000),s=S.drill.game||(S.drill.game={best:0,bestT:0,runs:0});s.runs++;addTot('game',G.ok);var better=G.ok>s.best;if(better){s.best=G.ok;s.bestT=sec}save();
  anOff();B.locked=true;B.onMove=null;$('choices').hidden=true;G.done=true;
  $('fb').className='feedback '+(G.ok>=G.total*.7?'good':'bad');$('fb').innerHTML=t('drillRes',G.ok,G.total,sec)+(better&&G.ok?' 🏆 '+t('newBest'):'');itemDone(G.total>0&&G.ok>=G.total*.7);setBtns({next:true});
}
function defEnd(){
  var D=cur.def,sec=Math.round((now()-D.t0)/1000),s=S.drill.defend||(S.drill.defend={best:0,bestT:0,runs:0});s.runs++;addTot('defend',D.ok);var better=D.ok>s.best;if(better){s.best=D.ok;s.bestT=sec}save();
  anOff();B.locked=true;B.onMove=null;$('choices').hidden=true;D.done=true;
  $('fb').className='feedback '+(D.ok>=D.total*.75?'good':'bad');$('fb').innerHTML=t('drillRes',D.ok,D.total,sec)+(better&&D.ok?' 🏆 '+t('newBest'):'');itemDone(D.total>0&&D.ok>=D.total*.75);setBtns({next:true});
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
function lessonById(id){return CURSO.lessons.filter(function(l){return l.id===id})[0]}
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
function reviewPuz(n){var o=[];CURSO.lessons.forEach(function(l){l.p.forEach(function(p){var s=S.puz[p.id];if(s&&s.lapses&&(s.due||0)<=now())o.push({t:'puz',l:l.id,id:p.id})})});return o.slice(0,n)}
function renderLearn(){
  var h='<div class="unit"><h3>'+t('unitFund')+'</h3>'+FUND.map(function(f){var sub;
    if(f.id==='quiz'){var k=QUIZ.filter(function(q){return S.quiz[q.id]&&S.quiz[q.id].box>=2}).length;sub=t('learned',k,QUIZ.length)}
    var pct=null;if(f.id!=='quiz'){var d=S.drill[f.id],g=GOAL[f.id]||50,tot=(d&&d.tot)||0;pct=Math.min(1,tot/g);
      sub=t('drillProg',Math.min(tot,g),g)+(d&&d.best?' · '+(f.id==='rush'?t('rushBest',d.best):t('bestWas2',d.best,d.bestT)):'')}
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
function loadTheory(l){
  S.seenLesson[l.id]=1;save();setBar(null,false);
  var p=l.p[0];var c=new Chess(p.fen);c.move(p.m[0],{sloppy:true});var me=c.turn();animExample(p.fen,p.m,me==='b',me);
  $('prompt').innerHTML='<div class="op">'+kindPill('idea',esc(tt(lessonUnit(l))))+'</div><h3 class="ideaT">'+esc(tt(l.t))+'</h3><ul class="ideaB">'+tt(l.body).map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul><p class="small">'+t('theoryGo')+'</p>';
  setBtns({next:true});cur.answered=true;
}
function lessonUnit(l){return CURSO.units.filter(function(u){return u.id===l.unit})[0].t}
/* puzzle: FEN is before the opponent's move; m[0] is played automatically, then you alternate */
function loadPuz(l,p){
  var c=new Chess(p.fen),me=c.turn()==='w'?'b':'w';cur.puz={l:l,p:p,ply:0,me:me};
  setBoard(p.fen,me==='b');setBar(null,false);B.locked=true;
  $('prompt').innerHTML='<div class="op">'+kindPill('puz',esc(tt(l.t))+' · '+sideTxt(me))+'</div>'+t('puzQ')+' <span class="small">'+t('puzRating',p.r)+'</span>';
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
  $('fb').className='feedback '+(cur.first?'good':'bad');$('fb').innerHTML=cur.first?t('puzDone'):t('puzDoneLate');
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
      if(S.games[g.url])return;var sans=movesOf(g.pgn);
      S.games[g.url]={id:g.url,white:g.white.username,black:g.black.username,date:g.end_time,opening:openingName(g.eco),side:side,r:resultCode(me.result),how:me.result,rt:me.rating,tc:g.time_class,src:'app',op:0};
      if(sans)S.pend[g.url]=sans;added++});
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
  /* rating: last game of each month */
  var bym={};gs.forEach(function(g){var d=new Date(g.date*1000),k=d.getFullYear()*12+d.getMonth();bym[k]=g.rt});
  var ks=Object.keys(bym).map(Number).sort(function(a,b){return a-b}).slice(-18),pts=ks.map(function(k){return [k,bym[k]]});
  var xl=ks.filter(function(k,i){return i%3===0||i===ks.length-1}).map(function(k){return [k,MON[LANG][k%12]]});
  $('chRating').innerHTML=lineChart(pts,{xl:xl});
  var cur_=S.rating&&S.rating.rapid?S.rating.rapid:gs.length?gs[gs.length-1].rt:0,ago=gs.filter(function(g){return g.date<now()/1000-30*86400}).pop(),best=Math.max(gs.reduce(function(m,g){return Math.max(m,g.rt)},0),S.rating&&S.rating.best||0);
  $('capRating').textContent=gs.length?t('ratingCap',cur_,ago?(cur_-ago.rt>=0?'+':'')+(cur_-ago.rt):'—',best):'';
  /* mistakes per game */
  var em={};gs.forEach(function(g){if(!g.op)return;var d=new Date(g.date*1000),k=d.getFullYear()*12+d.getMonth();var o=em[k]||(em[k]={n:0,e:0});o.n++;o.e+=g.errors||0});
  var ek=Object.keys(em).map(Number).filter(function(k){return em[k].n>=5}).sort(function(a,b){return a-b}).slice(-8);
  $('chErr').innerHTML=barChart(ek.map(function(k){return [MON[LANG][k%12]+" '"+String(Math.floor(k/12)).slice(2),em[k].e/em[k].n]}),function(v){return v.toFixed(1)},'#E8730C');
  /* training per day (last 14 days he practised), local dates */
  var dy={},L=S.log||[];L.forEach(function(e){var k=dkey(new Date(e[0]));var o=dy[k]||(dy[k]={n:0,ok:0});o.n++;o.ok+=e[2]});
  var dks=Object.keys(dy).sort().slice(-14);
  $('chTrain').innerHTML=barChart(dks.map(function(k){var p=k.split('-');return [(+p[2])+'/'+(+p[1]),Math.round(dy[k].ok/dy[k].n*100)]}),function(v){return v+'%'},'#0E9488');
  /* kpis */
  var tot=L.length,okN=L.reduce(function(s,e){return s+e[2]},0);
  $('kpis').innerHTML='<div class="kpi"><b>'+(cur_||'—')+'</b><span>'+t('kRating')+'</span></div><div class="kpi"><b>'+streakN()+'</b><span>'+t('kStreak')+'</span></div><div class="kpi"><b>'+tot+'</b><span>'+t('kDone',tot?Math.round(okN/tot*100):0)+'</span></div>';
  /* course */
  var rows=CURSO.units.map(function(u){var ls=CURSO.lessons.filter(function(l){return l.unit===u.id}),ok=0,n=0;ls.forEach(function(l){var p=lessonProg(l);ok+=p.ok;n+=p.n});return [tt(u.t),ok,n]});
  var rl=allLines(),rok=rl.filter(function(x){return x.st&&x.st.box>=3}).length;rows.push([t('tRep'),rok,rl.length]);
  var ik=IDEAS.filter(function(x){return S.ideas[x.id]&&S.ideas[x.id].box>=2}).length;rows.push([t('unitIdeas'),ik,IDEAS.length]);
  var sp=0,sn=0;STRAT.forEach(function(x){var p=planProg(x.id);sp+=p.ok;sn+=p.n});rows.push([t('unitStrat'),sp,sn]);
  rows.unshift([t('unitFund'),QUIZ.filter(function(q){return S.quiz[q.id]&&S.quiz[q.id].box>=2}).length,QUIZ.length]);
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
  var n=Math.min(sans.length,30),c=new Chess(),fens=[c.fen()];for(var i=0;i<n;i++){c.move(sans[i],{sloppy:true});fens.push(c.fen())}
  var R=[],found=0,errs=0,us=info.side==='w'?0:1,p=0;
  function ev(k){if(R[k])return Promise.resolve();return analyse(fens[k],ms).then(function(r){R[k]=r||{s:0,pv:[]}})}
  return new Promise(function(resolve){(function next(){
    if(stopFlag||p>=n){resolve({found:found,errs:errs,stopped:stopFlag&&p<n});return}
    ev(p).then(function(){return ev(p+1)}).then(function(){
      var s0=R[p].s,s1=-R[p+1].s,drop=wp(s0)-wp(s1),best=R[p].pv[0],rep=isRep(info.side,sans);
      if(p%2===us){
        if(isMistake(s0,s1)&&best&&best!==sans[p]){var k=posKey(fens[p])+'|'+sans[p];
          if(S.cards[k]){var e=S.cards[k];if((e.games||[]).indexOf(info.id)<0){e.games=(e.games||[]).concat(info.id);e.count=(e.count||1)+1}}
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
        var g=S.games[j.info.id]||j.info;if(!S.games[j.info.id])g.src='app';if(S.pend)delete S.pend[j.info.id];g.op=1;g.tr=1;g.errors=r.errs;S.games[j.info.id]=g;found+=r.found;done++;save();
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
$('bBase').onclick=function(){fetch('datos.json?v=6',{cache:'no-cache'}).then(function(r){return r.json()}).then(function(D){DATA.stats=D.stats||{};mergeBase(D);save();$('bkStatus').textContent=t('bkLoaded')}).catch(function(){$('bkStatus').textContent=t('bkNone')})};
var armed=false;
$('bReset').onclick=function(){if(!armed){armed=true;$('bReset').textContent=t('bkResetSure');setTimeout(function(){armed=false;$('bReset').textContent=t('bkReset')},4000);return}
  S=blank();save();armed=false;$('bReset').textContent=t('bkReset');$('bkStatus').textContent=t('bkWiped')};

/* ---------- cloud save: progress in a private GitHub gist (token stays on this device only) ---------- */
var CKEY='taller-aperturas.cloud',GDESC='taller-aperturas-progress',GFILE='progress.json';
var CL={token:'',gist:'',at:0};try{var cj=JSON.parse(localStorage.getItem(CKEY)||'{}');CL.token=cj.token||'';CL.gist=cj.gist||'';CL.at=cj.at||0}catch(e){}
var clTimer=null,clBusy=false,clPulled=0,clErr='';
function clSave(){try{localStorage.setItem(CKEY,JSON.stringify(CL))}catch(e){}}
function cloudOn(){return !!(CL.token&&CL.gist)}
function prog(o){return {box:o.box||0,due:o.due||0,reps:o.reps||0,lapses:o.lapses||0}}
function payload(){
  var cards={},app={},games={};
  Object.keys(S.cards).forEach(function(k){var c=S.cards[k];if(c.src==='app')app[k]=c;else if(c.reps)cards[k]=prog(c)});
  Object.keys(S.games).forEach(function(k){if(S.games[k].src==='app')games[k]=S.games[k]});
  var m=function(o){var r={};Object.keys(o||{}).forEach(function(k){r[k]=prog(o[k])});return r};
  return {v:1,at:now(),user:S.user,cards:cards,appCards:app,games:games,rep:m(S.rep),ideas:m(S.ideas),puz:m(S.puz),tech:m(S.tech),quiz:m(S.quiz),plan:m(S.plan),drill:S.drill,
    seenLesson:S.seenLesson,log:S.log,daily:S.daily,streak:S.streak,days:S.days,lastSync:S.lastSync};
}
function newer(a,b){return (a.reps||0)>(b.reps||0)||((a.reps||0)===(b.reps||0)&&(a.due||0)>(b.due||0))}
function mergeProgress(R){
  if(!R||!R.v)return;
  Object.keys(R.appCards||{}).forEach(function(k){var c=R.appCards[k];if(!S.cards[k]&&(c.kind==='mine'?isMistake(c.s0,c.s1):isPunish(c.s0,c.s1)))S.cards[k]=c});
  Object.keys(R.games||{}).forEach(function(k){if(!S.games[k])S.games[k]=R.games[k]});
  Object.keys(R.cards||{}).forEach(function(k){var c=S.cards[k],r=R.cards[k];if(c&&newer(r,c)){c.box=r.box;c.due=r.due;c.reps=r.reps;c.lapses=r.lapses}});
  Object.keys(R.drill||{}).forEach(function(k){var a=S.drill[k],r=R.drill[k];if(!a||r.best>a.best||(r.best===a.best&&r.bestT&&r.bestT<a.bestT))S.drill[k]=r});
  ['rep','ideas','puz','tech','quiz','plan'].forEach(function(f){S[f]=S[f]||{};Object.keys(R[f]||{}).forEach(function(k){var a=S[f][k],r=R[f][k];if(!a||newer(r,a))S[f][k]=r})});
  Object.keys(R.seenLesson||{}).forEach(function(k){S.seenLesson[k]=1});
  var seen={};S.log=(S.log||[]).concat(R.log||[]).filter(function(e){var k=e[0]+e[1];if(seen[k])return false;seen[k]=1;return true}).sort(function(a,b){return a[0]-b[0]}).slice(-4000);
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
  var tx=!CL.token?t('clOff'):clErr?t('clErr',clErr):clBusy?t('clBusy'):CL.at?t('clOk',new Date(CL.at).toLocaleTimeString(LANG,{hour:'2-digit',minute:'2-digit'})):t('clBusy');
  ['clStatus','clHome'].forEach(function(id){var el=$(id);if(el)el.textContent=tx});
  $('clSetup').hidden=!!CL.token;$('clOn').hidden=!CL.token;$('clHome').classList.toggle('warn',!CL.token);
}
function cloudPush(keep){
  if(!cloudOn())return Promise.resolve();clearTimeout(clTimer);clBusy=true;clStatus();
  var files={};files[GFILE]={content:JSON.stringify(payload())};
  return gh('/gists/'+CL.gist,'PATCH',{files:files},keep).then(function(){CL.at=now();clErr='';clSave()}).catch(function(e){clErr=String(e)}).then(function(){clBusy=false;clStatus()});
}
function cloudPull(){
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
$('bClConnect').onclick=function(){var v=$('iToken').value;if(!v.trim())return;$('iToken').value='';cloudConnect(v)};
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
