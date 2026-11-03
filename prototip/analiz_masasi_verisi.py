"""Analiz masası verisi: 81 ili kapsayan, en az 5 yıllık zaman serisi olan oran/endeks türü il göstergeleri."""
import json, sqlite3, re, csv
from collections import defaultdict
from shapely.geometry import shape
KOK='/home/claude/dakaveri-v2'
db=sqlite3.connect(KOK+'/build/veri.db')
M=json.load(open(KOK+'/public/veri/manifest.json'))
UST=[["Nüfus ve Toplum",["Nüfus","Demografi","Göç","Kültür"]],["Ekonomi ve Üretim",["Ekonomi","Sanayi","Tarım","Dış Ticaret","Turizm","Enflasyon ve Fiyat","Araştırma ve Geliştirme"]],["Emek ve Eğitim",["İşgücü","Eğitim"]],["Yaşam Koşulları",["Gelir ve Yaşam Koşulları","Tüketim Harcamaları","Sağlık","İnşaat ve Konut"]],["Altyapı ve Çevre",["Ulaştırma","Haberleşme","Enerji","Çevre"]],["Endeksler ve Uluslararası",["Sosyo-Ekonomik Gelişmişlik","Bölgesel Refah (OECD)","Kentler (OECD)"]],["Sürdürülebilir Kalkınma",["Sürdürülebilir Kalkınma"]]]
kat2ust={k:u for u,ks in UST for k in ks}
man={}
for k in M['kategoriler']:
    for g in k['gostergeler']:
        raw=re.sub(r'\s\([^()]*\)$','',g['ad'])
        man.setdefault(raw,(k['ad'],g))
gizli=set()
for r in csv.reader(open(KOK+'/veri-ekleri/yayinlanmayacak.csv',encoding='utf-8-sig'),delimiter=';'):
    gizli.add(r[0])
rows=db.execute("""SELECT v.indicator, CAST(v.time AS INT) t, COUNT(DISTINCT v.geo) n FROM values_long v JOIN entities e USING(geo)
 WHERE e.level='province' AND v.value IS NOT NULL AND CAST(v.time AS INT)>=2008 GROUP BY v.indicator, t""").fetchall()
yrs=defaultdict(list)
for ind,t,n in rows:
    if n>=78: yrs[ind].append(t)
OLCU=re.compile(r'%|Oran|Hız|Başına|Başı |Ortalama|Ortanca|Yoğunluğu|Endeks|Pay\b|Payı|Büyüklüğü|Yüz Bin|Bin Kişi|Eğitim Süresi|Sıcaklığı|Doğurganlık|Yaşam Süresi',re.I)
DISLA=re.compile(r'Göre Nüfus|Yaş Grubu Nüfus|^65 Yaş ve Üzeri Nüfus|Çocuk Nüfus:|Genç Nüfus:|Göre (Doğum|Boşanma|Evlenme|Ölüm) Sayısı|Girişim Sayısı|\(Bin TL\)|\(MWh\)|\(Hektar\)|\(Baş\)|Mezunu Sayısı|Bilmeyen Sayısı|Değişim Oranı|Kişi Başına GSYH \(\$\)|^Türkiye Sektör Katma Değeri İçindeki Pay|3\.2\.1 Beş yaş altı|3\.c\.1\.a 10\.000 kişi başına hekim|Brüt Okullaşma|Erkek|Kız |Kadın\)|Erkek\)|\(Kadın|, Kadın|Erkeğin|Kadının Ortalama Evlenme|Bir Milyon Otomobil',re.I)
TUT={'Kişi Başına GSYH (TL)','Kişi Başına Toplam Mevduat (TL)','Kişi Başına Nakdi Kredi (TL)','15 Yaş ve Üzeri Kadın Yüksekokul veya Fakülte Mezunu Oranı (%)','6 Yaş ve Üzeri Okuma Yazma Bilmeyen Kadın Oranı (%)','Atık Su Arıtma Tesisi ile Hizmet Verilen Belediye Nüfusunun Belediye Nüfusu İçindeki Payı (%)','SEGE Endeks Değeri','Kadının Ortalama İlk Evlenme Yaşı','SKA 05 Cinsiyet Eşitliği: 5.3.1 20-24 yaş grubunda olup 18 yaşından önce evlenmiş kadınların oranı (%)','Cinsiyet: Cinsiyet Oranı (100 Kadına Düşen Erkek)'}
sec=[k for k,v in yrs.items() if (k in TUT or (len(v)>=5 and OLCU.search(k) and not DISLA.search(k))) and k not in gizli and k in man]
print(len(sec),'gösterge')
YON_ART=re.compile(r'Okullaşma|Mezunu Oranı|Okuma Yazma Bilen|Tamamlanma|Yaşam Süresi|Hekim Sayısı|Hemşire|ebe ve hemşire|diş hekimi|eczacı|Yatak Sayısı|Eğitim Süresi|GSYH|Mevduat|Arıtma|Kanalizasyon|İçme ve Kullanma Suyu|Atık Hizmeti|Genişbant|Beşeri Kalkınma|SEGE|Kütüphane|Yüksek Teknoloji|güvenilir şekilde yönetilen|uygun nihai işlem|Net Göç',re.I)
YON_AZ=re.compile(r'Ölüm|Ölü Sayısı|Yaralı|İntihar|Öldürme|Hırsızlığı|Bilmeyen|PM10|18 yaşından önce|Öğrenci Başına Düşen|Başına Düşen Öğrenci|Başına Düşen: |Birimi Başına Düşen Nüfus|güvenilir olmayan|Belediye Atık Miktarı',re.I)
def kisa(ad):
    ad=re.sub(r'^SKA \d+ [^:]+: [\d.a-z]+ ','',ad)
    ad=ad.replace(' (Cari Fiyatlarla)','').replace('İllerde ','')
    ad=re.sub(r'\s\((%|Binde|Yüz Binde|TL|KWh|Yıl|0-1|°C|Kg/Kişi Gün|Litre/Kişi Gün|Çocuk Sayısı|OECD|10\.000 nüfusta|1\.000 canlı doğum başına)\)','',ad)
    ad=re.sub(r'\s\((%|Binde|Yüz Binde|OECD)\)','',ad)
    m=re.match(r'Eğitim Kademesine Göre Öğrenci Başına Düşen: (.+), (\w+)$',ad)
    if m: ad=f"{m.group(2)} başına öğrenci sayısı ({m.group(1).lower() if not m.group(1).startswith('İ') else 'i'+m.group(1)[1:].lower()})"
    ad=ad.replace('Cinsiyet: Cinsiyet Oranı (100 Kadına Düşen Erkek)','Cinsiyet oranı (100 kadına düşen erkek)')
    return ad[0].upper()+ad[1:]
BIRIM={'10.000 nüfusta':'10 bin kişide','Binde':'‰','Yüz Binde':'yüz binde','KWh':'kWh','Kg/Kişi Gün':'kg/gün','Litre/Kişi Gün':'litre/gün','Çocuk Sayısı':'çocuk','Yıl':'yıl','0-1':'endeks','°C':'°C'}
iller=json.load(open(KOK+'/public/veri/vitrin.json'))['iller']
kodlar=[i['kod'] for i in iller]
nufus=defaultdict(dict)
for t,g,v in db.execute("SELECT time,geo,value FROM values_long WHERE indicator='Toplam Nüfus' AND value IS NOT NULL"):
    nufus[int(t)][g]=v
OZEL={'Kişi Başına GSYH (TL)':'gsyh','15 Yaş ve Üzeri Kadın Yüksekokul veya Fakülte Mezunu Oranı (%)':'kadinuni','Doğurganlık Hızı (Çocuk Sayısı)':'dogurganlik'}
out=[]
for i,gost in enumerate(sorted(sec, key=lambda s:(UST.index(next(u for u in UST if u[0]==kat2ust.get(man[s][0],'Sürdürülebilir Kalkınma'))), man[s][0], s))):
    kat,mg=man[gost]
    d=defaultdict(dict)
    for t,g,v in db.execute("SELECT time,geo,value FROM values_long WHERE indicator=? AND value IS NOT NULL",(gost,)):
        if int(t)>=2008: d[int(t)][g]=v
    yillar=sorted(y for y in d if sum(k in d[y] for k in kodlar)>=78)
    if len(yillar)<3: continue
    birim=mg.get('birim') or ''
    pm=re.search(r'\(([^()]*)\)$',gost)
    if pm and pm.group(1) in BIRIM: birim=BIRIM[pm.group(1)]
    if birim in ('Yüzde','yüzde'): birim='%'
    if 'Yaşam Süresi' in gost: birim='yıl'
    if birim=='Türkiye=100': birim='endeks'
    if birim=='TL': ond=0
    if '(%)' in gost or gost.endswith('Oranı (%)'): birim='%'
    ond=mg.get('ondalik',1)
    tr={}
    for y in yillar:
        if 'TR' in d[y]: tr[str(y)]=d[y]['TR']
        elif birim=='TL' and y in nufus:
            ps=[(d[y][k],nufus[y].get(k)) for k in kodlar if k in d[y] and nufus[y].get(k)]
            tr[str(y)]=sum(v*p for v,p in ps)/sum(p for _,p in ps)
    yon=1 if re.search(r'uygun nihai işlem|Arıtılmış evsel',gost) else -1 if YON_AZ.search(gost) else 1 if YON_ART.search(gost) else 0
    if re.search(r'Öğrenci Başına Düşen: .*, Okul$',gost): yon=0
    def yuv(v):
        if v is None: return None
        a=abs(v); return round(v, 4 if a<10 else 3 if a<1000 else 1)
    out.append(dict(k=OZEL.get(gost,f'g{i}'),ad=kisa(gost),gosterge=gost,birim=birim,ond=ond,kat=kat,grup=kat2ust.get(kat,'Sürdürülebilir Kalkınma'),
        kaynak=mg.get('kaynakKisa',''),yon=yon,nominal=(birim=='TL'),yillar=yillar,
        deger={str(y):[yuv(d[y].get(k)) for k in kodlar] for y in yillar},tr={k:yuv(v) for k,v in tr.items()}))
print(len(out))
from collections import Counter
print(Counter(o['grup'] for o in out)); print(Counter(o['yon'] for o in out)); print(Counter(o['birim'] for o in out).most_common(15))
geo=json.load(open(KOK+'/public/veri/geo/province.json')); fk={f['id']:f for f in geo['features']}
sh={k:shape(fk[k]['geometry']).buffer(0.01) for k in kodlar}
kom=[[j for j,k2 in enumerate(kodlar) if k2!=k and sh[k].intersects(sh[k2])] for k in kodlar]
def r(c): return [r(x) for x in c] if isinstance(c[0],(list,tuple)) else [round(c[0],3),round(c[1],3)]
fs=[]
for k in kodlar:
    m=shape(fk[k]['geometry']).simplify(0.01,preserve_topology=True).__geo_interface__
    fs.append({'type':'Feature','id':k,'geometry':{'type':m['type'],'coordinates':r(m['coordinates'])}})
V=dict(iller=[dict(k=i['kod'],a=i['ad'],b=i['bolge'],o=i['oecd'],n=i['nufus']) for i in iller],
       bolgeler=["Marmara","Ege","Akdeniz","İç Anadolu","Karadeniz","Doğu Anadolu","Güneydoğu Anadolu"],
       oecdSinif=['Ağırlıklı kentsel','Ara (geçiş)','Ağırlıklı kırsal'],komsu=kom,gostergeler=out,
       harita={'type':'FeatureCollection','features':fs})
s=json.dumps(V,ensure_ascii=False,separators=(',',':'))
open('/tmp/claude-0/masa/veri.json','w').write(s); print(len(s)//1024,'KB')
for o in out: print(f"{o['grup'][:12]:12} | {o['kat'][:14]:14} | {o['yon']:+d} | {o['birim'][:8]:8} | {o['ad'][:80]}")
