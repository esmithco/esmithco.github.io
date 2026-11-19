"""Nov 19 fix: 'concrete' was measured in the middle of a trade (right after his capture, before the recapture), so lines that end
level counted as 'wins material'. Now material is measured after the OPPONENT's reply (even ply, up to 6 plies, or the last even ply
of a shorter line); mate inside the line counts. Cards that fail: punish -> hidden; own -> judge-only."""
import json,sys,chess
V={1:1,2:3,3:3,4:5,5:9,6:0}
def bal(b,c):return sum((1 if p.color==c else -1)*V[p.piece_type] for p in b.piece_map().values())
def delta(b0,moves,col,n=6):
    b=b0.copy();d0=bal(b,col);last=None
    for i,m in enumerate(moves[:n]):
        try:b.push_san(m)
        except Exception:break
        if b.is_checkmate():return 99 if b.turn!=col else -99
        if (i+1)%2==0:last=bal(b,col)-d0
    return last if last is not None else 0
f=sys.argv[1];D=json.load(open(f));out={'punish':0,'mine':0}
for c in D['cards'].values():
    if c.get('hide'):continue
    b=chess.Board()
    for m in c['line']:b.push_san(m)
    col=b.turn;vis=c.get('vis')
    if c['kind']=='punish' or vis=='win':ok=delta(b,c.get('pvBest',[]),col)>=1
    else:ok=delta(b,[c['played']]+c.get('pvBad',[]),col)<=-1
    if not ok:
        c['hide']=True;c['jo']=c['kind']=='mine';out[c['kind']]+=1
D['base']+=1;json.dump(D,open(f,'w'),separators=(',',':'));print('removed',out,'base',D['base'])
