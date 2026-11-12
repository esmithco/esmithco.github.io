"""For every visible card: the moves that are about as good as the best one (depth 16, multipv 5, within 35 cp), so the app accepts them."""
import json,chess,chess.engine,sys
from multiprocessing import Pool
P='/Users/esmith/Desktop/Files/Projects/esmithco.github.io/ajedrez/datos.json'
def work(item):
    k,line,best=item
    e=chess.engine.SimpleEngine.popen_uci('stockfish')
    try:
        b=chess.Board()
        for m in line: b.push_san(m)
        info=e.analyse(b,chess.engine.Limit(depth=16),multipv=5)
        top=info[0]['score'].pov(b.turn).score(mate_score=10000)
        alts=[b.san(i['pv'][0]) for i in info if top-i['score'].pov(b.turn).score(mate_score=10000)<=35]
        return k,[a for a in alts if a!=best]
    finally: e.quit()
if __name__=='__main__':
    D=json.load(open(P))
    items=[(k,c['line'] if c['kind']=='mine' else c['line'],c['best']) for k,c in D['cards'].items() if c.get('vis')!='deep']
    with Pool(7) as p: res=p.map(work,items,chunksize=4)
    n=0
    for k,a in res:
        D['cards'][k]['alts']=a;n+=bool(a)
    D['base']=D['base']+1
    json.dump(D,open(P,'w'),separators=(',',':'))
    print('cards',len(res),'with alternatives',n,'base',D['base'])
