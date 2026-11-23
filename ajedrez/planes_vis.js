/* Opening plans shown ON THE BOARD (Nov 19, "it's still a lot of text; make it like for a kid: fast and easy").
   OVIS[op][groupKey] = steps on the end position of the group's first line. Step = [es, en, arrows, rings]:
   arrows "from to color" separated by commas (g = good for you, r = danger for you); rings "square color". One short sentence each. */
window.OVIS={
london:{
 classic:[
  ['Tu pirámide c3-d4-e3: fuerte y segura.','Your c3-d4-e3 pyramid: strong and safe.','','c3 g,d4 g,e3 g'],
  ['Ne5: la casilla clave del Londres.','Ne5: the key square of the London.','','e5 g'],
  ['Nd2 cuida e4 y luego salta a f3.','Nd2 guards e4 and then jumps to f3.','d2 f3 g','e4 g'],
  ['Pase mágico: Qf3 y Qh3 contra h7.','Magic route: Qf3 and Qh3 against h7.','d1 f3 g,f3 h3 g','h7 g'],
  ['Tu alfil de d3 también mira h7.','Your d3 bishop also looks at h7.','d3 h7 g','h7 g'],
  ['Si …c4 echa tu alfil: a c2, sigue mirando h7.','If …c4 kicks your bishop: to c2, it still looks at h7.','c5 c4 r,d3 c2 g','c2 g']],
 qb6:[
  ['Su dama ataca b2.','Their queen attacks b2.','b6 b2 r','b2 r'],
  ['Tu dama defiende y no pierde tiempo.','Your queen defends without losing time.','c2 b2 g','b2 g'],
  ['Prepara e4 para abrir el centro.','Get ready for e4 to open the center.','e3 e4 g','d5 g'],
  ['Saca piezas y enroca.','Bring out pieces and castle.','g1 f3 g,f1 e2 g','']],
 bf5:[
  ['Su alfil se fue: b7 quedó solo.','Their bishop left: b7 is alone.','b3 b7 g','b7 g'],
  ['Tu peón c5 empuja a su dama.','Your c5 pawn pushes their queen.','c5 b6 g','b6 g'],
  ['Saca piezas y enroca.','Bring out pieces and castle.','g1 f3 g,f1 e2 g','']],
 nc6:[
  ['El caballo quiere Nc2+ (doble ataque).','The knight wants Nc2+ (double attack).','b4 c2 r','c2 r,e1 r,a1 r'],
  ['a3 lo echa. Listo.','a3 kicks it away. Done.','a3 b4 g','c2 g'],
  ['Si …Nh5 ataca el alfil: Be5. Nunca g4.','If …Nh5 hits the bishop: Be5. Never g4.','f4 e5 g','g4 r'],
  ['Luego: c3, Bd3, O-O y Ne5.','Then: c3, Bd3, O-O and Ne5.','c2 c3 g,f1 d3 g','']],
 kid:[
  ['Enroque largo: tu rey a c1, tu torre a d1.','Long castling: your king to c1, your rook to d1.','','c1 g,d1 g'],
  ['Bh6 cambia su alfil de g7: su rey pierde al defensor.','Bh6 trades their g7 bishop: their king loses its defender.','h6 g7 g','g7 g'],
  ['h4 y h5: abre la columna h hacia su rey.','h4 then h5: open the h-file toward their king.','h4 h5 g,h1 h7 g','g8 g'],
  ['f3 sostiene e4.','f3 holds e4.','','e4 g,f3 g'],
  ['Cuidado: él ataca tu rey con …b4 y …Qa5.','Watch out: they attack your king with …b4 and …Qa5.','b5 b4 r,a5 a2 r','c3 r,a2 r']],
 englund:[
  ['Cuidado: …Qb4+ ataca rey y b2.','Watch out: …Qb4+ hits king and b2.','e7 b4 r','b2 r,e1 r'],
  ['Saca piezas rápido y enroca.','Bring out pieces fast and castle.','f1 e2 g,e1 g1 g',''],
  ['Cambia su caballo: menos trucos.','Trade their knight: fewer tricks.','f3 e5 g','e5 g']],
 c5:[
  ['Tus peones d5 y e4 le quitan espacio.','Your d5 and e4 pawns take their space.','','d5 g,e4 g'],
  ['Saca piezas y enroca.','Bring out pieces and castle.','g1 f3 g,f1 e2 g',''],
  ['a4 frena …b5.','a4 stops …b5.','a2 a4 g','b5 g']]},
caro:{
 adv:[
  ['Su cadena de peones. La base es d4.','Their pawn chain. The base is d4.','','d4 g,e5 r'],
  ['…c5 golpea la base.','…c5 hits the base.','c5 d4 g','d4 g'],
  ['…Nc6 y …Qb6: más presión.','…Nc6 and …Qb6: more pressure.','b8 c6 g,d8 b6 g','d4 g,b2 g'],
  ['Tu b7 está solo: vigílalo.','Your b7 is alone: watch it.','','b7 r']],
 exch:[
  ['…b5 y …b4: ataca su c3.','…b5 and …b4: attack their c3.','b7 b4 g','c3 g'],
  ['Torre a c8: la columna c es tuya.','Rook to c8: the c-file is yours.','a8 c8 g',''],
  ['Cuidado: Qb3 ataca b7.','Watch out: Qb3 hits b7.','d1 b3 r','b7 r'],
  ['No dejes un caballo en e5.','Do not allow a knight on e5.','f3 e5 r','e5 r']],
 panov:[
  ['Su peón d4 se quedará solo: es tu blanco.','Their d4 pawn will be alone: your target.','','d4 g'],
  ['Tu caballo a d5, delante del peón.','Your knight to d5, in front of the pawn.','f6 d5 g','d5 g'],
  ['Cambia piezas: el peón se debilita.','Trade pieces: the pawn gets weaker.','','d4 g'],
  ['Cuida tu rey de Ne5 y Bd3.','Guard your king from Ne5 and Bd3.','f3 e5 r','h7 r']],
 classical:[
  ['Tu alfil en g6: fuera y feliz.','Your bishop on g6: out and happy.','','g6 g'],
  ['…Ngf6 y …e6. Saca todo.','…Ngf6 and …e6. Develop everything.','g8 f6 g,e7 e6 g',''],
  ['Luego …c5 rompe su centro.','Then …c5 breaks their center.','c6 c5 g','d4 g'],
  ['Cuidado con f7.','Watch f7.','f3 g5 r','f7 r']],
 fantasy:[
  ['Con f3 su rey quedó débil.','With f3 their king got weak.','','e1 g,g1 g'],
  ['…Bc5 y …Qb6 apuntan a su rey.','…Bc5 and …Qb6 aim at their king.','f8 c5 g,d8 b6 g','g1 g'],
  ['…Nf6 y enroca rápido.','…Nf6 and castle fast.','g8 f6 g,e8 g8 g','']],
 other:[
  ['Tu peón d5 echa al alfil: ganas tiempo.','Your d5 pawn kicks the bishop: you gain time.','','d5 g'],
  ['Saca piezas: …Nc6 y …Nf6.','Develop: …Nc6 and …Nf6.','b8 c6 g,g8 f6 g',''],
  ['Cuida f7.','Guard f7.','','f7 r']]},
slav:{
 qg:[
  ['Tu alfil ya salió. Ahora …e6.','Your bishop is out. Now …e6.','e7 e6 g','f5 g'],
  ['…Bb4 clava su caballo.','…Bb4 pins their knight.','f8 b4 g','c3 g'],
  ['Cuidado: Qb3 ataca b7.','Watch out: Qb3 hits b7.','d1 b3 r','b7 r'],
  ['No les dejes e4 gratis.','Do not give them e4 for free.','e2 e4 r','e4 r']],
 exch:[
  ['Torre a c8: la columna c es tuya.','Rook to c8: the c-file is yours.','a8 c8 g',''],
  ['Cuida b7 de Qb3.','Guard b7 from Qb3.','d1 b3 r','b7 r'],
  ['…e6, …Bd6 y enroca.','…e6, …Bd6 and castle.','e7 e6 g,f8 d6 g','']],
 london:[
  ['…c5 golpea d4.','…c5 hits d4.','c6 c5 g','d4 g'],
  ['…Qb6 ataca b2.','…Qb6 hits b2.','d8 b6 g','b2 g'],
  ['Saca piezas y enroca.','Bring out pieces and castle.','g8 f6 g,f8 e7 g',''],
  ['No dejes su caballo en e5.','Do not let their knight sit on e5.','f3 e5 r','e5 r']],
 other:[
  ['Si atacan tu alfil, retíralo sin miedo.','If they hit your bishop, step back calmly.','','h4 r'],
  ['Luego sácalo otra vez.','Then bring it out again.','c8 f5 g','f5 g'],
  ['Rompe con …c5 o …e5.','Break with …c5 or …e5.','c6 c5 g,e7 e5 g','']]}};
