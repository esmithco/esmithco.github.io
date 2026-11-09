import pickle, json, chess, collections
V={1:1,2:3,3:3,4:5,5:9,6:0}
res=pickle.load(open('plans.pkl','rb'))
def bal(b,c): return sum(V[p.piece_type]*(1 if p.color==c else -1) for p in b.piece_map().values())
def mob(b,sq,color):
    bb=b.copy(); bb.turn=color
    return sum(1 for m in bb.pseudo_legal_moves if m.from_square==sq)
def outpost(b,sq,color):
    f=chess.square_file(sq); r=chess.square_rank(sq)
    rel=r if color==chess.WHITE else 7-r
    if rel<3 or rel>5: return False
    for df in (-1,1):
        ff=f+df
        if not 0<=ff<=7: continue
        for rr in range(8):
            p=b.piece_at(chess.square(ff,rr))
            if p and p.piece_type==chess.PAWN and p.color!=color:
                # enemy pawn that could still advance to attack sq
                if (color==chess.WHITE and rr>r) or (color==chess.BLACK and rr<r): return False
    return True
def tag(b,m):
    p=b.piece_at(m.from_square); me=b.turn; t=p.piece_type
    queens=any(x.piece_type==chess.QUEEN for x in b.piece_map().values())
    cap=b.is_capture(m)
    if b.gives_check(m): return None
    if t==chess.KING:
        if b.is_castling(m) or cap: return None
        if not queens: return 'king'
        if chess.square_name(m.to_square) in ('h1','h8','b1','b8','a1','a8'): return 'prophy'
        return None
    if cap:
        cp=b.piece_at(m.to_square)
        if cp and V[cp.piece_type]==V[t] and t in (2,3,4): return 'trade'
        return None
    a=b.copy(); a.push(m)
    if t==chess.PAWN:
        name=chess.square_name(m.to_square)
        if name in ('h3','h6','a3','a6') : return 'prophy'
        for s in a.attacks(m.to_square):
            q=a.piece_at(s)
            if q and q.piece_type==chess.PAWN and q.color!=me: return 'break'
        return None
    if t==chess.ROOK:
        f=chess.square_file(m.to_square)
        own=[s for s in chess.SquareSet(chess.BB_FILES[f]) if a.piece_at(s) and a.piece_at(s).piece_type==chess.PAWN and a.piece_at(s).color==me]
        if not own and chess.square_file(m.from_square)!=f: return 'rook'
    if t==chess.KNIGHT and outpost(a,m.to_square,me): return 'outpost'
    if t in (2,3,4,5):
        m0=mob(b,m.from_square,me); m1=mob(a,m.to_square,me)
        if m1-m0>=3: return ('improve',m0,m1)
    return None
out=collections.defaultdict(list)
for fen,r in res.items():
    if len(r)<3: continue
    b=chess.Board(fen); best=r[0]
    if abs(best['s'])>250: continue
    gap=best['s']-r[1]['s']
    if gap<50 or gap>250: continue  # clear, but the runner-up is a real move, not a blunder
    if any(best['s']-x['s']>400 for x in r[:4]): continue  # sharp/tactical position: skip
    m=chess.Move.from_uci(best['uci'])
    tg=tag(b,m)
    if not tg: continue
    extra={}
    if isinstance(tg,tuple): tg,extra['m0'],extra['m1']=tg
    # not a hidden tactic: material after 4 plies of the pv must not swing by 2+
    bb=b.copy();b0=bal(bb,b.turn)
    for s in best['pv'][:4]: bb.push_san(s)
    if bal(bb,b.turn)-b0>=2: continue
    opts=[x for x in r[1:] if 60<=best['s']-x['s']<=300]
    if len(opts)<2: continue
    opts=opts[:2]
    if any(b.is_capture(chess.Move.from_uci(x['uci'])) and False for x in opts): pass
    out[tg].append({'fen':fen,'best':best['pv'][0],'s':best['s'],'pv':best['pv'],'opts':[{'san':x['pv'][0],'s':x['s'],'pv':x['pv'][:4]} for x in opts],'gap':best['s']-r[1]['s'],**extra})
sel={}
for tg,lst in out.items():
    lst.sort(key=lambda x:-min(x['gap'],200)-(0 if abs(x['s'])<150 else -50))
    sel[tg]=lst[:12]
    print(tg,len(lst),'->',len(sel[tg]))
json.dump(sel,open('plans.json','w'),ensure_ascii=False)
