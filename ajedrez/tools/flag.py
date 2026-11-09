import json,pickle,math,time,collections
from analyse import wp,pk
G=json.load(open('parsed.json'));C=pickle.load(open('cache12.pkl','rb'))
MAXPLY=30;now=time.time()
mine={};pun={}
for g in G:
    f=g['fens'];s=g['sans'];n=min(len(s),MAXPLY)
    us=0 if g['side']=='w' else 1
    for p in range(n):
        a=C.get(pk(f[p]));b=C.get(pk(f[p+1]))
        if not a or not b:continue
        s0=a['s'];s1=-b['s'];drop=wp(s0)-wp(s1)
        best=a['pv'][0] if a['pv'] else None
        if p%2==us:
            if abs(s0)<=500 and drop>=10 and best and best!=s[p]:
                k=pk(f[p])+'|'+s[p];c=mine.setdefault(k,{'g':[],'p':p,'game':g,'drop':drop})
                c['g'].append((g['id'],g['date']))
        else:
            if abs(s0)<=400 and drop>=15 and p+1<len(f):
                c2=C.get(pk(f[p+1]))
                if not c2 or not c2['pv']:continue
                k='P|'+pk(f[p+1]);c=pun.setdefault(k,{'g':[],'p':p,'game':g,'drop':drop})
                found=None
                if p+1<len(s):
                    d=C.get(pk(f[p+2])) if p+2<len(f) else None
                    if d: found=(wp(c2['s'])-wp(-d['s']))<5
                c['g'].append((g['id'],g['date'],found))
print('mine',len(mine),'punish',len(pun))
yr=now-365*86400
print('mine last year',sum(1 for c in mine.values() if max(d for _,d in c['g'])>yr))
print('punish last year',sum(1 for c in pun.values() if max(x[1] for x in c['g'])>yr))
print('punish missed',sum(1 for c in pun.values() if any(x[2] is False for x in c['g'])))
print(collections.Counter(min(3,len(c['g'])) for c in mine.values()))
