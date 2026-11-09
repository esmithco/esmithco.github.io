import json,urllib.request,time
UA={'User-Agent':'taller-aperturas/1.0 (personal training app)'}
def get(u):
    for i in range(4):
        try:
            import subprocess; return json.loads(subprocess.check_output(["curl","-sf","-A",UA["User-Agent"],u],timeout=60))
        except Exception as e:
            time.sleep(2+i*3)
    raise SystemExit('fail '+u)
arch=get('https://api.chess.com/pub/player/esmithco/games/archives')['archives']
games=[]
for u in arch:
    j=get(u); games+= [g for g in j.get('games',[]) if g.get('rules')=='chess' and g.get('pgn')]
    time.sleep(0.3)
json.dump(games,open('games.json','w'))
print(len(arch),'months',len(games),'games')
import collections
print(collections.Counter(g.get('time_class') for g in games))
