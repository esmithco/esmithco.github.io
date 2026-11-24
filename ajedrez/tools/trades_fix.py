"""Nov 24 (his screenshot: 'Cuenta el cambio' said +2, he said +3 — the line ended with the opponent's …gxf4 and he simply recaptures
gxf4): the count must be taken when the trade is OVER. For every option, while the last move of the line is a capture and the engine's
best reply (depth 14) recaptures on that same square, the recapture is appended; the count is the material change at the END of the
(extended) line. Rows whose best option no longer wins >= 2, or with no 'only even' option left, are dropped.
Usage: python trades_fix.py <trades.js>"""
import json, sys, chess, chess.engine
V = {1: 1, 2: 3, 3: 3, 4: 5, 5: 9, 6: 0}
def bal(b, c): return sum((1 if p.color == c else -1) * V[p.piece_type] for p in b.piece_map().values())
p = sys.argv[1]; s = open(p).read(); head = s[:s.index('window.TRADES=')]
rows = json.loads(s[s.index('window.TRADES=') + 14:].rstrip().rstrip(';'))
e = chess.engine.SimpleEngine.popen_uci('/opt/homebrew/bin/stockfish'); e.configure({'Threads': 6, 'Hash': 256})
out = []; changed = 0
for fen, opts, rating in rows:
    b0 = chess.Board(fen); me = b0.turn; start = bal(b0, me); new = []
    for san, val, line in opts:
        b = chess.Board(fen); mv = line.split()
        for m in mv: b.push_san(m)
        if val >= 99 or b.is_checkmate():
            new.append([san, 99 if b.is_checkmate() or val >= 99 else val, ' '.join(mv)]); continue
        for _ in range(4):
            last = b.peek()
            if not b.is_capture(last) and len(b.move_stack) and False: break
            prev = b.copy(); prev.pop()
            if not prev.is_capture(last): break
            if b.is_game_over(): break
            r = e.analyse(b, chess.engine.Limit(depth=14))
            nx = r['pv'][0] if r.get('pv') else None
            if nx is None or not b.is_capture(nx) or nx.to_square != last.to_square: break
            mv.append(b.san(nx)); b.push(nx)
        v = 99 if b.is_checkmate() else bal(b, me) - start
        if v != val: changed += 1
        new.append([san, v, ' '.join(mv)])
    new.sort(key=lambda o: -o[1])
    if new[0][1] >= 2 and any(-1 <= o[1] <= 1 for o in new[1:]): out.append([fen, new, rating])
e.quit()
print('rows', len(rows), '-> kept', len(out), '| options recounted', changed)
open(p, 'w').write(head + 'window.TRADES=' + json.dumps(out, separators=(',', ':')) + ';\n')
