"""Analiz Masası verisi: public/veri/analiz.json

81 ilin tamamı için yayımlanan, 2008 sonrasında en az beş yıllık serisi bulunan oran, hız, pay, kişi başı ve
endeks türü il göstergeleri (mutlak sayılar, mükerrerler ve veri-ekleri/yayinlanmayacak.csv'dekiler hariç).
Her gösterge için: kısa ad, birim, ondalık, üst başlık, kategori, "iyi yön" (+1 yüksek iyi, -1 düşük iyi, 0 nötr;
addan kural yoluyla), nominal TL bayrağı, yıllara göre 81 il değeri ve Türkiye değeri (TL için nüfus ağırlıklı).
Ayrıca illerin kraliçe komşuluğu (sınır paylaşan iller), coğrafi bölge ve OECD kentsel-kırsal sınıfı.

Düzey 2 (26 bölge): yukarıdaki göstergelerden TÜİK'in Düzey 2 değerini de yayımladıkları ile yalnızca Düzey 2'de
yayımlanan oran göstergeleri (işgücü piyasası, yoksulluk, Ar-Ge yoğunluğu vb.) için "d2" alanı: yıllara göre 26 bölge
değeri ve Türkiye değeri. Yalnızca Düzey 2'de bulunan göstergelerde il alanları boştur (yillar: []).
Bölgeler için ayrıca Düzey 1 üst bölgesi, coğrafi bölge (bölgedeki illerin çoğunluğuna göre) ve komşuluk.

Çalıştırma: python tools/analiz/analiz_verisi.py   (önce build/veri.db ve public/veri/vitrin.json üretilmiş olmalı)
"""
import json, sqlite3, re, csv
from collections import defaultdict
from shapely.geometry import shape
from pathlib import Path
KOK=str(Path(__file__).resolve().parents[2])
db=sqlite3.connect(KOK+'/build/veri.db')
M=json.load(open(KOK+'/public/veri/manifest.json'))
UST=[["Nüfus ve Toplum",["Nüfus","Demografi","Göç","Kültür"]],["Ekonomi ve Üretim",["Ekonomi","Sanayi","Tarım","Dış Ticaret","Turizm","Enflasyon ve Fiyat","Araştırma ve Geliştirme"]],["Emek ve Eğitim",["İşgücü","Eğitim"]],["Yaşam Koşulları",["Gelir ve Yaşam Koşulları","Tüketim Harcamaları","Sağlık","İnşaat ve Konut"]],["Altyapı ve Çevre",["Ulaştırma","Haberleşme","Enerji","Çevre"]],["Endeksler ve Uluslararası",["Sosyo-Ekonomik Gelişmişlik","Bölgesel Refah (OECD)","Kentler (OECD)"]],["Sürdürülebilir Kalkınma",["Sürdürülebilir Kalkınma"]]]
kat2ust={k:u for u,ks in UST for k in ks}
man={}
for k in M['kategoriler']:
    for g in k['gostergeler']:
        raw=re.sub(r'\s\([^()]*\)$','',g['ad'])
        man.setdefault(raw,(k['ad'],g))
        # OECD göstergelerinde veritabanı adı manifest adıyla aynıdır ("… (OECD) (Yüz Binde)"); sondaki birim atılınca eşleşmez
        man.setdefault(g['ad'],(k['ad'],g))
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
# Düzey 2: 26 bölgenin tamamı için 2008 sonrası en az beş yıl
rows2=db.execute("""SELECT v.indicator, CAST(v.time AS INT) t, COUNT(DISTINCT v.geo) n FROM values_long v JOIN entities e USING(geo)
 WHERE e.level='region26' AND v.value IS NOT NULL AND CAST(v.time AS INT)>=2008 GROUP BY v.indicator, t""").fetchall()
yrs2=defaultdict(list)
for ind,t,n in rows2:
    if n>=26: yrs2[ind].append(t)
D2_DISLA=re.compile(r'Erkek|Kadın|\(Bin Kişi\)|Sayısı|\(1000\)|\(TL\)|TÜFE',re.I)
D2_TUT={'Gini Katsayısı',"Yoksulluk sınırı (TL) (Medyan Gelirin %60'ına Göre)",'Kadınlarda İstihdam Oranı (15+ yaş) (%)','Kadınlarda İşgücüne Katılma Oranı (15+ yaş) (%)','Kadınlarda İşsizlik Oranı (15+ yaş) (%)'}
sec2=[k for k,v in yrs2.items() if len(v)>=5 and k not in gizli and k in man and k not in sec
      and (k in D2_TUT or (OLCU.search(k) and not DISLA.search(k) and not D2_DISLA.search(k)))]
sec=sec+sec2
# Türetilmiş kişi başı kültür göstergeleri (Hesaplama: Platform): TÜİK mutlak sayıları / ADNKS toplam nüfusu.
# Mutlak sayılar iller arasında karşılaştırılamadığından ilişki analizine nüfusa oranlanarak alınır.
TURET={
 'Bin Kişi Başına Sinema Koltuğu':('Sinema Koltuk Sayısı',1000,'bin kişide',1),
 'Kişi Başına Sinema Seyircisi':('Sinema Seyirci Sayısı',1,'seyirci',2),
 'Bin Kişi Başına Tiyatro Koltuğu':('Tiyatro Koltuk Sayısı',1000,'bin kişide',1),
 'Kişi Başına Tiyatro Seyircisi':('Tiyatro Seyirci Sayısı',1,'seyirci',2),
 'Yüz Bin Kişi Başına Halk Kütüphanesi':('Halk Kütüphanelerinin Sayısı',100000,'yüz bin kişide',1),
 'Kişi Başına Halk Kütüphanesi Kitabı':('Halk Kütüphanelerinde Kitap Sayısı',1,'kitap',2),
 'Bin Kişi Başına Ödünç Verilen Kütüphane Materyali':('Halk Kütüphanelerinde Ödünç Verilen Materyal Sayısı',1000,'bin kişide',0),
 'Kişi Başına Müze ve Ören Yeri Ziyaretçisi':('Kültür ve Turizm Bakanlığına Bağlı Müze ve Ören Yeri Ziyaretçi Sayısı',1,'ziyaretçi',2),
}
for ad,(pay,_,birim_,ond_) in TURET.items():
    man[ad]=('Kültür',dict(id='turetilmis-'+re.sub(r'[^a-z0-9]+','-',ad.lower().translate(str.maketrans('çğıöşüİ','cgiosui'))).strip('-'),birim=birim_,ondalik=ond_,kaynakKisa='TÜİK',turetilmis=pay))
sec=sec+list(TURET)
# Yoksulluk sınırı bölgenin medyan eşdeğer gelirinin %60'ıdır; 0,6'ya bölünerek medyan gelir düzeyi elde edilir (Hesaplama: Platform)
SINIR="Yoksulluk sınırı (TL) (Medyan Gelirin %60'ına Göre)"
OLCEK={SINIR:1/0.6}
YON_ART=re.compile(r'Yoksulluk sınırı|Yükseköğretim Mezunu|Yetişkin Eğitimine Katılım|Çalışan Başına GSYH|Emek Verimliliği: Toplam|Sinema Koltuğu|Sinema Seyircisi|Tiyatro Koltuğu|Tiyatro Seyircisi|Halk Kütüphanesi|Kütüphane Materyali|Ören Yeri Ziyaretçisi|İstihdam Oranı|İşgücüne Katılma Oranı|Ar-Ge Harcamasının|Okullaşma|Mezunu Oranı|Okuma Yazma Bilen|Tamamlanma|Yaşam Süresi|Hekim Sayısı|Hemşire|ebe ve hemşire|diş hekimi|eczacı|Yatak Sayısı|Eğitim Süresi|GSYH|Mevduat|Arıtma|Kanalizasyon|İçme ve Kullanma Suyu|Atık Hizmeti|Genişbant|Beşeri Kalkınma|SEGE|Kütüphane|Yüksek Teknoloji|güvenilir şekilde yönetilen|uygun nihai işlem|Net Göç',re.I)
YON_AZ=re.compile(r'Ne Eğitimde Ne İstihdamda|Eğitimi Erken Bırakanlar|Lise Altı|Gini|Kasten Öldürme|Taşıt Hırsızlığı|İşsizlik Oranı|Yoksulluk Oranı|iş kazaları|Ölüm|Ölü Sayısı|Yaralı|İntihar|Öldürme|Hırsızlığı|Bilmeyen|PM10|18 yaşından önce|Öğrenci Başına Düşen|Başına Düşen Öğrenci|Başına Düşen: |Birimi Başına Düşen Nüfus|güvenilir olmayan|Belediye Atık Miktarı',re.I)
def kisa(ad):
    ad=re.sub(r'^SKA \d+ [^:]+: [\d.a-z]+ ','',ad)
    ad=ad.replace(' (Cari Fiyatlarla)','').replace('İllerde ','')
    ad=re.sub(r'\s\((%|Binde|Yüz Binde|TL|KWh|Yıl|0-1|°C|Kg/Kişi Gün|Litre/Kişi Gün|Çocuk Sayısı|OECD|10\.000 nüfusta|1\.000 canlı doğum başına)\)','',ad)
    ad=re.sub(r'\s\((%|Binde|Yüz Binde|OECD)\)','',ad)
    m=re.match(r'Eğitim Kademesine Göre Öğrenci Başına Düşen: (.+), (\w+)$',ad)
    if m: ad=f"{m.group(2)} başına öğrenci sayısı ({m.group(1).lower() if not m.group(1).startswith('İ') else 'i'+m.group(1)[1:].lower()})"
    ad=ad.replace('Cinsiyet: Cinsiyet Oranı (100 Kadına Düşen Erkek)','Cinsiyet oranı (100 kadına düşen erkek)')
    # Düzey 2 işgücü ve diğer göstergeler için sade adlar
    ad=re.sub(r'^Yaş Grubuna Göre (İstihdam Oranı|İşgücüne Katılma Oranı|İşsizlik Oranı): (.+) Yaş$',lambda m: f"{m.group(1)} ({m.group(2)} yaş)",ad)
    ad=ad.replace(' (15+ Yaş) (Saat)',' (15+ yaş)').replace('Yaşlı Nüfus Oranı (65 +)','Yaşlı Nüfus Oranı (65+ yaş)')
    ad=re.sub(r'^Ölümcül olmayan iş kazaları.*$','Ölümcül olmayan iş kazası oranı',ad)
    ad=re.sub(r'^Ölümcül iş kazaları.*$','Ölümcül iş kazası oranı',ad)
    ad=re.sub(r"^Yoksulluk sınırı( \(TL\))? \(Medyan Gelirin %60'ına Göre\)$",'Medyan Eşdeğer Hanehalkı Kullanılabilir Fert Geliri',ad)
    ad=ad.replace("Yoksulluk Oranı (Medyan Gelirin %60'ına Göre)",'Yoksulluk Oranı (medyan gelirin %60\'ına göre)')
    return ad[0].upper()+ad[1:]
BIRIM={'10.000 nüfusta':'10 bin kişide','Binde':'‰','Yüz Binde':'yüz binde','KWh':'kWh','Kg/Kişi Gün':'kg/gün','Litre/Kişi Gün':'litre/gün','Çocuk Sayısı':'çocuk','Yıl':'yıl','0-1':'endeks','°C':'°C'}
iller=json.load(open(KOK+'/public/veri/vitrin.json'))['iller']
kodlar=[i['kod'] for i in iller]
nufus=defaultdict(dict)
for t,g,v in db.execute("SELECT time,geo,value FROM values_long WHERE indicator='Toplam Nüfus' AND value IS NOT NULL"):
    nufus[int(t)][g]=v
OZEL={'İstihdam Oranı (15+ yaş) (%)':'istihdam','Yoksulluk Oranı (%) (Medyan Gelirin %60\'ına Göre)':'yoksulluk','Kişi Başına GSYH (TL)':'gsyh','15 Yaş ve Üzeri Kadın Yüksekokul veya Fakülte Mezunu Oranı (%)':'kadinuni','Doğurganlık Hızı (Çocuk Sayısı)':'dogurganlik'}
b2=db.execute("SELECT geo,name,parent FROM entities WHERE level='region26' ORDER BY geo").fetchall()
kod2=[g for g,_,_ in b2]
il2d2={g:p for g,p in db.execute("SELECT geo,parent FROM entities WHERE level='province'")}
out=[]
for i,gost in enumerate(sorted(sec, key=lambda s:(UST.index(next(u for u in UST if u[0]==kat2ust.get(man[s][0],'Sürdürülebilir Kalkınma'))), man[s][0], s))):
    kat,mg=man[gost]
    d=defaultdict(dict)
    kaynakAd=gost
    olcek=OLCEK.get(gost,1)
    if gost in TURET:
        kaynakAd,carpan=TURET[gost][0],TURET[gost][1]
    for t,g,v in db.execute("SELECT time,geo,value FROM values_long WHERE indicator=? AND value IS NOT NULL",(kaynakAd,)):
        if gost in TURET:
            pn=nufus.get(int(t),{}).get(g)
            if not pn: continue
            v=v/pn*carpan
        if int(t)>=2008: d[int(t)][g]=v*olcek
    if gost in TURET:
        # TÜİK kültür tablolarında tesisi olmayan il "-" ile gösterilir; veri yayımlanan yıllarda eksik il = 0
        for y in list(d):
            if sum(k in d[y] for k in kodlar)>=60:
                for k in kodlar: d[y].setdefault(k,0.0)
    yillar=sorted(y for y in d if sum(k in d[y] for k in kodlar)>=78) if gost not in sec2 else []
    d2v=defaultdict(dict)
    for t,g,v in db.execute("SELECT v.time,v.geo,v.value FROM values_long v JOIN entities e USING(geo) WHERE v.indicator=? AND v.value IS NOT NULL AND e.level='region26'",(kaynakAd,)):
        if gost in TURET:
            pn=nufus.get(int(t),{}).get(g)
            if not pn: continue
            v=v/pn*TURET[gost][1]
        if int(t)>=2008: d2v[int(t)][g]=v*olcek
    if gost in TURET:
        for y in list(d2v):
            if len(d2v[y])>=20:
                for k in kod2: d2v[y].setdefault(k,0.0)
    yillar2=sorted(y for y in d2v if len(d2v[y])>=26)
    if len(yillar)<3 and len(yillar2)<5: continue
    if len(yillar)<3: yillar=[]
    birim=mg.get('birim') or ''
    pm=re.search(r'\(([^()]*)\)$',gost)
    if pm and pm.group(1) in BIRIM: birim=BIRIM[pm.group(1)]
    if birim in ('Yüzde','yüzde'): birim='%'
    if 'Yaşam Süresi' in gost: birim='yıl'
    if gost.startswith('Yaşlı Nüfus Oranı'): birim='%'
    if '(Saat)' in gost: birim='saat'
    if 'çalışan başına' in gost: birim='yüz bin çalışanda'
    if gost==SINIR: birim='TL'
    if gost.startswith('Emek Verimliliği') and not birim: birim='$ (SGP)'
    if birim=='Türkiye=100': birim='endeks'
    if birim=='TL': ond=0
    if '(%)' in gost or gost.endswith('Oranı (%)'): birim='%'
    if not birim and gost.startswith('Halk Kütüphanelerinden Bin Kişi Başına'): birim='bin kişide'
    ond=mg.get('ondalik',1)
    tr_tum={y:d[y]['TR'] for y in d if 'TR' in d[y]}
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
    tr2={}
    for y in yillar2:
        if 'TR' in d[y]: tr2[str(y)]=d[y]['TR']
        elif y in tr_tum: tr2[str(y)]=tr_tum[y]
    d2alan=dict(yillar=yillar2,deger={str(y):[yuv(d2v[y].get(k)) for k in kod2] for y in yillar2},tr={k:yuv(v) for k,v in tr2.items()}) if len(yillar2)>=5 else None
    kayit=dict(k=OZEL.get(gost,f'g{i}'),id=mg['id'],ad=kisa(gost),gosterge=gost,birim=birim,ond=ond,kat=kat,grup=kat2ust.get(kat,'Sürdürülebilir Kalkınma'),
        kaynak=mg.get('kaynakKisa',''),yon=yon,nominal=(birim=='TL'),yillar=yillar,
        deger={str(y):[yuv(d[y].get(k)) for k in kodlar] for y in yillar},tr={k:yuv(v) for k,v in tr.items()})
    if d2alan: kayit['d2']=d2alan
    if gost in TURET: kayit['turetilmis']=f"{TURET[gost][0]} / toplam nüfus"
    if gost==SINIR: kayit['turetilmis']="yoksulluk sınırı (medyan gelirin %60'ı) / 0,6"
    out.append(kayit)
geo=json.load(open(KOK+'/public/veri/geo/province.json')); fk={f['id']:f for f in geo['features']}
sh={k:shape(fk[k]['geometry']).buffer(0.01) for k in kodlar}
kom=[[j for j,k2 in enumerate(kodlar) if k2!=k and sh[k].intersects(sh[k2])] for k in kodlar]
geo2=json.load(open(KOK+'/public/veri/geo/region26.json')); fk2={f['id']:f for f in geo2['features']}
sh2={k:shape(fk2[k]['geometry']).buffer(0.01) for k in kod2}
kom2=[[j for j,k2 in enumerate(kod2) if k2!=k and sh2[k].intersects(sh2[k2])] for k in kod2]
from collections import Counter
ilb={i['kod']:i['bolge'] for i in iller}
d1ad={g:n for g,n in db.execute("SELECT geo,name FROM entities WHERE level='region12'")}
bolge2=[dict(k=g,a=n,d1=d1ad[p],b=Counter(ilb[il] for il,pp in il2d2.items() if pp==g and il in ilb).most_common(1)[0][0]) for g,n,p in b2]
# Balon boyutu için büyüklük göstergeleri (İlişki sekmesinde üçüncü boyut): yalnız toplam/mutlak, sıfırdan büyük değerler.
# (anahtar, veritabanı adı, görünen ad, birim, eksik il = 0 kabul edilsin mi)
BOYUTLAR=[('nufus','Toplam Nüfus','Nüfus','kişi',False),
 ('gsyh','Gayrisafi Yurt İçi Hasıla (GSYH) (Bin TL)','GSYH','bin TL',False),
 ('ihracat','Toplam İhracat (1000 $)','İhracat','bin $',False),
 ('girisim','Toplam Girişim Sayısı','Girişim sayısı','girişim',False),
 ('mevduat','Toplam Mevduat (Bin TL)','Toplam mevduat','bin TL',False),
 ('elektrik','Toplam Tüketim (MWh)','Elektrik tüketimi','MWh',False),
 ('yatak','Toplam Yatak Sayısı','Hastane yatağı','yatak',False),
 ('geceleme','Turizm İşletme Belgeli Tesislerde Geceleme Sayısı','Turist geceleme (işletme belgeli)','geceleme',False),
 ('sinema','Sinema Seyirci Sayısı','Sinema seyircisi','seyirci',True)]
boyut=[]
for anahtar,adb,ad,birim_,sifir in BOYUTLAR:
    di=defaultdict(dict); dd=defaultdict(dict)
    for t,g,v,lv in db.execute("SELECT v.time,v.geo,v.value,e.level FROM values_long v JOIN entities e USING(geo) WHERE v.indicator=? AND v.value IS NOT NULL AND e.level IN ('province','region26') AND CAST(v.time AS INT)>=2008",(adb,)):
        (di if lv=='province' else dd)[int(t)][g]=v
    def kur(dic,kod,esik):
        ys=[]
        for y in sorted(dic):
            if sifir and len(dic[y])>=esik*0.75:
                for k in kod: dic[y].setdefault(k,0.0)
            if sum(k in dic[y] for k in kod)>=esik: ys.append(y)
        return {str(y):[None if dic[y].get(k) is None else round(dic[y][k]) for k in kod] for y in ys}
    boyut.append(dict(k=anahtar,ad=ad,birim=birim_,il=kur(di,kodlar,78),d2=kur(dd,kod2,26)))
V=dict(iller=[dict(k=i['kod'],a=i['ad'],b=i['bolge'],o=i['oecd'],n=i['nufus']) for i in iller],
       bolgeler=["Marmara","Ege","Akdeniz","İç Anadolu","Karadeniz","Doğu Anadolu","Güneydoğu Anadolu"],
       oecdSinif=['Ağırlıklı kentsel','Ara (geçiş)','Ağırlıklı kırsal'],komsu=kom,bolgeler2=bolge2,komsu2=kom2,boyutlar=boyut,gostergeler=out)
s=json.dumps(V,ensure_ascii=False,separators=(',',':'))
open(KOK+'/public/veri/analiz.json','w',encoding='utf-8').write(s); print('analiz.json:',len(out),'gösterge (il:',sum(1 for g in out if g['yillar']),', Düzey 2:',sum(1 for g in out if 'd2' in g),', yalnız Düzey 2:',sum(1 for g in out if not g['yillar']),'),',len(s)//1024,'KB')
