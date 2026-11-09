# Curated repertoire: London (White), Caro-Kann and Slav (Black).
# Each line: name, moves (SAN from the start), notes {ply: (es, en)}.
# A note on ply i explains move i (0-based): why we play it, or what the opponent's move wants.
import json, chess, sys

R = {
 'london': {'side': 'w', 'name': ('Sistema Londres', 'London System'), 'lines': [
  {'name': ('Clásica: …Nf6, …e6, …Bd6', 'Classical: …Nf6, …e6, …Bd6'),
   'moves': 'd4 d5 Bf4 Nf6 e3 e6 Nf3 Bd6 Bg3 O-O Bd3 c5 c3 Nc6 Nbd2'.split(),
   'notes': {
    2: ('Saca el alfil ANTES de e3. Si juegas e3 primero, el alfil queda encerrado detrás de tus peones.',
        'Develop the bishop BEFORE e3. If you play e3 first, the bishop gets locked behind your own pawns.'),
    4: ('e3 sostiene el peón de d4 y abre camino al otro alfil.',
        'e3 supports the d4 pawn and opens a path for your other bishop.'),
    7: ('…Bd6 quiere cambiar tu mejor pieza: el alfil de f4.',
        '…Bd6 wants to trade off your best piece, the f4 bishop.'),
    8: ('Bg3 conserva el alfil. Si te lo cambian (…Bxg3 hxg3), tu torre de h1 gana la columna h abierta.',
        'Bg3 keeps the bishop. If they trade (…Bxg3 hxg3), your h1 rook gets the open h-file.'),
    10: ('Bd3 apunta al enroque negro (h7) y prepara tu enroque.',
         'Bd3 aims at the black king side (h7) and gets you ready to castle.'),
    12: ('c3 forma la "pirámide" (c3-d4-e3): d4 queda muy sólido aunque las negras lo ataquen con …c5 y …Nc6.',
         'c3 builds the pyramid (c3-d4-e3): d4 stays solid even when Black hits it with …c5 and …Nc6.'),
    14: ('El caballo va a d2 (no a c3, porque ahí está tu peón). Desde d2 controla e4 y puede ir a f3 o e5.',
         'The knight goes to d2 (not c3, your pawn is there). From d2 it controls e4 and can reroute.'),
   }},
  {'name': ('…c5 y …Qb6: el ataque a b2', '…c5 and …Qb6: the attack on b2'),
   'moves': 'd4 d5 Bf4 c5 e3 Nc6 c3 Qb6 Qb3 c4 Qc2'.split(),
   'notes': {
    3: ('…c5 ataca d4 de inmediato.', '…c5 hits d4 right away.'),
    6: ('c3 refuerza d4. Ahora tu alfil de f4 ya no defiende b2: ojo con …Qb6.',
        'c3 reinforces d4. Your bishop left c1, so b2 is undefended: watch out for …Qb6.'),
    7: ('…Qb6 ataca b2 (y presiona d4). Es LA idea típica contra el Londres.',
        '…Qb6 attacks b2 (and pressures d4). It is THE typical idea against the London.'),
    8: ('Qb3 defiende b2 y ofrece cambiar damas. Si …Qxb3 axb3, tu torre de a1 queda activa en la columna a.',
        'Qb3 defends b2 and offers a queen trade. After …Qxb3 axb3 your a1 rook becomes active on the a-file.'),
    9: ('…c4 echa a tu dama, pero suelta la presión sobre d4. Más adelante tu plan es e4.',
        '…c4 kicks your queen but releases the pressure on d4. Later your plan is e4.'),
    10: ('Qc2 vigila e4 y sigue cuidando la casilla b2 desde lejos (la dama controla la segunda fila).',
         'Qc2 eyes e4 and keeps an eye on the second rank, so b2 stays covered.'),
   }},
  {'name': ('…Bf5 simétrica: castiga b7', 'Symmetrical …Bf5: hit b7'),
   'moves': 'd4 d5 Bf4 Bf5 e3 e6 c4 Nf6 Nc3 c6 Qb3 Qb6 c5'.split(),
   'notes': {
    3: ('…Bf5 copia tu idea. Pero su alfil salió del flanco de dama y b7 quedó débil.',
        '…Bf5 copies your idea. But that bishop left the queenside, so b7 is now weak.'),
    6: ('c4 abre la diagonal para Qb3 apuntando a b7.', 'c4 opens the way for Qb3 aiming at b7.'),
    10: ('Qb3 ataca b7. Las negras tienen que gastar tiempo defendiéndolo.',
         'Qb3 attacks b7. Black has to spend time defending it.'),
    12: ('c5 gana espacio. Si …Qxb3 axb3, tu torre a1 y los peones b3/c5 dominan el flanco de dama.',
         'c5 grabs space. After …Qxb3 axb3, your a1 rook and the b3/c5 pawns dominate the queenside.'),
   }},
  {'name': ('…Nc6 y …Nb4: cuida c2', '…Nc6 and …Nb4: guard c2'),
   'moves': 'd4 d5 Bf4 Nc6 e3 Nb4 a3'.split(),
   'notes': {
    5: ('…Nb4 apunta a c2. Ahora tu dama lo defiende, pero si las negras suman …Bf5, …Nxc2+ será un tenedor al rey y la torre.',
        '…Nb4 aims at c2. Your queen covers it for now, but after …Bf5 the fork …Nxc2+ (king and rook) becomes real.'),
    6: ('a3 echa al caballo antes de que se junte con el alfil. Perdió dos tiempos para nada.',
        'a3 kicks the knight before it teams up with the bishop. Black wasted two moves.'),
   }},
  {'name': ('Contra el fianchetto (…g6, …Bg7)', 'Against the fianchetto (…g6, …Bg7)'),
   'moves': 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3'.split(),
   'notes': {
    8: ('Contra …g6 el alfil va a e2 (no a d3): ahí no choca con …e5 ni con un peón en d6.',
        'Against …g6 the bishop goes to e2 (not d3): it does not run into …e5 or the d6 pawn.'),
    10: ('h3 le da al alfil de f4 una casilla de escape (h2) y evita …Nh5 o …Bg4 molestos.',
         'h3 gives your f4 bishop an escape square (h2) and stops annoying …Nh5 or …Bg4.'),
   }},
  {'name': ('Englund (1…e5): no juegues Bf4 en automático', 'Englund (1…e5): don\'t autopilot Bf4'),
   'moves': 'd4 e5 dxe5 Nc6 Nf3 Qe7 Nc3 Nxe5 e4'.split(),
   'notes': {
    1: ('1…e5 es el Gambito Englund: regala un peón para tender trampas.',
        '1…e5 is the Englund Gambit: Black gives a pawn to set traps.'),
    5: ('…Qe7 presiona e5 y prepara …Qb4+.', '…Qe7 hits e5 and prepares …Qb4+.'),
    6: ('Nc3: desarrolla y cubre b5/d5, lo más simple. 4.Bf4 también sirve, PERO hay que saber la trampa: 4…Qb4+ 5.Bd2 Qxb2 6.Bc3 Bb4 7.Qd2 Bxc3 y ahora 8.Nxc3! (8.Qxc3?? Qc1# mate).',
        'Nc3: develops and covers b5/d5, the simplest. 4.Bf4 also works, BUT you must know the trap: 4…Qb4+ 5.Bd2 Qxb2 6.Bc3 Bb4 7.Qd2 Bxc3 and now 8.Nxc3! (8.Qxc3?? Qc1# mate).'),
    8: ('e4: centro grande y desarrollo rápido. Ya le devolviste el peón pero tienes mejor juego.',
        'e4: big center and quick development. You gave the pawn back but you are better.'),
   }},
  {'kind': 'punish', 'name': ('Castiga …Qxb2: la dama se fue lejos', 'Punish …Qxb2: the queen went too far'),
   'moves': 'd4 d5 Bf4 c5 e3 Qb6 Nc3 Qxb2 Nxd5'.split(),
   'notes': {
    6: ('Nc3 deja b2 "regalado" a propósito: si lo come, la dama queda lejos de su rey.',
        'Nc3 leaves b2 hanging on purpose: if Black grabs it, the queen is far from home.'),
    7: ('…Qxb2? come un peón pero se queda sin defensores. Ahora d5 ya no está protegido.',
        '…Qxb2? grabs a pawn but leaves Black without defenders. Now d5 is no longer protected.'),
    8: ('Nxd5! come gratis y amenaza Nc7+, tenedor al rey y la torre de a8. Además Rb1 puede cazar a la dama.',
        'Nxd5! wins a pawn for free and threatens Nc7+, forking the king and the a8 rook. Rb1 can also hunt the queen.'),
   }},
  {'kind': 'trap', 'name': ('…Nh5 contra tu alfil: no juegues g4', '…Nh5 hits your bishop: don\'t play g4'),
   'moves': 'd4 d5 Bf4 Nf6 e3 g6 Nf3 Bg7 Bd3 Nh5 Be5'.split(),
   'notes': {
    9: ('…Nh5 ataca tu alfil de f4. En tus partidas jugaste g4? para echarlo y te abriste el rey.',
        '…Nh5 attacks your f4 bishop. In your games you played g4? to kick it and wrecked your own king.'),
    10: ('Be5 aparta el alfil a una casilla fuerte y cambia el alfil de g7 si quieren. Sin debilitar tu rey.',
         'Be5 moves the bishop to a strong square and offers to trade the g7 bishop, without weakening your king.'),
   }},
 ]},
 'caro': {'side': 'b', 'name': ('Caro-Kann', 'Caro-Kann'), 'lines': [
  {'name': ('2.Nf3 y cambio: 2…d5 3.exd5', '2.Nf3 then exchange'),
   'moves': 'e4 c6 Nf3 d5 exd5 cxd5 d4 Nc6 c3 Nf6 Bf4 Bg4'.split(),
   'notes': {
    1: ('…c6 prepara …d5 con apoyo: así no pierdes tiempo con la dama como en la escandinava.',
        '…c6 prepares a supported …d5, so your queen doesn\'t get chased like in the Scandinavian.'),
    3: ('…d5 ataca e4 de inmediato.', '…d5 attacks e4 right away.'),
    5: ('Recaptura con el peón c: te queda un peón central fuerte en d5.',
        'Recapture with the c-pawn: you keep a strong central pawn on d5.'),
    7: ('…Nc6 presiona d4.', '…Nc6 puts pressure on d4.'),
    11: ('…Bg4 clava el caballo de f3, que defiende d4. Tu alfil sale ANTES de …e6.',
         '…Bg4 pins the f3 knight, which defends d4. Your bishop comes out BEFORE …e6.'),
   }},
  {'name': ('2.Nf3 y 3.e5 (avance)', '2.Nf3 and 3.e5 (advance)'),
   'moves': 'e4 c6 Nf3 d5 e5 Bg4 h3 Bxf3 Qxf3 e6 d4 c5'.split(),
   'notes': {
    4: ('e5 gana espacio y cierra el centro.', 'e5 grabs space and closes the center.'),
    5: ('…Bg4 saca el alfil fuera de la cadena e6-d5 antes de jugar …e6.',
        '…Bg4 gets the bishop outside the e6-d5 chain before you play …e6.'),
    7: ('Cambiar alfil por caballo está bien aquí: tu alfil "malo" era el de casillas claras… pero este ya salió, así que lo cambias tranquilo.',
        'Giving bishop for knight is fine here: you keep a solid structure and gain time.'),
    11: ('…c5 golpea la base de la cadena blanca (d4). Es el plan clave en los avances.',
         '…c5 hits the base of White\'s pawn chain (d4). It\'s the key plan in advance structures.'),
   }},
  {'name': ('Variante del cambio (3.exd5 + Bd3)', 'Exchange Variation (3.exd5 + Bd3)'),
   'moves': 'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4 Qb3 Qd7'.split(),
   'notes': {
    7: ('…Nc6 presiona d4 y prepara …Bg4.', '…Nc6 pressures d4 and prepares …Bg4.'),
    11: ('…Bg4 saca el alfil activo. Pero deja b7 sin defensa: espera Qb3.',
         '…Bg4 activates the bishop. It leaves b7 undefended though: expect Qb3.'),
    12: ('Qb3 ataca b7 y d5 al mismo tiempo.', 'Qb3 hits b7 and d5 at the same time.'),
    13: ('…Qd7 defiende b7 y conecta. NO juegues …Qb6?? si pierde material; …Qd7 es lo normal.',
         '…Qd7 defends b7 and stays solid. This is the standard answer.'),
   }},
  {'name': ('Panov (4.c4)', 'Panov Attack (4.c4)'),
   'moves': 'e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Be7'.split(),
   'notes': {
    6: ('c4 ataca d5: juego más abierto.', 'c4 attacks d5: a more open game.'),
    7: ('…Nf6 defiende d5 y desarrolla.', '…Nf6 defends d5 and develops.'),
    9: ('…e6 sostiene d5 con peón. Juego sólido: tú atacarás el peón aislado de d4 después.',
        '…e6 supports d5 with a pawn. Solid: later you target White\'s isolated d4 pawn.'),
    11: ('…Be7 y luego enroque corto. Desarrolla antes de buscar peones.',
         '…Be7 then castle. Develop before grabbing anything.'),
   }},
  {'name': ('Avance (3.e5 Bf5)', 'Advance (3.e5 Bf5)'),
   'moves': 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5'.split(),
   'notes': {
    5: ('…Bf5 FUERA de la cadena antes de …e6. Si juegas …e6 primero, el alfil queda encerrado.',
        '…Bf5 OUTSIDE the chain before …e6. If you play …e6 first, the bishop gets locked in.'),
    7: ('…e6 completa la estructura. Ojo: si el alfil blanco va a g5, …e6 abre la diagonal hacia tu dama (d8).',
        '…e6 completes the structure. Careful: if a white bishop is on g5, …e6 opens the diagonal to your queen on d8.'),
    9: ('…c5 ataca la base de la cadena (d4). Plan típico: …Nc6, …Qb6 y presión sobre d4.',
        '…c5 hits the base of the chain (d4). Typical plan: …Nc6, …Qb6 and pressure on d4.'),
   }},
  {'name': ('Avance con Bd3: cambia alfiles', 'Advance with Bd3: trade bishops'),
   'moves': 'e4 c6 d4 d5 e5 Bf5 Bd3 Bxd3 Qxd3 e6 Nf3 c5'.split(),
   'notes': {
    6: ('Bd3 ofrece cambiar alfiles.', 'Bd3 offers a bishop trade.'),
    7: ('Cambia con gusto: en la Caro-Kann tu alfil de casillas claras es el que suele quedar malo.',
        'Trade happily: in the Caro-Kann your light-squared bishop is usually your problem piece.'),
    11: ('…c5 ataca la base de la cadena (d4) ya. Después …Nc6 y …Qb6 suman presión sobre d4 y b2.',
         '…c5 hits the base of the chain (d4) right away. Then …Nc6 and …Qb6 pile up on d4 and b2.'),
   }},
  {'name': ('Clásica (3.Nc3 dxe4 4.Nxe4 Bf5)', 'Classical (3.Nc3 dxe4 4.Nxe4 Bf5)'),
   'moves': 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7'.split(),
   'notes': {
    7: ('…Bf5 desarrolla con tempo atacando al caballo de e4.', '…Bf5 develops with tempo, hitting the e4 knight.'),
    9: ('El alfil se retira a g6 y sigue activo.', 'The bishop drops to g6 and stays active.'),
    10: ('h4 amenaza h5 para atrapar tu alfil.', 'h4 threatens h5 to trap your bishop.'),
    11: ('…h6 le da al alfil la casilla h7. Si te olvidas, h5 lo deja sin casillas.',
         '…h6 gives the bishop h7. If you forget, h5 leaves it with no squares.'),
    13: ('…Nd7 controla e5 y prepara …Ngf6 sin que te doblen peones.',
         '…Nd7 controls e5 and prepares …Ngf6 without allowing doubled pawns.'),
   }},
  {'name': ('Fantasía (3.f3)', 'Fantasy (3.f3)'),
   'moves': 'e4 c6 d4 d5 f3 dxe4 fxe4 e5 Nf3 exd4'.split(),
   'notes': {
    4: ('f3 sostiene e4 pero debilita el rey blanco (diagonal g1-a7 y la casilla e3).',
        'f3 holds e4 but weakens White\'s king (the g1-a7 diagonal and e3).'),
    7: ('…e5! golpea el centro ya. Lo que perdiste antes fue …Bg4?: no ataca nada y te quedas atrás en desarrollo.',
        '…e5! hits the center now. The move that cost you before was …Bg4?: it attacks nothing and you fall behind.'),
    9: ('…exd4 gana un peón central. Después desarrolla rápido (…Bc5/…Nf6) y aprovecha el rey blanco débil.',
        '…exd4 wins a central pawn. Then develop fast (…Bc5/…Nf6) and use White\'s weak king.'),
   }},
  {'name': ('2.Bc4', '2.Bc4'),
   'moves': 'e4 c6 Bc4 d5 exd5 cxd5 Bb5+ Bd7 Bxd7+ Qxd7'.split(),
   'notes': {
    3: ('…d5 golpea al alfil y al peón a la vez: gana tiempo.', '…d5 hits the bishop and the pawn at once: you gain time.'),
    7: ('…Bd7 tapa el jaque y ofrece cambiar alfiles.', '…Bd7 blocks the check and offers a trade.'),
    9: ('Ya tienes el centro (d5) y desarrollo cómodo.', 'You now own the center (d5) and develop easily.'),
   }},
  {'kind': 'trap', 'name': ('Avance con Bg5: ¡no juegues …e6!', 'Advance with Bg5: don\'t play …e6!'),
   'moves': 'e4 c6 d4 d5 e5 Bf5 Bg5 Qb6'.split(),
   'notes': {
    6: ('Bg5 es una trampa: si juegas …e6?? se abre la diagonal g5-d8 y Bxd8 te gana la dama. Te pasó en tus partidas.',
        'Bg5 is a trap: if you play …e6?? the g5-d8 diagonal opens and Bxd8 wins your queen. It happened in your games.'),
    7: ('…Qb6! saca la dama de la diagonal y ataca b2 (el alfil de c1 ya no lo defiende) y d4.',
        '…Qb6! gets the queen off the diagonal and hits b2 (the c1 bishop no longer guards it) and d4.'),
   }},
 ]},
 'slav': {'side': 'b', 'name': ('Eslava (contra 1.d4)', 'Slav (vs 1.d4)'), 'lines': [
  {'name': ('Eslava principal (4.Nc3 dxc4)', 'Main Slav (4.Nc3 dxc4)'),
   'moves': 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5'.split(),
   'notes': {
    3: ('…c6 defiende d5 sin encerrar tu alfil (como pasaría con …e6).',
        '…c6 defends d5 without locking in your bishop (as …e6 would).'),
    7: ('…dxc4 toma el peón: ahora las blancas tienen que gastar tiempo en recuperarlo. …b5 queda como amenaza.',
        '…dxc4 takes the pawn: White must spend time getting it back. …b5 to keep it is in the air.'),
    8: ('a4 impide …b5.', 'a4 stops …b5.'),
    9: ('…Bf5 saca el alfil antes de …e6. Es la gran ventaja de la Eslava.',
        '…Bf5 develops the bishop before …e6. That\'s the main point of the Slav.'),
   }},
  {'name': ('Eslava con 4.e3', 'Slav with 4.e3'),
   'moves': 'd4 d5 c4 c6 Nc3 Nf6 e3 e6 Nf3 Nbd7'.split(),
   'notes': {
    6: ('e3 defiende c4 de antemano. Ahora …Bf5 deja b7 débil (Qb3).',
        'e3 protects c4 in advance. Now …Bf5 would leave b7 weak (Qb3).'),
    7: ('…e6 te da una estructura muy sólida (Semi-Eslava).', '…e6 gives you a very solid structure (Semi-Slav).'),
    9: ('…Nbd7 prepara …dxc4 y …b5, o …e5 más adelante.', '…Nbd7 prepares …dxc4 and …b5, or …e5 later.'),
   }},
  {'name': ('Eslava del cambio', 'Exchange Slav'),
   'moves': 'd4 d5 c4 c6 cxd5 cxd5 Nc3 Nf6 Bf4 Nc6 e3 Bf5'.split(),
   'notes': {
    4: ('cxd5 simplifica: estructura simétrica.', 'cxd5 simplifies: a symmetrical structure.'),
    9: ('…Nc6 presiona d4 y desarrolla.', '…Nc6 hits d4 and develops.'),
    11: ('…Bf5 copia: en simétricas, desarrollar igual de rápido basta para igualar.',
         '…Bf5 mirrors: in symmetrical structures, matching development is enough to equalize.'),
   }},
  {'name': ('Contra el Londres (2.Bf4)', 'Against the London (2.Bf4)'),
   'moves': 'd4 d5 Bf4 c6 e3 Bf5 Nf3 e6 Bd3 Bxd3 Qxd3 Nd7'.split(),
   'notes': {
    3: ('…c6 y …Bf5: el mismo plan que tu Caro-Kann. Y aquí NO hay trampa de …Nc6/…Nxd4.',
        '…c6 and …Bf5: the same plan as your Caro-Kann, and no …Nc6/…Nxd4 trap here.'),
    5: ('…Bf5 fuera de la cadena antes de …e6.', '…Bf5 outside the chain before …e6.'),
    9: ('Cambia alfiles con gusto (es tu pieza "mala").', 'Trade bishops happily (it\'s your "bad" piece).'),
    11: ('…Nd7 controla e5 y evita Ne5 molestos.', '…Nd7 covers e5 and prevents an annoying Ne5.'),
   }},
  {'kind': 'punish', 'name': ('Gambito de dama: si juegan e4 temprano, quédate el peón', 'Queen\'s Gambit: if they play e4 early, keep the pawn'),
   'moves': 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 e4 b5'.split(),
   'notes': {
    8: ('e4 quiere un centro grande, pero se olvida de recuperar c4.',
        'e4 wants a big center, but forgets about winning back c4.'),
    9: ('…b5 sostiene el peón de más. Sin a4 previo, las blancas no tienen cómo atacarlo rápido.',
        '…b5 holds the extra pawn. Without a4 first, White can\'t attack it quickly.'),
   }},
 ]},
}

# validate
ok = True
for k, op in R.items():
    for ln in op['lines']:
        b = chess.Board()
        for i, s in enumerate(ln['moves']):
            try:
                b.push_san(s)
            except Exception as e:
                print('ILLEGAL', k, ln['name'][1], i, s, e); ok = False; break
        for i in ln['notes']:
            if i >= len(ln['moves']): print('NOTE OOR', k, ln['name'][1], i); ok = False
        # user must make the last move
        last_by_white = (len(ln['moves']) - 1) % 2 == 0
        if last_by_white != (op['side'] == 'w'): print('LAST MOVE NOT OURS', k, ln['name'][1])
if not ok: sys.exit(1)

out = {}
for k, op in R.items():
    out[k] = {'side': op['side'], 'name': {'es': op['name'][0], 'en': op['name'][1]},
              'lines': [{'name': {'es': l['name'][0], 'en': l['name'][1]}, 'moves': l['moves'], 'kind': l.get('kind', 'main'),
                         'notes': {str(i): {'es': v[0], 'en': v[1]} for i, v in l['notes'].items()}} for l in op['lines']]}
json.dump(out, open('rep.json', 'w'), ensure_ascii=False)
print('ok', sum(len(o['lines']) for o in out.values()), 'lines')
