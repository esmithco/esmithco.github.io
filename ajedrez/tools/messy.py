"""Nov 19: hide 'find the move' cards whose best line is not simple: it costs him material on the way (sacrifice), or after 4 plies
one of his pieces worth >= 5 is left hanging (the line only works much later). They stay for the judge drill (jo)."""
import json,sys,chess
V={1:1,2:3,3:3,4:5,5:9,6:0}
def bal(b,c):return sum((1 if p.color==c else -1)*V[p.piece_type] for p in b.piece_map().values())
def hanging_big(b,col):
    for sq,p in b.piece_map().items():
        if p.color!=col or V[p.piece_type]<5:continue
        att=b.attackers(not col,sq)
        if att and (not b.attackers(col,sq) or min(V[b.piece_at(a).piece_type] or 99 for a in att)<V[p.piece_type]):return True
    return False
f=sys.argv[1];D=json.load(open(f));n=0
for c in D['cards'].values():
    if c.get('hide'):continue
    b=chess.Board()
    for m in c['line']:b.push_san(m)
    col=b.turn;b0=bal(b,col);mn=0;end=0;messy=False
    for i,m in enumerate(c.get('pvBest',[])[:8]):
        try:b.push_san(m)
        except Exception:break
        d=bal(b,col)-b0;end=d
        if i%2==1:
            mn=min(mn,d)
            if i==3 and b.turn==col and hanging_big(b,col) and not b.is_check():messy=True
    if (mn<=-2 and end<=0) or messy:
        c['hide']=True;c['jo']=c['kind']=='mine';n+=1;print(c['kind'],c['best'],' '.join(c['pvBest'][:8]))
D['base']+=1
json.dump(D,open(f,'w'),separators=(',',':'));print('moved',n,'base',D['base'])
