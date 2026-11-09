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
function blank(){return {v:3,user:'Esmithco',games:{},cards:{},gambits:{},rep:{},ideas:{},daily:null,streak:{n:0,last:''},base:0}}
var S=blank(),DATA={stats:{}};
function upgrade(){
  var b=blank();Object.keys(b).forEach(function(k){if(S[k]==null)S[k]=b[k]});
  Object.keys(S.cards).forEach(function(k){if(!S.cards[k].kind)S.cards[k].kind='mine'});S.v=3;
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function mergeBase(D){
  var nc={};
  Object.keys(D.cards||{}).forEach(function(k){var c=D.cards[k],o=S.cards[k];if(o){c.box=o.box||0;c.due=o.due||0;c.reps=o.reps||0;c.lapses=o.lapses||0}nc[k]=c});
  Object.keys(S.cards).forEach(function(k){var o=S.cards[k];if(!nc[k]&&o.src==='app')nc[k]=o});
  S.cards=nc;
  Object.keys(D.games||{}).forEach(function(k){var g=S.games[k];if(!g)S.games[k]=D.games[k];else{g.op=1;g.tr=1;g.errors=D.games[k].errors}});
  if(D.gambits)S.gambits=D.gambits;S.base=D.base||0;
}
function boot(){
  var raw=null;try{raw=localStorage.getItem(KEY)}catch(e){}
  if(raw){try{S=JSON.parse(raw)}catch(e){S=blank()}}
  upgrade();
  fetch('datos.json?v=3',{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(D){
    DATA.stats=D.stats||{};
    if(!S.base||S.base<(D.base||0)){mergeBase(D);save()}
  }).catch(function(){}).then(function(){route()});
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
var B={chess:null,flip:false,sel:null,targets:[],marks:{},onMove:null,onTap:null,locked:true,drag:null,arrows:[]};
var boardEl=$('board'),arrowEl=$('arrows');
function piece(p){return '<svg class="pc" viewBox="0 0 40 40"><use href="#'+p.color+p.type+'"/></svg>'}
function drawBoard(){
  var h='';
  for(var vr=0;vr<8;vr++)for(var vf=0;vf<8;vf++){
    var f=B.flip?7-vf:vf,r=B.flip?vr:7-vr,n='abcdefgh'[f]+(r+1);var pc=B.chess?B.chess.get(n):null;
    var cls='sq '+((f+r)%2?'l':'d')+(B.marks[n]?' '+B.marks[n]:'')+(B.sel===n?' sel':'')+(B.drag&&B.drag.from===n?' drag-from':'');
    var inner=pc?piece(pc):'';
    if(B.targets.indexOf(n)>=0)inner+=pc?'<span class="ring"></span>':'<span class="dot"></span>';
    if(vr===7)inner+='<span class="cf">'+'abcdefgh'[f]+'</span>';if(vf===0)inner+='<span class="cr">'+(r+1)+'</span>';
    h+='<div class="'+cls+'" data-sq="'+n+'">'+inner+'</div>';
  }
  boardEl.innerHTML=h;if(B.drag&&B.drag.ghost)boardEl.appendChild(B.drag.ghost);drawArrows();
}
function sqXY(n){var f='abcdefgh'.indexOf(n[0]),r=+n[1]-1;return B.flip?[7-f+.5,r+.5]:[f+.5,7-r+.5]}
function drawArrows(){
  arrowEl.innerHTML=B.arrows.map(function(a){var p=sqXY(a.from),q=sqXY(a.to),dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
    var ex=q[0]-ux*.3,ey=q[1]-uy*.3;
    return '<line x1="'+p[0]+'" y1="'+p[1]+'" x2="'+ex+'" y2="'+ey+'" stroke="'+a.c+'" stroke-width=".17" stroke-linecap="round" opacity=".85"/>'+
      '<polygon points="'+(q[0]+ux*.05)+','+(q[1]+uy*.05)+' '+(ex-uy*.28)+','+(ey+ux*.28)+' '+(ex+uy*.28)+','+(ey-ux*.28)+'" fill="'+a.c+'" opacity=".85"/>'}).join('');
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
function chip(san,drop,cpW){var c=classOf(drop);return '<span class="chip '+c[0]+'"><b class="mono">'+esc(san)+'</b> '+t(c[1])+(cpW!=null?' · '+evalTxt(cpW):'')+(drop>5?' · −'+Math.round(drop):'')+'</span>'}

/* ---------- explanations ---------- */
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

/* ---------- spaced repetition ---------- */
function gradeObj(o,ok){
  if(ok){o.box=Math.min(6,(o.box||0)+1);o.due=now()+DAYS[o.box]*864e5-36e5}
  else{o.lapses=(o.lapses||0)+1;o.box=1;o.due=now()+10*6e4}
  o.reps=(o.reps||0)+1;save();
}
function cardsOf(kind){return Object.keys(S.cards).map(function(k){return S.cards[k]}).filter(function(c){return c.kind===kind})}
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
function today(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()}
function yesterday(){var d=new Date(now()-864e5);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()}
function buildToday(){
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
  var it=[L(pickL[0]),C(mine[0]),C(pun[0]),nq?{t:'name',op:nq.op,i:nq.i}:C(mine[1]),L(pickL[1]),C(mine[2]),C(pun[1]),C(mine[3]),idea?{t:'idea',id:idea.id}:null].filter(Boolean);
  S.daily={date:today(),items:it,idx:0,ok:0,done:false};save();
}
function dailyNow(){if(!S.daily||S.daily.date!==today())buildToday();return S.daily}

/* ---------- routing / screens ---------- */
var SCREENS=['home','train','rep','mine','punish','ideas','data'],LISTS={mine:1,punish:1};
function route(){
  var h=(location.hash||'#home').slice(1).split('/');var s=h[0];if(SCREENS.indexOf(s)<0)s='home';
  if(s==='train'&&!X.items.length)s='home';
  if(s!=='train')stopTimers();
  SCREENS.forEach(function(x){if(!LISTS[x])$('s-'+x).hidden=x!==s});
  $('backLink').hidden=s==='home';$('homeLink').hidden=s!=='home';$('intro').hidden=s!=='home';
  if(s==='mine'||s==='punish'){quickSession(s);return}
  if(s==='home')renderHome();if(s==='rep')renderRep(h[1]);
  if(s==='ideas')renderIdeas();if(s==='data')renderData();if(s==='train')renderItem();
  window.scrollTo(0,0);
}
function go(s){if(location.hash==='#'+s)route();else location.hash=s}
window.addEventListener('hashchange',route);
$('backLink').onclick=function(e){e.preventDefault();if(EX.on){exitExplore();return}go(X.src==='today'||!X.src?'home':X.back||'home')};
function rerender(){route()}

function renderHome(){
  var d=dailyNow(),n=d.items.length;
  $('hToday').textContent=t('today');
  $('hTodaySub').textContent=d.done?t('todayDone'):t('todaySub',n,Math.max(5,Math.round(n*1.2)));
  $('hTodayBar').style.width=(d.idx/n*100)+'%';
  $('bToday').textContent=d.done?t('todayAgain'):d.idx>0?t('todayCont',d.idx,n):t('todayStart');
  $('hStreak').textContent=S.streak.n>0?'🔥 '+t('streak',S.streak.n):'';
  var cm=counts('mine'),cp=counts('punish');
  $('tMineN').textContent=fmtCount(cm);$('tPunN').textContent=fmtCount(cp);
  var ls=allLines(),okL=ls.filter(function(x){return x.st&&x.st.box>=3}).length;$('tRepN').textContent=t('learned',okL,ls.length);
  var ik=IDEAS.filter(function(x){return S.ideas[x.id]&&S.ideas[x.id].box>=2}).length;$('tIdeasN').textContent=t('learned',ik,IDEAS.length);
}
function fmtCount(c){return LANG==='es'?(c.due?c.due+' para repasar · ':'')+c.nw+' nuevas':(c.due?c.due+' to review · ':'')+c.nw+' new'}
$('bToday').onclick=function(){
  var d=dailyNow();if(d.done){buildToday();d=S.daily}
  startSession(d.items,'today',d.idx);
};
document.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){var g=b.getAttribute('data-go');if(LISTS[g])quickSession(g);else go(g)}});

/* ---------- session runner ---------- */
var X={items:[],i:0,src:'',ok:0,back:'home'};
var cur=null,timers=[];
function later(f,ms){var id=setTimeout(f,ms);timers.push(id);return id}
function stopTimers(){timers.forEach(clearTimeout);timers=[]}
function startSession(items,src,from){X.items=items.slice();X.i=from||0;X.src=src;X.ok=0;X.back=src==='today'?'home':src.split(':')[0];cur=null;go('train')}
function renderItem(){
  stopTimers();EX.on=false;$('exBar').hidden=true;$('demoBar').hidden=true;
  if(X.i>=X.items.length){endSession();return}
  var it=X.items[X.i];cur={it:it,answered:false,first:true};
  $('trCount').textContent=(X.i+1)+'/'+X.items.length;$('trProg').style.width=(X.i/X.items.length*100)+'%';
  ['fb','why','choices','note'].forEach(function(id){$(id).innerHTML='';$(id).className=id==='fb'?'feedback':id;$(id).hidden=id!=='fb'});
  $('line').textContent='';$('trEnd').hidden=true;$('trBody').hidden=false;
  if(it.t==='card'){var c=S.cards[it.id];if(!c){skip();return}cur.card=c;loadCard(c)}
  else if(it.t==='line'){if(!REP[it.op]||!REP[it.op].lines[it.i]){skip();return}loadLine(it.op,it.i)}
  else if(it.t==='name'){if(!REP[it.op]||!REP[it.op].lines[it.i]){skip();return}loadName(it.op,it.i)}
  else if(it.t==='idea'){var idea=IDEAS.filter(function(x){return x.id===it.id})[0];if(!idea){skip();return}loadIdea(idea)}
}
function skip(){X.i++;saveDaily();renderItem()}
function saveDaily(){if(X.src==='today'&&S.daily){S.daily.idx=X.i;if(X.i>=S.daily.items.length&&!S.daily.done){S.daily.done=true;
  if(S.streak.last!==today()){S.streak.n=S.streak.last===yesterday()?S.streak.n+1:1;S.streak.last=today()}}save()}}
function itemDone(ok){
  cur.answered=true;B.locked=true;B.onTap=null;if(ok&&cur.first)X.ok++;
  if(X.src==='today'&&ok&&cur.first&&S.daily)S.daily.ok=(S.daily.ok||0)+1;
  setBtns({next:true,explore:true});$('bNext').focus({preventScroll:true});
}
$('bNext').onclick=function(){X.i++;saveDaily();renderItem()};
function endSession(){
  $('trBody').hidden=true;$('trEnd').hidden=false;$('trProg').style.width='100%';
  $('trEndT').textContent=X.items.length?t('sessDone'):t('sessEmpty');
  $('trEndS').textContent=X.items.length?t('sessSum',X.ok,X.items.length):'';
  if(X.src==='today'){saveDaily();$('trEndS').textContent+=S.streak.n?'  🔥 '+t('streak',S.streak.n):''}
}
$('bEndHome').onclick=function(){go(X.back||'home')};
function setBtns(o){
  var map={hint:'bHint',show:'bShow',explore:'bExplore',bad:'bBad',good:'bGood',replay:'bReplay',next:'bNext'};
  Object.keys(map).forEach(function(k){$(map[k]).hidden=!o[k]});
}
function kindPill(k,extra){var m={mine:['kMine','mist'],punish:['kPun','good'],rep:['kRep','rep'],name:['kName','rep'],trap:['kTrap','blun'],idea:['kIdea','idea']}[k];
  return '<span class="pill '+m[1]+'">'+t(m[0])+'</span>'+(extra?' <span class="small">'+extra+'</span>':'')}
function sideTxt(side){return t('youPlay',side==='w'?t('white'):t('black'))}

/* card: own mistake or punish */
function loadCard(c){
  var fen=fenOf(c.line),prev=c.line.length?fenOf(c.line.slice(0,-1)):null;
  setBoard(fen,c.side==='b',c.line[c.line.length-1],prev);
  var ref=c.kind==='mine'?c.s0:c.s1;cur.fen=fen;cur.ref=ref;
  setBar(toW(ref,c.side));
  var head=kindPill(c.kind==='mine'?(c.trap?'trap':'mine'):'punish',sideTxt(c.side));
  var p=c.kind==='mine'?t('pMine',esc(c.played),evalTxt(c.s0),evalTxt(c.s1))
    :t('pPun',esc(c.oppMove),evalTxt(c.s0),evalTxt(c.s1));
  $('prompt').innerHTML='<div class="op">'+head+'</div>'+p;
  $('line').innerHTML=moveLine(c.line);
  B.locked=false;B.onMove=onCardMove;drawBoard();
  setBtns({hint:true,show:true,replay:c.line.length>0});Engine.init();
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
  if(!ok){later(function(){B.chess=new Chess(fen0);B.marks={};var a=arrowFor(fen0,best,'#0E9488');B.arrows=a?[a]:[];drawBoard();setBar(toW(cur.ref,col))},1100)}
  else{var a=arrowFor(fen0,best,'#0E9488');if(san!==best&&a){B.arrows=[a];drawBoard()}}
  /* why */
  var w=[],ply=c.line.length;
  if(c.kind==='mine'){
    w.push(t('swing',evalTxt(c.s0),evalTxt(c.s1),'−'+Math.round(wp(c.s0)-wp(c.s1))));
    if(c.pvBad)explainBad(fen0,c.played,c.pvBad,c.s1,col,ply).forEach(function(x){w.push(x)});
    if(!ok&&san!==c.played&&pvAfter&&sAfter!=null)explainBad(fen0,san,pvAfter,sAfter,col,ply).forEach(function(x){w.push('<i>'+esc(san)+':</i> '+x)});
    explainBest(fen0,best,c.pvBest,c.s0,col,c.threat,c.s0).forEach(function(x){w.push(x)});
  }else{
    if(!ok&&pvAfter&&sAfter!=null)explainBad(fen0,san,pvAfter,sAfter,col,ply).forEach(function(x){w.push('<i>'+esc(san)+':</i> '+x)});
    explainBest(fen0,best,c.pvBest,c.s1,col,null,c.s1).forEach(function(x){w.push(x)});
    if(c.oppBest&&c.oppBest!==c.oppMove)w.push(t('oppShould','<span class="mono">'+esc(c.oppBest)+'</span>'));
  }
  showWhy(w);
  cur.badLine=c.kind==='mine'&&c.pvBad?[c.played].concat(c.pvBad.slice(0,6)):(!ok&&pvAfter?[san].concat(pvAfter.slice(0,6)):null);
  cur.goodLine=c.pvBest?c.pvBest.slice(0,7):[best];
  itemDone(ok);
  setBtns({next:true,explore:true,bad:!!cur.badLine,good:true,replay:c.line.length>0});
  $('bBad').textContent=t('bBadLine',cur.badLine?cur.badLine[0]:'');
}
function showWhy(list){if(!list.length)return;$('why').hidden=false;$('why').innerHTML='<h3>'+t('why')+'</h3><ul>'+list.map(function(x){return '<li>'+x+'</li>'}).join('')+'</ul>'}
function animate(fen,moves,first,cb){
  stopTimers();var c=new Chess(fen),i=0;B.chess=c;B.marks={};B.arrows=[];B.sel=null;B.targets=[];B.locked=true;drawBoard();
  (function step(){if(i>=moves.length){if(cb)cb();return}
    var m=c.move(moves[i],{sloppy:true});B.marks={};if(m){var cls=first&&i===0?'bad':'last';B.marks[m.from]=cls;B.marks[m.to]=cls}drawBoard();i++;later(step,first&&i===1?1000:650)})();
}
$('bBad').onclick=function(){if(cur&&cur.badLine)animate(cur.fen,cur.badLine,true)};
$('bGood').onclick=function(){if(cur&&cur.goodLine)animate(cur.fen,cur.goodLine,false)};
$('bReplay').onclick=function(){if(cur&&cur.card){var l=cur.card.line;animate(new Chess().fen(),l,false,function(){B.locked=cur.answered;if(!cur.answered)B.chess=new Chess(cur.fen)})}};
$('bHint').onclick=function(){if(!cur||cur.answered)return;var a=null;
  if(cur.card)a=arrowFor(cur.fen,cur.card.best,'#E8730C');else if(cur.rep){repHint('#E8730C');cur.first=false;return}
  else if(cur.idea&&cur.idea.type==='move')a=arrowFor(cur.fen,cur.idea.answer[0],'#E8730C');
  if(a){B.marks[a.from]='hint';drawBoard();cur.first=false}};
$('bShow').onclick=function(){if(!cur||cur.answered)return;cur.first=false;
  if(cur.card){B.locked=true;cardResult(false,'—',null,null)}
  else if(cur.idea)ideaResult(false);
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
  var k=l.kind==='trap'?'trap':l.kind==='punish'?'punish':'rep';
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
    cur.fen=B.chess.fen();itemDone(ok);setBtns({next:true,explore:true})}});
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
  cur.fen=B.chess.fen();itemDone(R.err===0);setBtns({next:true,explore:true});
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
  itemDone(ok);setBtns({next:true,explore:idea.type!=='choice',good:false});
}

/* ---------- explore ---------- */
var EX={on:false,hist:[],evalW:null,saved:null};
$('bExplore').onclick=function(){enterExplore()};
function enterExplore(){
  stopTimers();EX.on=true;EX.saved={fen:B.chess.fen(),marks:B.marks,arrows:B.arrows};EX.hist=[];
  $('exBar').hidden=false;$('trBody').classList.add('exploring');$('exInfo').innerHTML=t('explore');
  B.locked=false;B.onTap=null;B.onMove=onExploreMove;B.arrows=[];drawBoard();setBar(null);exEval();
}
function exitExplore(){EX.on=false;$('exBar').hidden=true;$('trBody').classList.remove('exploring');
  B.chess=new Chess(EX.saved.fen);B.marks=EX.saved.marks;B.arrows=EX.saved.arrows;B.locked=true;drawBoard();if(cur&&cur.card)setBar(barCp);}
$('bExBack').onclick=exitExplore;
$('bExUndo').onclick=function(){if(!EX.hist.length)return;B.chess.undo();var h=EX.hist.pop();EX.evalW=h;B.marks={};B.arrows=[];drawBoard();exEval()};
function exEval(lastSan,mover,beforeW){
  var fen=B.chess.fen(),tok=EX.tok=(EX.tok||0)+1;$('exEval').innerHTML=t('thinking');
  analyse(fen,900).then(function(r){
    if(!r||tok!==EX.tok||!EX.on)return;var side=B.chess.turn(),w=toW(r.s,side);setBar(w);
    var h='';
    if(lastSan&&beforeW!=null){var d=mover==='w'?wp(beforeW)-wp(w):wp(-beforeW)-wp(-w);h+=chip(lastSan,Math.max(0,d),mover==='w'?w:-w)+' '}
    if(r.pv.length){var a=arrowFor(fen,r.pv[0],'#2563EB');B.arrows=a?[a]:[];drawBoard();h+=t('engineBest',pvText(fen,r.pv,5))}
    EX.evalW=w;$('exEval').innerHTML=h;
  });
}
function onExploreMove(mv){EX.hist.push(EX.evalW);exEval(mv.san,mv.color,EX.evalW)}

/* ---------- repertoire screen ---------- */
var repTab='london';
function renderRep(op){
  if(op&&REP[op])repTab=op;
  $('repTabs').innerHTML=Object.keys(REP).map(function(k){return '<button class="tab" role="tab" aria-selected="'+(k===repTab)+'" data-op="'+k+'">'+esc(tt(REP[k].name))+'</button>'}).join('');
  $('repTabs').querySelectorAll('button').forEach(function(b){b.onclick=function(){repTab=b.getAttribute('data-op');renderRep()}});
  var ls=repLines(repTab);
  $('repList').innerHTML=ls.map(function(x){var st=x.st,lab=!st?t('repNew'):st.box>=3?t('repOkS'):lineDue(x)?t('repDue'):'';
    var kind=x.l.kind==='trap'?'<span class="pill blun">'+t('kindTrap')+'</span> ':x.l.kind==='punish'?'<span class="pill good">'+t('kindPunish')+'</span> ':'';
    return '<button class="lrow" data-i="'+x.i+'"><span class="dotst '+(!st?'new':st.box>=3?'ok':lineDue(x)?'due':'')+'"></span><span class="lname">'+kind+esc(tt(x.l.name))+
      '<span class="mono small">'+esc(moveLine(x.l.moves,Math.min(6,x.l.moves.length)))+'</span></span><span class="small">'+lab+'</span></button>'}).join('');
  $('repList').querySelectorAll('.lrow').forEach(function(b){b.onclick=function(){startSession([{t:'line',op:repTab,i:+b.getAttribute('data-i')}],'rep')}});
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

/* ---------- ideas ---------- */
function renderIdeas(){
  $('ideaList').innerHTML=IDEAS.map(function(x,i){var s=S.ideas[x.id];return '<button class="lrow" data-i="'+i+'"><span class="dotst '+(!s?'new':s.box>=2?'ok':'due')+'"></span><span class="lname">'+esc(tt(x.t))+'<span class="small">'+esc(tt(x.body)[0])+'</span></span></button>'}).join('');
  $('ideaList').querySelectorAll('.lrow').forEach(function(b){b.onclick=function(){startSession([{t:'idea',id:IDEAS[+b.getAttribute('data-i')].id}],'ideas')}});
}

/* ---------- data screen: analysis, stats, backup ---------- */
function renderData(){
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
function status(k){var a=[].slice.call(arguments,1);$('impStatus').textContent=fmt(TXT[LANG].st[k]||k,a)}
function isRep(side,sans){return (side==='w'&&sans[0]==='d4')||(side==='b'&&((sans[0]==='e4'&&sans[1]==='c6')||sans[0]==='d4'))}
function fetchGames(user,months){
  return fetch('https://api.chess.com/pub/player/'+encodeURIComponent(user)+'/games/archives').then(function(r){if(!r.ok)throw new Error('user');return r.json()}).then(function(a){
    var urls=(a.archives||[]).slice(-months),out=[],i=0;
    return new Promise(function(res,rej){(function next(){if(i>=urls.length){res(out);return}status('fetch',i+1,urls.length);
      fetch(urls[i++]).then(function(r){return r.json()}).then(function(j){(j.games||[]).forEach(function(g){if(g.rules==='chess'&&g.pgn)out.push(g)});next()}).catch(rej)})()})})}
var running=false,stopFlag=false;
function setRunning(on){running=on;$('bRecent').disabled=on;$('bPgn').disabled=on;$('bStop').hidden=!on}
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
        if(Math.abs(s0)<=500&&drop>=10&&best&&best!==sans[p]){errs++;var k=posKey(fens[p])+'|'+sans[p];
          if(S.cards[k]){var e=S.cards[k];if((e.games||[]).indexOf(info.id)<0){e.games=(e.games||[]).concat(info.id);e.count=(e.count||1)+1}}
          else{S.cards[k]={id:k,kind:'mine',src:'app',side:info.side,opening:info.opening,line:sans.slice(0,p),played:sans[p],best:best,s0:s0,s1:s1,drop:Math.round(drop),
            sev:drop>=20?'blunder':'mistake',trap:s0>=-200&&s1<=-300,pvBest:R[p].pv,pvBad:R[p+1].pv,threat:null,games:[info.id],count:1,date:info.date,rep:rep,
            mat:outcome(fens[p+1],R[p+1].pv,info.side,6).delta,box:0,due:0};found++}}
      }else if(Math.abs(s0)<=400&&drop>=15&&p+1<=n&&R[p+1].pv.length){
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
      if(stopFlag||!jobs.length){status(stopFlag?'stopped':'done',done,total,found);setRunning(false);save();return}
      var j=jobs.shift();status('game',done+1,total,j.info.white,j.info.black);
      analyseGame(j.info,j.sans,ms).then(function(r){if(r.stopped){next();return}
        var g=S.games[j.info.id]||j.info;g.op=1;g.tr=1;g.errors=r.errs;S.games[j.info.id]=g;found+=r.found;done++;save();
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
$('bBase').onclick=function(){fetch('datos.json?v=3',{cache:'no-cache'}).then(function(r){return r.json()}).then(function(D){DATA.stats=D.stats||{};mergeBase(D);save();$('bkStatus').textContent=t('bkLoaded')}).catch(function(){$('bkStatus').textContent=t('bkNone')})};
var armed=false;
$('bReset').onclick=function(){if(!armed){armed=true;$('bReset').textContent=t('bkResetSure');setTimeout(function(){armed=false;$('bReset').textContent=t('bkReset')},4000);return}
  S=blank();save();armed=false;$('bReset').textContent=t('bkReset');$('bkStatus').textContent=t('bkWiped')};

/* ---------- start ---------- */
applyStatic();B.chess=new Chess();drawBoard();boot();
})();
