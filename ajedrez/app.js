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
function blank(){return {v:3,user:'Esmithco',games:{},cards:{},gambits:{},rep:{},ideas:{},puz:{},tech:{},drill:{},quiz:{},plan:{},seenLesson:{},log:[],daily:null,streak:{n:0,last:''},base:0,lastSync:0}}
var S=blank(),DATA={stats:{}};
function upgrade(){
  var b=blank();Object.keys(b).forEach(function(k){if(S[k]==null)S[k]=b[k]});
  Object.keys(S.cards).forEach(function(k){if(!S.cards[k].kind)S.cards[k].kind='mine'});S.v=3;
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}if(typeof cloudSoon==='function')cloudSoon()}
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
  upgrade();
  fetch('datos.json?v=4',{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(D){
    DATA.stats=D.stats||{};
    if(!S.base||S.base<(D.base||0)){mergeBase(D);save()}
  }).catch(function(){}).then(function(){route();clStatus();cloudPull()});
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
  var cl=curLesson(),pz=lessonItems(cl,3),rv=reviewPuz(1);pz=pz.concat(rv);
  var P=function(i){return pz[i]||null};
  var dr=['coord','flash','nota','rush','sqname'][new Date().getDate()%5],qz=QUIZ.filter(function(q){var s=S.quiz[q.id];return !s||(s.due||0)<=now()})[0];
  var cs=curStrat(),pl=cs?stratItems(cs.id,1):[];var vq=VOCAB.filter(function(q){var s=S.quiz[q.id];return !s||(s.due||0)<=now()})[0];
  var it=[{t:'drill',f:dr},L(pickL[0]),P(0),C(mine[0]),P(1),C(pun[0]),nq?{t:'name',op:nq.op,i:nq.i}:C(mine[1]),P(2),pl[0]||C(mine[2]),pl[1]||null,P(3),vq?{t:'quiz',id:vq.id}:null,qz?{t:'quiz',id:qz.id}:null,idea?{t:'idea',id:idea.id}:null].filter(Boolean);
  S.daily={v:4,date:today(),items:it,idx:0,ok:0,done:false};save();
}
function dailyNow(){if(!S.daily||S.daily.date!==today()||((S.daily.v||0)<4&&!S.daily.idx))buildToday();return S.daily}

/* ---------- routing / screens ---------- */
var SCREENS=['home','train','rep','learn','progress','data'],LISTS={mine:1,punish:1},TABS={home:'navToday',rep:'navRep',learn:'navLearn',progress:'navProg',data:'tData'};
function route(){
  var h=(location.hash||'#home').slice(1).split('/');var s=h[0];if(SCREENS.indexOf(s)<0)s='home';
  if(s==='train'&&!X.items.length)s='home';
  if(s!=='train')stopTimers();
  if(LISTS[s]){quickSession(s);return}
  SCREENS.forEach(function(x){$('s-'+x).hidden=x!==s});
  $('tabbar').hidden=s==='train';$('bClose').hidden=s!=='train'&&s!=='data';
  $('topTitle').textContent=s==='train'?'':s==='home'?t('title'):t(TABS[s]);
  document.querySelectorAll('#tabbar button').forEach(function(b){if(b.getAttribute('data-tab')===s)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  if(s==='home')renderHome();if(s==='rep')renderRep(h[1]);if(s==='learn')renderLearn();if(s==='progress')renderProgress();
  if(s==='data')renderData();if(s==='train')renderItem();
  window.scrollTo(0,0);
}
function go(s){if(location.hash==='#'+s)route();else location.hash=s}
window.addEventListener('hashchange',route);
$('bClose').onclick=function(){if(location.hash==='#data'){go('progress');return}stopTimers();go(X.back||'home')};
document.querySelectorAll('#tabbar button').forEach(function(b){b.onclick=function(){go(b.getAttribute('data-tab'))}});
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
  if(!running&&!$('syncStatus').textContent)$('syncStatus').textContent=S.lastSync?t('lastSync',new Date(S.lastSync).toLocaleDateString(LANG)):t('syncHint');
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
function startSession(items,src,from){X.items=items.slice();X.i=from||0;X.src=src;X.ok=0;X.back=src==='today'?'home':src==='ideas'?'learn':src.split(':')[0];cur=null;go('train')}
function renderItem(){
  stopTimers();anOff();$('demoBar').hidden=true;boardEl.classList.remove('nopieces');
  if(X.i>=X.items.length){endSession();return}
  var it=X.items[X.i];cur={it:it,answered:false,first:true};$('bPrevEx').disabled=X.i===0;
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
  else if(it.t==='drill'){if(it.f==='flash')loadFlash();else if(it.f==='rush')loadRush();else loadDrill(it.f)}
  else if(it.t==='stheory'){var sx=stratById(it.s);if(!sx){skip();return}loadSTheory(sx)}
  else if(it.t==='plan'){loadPlan(it.s,it.k)}
  else if(it.t==='play'){var tx=techById(it.id);if(!tx){skip();return}loadPlay(tx)}
  else if(it.t==='idea'){var idea=IDEAS.filter(function(x){return x.id===it.id})[0];if(!idea){skip();return}loadIdea(idea)}
}
function skip(){X.i++;saveDaily();renderItem()}
function saveDaily(){if(X.src==='today'&&S.daily){S.daily.idx=X.i;if(X.i>=S.daily.items.length&&!S.daily.done){S.daily.done=true;
  if(S.streak.last!==today()){S.streak.n=S.streak.last===yesterday()?S.streak.n+1:1;S.streak.last=today()}}save()}}
function itemDone(ok){
  cur.answered=true;B.locked=true;B.onTap=null;if(ok&&cur.first)X.ok++;
  if(cur.it.t!=='theory'){S.log=S.log||[];S.log.push([now(),cur.it.t,ok&&cur.first?1:0]);if(S.log.length>4000)S.log=S.log.slice(-4000);save()}
  if(X.src==='today'&&ok&&cur.first&&S.daily)S.daily.ok=(S.daily.ok||0)+1;
  setBtns({next:true});
  if(cur.anPath){var p=cur.anPath();if(p){var arr=B.arrows;anSet(p.start,p.moves,p.i==null?p.moves.length:p.i,p.base);if(p.keepArrows){B.arrows=arr;drawBoard()}B.onMove=anMove}}
  $('bNext').focus({preventScroll:true});
}
$('bPrevEx').onclick=function(){if(X.i>0){X.i--;saveDaily();renderItem()}};
$('bNext').onclick=function(){X.i++;saveDaily();renderItem()};
function endSession(){
  $('trBody').hidden=true;$('trEnd').hidden=false;$('trProg').style.width='100%';
  $('trEndT').textContent=X.items.length?t('sessDone'):t('sessEmpty');
  $('trEndS').textContent=X.items.length?t('sessSum',X.ok,X.items.length):'';
  if(X.src==='today'){saveDaily();$('trEndS').textContent+=S.streak.n?'  🔥 '+t('streak',S.streak.n):''}
}
$('bEndHome').onclick=function(){go(X.back||'home')};
function setBtns(o){
  var map={hint:'bHint',show:'bShow',bad:'bBad',good:'bGood',next:'bNext',retry:'bRetry',scan:'bScan'};
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
  var p=c.kind==='mine'?t('pMine',esc(c.played),evalTxt(c.s0),evalTxt(c.s1))
    :t('pPun',esc(c.oppMove),evalTxt(c.s0),evalTxt(c.s1));
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
  setBtns({next:true,bad:!!cur.badLine,good:true});
  $('bBad').textContent=t('bBadLine',cur.badLine?cur.badLine[0]:'');
}
function showWhy(list){if(!list.length)return;$('why').hidden=false;$('why').innerHTML='<h3>'+t('why')+'</h3><ul>'+list.map(function(x){return '<li>'+x+'</li>'}).join('')+'</ul>'}
/* ---------- analysis board: step through any line yourself (◀ ▶), and after answering move freely with live engine ---------- */
var INIT=new Chess().fen();
var AN={on:false,start:INIT,moves:[],i:0,base:0,tok:0,ev:{}};
function anSet(start,moves,i,base){AN.on=true;AN.start=start;AN.moves=moves.slice();AN.i=Math.max(0,Math.min(i,AN.moves.length));AN.base=base==null?AN.i:base;$('anBar').hidden=false;$('line').hidden=true;anRender()}
function anOff(){AN.on=false;AN.tok++;$('anBar').hidden=true;$('line').hidden=false;$('anEval').innerHTML=''}
function anChess(n){var c=new Chess(AN.start);for(var k=0;k<n&&k<AN.moves.length;k++){if(!c.move(AN.moves[k],{sloppy:true}))break}return c}
function anRender(keepArrows){
  var c=anChess(AN.i),arr=keepArrows?B.arrows:[];B.chess=c;B.sel=null;B.targets=[];B.marks={};B.arrows=arr;B.drag=null;
  var h=c.history({verbose:true}),last=h[h.length-1];if(last){B.marks[last.from]='last';B.marks[last.to]='last'}
  B.locked=cur&&!cur.answered?AN.i!==AN.base:false;
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
function anMove(mv){AN.moves=AN.moves.slice(0,AN.i).concat([mv.san]);AN.i++;anRender()}
function anEval(){
  var c=anChess(AN.i),fen=c.fen(),tok=++AN.tok,side=c.turn();
  var prevFen=AN.i>0?anChess(AN.i-1).fen():null,lastSan=AN.i>0?AN.moves[AN.i-1]:null;
  $('anEval').innerHTML=t('thinking');
  var get=function(f){return AN.ev[f]?Promise.resolve(AN.ev[f]):analyse(f,700).then(function(r){if(r){var cc=new Chess(f);AN.ev[f]={w:toW(r.s,cc.turn()),pv:r.pv}}return AN.ev[f]})};
  get(fen).then(function(e){
    if(tok!==AN.tok||!e)return;setBar(e.w);
    var h='';
    if(e.pv&&e.pv.length){var a=arrowFor(fen,e.pv[0],'#2563EB');B.arrows=a?[a]:[];drawBoard();h+=t('engineBest',pvText(fen,e.pv,4))}
    if(!prevFen||AN.i<=AN.base){$('anEval').innerHTML=h;return}
    get(prevFen).then(function(p){if(tok!==AN.tok||!p)return;var mover=side==='w'?'b':'w',d=mover==='w'?wp(p.w)-wp(e.w):wp(-p.w)-wp(-e.w);
      $('anEval').innerHTML=chip(lastSan,Math.max(0,d),mover==='w'?e.w:-e.w)+' '+h});
  });
}
/* show a line from the exercise position, then let the user step with ▶ */
function anLine(moves){var p=cur.anPath?cur.anPath():null;if(!p)return;anSet(p.start,p.moves.slice(0,p.base).concat(moves),p.base,p.base);$('anEval').innerHTML=cur.answered?$('anEval').innerHTML:'';flashTip()}
function flashTip(){var el=$('anTip');el.hidden=false;clearTimeout(el._t);el._t=setTimeout(function(){el.hidden=true},3500)}

$('bBad').onclick=function(){if(cur&&cur.badLine)anLine(cur.badLine)};
$('bGood').onclick=function(){if(cur&&cur.goodLine)anLine(cur.goodLine)};
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

/* ---------- fundamentals: coordinates, notation, concept quiz ---------- */
var FILES='abcdefgh';
function rndSq(){return FILES[Math.floor(Math.random()*8)]+(1+Math.floor(Math.random()*8))}
function fundById(id){return FUND.filter(function(f){return f.id===id})[0]}
function quizById(id){return QUIZ.concat(VOCAB).filter(function(q){return q.id===id})[0]}
function fundItems(id){
  var o=[];if(!S.seenLesson['f_'+id])o.push({t:'ftheory',f:id});
  if(id==='quiz'){var qs=QUIZ.filter(function(q){var s=S.quiz[q.id];return !s||(s.due||0)<=now()});if(qs.length<3)qs=QUIZ.slice();
    return o.concat(qs.slice(0,8).map(function(q){return {t:'quiz',id:q.id}}))}
  if(id==='flash'||id==='rush')return o.concat([{t:'drill',f:id}]);
  return o.concat([{t:'drill',f:id},{t:'drill',f:id},{t:'drill',f:id}]);
}
function loadFTheory(f){
  S.seenLesson['f_'+f.id]=1;save();setBar(null,false);setBoard(new Chess().fen(),false);B.locked=true;
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
  var D=cur.drill={id:id,n:0,ok:0,total:id==='nota'?6:id==='sqname'?8:10,t0:now()};
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
  var better=D.ok>s.best||(D.ok===s.best&&(!s.bestT||sec<s.bestT));if(better){s.best=D.ok;s.bestT=sec}save();
  boardEl.classList.remove('nocoords');
  $('fb').className='feedback '+(D.ok>=D.total*.8?'good':'bad');$('fb').innerHTML=t('drillRes',D.ok,D.total,sec)+(better&&D.ok>0?' 🏆 '+t('newBest'):' · '+t('bestWas2',s.best,s.bestT));
  itemDone(D.ok>=D.total*.8);setBtns({next:true});
}

/* ---------- strategy: "find the plan" (quiet moves from his own games) + commentator vocabulary ---------- */
VOCAB.forEach(function(q){if(q.id.indexOf('v_')!==0)q.id='v_'+q.id});
var OPTC=['#2563EB','#E8730C','#7C3AED'];
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
  S.seenLesson['s_'+x.id]=1;save();setBar(null,false);var ex=plansOf(x.id)[0];setBoard(ex?ex.fen:INIT,ex?new Chess(ex.fen).turn()==='b':false);B.locked=true;
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
  var pool=puzPool(['hanging','mate1'],1400);var F=cur.flash={pool:pool,n:0,ok:0,total:8,t0:now()};setBar(null,false);setBtns({});flashNext();
}
/* levels: 1-3 = read the question first, "I'm ready", look 5 / 3 / 2 s; 4-5 = game mode (no question beforehand), 3 / 2 s */
var FL=[null,{q:1,s:5},{q:1,s:3},{q:1,s:2},{q:0,s:3},{q:0,s:2}];
function flashLvl(){return Math.min(5,(S.drill.flash&&S.drill.flash.lvl)||1)}
function flashNext(){
  var F=cur.flash,lvl=flashLvl();
  if(F.n>=F.total){var sec=Math.round((now()-F.t0)/1000),s=S.drill.flash||(S.drill.flash={best:0,bestT:0,runs:0,lvl:1});s.runs++;var better=F.ok>s.best;if(better){s.best=F.ok;s.bestT=sec}
    var msg='';if(F.ok>=6&&lvl<5){s.lvl=lvl+1;msg=' ⬆ '+t('flashUp',s.lvl)}else if(F.ok<=3&&lvl>1){s.lvl=lvl-1;msg=' ⬇ '+t('flashDown',s.lvl)}save();
    boardEl.classList.remove('nopieces');$('choices').hidden=true;$('fb').className='feedback '+(F.ok>=6?'good':'bad');$('fb').innerHTML=t('drillRes',F.ok,F.total,sec)+(better&&F.ok?' 🏆 '+t('newBest'):'')+msg;itemDone(F.ok>=6);setBtns({next:true});return}
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
      var good=flashAnswers(c,kind,ans),ok=good.indexOf(sq)>=0;F.n++;if(ok)F.ok++;
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
  var ms=c.moves({verbose:true}),lst=good.map(function(g){var m=ms.filter(function(x){return x.to===g&&(kind!=='mate'||(function(){c.move(x.san);var y=c.in_checkmate();c.undo();return y})())})[0];
    return m?(kind==='mate'?'<b class="mono">'+esc(m.san)+'</b>':pcName(m.captured)+' '+g+' (<span class="mono">'+esc(m.san)+'</span>)'):g}).join(', ');
  var h=kind==='mate'?t('flashMates',lst):t('flashFree',lst);
  if(!ok){var p=c.get(sq);h+=' · '+(!p?t('flashEmpty',sq):p.color===c.turn()?t('flashOwn',sq):t('flashDefended',pcName(p.type),sq))}
  return h;
}
function timerBar(ms,cb){var el=$('tmr');if(!el){later(cb,ms);return}var t0=now();
  (function tick(){var left=Math.max(0,1-(now()-t0)/ms);el.style.width=(left*100)+'%';el.classList.toggle('low',left<.3);if(left<=0){cb();return}later(tick,100)})()}
/* Rush */
function loadRush(){
  var pool=puzPool(['hanging','mate1','fork','backrank','pin'],1350).concat(puzPool(['mate2'],1300)).sort(function(){return Math.random()-.5});
  cur.rush={pool:pool,n:0,ok:0,lives:3,sec:30,missed:[]};setBar(null,false);setBtns({});rushNext();
}
function rushHead(){var R=cur.rush;return '<div class="op">'+kindPill('idea',t('rushT'))+' <span class="counter">'+'❤️'.repeat(R.lives)+'🤍'.repeat(3-R.lives)+' · ✓ '+R.ok+'</span></div>'}
function rushNext(){
  var R=cur.rush;if(R.lives<=0||R.n>=R.pool.length){rushEnd();return}
  var it=R.pool[R.n++],a=afterFirst(it.p),c=a.c,me=c.turn();R.cur={p:it.p,ply:1,me:me,done:false};
  setBoard(c.fen(),me==='b',a.m.san,it.p.fen);B.locked=false;$('fb').innerHTML='';
  $('prompt').innerHTML=rushHead()+'<div class="bigq">'+t('rushQ')+' <span class="small">'+esc(tt(it.l.t))+'</span></div><div class="timer"><span id="tmr"></span></div>';
  var tok=R.tok=(R.tok||0)+1;
  timerBar(R.sec*1000,function(){if(R.tok===tok&&!R.cur.done)rushFail(t('rushTime'))});
  B.onMove=function(mv){var P=R.cur;if(P.done)return;var want=P.p.m[P.ply];
    var ok=mv.san===want||(P.ply===P.p.m.length-1&&B.chess.in_checkmate());
    if(!ok){B.marks[mv.to]='bad';drawBoard();rushFail('',mv.san);return}
    P.ply++;B.marks[mv.to]='ok';drawBoard();
    if(P.ply>=P.p.m.length){P.done=true;R.ok++;B.locked=true;$('fb').className='feedback good';$('fb').textContent='✓';later(rushNext,500);return}
    B.locked=true;later(function(){var m=B.chess.move(P.p.m[P.ply],{sloppy:true});P.ply++;B.marks={};if(m){B.marks[m.from]='last';B.marks[m.to]='last'}drawBoard();B.locked=false},300)};
}
function rushFail(msg,wrong){var R=cur.rush,P=R.cur;P.done=true;R.lives--;B.locked=true;R.tok++;R.missed.push({p:P.p,ply:P.ply,wrong:wrong||null,t:R.n});
  var f=B.chess.fen();try{B.chess.undo()}catch(e){}var ar=arrowFor(B.chess.fen(),P.p.m[P.ply],'#0E9488');if(!ar){B.chess=new Chess(f)}B.arrows=ar?[ar]:[];drawBoard();
  $('fb').className='feedback bad';$('fb').innerHTML=(msg?msg+' ':'')+'✗ '+t('bestWas',esc(P.p.m[P.ply]));$('prompt').querySelector('.counter').textContent='❤️'.repeat(Math.max(0,R.lives))+'🤍'.repeat(3-Math.max(0,R.lives))+' · ✓ '+R.ok;
  later(rushNext,1800)}
function rushEnd(){var R=cur.rush,s=S.drill.rush||(S.drill.rush={best:0,bestT:0,runs:0});s.runs++;var better=R.ok>s.best;if(better)s.best=R.ok;save();
  $('fb').className='feedback good';$('fb').innerHTML=t('rushRes',R.ok)+(better&&R.ok?' 🏆 '+t('newBest'):' · '+t('rushBest',s.best));itemDone(R.ok>=5);setBtns({next:true});
  if(R.missed.length){var ch=$('choices');ch.hidden=false;ch.classList.remove('grid');
    ch.innerHTML='<p class="small">'+t('rushMissed')+'</p>'+R.missed.map(function(x,k){return '<button class="btn opt" data-k="'+k+'">'+t('rushRevBtn',k+1,x.wrong?esc(x.wrong):t('rushTime'),esc(x.p.m[x.ply]))+'</button>'}).join('');
    ch.querySelectorAll('[data-k]').forEach(function(b){b.onclick=function(){var x=R.missed[+b.getAttribute('data-k')];
      anSet(x.p.fen,x.p.m,x.ply,x.ply);B.onMove=anMove;var a=arrowFor(anChess(x.ply).fen(),x.p.m[x.ply],'#0E9488');if(a){B.arrows=[a];drawBoard()}
      $('fb').className='feedback';$('fb').innerHTML=t('rushRev',x.wrong?'<span class="mono">'+esc(x.wrong)+'</span>':t('rushTime'),'<span class="mono">'+esc(x.p.m[x.ply])+'</span>')+' <span class="small">'+t('flashReview')+'</span>';window.scrollTo(0,0)}})}
}
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
  var ps=due.concat(fresh).slice(0,max||8);
  var o=[];if(!S.seenLesson[l.id])o.push({t:'theory',l:l.id});
  return o.concat(ps.map(function(p){return {t:'puz',l:l.id,id:p.id}}));
}
function reviewPuz(n){var o=[];CURSO.lessons.forEach(function(l){l.p.forEach(function(p){var s=S.puz[p.id];if(s&&s.lapses&&(s.due||0)<=now())o.push({t:'puz',l:l.id,id:p.id})})});return o.slice(0,n)}
function renderLearn(){
  var h='<div class="unit"><h3>'+t('unitFund')+'</h3>'+FUND.map(function(f){var sub;
    if(f.id==='quiz'){var k=QUIZ.filter(function(q){return S.quiz[q.id]&&S.quiz[q.id].box>=2}).length;sub=t('learned',k,QUIZ.length)}
    else{var d=S.drill[f.id];sub=d?t('bestWas2',d.best,d.bestT):t('drillNew')}
    if(f.id==='rush'){var dr0=S.drill.rush;sub=dr0?t('rushBest',dr0.best):t('drillNew')}
    var ok=f.id==='quiz'?QUIZ.filter(function(q){return S.quiz[q.id]&&S.quiz[q.id].box>=2}).length>=QUIZ.length*.7:(S.drill[f.id]&&S.drill[f.id].best>=({nota:6,sqname:8,flash:8,rush:15}[f.id]||10)*.9);
    return '<button class="lrow" data-f="'+f.id+'"><span class="dotst '+(ok?'ok':S.seenLesson['f_'+f.id]?'due':'new')+'"></span><span class="lname">'+esc(tt(f.t))+'<span class="small">'+sub+'</span></span></button>'}).join('')+'</div>';
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
function loadTheory(l){
  S.seenLesson[l.id]=1;save();setBar(null,false);
  var p=l.p[0];var c=new Chess(p.fen);c.move(p.m[0],{sloppy:true});setBoard(c.fen(),c.turn()==='b');B.locked=true;
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
  cur.first=false;B.marks[mv.to]='bad';drawBoard();$('fb').className='feedback bad';$('fb').innerHTML=t('puzWrong','<span class="mono">'+esc(mv.san)+'</span>');
  var f0=null;later(function(){B.chess.undo();f0=B.chess.fen();B.marks={};var a=arrowFor(f0,want,'#E8730C');if(a)B.marks[a.from]='hint';drawBoard();B.locked=false},900);
}
function puzSolved(){
  var P=cur.puz,s=S.puz[P.p.id]||(S.puz[P.p.id]={box:0,due:0});gradeObj(s,cur.first);
  $('fb').className='feedback '+(cur.first?'good':'bad');$('fb').innerHTML=cur.first?t('puzDone'):t('puzDoneLate');
  var c=new Chess(P.p.fen);c.move(P.p.m[0],{sloppy:true});var f1=c.fen(),sol=P.p.m.slice(1);
  var r=outcome(f1,sol,P.me,sol.length);
  var w=['<b>'+esc(tt(P.l.t))+':</b> '+esc(tt(P.l.body)[0]),(c.in_checkmate()?'':'')+t('puzSol',pvText(f1,sol,8))+(r.mate?' — '+t('matePat'):r.delta>=1?' — '+t('puzWins',matTxt(r.delta)):'')];
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
function syncGames(){
  if(running)return;var user=(S.user||'Esmithco').toLowerCase();setRunning(true);stopFlag=false;
  var since=lastGameDate(),sd=new Date((since||0)*1000),key=sd.getUTCFullYear()*100+sd.getUTCMonth()+1;
  status('fetch',1,1);
  fetch('https://api.chess.com/pub/player/'+encodeURIComponent(user)+'/games/archives').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(a){
    var urls=(a.archives||[]).filter(function(u){var m=u.match(/(\d{4})\/(\d{2})$/);return m&&(+m[1]*100+ +m[2])>=key});if(!since)urls=urls.slice(-3);
    var out=[],i=0;return new Promise(function(res,rej){(function next(){if(i>=urls.length){res(out);return}status('fetch',i+1,urls.length);
      fetch(urls[i++]).then(function(r){return r.json()}).then(function(j){(j.games||[]).forEach(function(g){if(g.rules==='chess'&&g.pgn)out.push(g)});next()}).catch(rej)})()})
  }).then(function(games){var jobs=[];
    games.forEach(function(g){var side=g.white.username.toLowerCase()===user?'w':'b',me=side==='w'?g.white:g.black;
      var info={id:g.url,white:g.white.username,black:g.black.username,date:g.end_time,opening:openingName(g.eco),side:side,r:resultCode(me.result),how:me.result,rt:me.rating,tc:g.time_class};
      if(S.games[info.id])return;var sans=movesOf(g.pgn);if(sans)jobs.push({info:info,sans:sans})});
    jobs.sort(function(a,b){return (b.info.date||0)-(a.info.date||0)});jobs=jobs.slice(0,40);
    S.lastSync=now();save();runJobs(jobs);
  }).catch(function(){setRunning(false);status('fail')});
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
  var cur_=gs.length?gs[gs.length-1].rt:0,ago=gs.filter(function(g){return g.date<now()/1000-30*86400}).pop(),best=gs.reduce(function(m,g){return Math.max(m,g.rt)},0);
  $('capRating').textContent=gs.length?t('ratingCap',cur_,ago?(cur_-ago.rt>=0?'+':'')+(cur_-ago.rt):'—',best):'';
  /* mistakes per game */
  var em={};gs.forEach(function(g){if(!g.op)return;var d=new Date(g.date*1000),k=d.getFullYear()*12+d.getMonth();var o=em[k]||(em[k]={n:0,e:0});o.n++;o.e+=g.errors||0});
  var ek=Object.keys(em).map(Number).filter(function(k){return em[k].n>=5}).sort(function(a,b){return a-b}).slice(-8);
  $('chErr').innerHTML=barChart(ek.map(function(k){return [MON[LANG][k%12]+" '"+String(Math.floor(k/12)).slice(2),em[k].e/em[k].n]}),function(v){return v.toFixed(1)},'#E8730C');
  /* training per week */
  var wk={},L=S.log||[];L.forEach(function(e){var w=Math.floor((e[0]/864e5+3)/7);var o=wk[w]||(wk[w]={n:0,ok:0});o.n++;o.ok+=e[2]});
  var wks=Object.keys(wk).map(Number).sort(function(a,b){return a-b}).slice(-8);
  $('chTrain').innerHTML=barChart(wks.map(function(w){var d=new Date((w*7-3)*864e5);return [d.getDate()+'/'+(d.getMonth()+1),Math.round(wk[w].ok/wk[w].n*100)]}),function(v){return v+'%'},'#0E9488');
  /* kpis */
  var tot=L.length,okN=L.reduce(function(s,e){return s+e[2]},0);
  $('kpis').innerHTML='<div class="kpi"><b>'+(cur_||'—')+'</b><span>'+t('kRating')+'</span></div><div class="kpi"><b>'+(S.streak.n||0)+'</b><span>'+t('kStreak')+'</span></div><div class="kpi"><b>'+tot+'</b><span>'+t('kDone',tot?Math.round(okN/tot*100):0)+'</span></div>';
  /* course */
  var rows=CURSO.units.map(function(u){var ls=CURSO.lessons.filter(function(l){return l.unit===u.id}),ok=0,n=0;ls.forEach(function(l){var p=lessonProg(l);ok+=p.ok;n+=p.n});return [tt(u.t),ok,n]});
  var rl=allLines(),rok=rl.filter(function(x){return x.st&&x.st.box>=3}).length;rows.push([t('tRep'),rok,rl.length]);
  var ik=IDEAS.filter(function(x){return S.ideas[x.id]&&S.ideas[x.id].box>=2}).length;rows.push([t('unitIdeas'),ik,IDEAS.length]);
  var sp=0,sn=0;STRAT.forEach(function(x){var p=planProg(x.id);sp+=p.ok;sn+=p.n});rows.push([t('unitStrat'),sp,sn]);
  rows.unshift([t('unitFund'),QUIZ.filter(function(q){return S.quiz[q.id]&&S.quiz[q.id].box>=2}).length,QUIZ.length]);
  $('chCourse').innerHTML=rows.map(function(r){return '<div><div class="small" style="display:flex;justify-content:space-between"><span>'+esc(r[0])+'</span><span>'+r[1]+'/'+r[2]+'</span></div><div class="bar2"><span style="width:'+(r[2]?Math.round(r[1]/r[2]*100):0)+'%"></span></div></div>'}).join('');
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
      if(stopFlag||!jobs.length){status(stopFlag?'stopped':'done',done,total,found);setRunning(false);save();if(!$('s-home').hidden){var m=counts('mine'),q=counts('punish');$('tMineN').textContent=fmtCount(m);$('tPunN').textContent=fmtCount(q)}return}
      var j=jobs.shift();status('game',done+1,total,j.info.white,j.info.black);
      analyseGame(j.info,j.sans,ms).then(function(r){if(r.stopped){next();return}
        var g=S.games[j.info.id]||j.info;if(!S.games[j.info.id])g.src='app';g.op=1;g.tr=1;g.errors=r.errs;S.games[j.info.id]=g;found+=r.found;done++;save();
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
$('bBase').onclick=function(){fetch('datos.json?v=4',{cache:'no-cache'}).then(function(r){return r.json()}).then(function(D){DATA.stats=D.stats||{};mergeBase(D);save();$('bkStatus').textContent=t('bkLoaded')}).catch(function(){$('bkStatus').textContent=t('bkNone')})};
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
    seenLesson:S.seenLesson,log:S.log,daily:S.daily,streak:S.streak,lastSync:S.lastSync};
}
function newer(a,b){return (a.reps||0)>(b.reps||0)||((a.reps||0)===(b.reps||0)&&(a.due||0)>(b.due||0))}
function mergeProgress(R){
  if(!R||!R.v)return;
  Object.keys(R.appCards||{}).forEach(function(k){if(!S.cards[k])S.cards[k]=R.appCards[k]});
  Object.keys(R.games||{}).forEach(function(k){if(!S.games[k])S.games[k]=R.games[k]});
  Object.keys(R.cards||{}).forEach(function(k){var c=S.cards[k],r=R.cards[k];if(c&&newer(r,c)){c.box=r.box;c.due=r.due;c.reps=r.reps;c.lapses=r.lapses}});
  Object.keys(R.drill||{}).forEach(function(k){var a=S.drill[k],r=R.drill[k];if(!a||r.best>a.best||(r.best===a.best&&r.bestT&&r.bestT<a.bestT))S.drill[k]=r});
  ['rep','ideas','puz','tech','quiz','plan'].forEach(function(f){S[f]=S[f]||{};Object.keys(R[f]||{}).forEach(function(k){var a=S[f][k],r=R[f][k];if(!a||newer(r,a))S[f][k]=r})});
  Object.keys(R.seenLesson||{}).forEach(function(k){S.seenLesson[k]=1});
  var seen={};S.log=(S.log||[]).concat(R.log||[]).filter(function(e){var k=e[0]+e[1];if(seen[k])return false;seen[k]=1;return true}).sort(function(a,b){return a[0]-b[0]}).slice(-4000);
  if(R.streak&&(R.streak.last>(S.streak.last||'')||R.streak.last===S.streak.last&&R.streak.n>S.streak.n))S.streak=R.streak;
  if(R.daily&&(!S.daily||R.daily.date>S.daily.date||(R.daily.date===S.daily.date&&(R.daily.idx||0)>(S.daily.idx||0))))S.daily=R.daily;
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
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(function(){});
})();
