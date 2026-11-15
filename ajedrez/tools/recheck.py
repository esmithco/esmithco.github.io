"""Deep re-check of every exercise card (base + the ones his phone created): true evals, lines, visibility, alternatives, and whether it teaches something."""
import json,chess,chess.engine,math,sys
from multiprocessing import Pool
sys.path.insert(0,'.')
from vis import vis_mine,vis_punish
def wp(cp):cp=max(-1000,min(1000,cp));return 50+50*(2/(1+math.exp(-0.00368208*cp))-1)
def sanl(b,pv,n=8):
    x=b.copy();o=[]
    for m in pv[:n]:o.append(x.san(m));x.push(m)
    return o
V={1:1,2:3,3:3,4:5,5:9,6:0}
def bal(b,col):return sum((1 if p.color==col else -1)*V[p.piece_type] for p in b.piece_map().values())
def concrete(b,moves,col,sign,n=5):
    x=b.copy();b0=bal(x,col)
    for m in moves[:n]:
        try:x.push_san(m)
        except Exception:break
        if x.is_checkmate():return (x.turn!=col) if sign>0 else (x.turn==col)
    d=bal(x,col)-b0
    return d>=1 if sign>0 else d<=-1
def work(c):
    e=chess.engine.SimpleEngine.popen_uci('stockfish')
    try:
        b=chess.Board()
        for m in c['line']:b.push_san(m)
        r=e.analyse(b,chess.engine.Limit(depth=18),multipv=4)
        s0=r[0]['score'].pov(b.turn).score(mate_score=10000);best=b.san(r[0]['pv'][0])
        alts=[b.san(i['pv'][0]) for i in r[1:] if s0-i['score'].pov(b.turn).score(mate_score=10000)<=35]
        out={'id':c['id'],'best':best,'pvBest':sanl(b,r[0]['pv']),'alts':alts}
        if c['kind']=='mine':
            b1=b.copy();b1.push_san(c['played']);r1=e.analyse(b1,chess.engine.Limit(depth=18))
            s1=-r1['score'].pov(b1.turn).score(mate_score=10000);out.update(s0=s0,s1=s1,pvBad=sanl(b1,r1['pv']))
            d=wp(s0)-wp(s1)
            mistake=s0>=-100 and d>=15 and (s1<=-150 or (s0>=200 and s1<=0)) and c['played']!=best and c['played'] not in alts
            v=vis_mine(b,c['played'],out['pvBad'],out['pvBest']) if mistake else 'deep'
            # concrete only: within 5 plies he loses >= 1 pawn of material or gets mated (bad move), or the best move wins >= 1 pawn / mates (missed win), and the eval swing is >= 1.5 pawns
            mat_bad=concrete(b,[c['played']]+out['pvBad'],b.turn,-1)
            mat_best=concrete(b,out['pvBest'],b.turn,+1)
            clear=(s0-s1)>=150 and (mat_bad if v=='lose' else mat_best)
            out.update(vis=v,keep=bool(mistake and v!='deep' and clear),drop=round(d))
        else:
            # punish: position after the opponent's mistake, his move to find
            s1=s0;out.update(s1=s1)
            v=vis_punish(b,out['pvBest'])
            out.update(vis=v,keep=bool(v!='deep' and s1>=150 and concrete(b,out['pvBest'],b.turn,+1)))
        return out
    except Exception as ex:
        return {'id':c['id'],'keep':False,'err':str(ex)}
    finally:e.quit()
if __name__=='__main__':
    D=json.load(open('/Users/esmith/Desktop/Files/Projects/esmithco.github.io/ajedrez/datos.json'))
    p=json.loads(json.load(open('fb.json')))
    cards=[c for c in D['cards'].values()]
    app=[c for c in p['appCards'].values() if c['id'] not in D['cards']]
    for c in app:c=c
    allc=cards+app
    with Pool(7) as pool:res=pool.map(work,allc,chunksize=3)
    R={r['id']:r for r in res}
    kept={'mine':0,'punish':0};tot={'mine':0,'punish':0}
    for c in allc:
        r=R[c['id']];tot[c['kind']]+=1
        if r.get('err'):print('ERR',c['id'][:40],r['err']);continue
        c.update({k:v for k,v in r.items() if k not in('id','keep','err')})
        c['hide']=not r['keep']
        if c['id'] not in D['cards']:c=dict(c);c.pop('box',None);c.pop('due',None);c.pop('reps',None);c.pop('lapses',None);c['src']='app';D['cards'][c['id']]=c
        if r['keep']:kept[c['kind']]+=1
    D['base']+=1
    json.dump(D,open('/Users/esmith/Desktop/Files/Projects/esmithco.github.io/ajedrez/datos.json','w'),separators=(',',':'))
    print('total',tot,'kept',kept,'base',D['base'])
