import json, math, io, os, pickle, sys, time, re
import chess, chess.pgn, chess.engine
from multiprocessing import Pool
USER='esmithco'; MAXPLY=30; SF='/opt/homebrew/bin/stockfish'
LOSS={'checkmated','resigned','timeout','abandoned','lose'}
def wp(cp):
    cp=max(-1000,min(1000,cp)); return 50+50*(2/(1+math.exp(-0.00368208*cp))-1)
def pk(fen): return ' '.join(fen.split(' ')[:4])
eng=None
def init():
    global eng
    eng=chess.engine.SimpleEngine.popen_uci(SF); eng.configure({'Threads':1,'Hash':64})
def run(args):
    fen,depth=args
    b=chess.Board(fen)
    if b.is_checkmate(): return fen,{'s':-10000,'pv':[]}
    if b.is_stalemate() or b.is_insufficient_material(): return fen,{'s':0,'pv':[]}
    i=eng.analyse(b,chess.engine.Limit(depth=depth))
    s=i['score'].pov(b.turn).score(mate_score=10000)
    pv=[]; bb=b.copy()
    for m in i.get('pv',[])[:8]:
        pv.append(bb.san(m)); bb.push(m)
    return fen,{'s':s,'pv':pv}
def opening(url):
    seg=(url or '').rstrip('/').split('/')[-1]
    import urllib.parse; seg=urllib.parse.unquote(seg)
    keep=[]
    for p in seg.split('-'):
        if re.search(r'\d|\.\.\.',p): break
        keep.append(p)
    return ' '.join(keep).strip() or 'Desconocida'
def main():
    games=json.load(open('games.json'))
    G=[]
    for g in games:
        side='w' if g['white']['username'].lower()==USER else 'b'
        me=g['white'] if side=='w' else g['black']
        r='W' if me['result']=='win' else ('L' if me['result'] in LOSS else 'D')
        pg=chess.pgn.read_game(io.StringIO(g['pgn']))
        if pg is None: continue
        b=pg.board(); sans=[]; fens=[b.fen()]
        for m in pg.mainline_moves():
            sans.append(b.san(m)); b.push(m); fens.append(b.fen())
        G.append({'id':g['url'],'white':g['white']['username'],'black':g['black']['username'],'date':g.get('end_time',0),
          'opening':opening(g.get('eco')),'side':side,'r':r,'how':me['result'],'sans':sans,'fens':fens})
    print(len(G),'games parsed',flush=True)
    cache=pickle.load(open('cache12.pkl','rb')) if os.path.exists('cache12.pkl') else {}
    todo=[]; seen=set()
    for g in G:
        for f in g['fens'][:MAXPLY+2]:
            k=pk(f)
            if k not in cache and k not in seen: seen.add(k); todo.append((f,12))
    print(len(todo),'positions to evaluate',flush=True)
    t=time.time()
    with Pool(7,initializer=init) as p:
        for n,(f,r) in enumerate(p.imap_unordered(run,todo,chunksize=16)):
            cache[pk(f)]=r
            if n%5000==0: print(n,round(time.time()-t),flush=True); pickle.dump(cache,open('cache12.pkl','wb'))
    pickle.dump(cache,open('cache12.pkl','wb'))
    json.dump([{k:v for k,v in g.items()} for g in G],open('parsed.json','w'))
    print('phase1 done',round(time.time()-t),flush=True)
if __name__=='__main__': main()
