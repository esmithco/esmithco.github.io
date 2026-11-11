"""Lines built from HIS games: the opponent moves he meets most (and scores worst against) in his own openings,
continued with the engine's best moves for him and his opponents' most common replies. Output: mylines.json"""
import json,collections,chess,chess.engine,re,sys
G=json.load(open('parsed.json'))
REPJS=open(sys.argv[1]).read()
REP=json.loads(REPJS[REPJS.index('=')+1:].rstrip().rstrip(';'))
def board(sans):
    b=chess.Board()
    for m in sans: b.push_san(m)
    return b
def pk(b): return ' '.join(b.fen().split(' ')[:4])
def mine(op,g):
    s=g['sans']
    if len(s)<8: return False
    if op=='london': return g['side']=='w' and s[0]=='d4'   # all 1.d4 games: also the replies that stop the London (1…e5 …)
    if op=='caro': return g['side']=='b' and s[0] not in ('d4','c4') and s[1]=='c6'
    if op=='slav': return g['side']=='b' and s[0] in ('d4','c4') and (s[1]=='c6' or (s[1]=='d5' and 'c6' in s[3:6:2]))
# positions already in the curated lines -> the move he is expected to play there (never contradict them)
book={};covered={}
for op,o in REP.items():
    side=chess.WHITE if o['side']=='w' else chess.BLACK
    for l in o['lines']:
        if l.get('kind')=='game': continue
        b=chess.Board()
        for m in l['moves']:
            if b.turn==side: book.setdefault(op,{})[pk(b)]=m
            b.push_san(m)
        covered.setdefault(op,[]).append(l['moves'])
eng=chess.engine.SimpleEngine.popen_uci('stockfish');eng.configure({'Threads':6,'Hash':256})
def best(b):
    r=eng.analyse(b,chess.engine.Limit(depth=16));return b.san(r['pv'][0]),r['score'].pov(b.turn).score(mate_score=10000)
LABEL={'Qh5':('Dama temprana (Qh5)','Early queen (Qh5)'),'Qf3':('Dama temprana (Qf3)','Early queen (Qf3)'),'Bc4':('Alfil a c4 (estilo italiana)','Bishop to c4 (Italian style)'),
 'g3':('Fianchetto (g3)','Fianchetto (g3)'),'Bg2':('Fianchetto','Fianchetto'),'g6':('Fianchetto (…g6)','Fianchetto (…g6)'),'Bf4':('Londres (Bf4)','London (Bf4)'),
 'c4':('Gambito (c4)','Gambit (c4)'),'Nc3':('Nc3 (clásica)','Nc3 (classical)'),'f4':('f4','f4'),'d3':('d3 tranquilo','Quiet d3'),'e5':('Avance (e5)','Advance (e5)'),'exd5':('Cambio (exd5)','Exchange (exd5)'),'b3':('Fianchetto de dama (b3)','Queenside fianchetto (b3)'),'Bb5':('Bb5','Bb5')}
def label(mv,white):
    k=mv.lstrip('…')
    if k in LABEL: return LABEL[k]
    m=('' if white else '…')+mv
    return (m,m)
VAL={1:1,2:3,3:3,4:5,5:9,6:0}
def why(b,mv):
    """a short teacher note for HIS move"""
    m=b.parse_san(mv);p=b.piece_at(m.from_square);b2=b.copy();b2.push(m)
    if b.is_castling(m): return ('Enroca: tu rey a salvo y la torre al juego.','Castle: your king is safe and the rook joins the game.')
    if b2.is_check(): return ('Jaque que te da tiempo.','A check that gains time.')
    if b.is_capture(m):
        cap=b.piece_at(m.to_square);
        if cap and not b2.attackers(b2.turn,m.to_square): return ('Captura gratis: nadie puede recapturar.','A free capture: nobody can take back.')
        return ('Captura y cambia: cuenta lo que ganas.','Capture and trade: count what you win.')
    att=[t for t in b2.attacks(m.to_square) if b2.piece_at(t) and b2.piece_at(t).color!=p.color and VAL[b2.piece_at(t).piece_type]>VAL[p.piece_type]]
    if att: return ('Ataca una pieza más valiosa y gana tiempo.','Attacks a more valuable piece and gains time.')
    home=0 if p.color==chess.WHITE else 7
    if p.piece_type in (2,3) and chess.square_rank(m.from_square)==home: return ('Desarrolla una pieza nueva.','Develops a new piece.')
    if p.piece_type==1 and chess.square_file(m.to_square) in (2,3,4): return ('Peón al centro: más espacio y casillas para tus piezas.','Pawn to the center: more space and squares for your pieces.')
    if p.piece_type==5: return ('La dama sale solo si hay una amenaza concreta.','The queen comes out only with a concrete threat.')
    return ('La jugada sólida según el motor.','The solid move according to the engine.')
out={}
for op in ('london','caro','slav'):
    side='w' if op=='london' else 'b';me=chess.WHITE if side=='w' else chess.BLACK
    gs=[g for g in G if mine(op,g)]
    node=collections.defaultdict(lambda:{'n':0,'sc':0.0,'next':collections.Counter()})
    for g in gs:
        sc={'W':1,'D':.5}.get(g['r'],0)
        for p in range(0,min(12,len(g['sans']))):
            k=tuple(g['sans'][:p]);node[k]['n']+=1;node[k]['sc']+=sc;node[k]['next'][g['sans'][p]]+=1
        k=tuple(g['sans'][:min(12,len(g['sans']))]);node[k]['n']+=1;node[k]['sc']+=sc
    cand=[]
    for k,v in node.items():
        b=None
        if len(k)>=10 or v['n']<6: continue
        turn_me=(len(k)%2==0)==(side=='w')
        if turn_me: continue
        for mv,c in v['next'].items():
            ch=k+(mv,);cn=node[ch]
            if cn['n']<(3 if len(k)<=4 else 4): continue   # early surprises count even if rarer
            path=list(ch)
            if any(l[:len(path)]==path for l in covered.get(op,[])): continue
            score=cn['sc']/cn['n'];pain=cn['n']*(1-score)
            if score>0.6 and cn['n']<10: continue
            cand.append((pain,path,cn['n'],score))
    cand.sort(key=lambda x:-x[0]);chosen=[]
    for pain,path,n,score in cand:
        if any(path[:len(c[1])]==c[1] or c[1][:len(path)]==path for c in chosen): continue
        chosen.append((pain,path,n,score))
        if len(chosen)>=7: break
    # surprises that break his setup (he asked for these): always include the branches he has met, even if rare
    FORCE={'london':[['d4','e5','dxe5','Bc5'],['d4','e5','dxe5','d6'],['d4','e5','dxe5','f6']],
           'caro':[['e4','c6','Qh5'],['e4','c6','Qf3'],['e4','c6','Bc4']],'slav':[]}
    for path in FORCE.get(op,[]):
        k=tuple(path)
        if k not in node or any(l[:len(path)]==path for l in covered.get(op,[])) or any(c[1]==path for c in chosen): continue
        n=node[k]['n'];chosen.append((0,path,n,node[k]['sc']/n))
    lines=[]
    for pain,path,n,score in chosen:
        b=board(path);moves=list(path);notes={}
        wins=round(score*n)
        dev=len(path)-1
        notes[str(dev)]={'es':'En tus partidas el rival jugó esto %d veces y sacaste %s de %d puntos. Aquí tienes cómo seguir.'%(n,('%g'%(score*n)),n),
                          'en':'In your games your opponent played this %d times and you scored %s of %d. Here is how to go on.'%(n,('%g'%(score*n)),n)}
        for i in range(6):
            if b.is_game_over(): break
            if b.turn==me:
                mv=book.get(op,{}).get(pk(b))
                if not mv:
                    bm,bs=best(b);mv=bm
                    k=tuple(moves);his=[(m2,c2) for m2,c2 in (node[k]['next'].most_common(2) if k in node else []) if c2>=3]
                    for m2,c2 in his:   # keep HIS usual move (his style) when it is about as good as the engine's
                        if m2==bm: break
                        b3=b.copy();b3.push_san(m2);r=eng.analyse(b3,chess.engine.Limit(depth=14));s3=-r['score'].pov(b3.turn).score(mate_score=10000)
                        if bs-s3<=40: mv=m2
                        break
                w=why(b,mv);notes[str(len(moves))]={'es':w[0],'en':w[1]}
            else:
                k=tuple(moves);nx=node[k]['next'] if k in node else None
                mv=nx.most_common(1)[0][0] if nx and nx.most_common(1)[0][1]>=2 else best(b)[0]
            moves.append(mv);b.push_san(mv)
        if b.turn!=me: moves=moves  # line ends after his move or opponent move: fine
        # end on HIS move
        while moves and (len(moves)%2==1)!=(side=='w'): moves.pop()
        opp=[m for i,m in enumerate(path) if (i%2==0)==(side=='b')]
        lab=None
        if op=='london' and len(path)>1 and path[1]=='e5': lab=('Englund (…e5) · '+' '.join('…'+m for m in opp[1:]) if len(opp)>1 else 'Englund (…e5)',)*2
        for m in ([] if lab else opp):
            if m.lstrip('…') in LABEL and not (op=='london' and m=='d5') and not (op!='london' and m in ('e4','d4')): lab=LABEL[m];break
        if not lab:
            pre='' if side=='b' else '…';tail=' '.join(pre+m for m in opp[-2:]);lab=(tail,tail)
        names=[l['name']['es'] for l in lines]
        if 'vs '+lab[0] in names: lab=(lab[0]+' · '+path[-1],lab[1]+' · '+path[-1])
        lines.append({'name':{'es':'vs '+lab[0],'en':'vs '+lab[1]},'moves':moves,'kind':'game','stat':{'n':n,'score':round(score,2)},'notes':notes})
        print(op,lab[0],n,'%.2f'%score,' '.join(moves))
    out[op]=lines
eng.quit()
json.dump(out,open('mylines.json','w'),ensure_ascii=False,indent=0)
