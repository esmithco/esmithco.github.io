import chess
V={1:1,2:3,3:3,4:5,5:9,6:0}
def bal(b,col):
    return sum((1 if p.color==col else -1)*V[p.piece_type] for p in b.piece_map().values())
def fork(b,sq,victim):
    # pieces of `victim` (value>=3 or king) attacked by the piece now on sq
    n=0
    for t in b.attacks(sq):
        p=b.piece_at(t)
        if p and p.color==victim and (p.piece_type==chess.KING or V[p.piece_type]>=3): n+=1
    return n>=2
def punished(b,moves,col,n=3):
    """does the line show, within n plies, that `col` loses (material >=2, mate, or a fork by the opponent)?"""
    b=b.copy();b0=bal(b,col)
    for i,m in enumerate(moves[:n]):
        try: mv=b.push_san(m)
        except Exception: break
        if b.is_checkmate(): return b.turn==col
        if b.turn==col and fork(b,mv.to_square,col): return True
    return bal(b,col)-b0<=-2
def wins(b,moves,col,n=3):
    b=b.copy();b0=bal(b,col)
    for m in moves[:n]:
        try: mv=b.push_san(m)
        except Exception: break
        if b.is_checkmate(): return b.turn!=col
        if b.turn!=col and fork(b,mv.to_square,b.turn): return True
    return bal(b,col)-b0>=2
def vis_mine(board_before,played,pv_bad,pv_best):
    col=board_before.turn;b1=board_before.copy();b1.push_san(played)
    lost=bal(b1,col)-bal(board_before,col)  # my own capture counts
    b1c=b1.copy();b0=bal(board_before,col)
    if punished(b1,pv_bad or [],col) : return 'lose'
    # material lost overall within 3 plies counting my move
    bb=b1.copy()
    for m in (pv_bad or [])[:3]:
        try: bb.push_san(m)
        except Exception: break
    if bal(bb,col)-b0<=-2: return 'lose'
    if wins(board_before,pv_best or [],col): return 'win'
    return 'deep'
def vis_punish(board_after_opp,pv_best):
    col=board_after_opp.turn
    return 'win' if wins(board_after_opp,pv_best or [],col) else 'deep'
