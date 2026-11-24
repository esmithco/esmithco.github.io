"""Nov 24 (his words: "you count a pawn five moves later, a pawn I could take… it depends where I stop"): the count of 'Cuenta el
cambio' is the material at the END OF THE CAPTURES — each option's line is cut at the first move that is not a capture (mate lines are
kept whole). A row is kept only if, for every option, that count matches the full engine line (±1) — otherwise an in-between move
(…Rb7, then …fxe6 later) makes it ambiguous — and the best option still wins >= 2 with an 'only even' one (-1..+1) to compare.
Usage: python trades_cut.py <trades.js>"""
import json, sys, chess
V = {1: 1, 2: 3, 3: 3, 4: 5, 5: 9, 6: 0}
def bal(b, c): return sum((1 if p.color == c else -1) * V[p.piece_type] for p in b.piece_map().values())
p = sys.argv[1]; s = open(p).read(); head = s[:s.index('window.TRADES=')]
rows = json.loads(s[s.index('window.TRADES=') + 14:].rstrip().rstrip(';')); out = []; lens = []
for fen, opts, rating in rows:
    b0 = chess.Board(fen); me = b0.turn; start = bal(b0, me); new = []
    for san, val, line in opts:
        mv = line.split()
        if val >= 99: new.append([san, 99, line]); continue
        b = chess.Board(fen); keep = []
        for m in mv:
            x = b.parse_san(m)
            if keep and not b.is_capture(x): break
            keep.append(m); b.push(x)
        cv = 99 if b.is_checkmate() else bal(b, me) - start
        if abs(cv - val) > 1: new = None; break
        new.append([san, cv, ' '.join(keep)]); lens.append(len(keep))
    if new is None: continue
    new.sort(key=lambda o: -o[1])
    if new[0][1] >= 2 and any(-1 <= o[1] <= 1 for o in new[1:]): out.append([fen, new, rating])
print('rows', len(rows), '-> kept', len(out), '| line length', min(lens), '-', max(lens), 'avg', round(sum(lens) / len(lens), 1))
open(p, 'w').write(head + 'window.TRADES=' + json.dumps(out, separators=(',', ':')) + ';\n')
