import json,pickle,time,collections,chess,chess.engine
from multiprocessing import Pool
from analyse import wp,pk,SF
eng=None
def init():
    global eng
    eng=chess.engine.SimpleEngine.popen_uci(SF);eng.configure({'Threads':1,'Hash':64})
def an(fen,depth=16):
    b=chess.Board(fen)
    if b.is_game_over(): return {'s':-10000 if b.is_checkmate() else 0,'pv':[]}
    i=eng.analyse(b,chess.engine.Limit(depth=depth))
    s=i['score'].pov(b.turn).score(mate_score=10000);pv=[];bb=b.copy()
    for m in i.get('pv',[])[:8]:
        pv.append(bb.san(m));bb.push(m)
    return {'s':s,'pv':pv}
def job(t):
    kind,k,fen0,fen1,fenPrev=t
    out={'k':k}
    if kind=='m':
        out['before']=an(fen0);out['after']=an(fen1)
        b=chess.Board(fen0)
        if not b.is_check():
            b.push(chess.Move.null())
            if b.is_valid(): out['threat']=an(b.fen(),14)
    else:
        out['now']=an(fen1);out['prev']=an(fenPrev)
    return out
if __name__=='__main__':
    exec(open('flag.py').read().split("print('mine'")[0])
    yr=now-365*86400
    def rep(g):
        s=g['sans']
        return (g['side']=='w' and s[:1]==['d4']) or (g['side']=='b' and (s[:2]==['e4','c6'] or s[:1]==['d4']))
    def last(c): return max(x[1] for x in c['g'])
    selM=[(k,c) for k,c in mine.items() if last(c)>yr or len(c['g'])>1 or rep(c['game'])]
    selP=[(k,c) for k,c in pun.items() if (last(c)>yr or rep(c['game'])) and (any(x[2] is False for x in c['g']) or c['drop']>=25)]
    print('selected mine',len(selM),'punish',len(selP),flush=True)
    jobs=[]
    for k,c in selM:
        g=c['game'];p=c['p'];jobs.append(('m',k,g['fens'][p],g['fens'][p+1],None))
    for k,c in selP:
        g=c['game'];p=c['p'];jobs.append(('p',k,None,g['fens'][p+1],g['fens'][p]))
    res={}
    t=time.time()
    with Pool(7,initializer=init) as P:
        for n,r in enumerate(P.imap_unordered(job,jobs,chunksize=4)):
            res[r['k']]=r
            if n%300==0:print(n,len(jobs),round(time.time()-t),flush=True)
    pickle.dump((selM,selP,res),open('deep.pkl','wb'))
    print('done',round(time.time()-t))
