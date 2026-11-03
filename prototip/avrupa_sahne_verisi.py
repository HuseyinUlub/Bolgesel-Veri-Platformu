import json, numpy as np
from shapely.geometry import shape
g=json.load(open('public/veri/geo/avrupa-nuts2.json'))
d=json.load(open('public/veri/giris.json'))
ad=d['bolgeAdlari']; U=d['ulkeAdlari']
B=[]
for f in g['features']:
    k=f['id']; geo=shape(f['geometry'])
    if geo.geom_type=='MultiPolygon': geo=max(geo.geoms,key=lambda p:p.area)
    p=geo.representative_point()
    if k in ('ES70','PT20','PT30') or k.startswith('FRY'): continue
    u='EL' if k[:2]=='EL' else k[:2]
    gs=d['gsyh']['deger'].get(k); g4=d['gsyh']['d2004'].get(k)
    ya=d['yasli']['deger'].get(k); nu=(d['nufus'].get(k) or {}).get('g')
    ka=d['kadin'].get(k) or [None,None]
    B.append(dict(k=k,a=f['properties'].get('ad') if not k.startswith('TR') else ad.get(k,k),u=u,x=round(p.x/1000),y=round(p.y/1000),
                  g=gs,g4=g4,ya=ya,n=nu,k19=ka[0],k24=ka[1]))
# ikiz: 2024 kişi başı GSYH (SGP, AB=100) düzeyi en yakın Avrupa bölgesi
eu=[b for b in B if not b['k'].startswith('TR') and b['g'] is not None and b['k'] not in ('ES63','ES64')]
for t in B:
    if t['k'].startswith('TR') and t['g'] is not None:
        j=min(eu,key=lambda e:(abs(e['g']-t['g']), -(e['g4'] or 0)))
        t['ikiz']=j['k']
out=dict(bolgeler=B,ulkeler={k:v for k,v in U.items() if len(k)==2},ab=dict(yasli=d['yasli']['ab'],kadin=d['kadin']['EU27_2020'],nufus=d['nufus']['EU27_2020']['g']),
         trUlke=dict(g=d['gsyh']['ulke'].get('TR'),kadin=d['kadin']['TR'],nufus=d['nufus']['TR']['g'],yasli=d['yasli']['deger'].get('TR')),
         yil=dict(gsyh=d['gsyh']['yil'],yasli=d['yasli']['yil']))
json.dump(out,open('/tmp/claude-0/proto/veri.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(B),sum(1 for b in B if b['k'].startswith('TR')),{x:sum(b[x] is not None for b in B) for x in ['g','g4','ya','n','k19','k24']})
for t in B:
    if 'ikiz' in t: e=next(c for c in B if c['k']==t['ikiz']); print(t['a'],t['g'],'→',e['a'],e['u'],e['g'])
