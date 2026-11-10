import json,pickle,collections,time
from analyse import wp,pk
selM,selP,res=pickle.load(open('deep.pkl','rb'))
G=json.load(open('parsed.json'))
BASE=int(time.strftime('%Y%m%d'))
def is_mistake(s0,s1):
    # a real mistake, not just a less precise move: it leaves you clearly worse, or throws away a clear advantage
    if s0<-500: return False
    d=wp(s0)-wp(s1); return d>=15 and (s1<=-150 or (s0>=200 and s1<=0))
def is_punish(s0,s1):
    # the opponent's move hands you a clear advantage (your view, before/after it)
    if s0>400: return False
    g=wp(s1)-wp(s0); return g>=15 and (s1>=150 or (s0<=-200 and s1>=0))
def rep(g):
    s=g['sans'];return (g['side']=='w' and s[:1]==['d4']) or (g['side']=='b' and (s[:2]==['e4','c6'] or s[:1]==['d4']))
cards={}
for k,c in selM:
    g=c['game'];p=c['p'];r=res[k];b=r['before'];a=r['after']
    s0=b['s'];s1=-a['s'];drop=wp(s0)-wp(s1)
    best=b['pv'][0] if b['pv'] else None
    if not best or best==g['sans'][p] or not is_mistake(s0,s1): continue
    th=r.get('threat')
    cards[k]={'id':k,'kind':'mine','side':g['side'],'opening':g['opening'],'line':g['sans'][:p],'played':g['sans'][p],'best':best,
      's0':s0,'s1':s1,'drop':round(drop),'sev':'blunder' if (s1<=-300 or drop>=25) else 'mistake','trap':s0>=-200 and s1<=-300,
      'pvBest':b['pv'],'pvBad':a['pv'],'threat':({'s':th['s'],'pv':th['pv'][:6]} if th and th['pv'] else None),
      'games':[x[0] for x in c['g']],'count':len(c['g']),'date':max(x[1] for x in c['g']),'rep':rep(g),'box':0,'due':0}
for k,c in selP:
    g=c['game'];p=c['p'];r=res[k];nw=r['now'];pr=r['prev']
    if not nw['pv']: continue
    s1=nw['s'];s0=-pr['s']  # our perspective before opp move
    if not is_punish(s0,s1): continue
    gm=g['sans'][p+1] if p+1<len(g['sans']) else None
    cards[k]={'id':k,'kind':'punish','side':g['side'],'opening':g['opening'],'line':g['sans'][:p+1],'oppMove':g['sans'][p],
      'oppBest':pr['pv'][0] if pr['pv'] else None,'best':nw['pv'][0],'s0':s0,'s1':s1,'gain':round(wp(s1)-wp(s0)),'pvBest':nw['pv'],
      'gameMove':gm,'missed':any(x[2] is False for x in c['g']),'games':[x[0] for x in c['g']],'count':len(c['g']),
      'date':max(x[1] for x in c['g']),'rep':rep(g),'box':0,'due':0}
RT={x['url']:(x['white' if x['white']['username'].lower()=='esmithco' else 'black']['rating'],x.get('time_class')) for x in json.load(open('games.json'))}
games={}
# mistakes per game = every flagged own move (not only the ones kept as cards), for the progress chart
import pickle
C=pickle.load(open('cache12.pkl','rb'));cnt=collections.Counter()
for g in G:
    f=g['fens'];s=g['sans'];us=0 if g['side']=='w' else 1
    for p in range(us,min(len(s),30),2):
        a=C.get(pk(f[p]));b=C.get(pk(f[p+1]))
        if a and b and a['pv'] and a['pv'][0]!=s[p] and is_mistake(a['s'],-b['s']): cnt[g['id']]+=1
for g in G:
    games[g['id']]={'white':g['white'],'black':g['black'],'date':g['date'],'opening':g['opening'],'side':g['side'],'r':g['r'],'how':g['how'],'op':1,'tr':1,'errors':cnt[g['id']],'rt':RT.get(g['id'],(None,None))[0],'tc':RT.get(g['id'],(None,None))[1]}
# opponent/own move frequencies in repertoire games, first 16 plies
st=collections.defaultdict(collections.Counter)
for g in G:
    if not rep(g): continue
    for i in range(min(16,len(g['sans']))):
        st[pk(g['fens'][i])][g['sans'][i]]+=1
stats={k:dict(v) for k,v in st.items() if sum(v.values())>=3}
gam={}
for g in G:
    w=g['opening'].split();idx=next((i for i,x in enumerate(w) if 'Gambit' in x),-1)
    if idx<0: continue
    name=' '.join(w[:idx+1]);k=g['side']+'|'+name;o=gam.setdefault(k,{'name':name,'side':g['side'],'n':0,'W':0,'D':0,'L':0});o['n']+=1;o[g['r']]+=1
out={'v':3,'base':BASE,'user':'Esmithco','games':games,'cards':cards,'gambits':gam,'stats':stats}
s=json.dumps(out,separators=(',',':'),ensure_ascii=False)
open('datos.json','w').write(s)
print('cards',collections.Counter(c['kind'] for c in cards.values()),'rep',sum(c['rep'] for c in cards.values()),'stats',len(stats),'size',len(s)//1024,'KB')
rj=json.load(open('rep.json'))
open('repertorio.js','w').write('/* Generated from rep.py: curated repertoire lines with bilingual notes. */\nwindow.REP='+json.dumps(rj,ensure_ascii=False,separators=(',',':'))+';\n')
import chess
V={1:1,2:3,3:3,4:5,5:9,6:0}
def bal(b,color): return sum(V[p.piece_type]*(1 if p.color==color else -1) for p in b.piece_map().values())
def mat(line,pv,color):
    b=chess.Board()
    for s in line: b.push_san(s)
    b0=bal(b,color);worst=best=0
    for s in pv[:6]:
        b.push_san(s)
    return bal(b,color)-b0
for c in cards.values():
    col=chess.WHITE if c['side']=='w' else chess.BLACK
    if c['kind']=='punish': c['mat']=mat(c['line'],c['pvBest'],col)
    else: c['mat']=mat(c['line']+[c['played']],c['pvBad'],col)
s=json.dumps(out,separators=(',',':'),ensure_ascii=False)
open('datos.json','w').write(s)
print('punish w/ material',sum(1 for c in cards.values() if c['kind']=='punish' and c['mat']>=1),'mine losing material',sum(1 for c in cards.values() if c['kind']=='mine' and c['mat']<=-1))
