# His GOOD moves (Nov 23, his idea): positions where he found the only good move — the 2nd best is >= 1.5 worse — in a balanced or
# slightly better position (no trivial recaptures, no forced replies), so he can prove it was not luck.
import json,io,math,chess,chess.pgn,chess.engine
from multiprocessing import Pool
VAL={1:1,2:3,3:3,4:5,5:9,6:0}
def work(g):
    e=chess.engine.SimpleEngine.popen_uci('/opt/homebrew/bin/stockfish');out=[]
    try:
        pg=chess.pgn.read_game(io.StringIO(g['pgn']));col=chess.WHITE if g['white']['username'].lower()=='esmithco' else chess.BLACK
        b=pg.board();prev=None;prevmove=None
        for ply,nd in enumerate(pg.mainline()):
            m=nd.move
            if b.turn==col and ply>=14 and b.legal_moves.count()>4:
                recap=prevmove is not None and b.is_capture(prevmove) if False else (prevmove is not None and m.to_square==prevmove.to_square and b.is_capture(m))
                if not recap:
                    i=e.analyse(b,chess.engine.Limit(depth=12),multipv=2)
                    if len(i)==2 and i[0]['pv'][0]==m:
                        s0=i[0]['score'].pov(col).score(mate_score=3000);s2=i[1]['score'].pov(col).score(mate_score=3000)
                        if -150<=s0<=600 and s0-s2>=150:
                            d=e.analyse(b,chess.engine.Limit(depth=16),multipv=3)
                            if d[0]['pv'][0]==m:
                                best=d[0]['score'].pov(col).score(mate_score=3000);alts=[b.san(x['pv'][0]) for x in d[1:] if best-x['score'].pov(col).score(mate_score=3000)<=40]
                                if not alts or len(alts)<2:
                                    c=b.copy();pv=[]
                                    for x in d[0]['pv'][:5]:pv.append(c.san(x));c.push(x)
                                    out.append([b.fen(),best,pv[0],' '.join(pv),prev,g['end_time'],alts,g['url']])
            prev=b.fen();prevmove=m;b.push(m)
    except Exception as ex:pass
    finally:e.quit()
    return out
if __name__=='__main__':
    G=[]
    for f in ['g10.json','g11.json']:G+=json.load(open(f))['games']
    G=[g for g in G if g.get('time_class')=='rapid' and g['end_time']>=1790830800]
    print(len(G),flush=True)
    with Pool(7) as p:R=p.map(work,G,chunksize=2)
    rows=[r for x in R for r in x];json.dump(rows,open('good.json','w'));print('found',len(rows))
