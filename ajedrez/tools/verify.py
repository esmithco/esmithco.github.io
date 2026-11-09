import chess,chess.engine,sys,math
def wp(cp):
    cp=max(-1000,min(1000,cp)); return 50+50*(2/(1+math.exp(-0.00368208*cp))-1)
e=chess.engine.SimpleEngine.popen_uci('/opt/homebrew/bin/stockfish');e.configure({'Threads':1})
for line in sys.argv[1:]:
    mv=line.split();side=mv[0][0]  # first token 'w:' or 'b:'
    side=mv[0];mv=mv[1:];b=chess.Board();out=[]
    for i,s in enumerate(mv):
        m=b.parse_san(s)
        ours=(i%2==0)==(side=='w')
        if ours:
            info=e.analyse(b,chess.engine.Limit(depth=18),multipv=3)
            best=info[0]['score'].pov(b.turn).score(mate_score=10000)
            b2=b.copy();b2.push(m)
            a=e.analyse(b2,chess.engine.Limit(depth=18))['score'].pov(b.turn).score(mate_score=10000)
            tops=[b.san(x['pv'][0])+'('+str(x['score'].pov(b.turn).score(mate_score=10000))+')' for x in info]
            flag='!!' if wp(best)-wp(a)>=6 else ''
            out.append(f"{i}:{s} {a} best {' '.join(tops)} {flag}")
        b.push(m)
    print(' '.join(mv[:4]),'...');print('   '+'\n   '.join(out))
