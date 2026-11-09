# Mine "quiet move / plan" exercises from his own middlegames: positions where the engine's best move is
# a non-forcing move that is clearly better than the alternatives, then tag the strategic idea behind it.
import json, time, chess, chess.engine, pickle, os, random
from multiprocessing import Pool
SF='/opt/homebrew/bin/stockfish'
eng=None
def init():
    global eng
    eng=chess.engine.SimpleEngine.popen_uci(SF);eng.configure({'Threads':1,'Hash':64})
def job(fen):
    b=chess.Board(fen)
    try:
        info=eng.analyse(b,chess.engine.Limit(depth=14),multipv=5)
    except Exception: return fen,None
    out=[]
    for i in info:
        if 'pv' not in i: continue
        bb=b.copy();pv=[]
        for m in i['pv'][:6]: pv.append(bb.san(m)); bb.push(m)
        out.append({'s':i['score'].pov(b.turn).score(mate_score=10000),'uci':i['pv'][0].uci(),'pv':pv})
    return fen,out
def main():
    G=json.load(open('parsed.json'))
    cut=time.time()-540*86400
    todo=[]
    for g in G:
        if g['date']<cut: continue
        us=0 if g['side']=='w' else 1
        for p in range(18,min(len(g['sans']),70)):
            if p%2==us: todo.append(g['fens'][p])
    todo=list(dict.fromkeys(todo))
    random.seed(1);random.shuffle(todo);todo=todo[:9000]
    print(len(todo),'positions',flush=True)
    res={}
    t=time.time()
    with Pool(7,initializer=init) as P:
        for n,(f,r) in enumerate(P.imap_unordered(job,todo,chunksize=8)):
            if r: res[f]=r
            if n%1000==0: print(n,round(time.time()-t),flush=True)
    pickle.dump(res,open('plans.pkl','wb'))
    print('done',len(res),round(time.time()-t))
if __name__=='__main__': main()
