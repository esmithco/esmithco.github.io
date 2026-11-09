# Builds ../curso.js: the "Learn" course (bilingual theory + Lichess puzzles by theme + endgame technique).
# Needs lichess_db_puzzle.csv.zst (database.lichess.org, CC0) in the working directory and python-chess.
# Usage: python curso.py  (from a scratch dir), then copy curso.js into ajedrez/.
import csv, io, json, subprocess, sys, chess, chess.engine

L = []  # lessons
def lesson(unit, id, theme, lo, hi, es, en, body_es, body_en, n=20):
    L.append({'unit': unit, 'id': id, 'theme': theme, 'lo': lo, 'hi': hi, 't': {'es': es, 'en': en},
              'body': {'es': body_es, 'en': body_en}, 'n': n})

lesson('tac', 'hanging', 'hangingPiece', 800, 1300, 'Piezas colgando', 'Hanging pieces',
 ['Una pieza "cuelga" cuando la pueden comer y nadie la defiende (o la defienden menos veces de las que la atacan).',
  'Antes de cada jugada pregúntate: ¿qué piezas del rival están sin defensa? ¿y las mías?',
  'A tu nivel, la mayoría de partidas se deciden por piezas regaladas. Verlas es la habilidad n.º 1.'],
 ['A piece is "hanging" when it can be captured and nobody defends it (or it has fewer defenders than attackers).',
  'Before every move ask: which of my opponent\'s pieces are undefended? And mine?',
  'At your level most games are decided by free pieces. Spotting them is skill #1.'])
lesson('tac', 'mate1', 'mateIn1', 800, 1300, 'Mate en 1', 'Mate in 1',
 ['Revisa SIEMPRE los jaques primero: son las jugadas más forzadas.',
  'Mate = el rey está en jaque, no puede moverse, no se puede tapar ni comer a la pieza que da jaque.',
  'Mira las casillas de escape del rey: ¿quién las controla?'],
 ['ALWAYS check checks first: they are the most forcing moves.',
  'Mate = the king is in check, can\'t move, and the check can\'t be blocked or the checking piece captured.',
  'Look at the king\'s escape squares: who controls them?'])
lesson('tac', 'fork', 'fork', 900, 1400, 'Tenedor (doble ataque)', 'Fork (double attack)',
 ['Una pieza ataca dos piezas a la vez: el rival solo puede salvar una.',
  'Los caballos son los reyes del tenedor; también peones, damas y reyes.',
  'Busca piezas valiosas (rey, dama, torres) a "salto de caballo" una de otra.'],
 ['One piece attacks two at once: your opponent can only save one.',
  'Knights are the kings of forks, but pawns, queens and kings fork too.',
  'Look for valuable pieces (king, queen, rooks) a knight\'s jump apart.'])
lesson('tac', 'pin', 'pin', 900, 1450, 'Clavada', 'Pin',
 ['Una pieza no puede moverse porque detrás hay algo más valioso (o el rey: clavada absoluta).',
  'Ataca la pieza clavada con un peón o una pieza menor: no puede escapar.',
  'Alfiles, torres y damas clavan en líneas rectas o diagonales.'],
 ['A piece can\'t move because something more valuable sits behind it (the king: absolute pin).',
  'Attack the pinned piece with a pawn or minor piece: it can\'t run away.',
  'Bishops, rooks and queens pin along lines and diagonals.'])
lesson('tac', 'skewer', 'skewer', 950, 1500, 'Ensartada (rayos X)', 'Skewer',
 ['Como la clavada pero al revés: la pieza valiosa está delante, se mueve y comes la de atrás.',
  'Típico: jaque al rey en línea y ganas la dama o la torre que estaba detrás.',
  'Muy común en finales de torres y con damas.'],
 ['Like a pin in reverse: the valuable piece is in front, it moves, and you take the one behind.',
  'Typical: check the king along a line and win the queen or rook behind it.',
  'Very common in rook and queen endings.'])
lesson('tac', 'discovered', 'discoveredAttack', 1000, 1500, 'Ataque a la descubierta', 'Discovered attack',
 ['Mueves una pieza y "descubres" el ataque de otra que estaba detrás.',
  'La pieza que se mueve puede amenazar otra cosa: dos amenazas en una jugada.',
  'Si lo descubierto es un jaque, la pieza que se mueve puede ir a donde quiera.'],
 ['You move one piece and "uncover" an attack by the piece behind it.',
  'The moving piece can threaten something else: two threats in one move.',
  'If the uncovered attack is a check, the moving piece can go anywhere.'])
lesson('tac', 'backrank', 'backRankMate', 900, 1450, 'Mate del pasillo', 'Back-rank mate',
 ['El rey enrocado con sus peones delante no tiene salida: una torre o dama en la última fila da mate.',
  'Defensa: haz "luft" (h3/h6) cuando tengas tiempo.',
  'Ataque: busca sobrecargar o desviar a la pieza que defiende la última fila.'],
 ['A castled king behind its pawns has no escape: a rook or queen on the back rank mates.',
  'Defense: make "luft" (h3/h6) when you have time.',
  'Attack: overload or deflect the piece guarding the back rank.'])
lesson('tac', 'defender', 'capturingDefender', 1050, 1550, 'Elimina al defensor', 'Remove the defender',
 ['Si una pieza está defendida por una sola pieza, cambia o come a ese defensor primero.',
  'Después, lo que defendía queda colgando.',
  'Pregunta: "¿quién defiende esto? ¿puedo quitarlo?"'],
 ['If a piece is defended by just one piece, trade or capture that defender first.',
  'Then whatever it defended is left hanging.',
  'Ask: "who defends this? can I remove it?"'])
lesson('tac', 'trapped', 'trappedPiece', 1050, 1550, 'Pieza atrapada', 'Trapped piece',
 ['Una pieza sin casillas seguras se puede atacar y ganar.',
  'Alfiles y caballos en el borde (o damas que comen peones lejanos) se quedan sin salida.',
  'Antes de ir a por material, mira cómo vuelve tu pieza.'],
 ['A piece with no safe squares can be attacked and won.',
  'Bishops and knights on the edge (or queens grabbing far pawns) run out of squares.',
  'Before grabbing material, check how your piece gets back.'])
lesson('comb', 'mate2', 'mateIn2', 1000, 1600, 'Mate en 2', 'Mate in 2',
 ['Primero una jugada forzada (jaque, sacrificio o amenaza) y luego el mate.',
  'Calcula: "si juego esto, ¿qué puede hacer él?" Revisa TODAS sus respuestas.',
  'Los sacrificios de dama aparecen mucho: lo que importa es el mate, no el material.'],
 ['First a forcing move (check, sacrifice or threat), then mate.',
  'Calculate: "if I play this, what can he do?" Check ALL replies.',
  'Queen sacrifices show up a lot: mate matters, not material.'])
lesson('comb', 'deflection', 'deflection', 1100, 1650, 'Desviación', 'Deflection',
 ['Obligas a una pieza defensora a irse de su puesto (con un jaque o una captura).',
  'En cuanto se va, lo que defendía cae.',
  'Muy ligado al mate del pasillo y a las piezas sobrecargadas.'],
 ['You force a defending piece away from its post (with a check or a capture).',
  'Once it leaves, what it defended falls.',
  'Closely linked to back-rank mates and overloaded pieces.'])
lesson('comb', 'attraction', 'attraction', 1100, 1650, 'Atracción', 'Attraction',
 ['Sacrificas para atraer una pieza (a menudo el rey) a una casilla mala.',
  'Ahí la atacas con un tenedor, una clavada o un mate.',
  'Ejemplo típico: sacrificio en f7 para traer al rey y dar jaque doble.'],
 ['You sacrifice to lure a piece (often the king) onto a bad square.',
  'Then you hit it with a fork, a pin or mate.',
  'Typical example: sacrifice on f7 to drag the king out.'])
lesson('comb', 'doublecheck', 'doubleCheck', 1100, 1650, 'Jaque doble', 'Double check',
 ['Dos piezas dan jaque a la vez (normalmente con una descubierta).',
  'No se puede tapar ni comer: el rey TIENE que moverse.',
  'Es el arma más poderosa para cazar al rey.'],
 ['Two pieces give check at once (usually via a discovered check).',
  'It can\'t be blocked or captured: the king MUST move.',
  'The most powerful weapon for hunting the king.'])
lesson('comb', 'intermezzo', 'intermezzo', 1150, 1700, 'Jugada intermedia', 'In-between move',
 ['Antes de recapturar "lo obvio", busca un jaque o amenaza más fuerte.',
  'El rival tiene que responder, y luego recapturas igual pero con ventaja.',
  'También defiéndete: tu rival puede hacerte lo mismo.'],
 ['Before the "obvious" recapture, look for a stronger check or threat.',
  'Your opponent must answer, then you recapture anyway but better off.',
  'Watch out: your opponent can do it to you too.'])
lesson('comb', 'promotion', 'advancedPawn', 1050, 1600, 'Peones que coronan', 'Pawns that promote',
 ['Un peón en 6.ª o 7.ª fila vale casi una pieza: el rival tiene que pararlo.',
  'Sacrificar para abrir paso a un peón suele ganar.',
  'Las torres van DETRÁS de los peones pasados (propios o del rival).'],
 ['A pawn on the 6th or 7th rank is worth almost a piece: it must be stopped.',
  'Sacrificing to clear a pawn\'s path often wins.',
  'Rooks belong BEHIND passed pawns (yours or the opponent\'s).'])
lesson('mates', 'smothered', 'smotheredMate', 1000, 1700, 'Mate de la coz', 'Smothered mate',
 ['Un caballo da mate a un rey rodeado por sus propias piezas.',
  'Patrón clásico: dama da jaque en g8, la torre la come y Nf7#.',
  'Lo viste en tu Caro-Kann: Nd6# con la dama en e2.'],
 ['A knight mates a king boxed in by its own pieces.',
  'Classic pattern: queen check on g8, rook takes, Nf7#.',
  'You saw it in your Caro-Kann: Nd6# with the queen on e2.'], n=12)
lesson('mates', 'arabian', 'arabianMate', 1000, 1700, 'Mate árabe', 'Arabian mate',
 ['Torre y caballo contra el rey en la esquina.',
  'El caballo protege a la torre y controla la casilla de escape.',
  'Busca el rey en h8/a8 con una torre en la 7.ª fila.'],
 ['Rook and knight against a king in the corner.',
  'The knight protects the rook and covers the escape square.',
  'Look for a king on h8/a8 with a rook on the 7th rank.'], n=12)
lesson('mates', 'anastasia', 'anastasiaMate', 1000, 1750, 'Mate de Anastasia', 'Anastasia\'s mate',
 ['Caballo en e7 (o e2) quita casillas y la torre o dama da mate en la columna h.',
  'El rey queda encerrado por su propio peón de g7.',
  'Suele empezar con un sacrificio en h7.'],
 ['A knight on e7 takes squares and a rook or queen mates on the h-file.',
  'The king is trapped by its own g7 pawn.',
  'It often starts with a sacrifice on h7.'], n=12)
lesson('mates', 'mate3', 'mateIn3', 1200, 1800, 'Mate en 3', 'Mate in 3',
 ['Jugadas forzadas una tras otra: jaque, jaque… mate.',
  'Si el rival tiene una sola respuesta, calcular 3 jugadas es fácil.',
  'Practica visualizar sin mover las piezas.'],
 ['Forcing moves one after another: check, check… mate.',
  'If your opponent has only one reply, calculating 3 moves is easy.',
  'Practice visualizing without moving the pieces.'], n=12)
lesson('end', 'pawnend', 'pawnEndgame', 900, 1600, 'Finales de peones', 'Pawn endgames',
 ['Rey activo: en el final el rey ataca y apoya peones.',
  'Oposición: los reyes frente a frente con una casilla en medio; el que NO tiene que mover gana la pelea.',
  'Regla del cuadrado: ¿alcanza tu rey al peón pasado? Dibuja el cuadrado hasta la coronación.'],
 ['Active king: in the endgame the king attacks and supports pawns.',
  'Opposition: kings face to face with one square between; the side NOT to move wins the standoff.',
  'Rule of the square: can your king catch the passed pawn? Draw the square to the queening square.'])
lesson('end', 'rookend', 'rookEndgame', 1000, 1650, 'Finales de torres', 'Rook endgames',
 ['Son los finales más comunes. Torre activa > peón de más.',
  'Torres detrás de los peones pasados. Corta al rey rival con tu torre.',
  'Posiciones clave: Lucena (para ganar) y Philidor (para hacer tablas).'],
 ['The most common endgames. An active rook beats an extra pawn.',
  'Rooks behind passed pawns. Cut off the enemy king with your rook.',
  'Key positions: Lucena (to win) and Philidor (to draw).'])

# technique: play it out against Stockfish
TECH = [
 {'id': 'kq', 'fen': '8/8/8/4k3/8/8/8/4K2Q w - - 0 1', 'goal': 'mate', 'limit': 20,
  't': {'es': 'Mate con dama y rey', 'en': 'Mate with king and queen'},
  'body': {'es': ['Usa la dama a "salto de caballo" del rey rival para encerrarlo en una caja cada vez más pequeña.',
                  'Cuando esté en el borde, trae tu rey y da mate.', '¡Cuidado con el ahogado: deja siempre una casilla al rey rival!'],
           'en': ['Keep the queen a "knight\'s jump" from the enemy king to shrink its box.',
                  'Once it\'s on the edge, bring your king and mate.', 'Beware of stalemate: always leave the enemy king a square!']}},
 {'id': 'kr', 'fen': '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', 'goal': 'mate', 'limit': 30,
  't': {'es': 'Mate con torre y rey', 'en': 'Mate with king and rook'},
  'body': {'es': ['La torre corta al rey rival en una fila o columna.', 'Tu rey se acerca en oposición; la torre da jaque y el rival retrocede.',
                  'Si el rey rival ataca a tu torre, aléjala al otro lado del tablero.'],
           'en': ['The rook cuts off the enemy king along a rank or file.', 'Your king approaches in opposition; the rook checks and the king steps back.',
                  'If the enemy king attacks your rook, move it to the far side of the board.']}},
 {'id': 'kpwin', 'fen': '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', 'goal': 'promote', 'limit': 15,
  't': {'es': 'Rey y peón: coronar', 'en': 'King and pawn: promote'},
  'body': {'es': ['Rey DELANTE del peón, no detrás.', 'Gana la oposición y empuja el peón solo cuando tu rey controla las casillas de delante.',
                  'Con el rey en 6.ª delante del peón, se gana siempre (salvo peón de torre).'],
           'en': ['King IN FRONT of the pawn, not behind.', 'Win the opposition and push the pawn only when your king controls the squares ahead.',
                  'With your king on the 6th rank in front of the pawn it\'s always a win (except rook pawns).']}},
 {'id': 'kpdraw', 'fen': '8/8/8/4k3/8/8/4P3/4K3 b - - 0 1', 'goal': 'hold', 'limit': 20,
  't': {'es': 'Rey contra peón: hacer tablas', 'en': 'King vs pawn: hold the draw'},
  'body': {'es': ['Ponte delante del peón y toma la oposición.', 'Cuando el peón avanza, retrocede en línea recta frente a él.',
                  'Si te empujan a la última fila delante del peón con oposición, es tablas.'],
           'en': ['Get in front of the pawn and take the opposition.', 'When the pawn advances, step straight back in front of it.',
                  'If you end on the back rank in front of the pawn with the opposition, it\'s a draw.']}},
 {'id': 'lucena', 'fen': '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', 'goal': 'promote', 'limit': 15,
  't': {'es': 'Lucena: construye el puente', 'en': 'Lucena: build a bridge'},
  'body': {'es': ['Primero corta al rey rival con jaque de torre (Rd1+).', 'Lleva la torre a la 4.ª fila (Rd4): será el "puente" que tapará los jaques.',
                  'Sal con el rey y cuando te den jaque, tapa con la torre.'],
           'en': ['First cut off the enemy king with a rook check (Rd1+).', 'Put the rook on the 4th rank (Rd4): it becomes the "bridge" that blocks checks.',
                  'Walk your king out, and when checked, block with the rook.']}},
 {'id': 'philidor', 'fen': '3k4/R7/8/3KP3/8/8/8/6r1 b - - 0 1', 'goal': 'hold', 'limit': 20,
  't': {'es': 'Philidor: defensa de tablas', 'en': 'Philidor: drawing defense'},
  'body': {'es': ['Torre a tu 3.ª fila (…Rg6) para que el rey rival no avance.', 'Cuando el peón llega a la 6.ª, la torre se va atrás del todo y da jaques desde lejos.',
                  'El rey rival ya no tiene dónde esconderse: tablas.'],
           'en': ['Rook to your 3rd rank (…Rg6) so the enemy king can\'t advance.', 'When the pawn reaches the 6th, the rook goes all the way back and checks from behind.',
                  'The enemy king has nowhere to hide: draw.']}},
]

UNITS = [
 {'id': 'tac', 't': {'es': 'Tácticas básicas', 'en': 'Basic tactics'}},
 {'id': 'comb', 't': {'es': 'Combinaciones', 'en': 'Combinations'}},
 {'id': 'mates', 't': {'es': 'Patrones de mate', 'en': 'Mating patterns'}},
 {'id': 'end', 't': {'es': 'Finales', 'en': 'Endgames'}},
]

def select():
    want = {l['theme']: l for l in L}
    pool = {t: [] for t in want}
    p = subprocess.Popen(['zstd', '-dc', 'lichess_db_puzzle.csv.zst'], stdout=subprocess.PIPE)
    rd = csv.reader(io.TextIOWrapper(p.stdout, encoding='utf-8'))
    next(rd)
    for row in rd:
        pid, fen, moves, rating, rd_, pop, plays, themes = row[:8]
        rating, rd_, pop, plays = int(rating), int(rd_), int(pop), int(plays)
        if rd_ > 85 or pop < 88 or plays < 800: continue
        th = themes.split()
        mv = moves.split()
        if len(mv) > 8: continue
        for t in th:
            if t in want and want[t]['lo'] <= rating <= want[t]['hi'] and len(pool[t]) < 4000:
                pool[t].append((rating, pid, fen, mv, th))
    p.kill()
    out = {}
    for t, l in want.items():
        ps = sorted(pool[t])
        n = l['n']
        if not ps: print('NO PUZZLES', t); continue
        step = max(1, len(ps) // n)
        pick = [ps[i] for i in range(0, len(ps), step)][:n]
        res = []
        for rating, pid, fen, mv, th in pick:
            b = chess.Board(fen); san = []
            for u in mv:
                m = chess.Move.from_uci(u); san.append(b.san(m)); b.push(m)
            res.append({'id': pid, 'fen': fen, 'm': san, 'r': rating})
        out[l['id']] = res
        print(l['id'], t, len(pool[t]), 'pool ->', len(res), 'ratings', res[0]['r'], '-', res[-1]['r'])
    return out

def check_tech():
    e = chess.engine.SimpleEngine.popen_uci('/opt/homebrew/bin/stockfish')
    for x in TECH:
        b = chess.Board(x['fen'])
        s = e.analyse(b, chess.engine.Limit(depth=24))['score'].pov(chess.WHITE)
        print('TECH', x['id'], x['goal'], s)
    e.quit()

if __name__ == '__main__':
    check_tech()
    P = select()
    for l in L: l['p'] = P.get(l['id'], [])
    data = {'units': UNITS, 'lessons': L, 'tech': TECH}
    open('curso.js', 'w').write('/* Generated by tools/curso.py. Puzzles: Lichess puzzle database (CC0). */\nwindow.CURSO=' +
                                json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('size', len(open('curso.js').read()) // 1024, 'KB')
