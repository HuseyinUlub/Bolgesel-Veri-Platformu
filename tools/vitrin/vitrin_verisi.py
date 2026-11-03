"""
vitrin_verisi.py — Ana sayfanın giriş bölümündeki "vitrin" gösterimlerinin verisi.

Girdi : build/veri.db (pipeline çıktısı), public/veri/geo/province.json, public/veri/il-tipolojisi.json
Çıktı : public/veri/vitrin.json

Üç gösterim:
  pasta    81 ilin Türkiye toplamındaki payları; ölçü değiştirilebilir ağaç haritası (nüfus, yüzölçümü, GSYH, sektörler…)
  birinci  "Her il bir şeyde öne çıkıyor": her il için 81 il içinde en iyi sırada olduğu gösterge
           (seçilmiş ~120 gösterge; yön: yüksek ya da düşük olanı iyi/ilginç). Göstergeler iller arasında
           tekrarlanmasın diye atama Macar yöntemiyle yapılır (maliyet = sıra², küçük öncelik payı).
  suru     81 il balonu: nüfus (boyut), OECD kentsel–kırsal sınıfı (renk), değiştirilebilir eksen.
Ayrıca karo harita yerleşimi (il merkezlerinin 16×8 ızgaraya en kısa toplam uzaklıkla yerleştirilmesi).

Kullanım: python tools/vitrin/vitrin_verisi.py   (önce pipeline/build_data.py)
"""
from __future__ import annotations

import json
import math
import sqlite3
from pathlib import Path

import numpy as np
from scipy.optimize import linear_sum_assignment

KOK = Path(__file__).resolve().parents[2]
VERI = KOK / "public" / "veri"

# Coğrafi bölgeler (plaka → bölge sırası)
BOLGELER = ["Marmara", "Ege", "Akdeniz", "İç Anadolu", "Karadeniz", "Doğu Anadolu", "Güneydoğu Anadolu"]
_B = {
    0: [34, 22, 39, 59, 17, 41, 77, 54, 11, 16, 10],
    1: [35, 45, 9, 20, 48, 3, 43, 64],
    2: [7, 15, 32, 33, 1, 80, 31, 46],
    3: [6, 42, 70, 68, 51, 50, 40, 71, 38, 58, 66, 26, 18],
    4: [67, 74, 78, 37, 57, 19, 5, 55, 60, 52, 28, 61, 53, 8, 29, 69, 14, 81],
    5: [25, 24, 62, 23, 44, 12, 49, 13, 65, 30, 4, 36, 76, 75],
    6: [27, 2, 63, 21, 47, 72, 56, 73, 79],
}
BOLGE = {p: b for b, ps in _B.items() for p in ps}
assert len(BOLGE) == 81

# Ağaç haritası ölçüleri: (anahtar, düğme adı, gösterge, birim cümlesi)
PASTA = [
    # (anahtar, düğme adı, gösterge, cümlede iyelik biçimi, grup)
    ("nufus", "Nüfus", "Toplam Nüfus", "nüfusunun", "Nüfus ve yüzölçümü"),
    ("alan", "Yüzölçümü", None, "yüzölçümünün", "Nüfus ve yüzölçümü"),
    ("gsyh", "GSYH", "Gayrisafi Yurt İçi Hasıla (GSYH) (Bin TL)", "GSYH'sinin", "Üretim (katma değer)"),
    ("tarim", "Tarım", "Sektörlere Göre Katma Değer: Tarım, Ormancılık ve Balıkçılık (Cari Fiyatlarla) (Bin TL)", "tarım katma değerinin", "Üretim (katma değer)"),
    ("imalat", "İmalat", "Sektörlere Göre Katma Değer: İmalat Sanayi (Cari Fiyatlarla) (Bin TL)", "imalat katma değerinin", "Üretim (katma değer)"),
    ("insaat", "İnşaat", "Sektörlere Göre Katma Değer: İnşaat (Cari Fiyatlarla) (Bin TL)", "inşaat katma değerinin", "Üretim (katma değer)"),
    ("ticaret", "Ticaret, Ulaştırma, Konaklama", "Sektörlere Göre Katma Değer: Ticaret, Ulaştırma, Konaklama ve Yiyecek Hizmetleri (Cari Fiyatlarla) (Bin TL)", "ticaret, ulaştırma, konaklama ve yiyecek hizmetleri katma değerinin", "Üretim (katma değer)"),
    ("bilgi", "Bilgi ve İletişim", "Sektörlere Göre Katma Değer: Bilgi ve İletişim (Cari Fiyatlarla) (Bin TL)", "bilgi ve iletişim katma değerinin", "Üretim (katma değer)"),
    ("finans", "Finans ve Sigorta", "Sektörlere Göre Katma Değer: Finans ve Sigorta Faaliyetleri (Cari Fiyatlarla) (Bin TL)", "finans ve sigorta katma değerinin", "Üretim (katma değer)"),
    ("ihracat", "İhracat", "Faaliyet İline Göre İhracat (1000 $)", "ihracatının", "Dış ticaret ve girişimler"),
    ("ithalat", "İthalat", "Toplam İthalat (1000 $)", "ithalatının", "Dış ticaret ve girişimler"),
    ("girisim", "Girişim sayısı", "Toplam Girişim Sayısı", "girişimlerinin", "Dış ticaret ve girişimler"),
    ("mevduat", "Banka mevduatı", "Toplam Mevduat (Bin TL)", "banka mevduatının", "Finansal göstergeler"),
    ("kredi", "Banka kredileri", "Toplam Nakdi Krediler (Bin TL)", "nakdi banka kredilerinin", "Finansal göstergeler"),
    ("mezun", "Fakülte veya yüksekokul mezunu", "15 Yaş ve Üzeri Yüksekokul veya Fakülte Mezunu Sayısı", "yüksekokul veya fakülte mezunu nüfusunun", "Eğitim"),
    ("ogrenci", "Yükseköğretim öğrencisi", "Yükseköğretim (Önlisans ve Lisans) Öğrenci Sayısı: Öğrenci", "önlisans ve lisans öğrencilerinin", "Eğitim"),
    ("hekim", "Hekim", "Toplam Hekim Sayısı", "hekimlerinin", "Sağlık"),
    ("uzman", "Uzman hekim", "Uzman Hekim Sayısı", "uzman hekimlerinin", "Sağlık"),
    ("dis", "Diş hekimi", "Diş Hekimi Sayısı", "diş hekimlerinin", "Sağlık"),
    ("hemsire", "Hemşire", "Hemşire Sayısı", "hemşirelerinin", "Sağlık"),
    ("eczaci", "Eczacı", "Eczacı Sayısı", "eczacılarının", "Sağlık"),
    ("yatak", "Hastane yatağı", "Toplam Yatak Sayısı", "hastane yataklarının", "Sağlık"),
    ("elektrik", "Elektrik üretimi", "Toplam Elektrik Üretimi (Lisanslı + Lisanssız) (GWh)", "elektrik üretiminin", "Enerji ve konut"),
    ("konut", "Konut satışı", "Konut Satışları: Toplam", "konut satışlarının", "Enerji ve konut"),
    ("turizm", "Turist gecelemesi", "Turizm İşletme Belgeli Tesislerde Geceleme Sayısı", "turist gecelemelerinin", "Turizm ve kültür"),
    ("muze", "Müze ziyaretçisi", "Kültür ve Turizm Bakanlığına Bağlı Müze ve Ören Yeri Ziyaretçi Sayısı", "müze ve ören yeri ziyaretçilerinin", "Turizm ve kültür"),
]
# Sağlık ölçülerinde Türkiye payının yanında 100 bin kişiye düşen sayı da hesaplanır (aynı yılın ADNKS nüfusu)
PASTA_ORAN = {"hekim", "uzman", "dis", "hemsire", "eczaci", "yatak"}
PASTA_YIL = {"Faaliyet İline Göre İhracat (1000 $)": "2024"}  # 2025 yılı eksik görünüyor

# "Her il bir şeyde öne çıkıyor" adayları: (gösterge, kısa ad, yön kelimesi, ikon, kişi başı mı)
# yön kelimesi: yuksek / dusuk / cok / az  → sıralama yönü (dusuk/az = küçük değer iyi)
# kişi başı: True ise gösterge 1000 kişiye bölünür (aynı yılın ya da en yakın yılın nüfusuyla)
ADAY = [
    ("Bal Üretimi (Ton)", "Bal üretimi", "cok", "tarim", False),
    ("Canlı Hayvan Sayısı: Koyun (Baş)", "Koyun sayısı", "cok", "hayvan", False),
    ("Canlı Hayvan Sayısı: Keçi (Baş)", "Keçi sayısı", "cok", "hayvan", False),
    ("Canlı Hayvan Sayısı: Manda (Baş)", "Manda sayısı", "cok", "hayvan", False),
    ("Canlı Hayvan Sayısı: At, Katır ve Eşek (Baş)", "At, katır ve eşek sayısı", "cok", "hayvan", False),
    ("Büyükbaş Hayvan Sayısı", "Büyükbaş hayvan sayısı", "cok", "hayvan", False),
    ("Kümes Hayvanı Sayısı", "Kümes hayvanı sayısı", "cok", "hayvan", False),
    ("İşlenmemiş Tütün Üretim Miktarı (Ton)", "Tütün üretimi", "cok", "tarim", False),
    ("Şeker Pancarı Üretim Miktarı (Ton)", "Şeker pancarı üretimi", "cok", "tarim", False),
    ("Tahıl Üretim Miktarı (Ton)", "Tahıl üretimi", "cok", "tarim", False),
    ("Patates, Kuru Baklagiller vb. Üretim Miktarı (Ton)", "Patates ve baklagil üretimi", "cok", "tarim", False),
    ("Yağlı Tohumlar Üretim Miktarı (Ton)", "Yağlı tohum üretimi", "cok", "tarim", False),
    ("Tekstilde Kullanılan Ham Bitkiler Üretim Miktarı (Ton)", "Pamuk ve lif bitkisi üretimi", "cok", "tarim", False),
    ("Örtü Altı Sebze ve Meyve Üretimi (Ton)", "Sera üretimi", "cok", "tarim", False),
    ("Bağ Alanı (Hektar)", "Bağ alanı", "cok", "tarim", False),
    ("Arazi Kullanımı: Uzun Ömürlü Bitkiler, Zeytinlik Alanı (Hektar)", "Zeytinlik alanı", "cok", "tarim", False),
    ("Arazi Kullanımı: Uzun Ömürlü Bitkiler, Meyve, İçecek ve Baharat Bitkileri Alanı (Hektar)", "Meyve, çay ve baharat bahçeleri", "cok", "tarim", False),
    ("Süs Bitkileri (Hektar)", "Süs bitkisi alanı", "cok", "tarim", False),
    ("Organik Bitkisel Üretim (Geçiş Süreci Dahil): Üretim Miktarı (Ton)", "Organik tarım üretimi", "cok", "tarim", False),
    ("Tarımsal Alet ve Makine Sayısı: Traktör (Adet)", "Traktör sayısı", "cok", "tarim", False),
    ("Tarımsal Alet ve Makine Sayısı: Biçerdöver (Adet)", "Biçerdöver sayısı", "cok", "tarim", False),
    ("Kişi Başına Bitkisel Üretim Değeri (TL)", "Kişi başı bitkisel üretim değeri", "yuksek", "tarim", False),
    ("Kişi Başına Canlı Hayvanlar Değeri (TL)", "Kişi başı hayvan varlığı değeri", "yuksek", "hayvan", False),
    ("Katma Değerde Sektör Payı: Tarım, Ormancılık ve Balıkçılık (Cari Fiyatlarla) (%)", "Ekonomide tarımın payı", "yuksek", "tarim", False),
    ("Kişi Başına GSYH (TL)", "Kişi başı GSYH", "yuksek", "ekonomi", False),
    ("Katma Değerde Sektör Payı: İmalat Sanayi (Cari Fiyatlarla) (%)", "Ekonomide imalatın payı", "yuksek", "sanayi", False),
    ("Katma Değerde Sektör Payı: İnşaat (Cari Fiyatlarla) (%)", "Ekonomide inşaatın payı", "yuksek", "sanayi", False),
    ("Katma Değerde Sektör Payı: Ticaret, Ulaştırma, Konaklama ve Yiyecek Hizmetleri (Cari Fiyatlarla) (%)", "Ekonomide ticaret ve turizmin payı", "yuksek", "ekonomi", False),
    ("Katma Değerde Sektör Payı: Kamu Yönetimi, Eğitim, İnsan Sağlığı ve Sosyal Hizmet Faaliyetleri (Cari Fiyatlarla) (%)", "Ekonomide kamu hizmetlerinin payı", "yuksek", "ekonomi", False),
    ("Katma Değerde Sektör Payı: Gayrimenkul Faaliyetleri (Cari Fiyatlarla) (%)", "Ekonomide gayrimenkulün payı", "yuksek", "ekonomi", False),
    ("Katma Değerde Sektör Payı: Bilgi ve İletişim (Cari Fiyatlarla) (%)", "Ekonomide bilişimin payı", "yuksek", "haberlesme", False),
    ("Katma Değerde Sektör Payı: Finans ve Sigorta Faaliyetleri (Cari Fiyatlarla) (%)", "Ekonomide finansın payı", "yuksek", "ekonomi", False),
    ("Kişi Başına İhracat ($) (Faaliyet İline Göre)", "Kişi başı ihracat", "yuksek", "ticaret", False),
    ("İhracatın İthalatı Karşılama Oranı (%)", "İhracatın ithalatı karşılama oranı", "yuksek", "ticaret", False),
    ("Madencilik ve Taşocakçılığı İhracatı (1000 $)", "Maden ihracatı", "cok", "ticaret", False),
    ("Tarım, Ormancılık ve Balıkçılık İhracatı (1000 $)", "Tarım ürünleri ihracatı", "cok", "ticaret", False),
    ("Kişi Başına Toplam Mevduat (TL)", "Kişi başı banka mevduatı", "yuksek", "ekonomi", False),
    ("Kişi Başına Nakdi Kredi (TL)", "Kişi başı banka kredisi", "yuksek", "ekonomi", False),
    ("Sendikalaşma Oranı (%)", "Sendikalaşma oranı", "yuksek", "ekonomi", False),
    ("İstihdam Oranı (15+ yaş) (%)", "İstihdam oranı", "yuksek", "ekonomi", False),
    ("İşsizlik Oranı (15+ yaş) (%)", "İşsizlik oranı", "dusuk", "ekonomi", False),
    ("İmalat Sanayinde Teknoloji Düzeyine Göre İstihdam Oranı (%) (Yüksek Teknoloji)", "İmalatta yüksek teknoloji istihdamı", "yuksek", "sanayi", False),
    ("İmalat Sanayinde Teknoloji Düzeyine Göre İstihdam Oranı (%) (Orta Yüksek Teknoloji)", "İmalatta orta-yüksek teknoloji istihdamı", "yuksek", "sanayi", False),
    ("OSB Alan Büyüklüğünün İl/Bölge Yüzölçümüne Oranı (%)", "Yüzölçümünde organize sanayi payı", "yuksek", "sanayi", False),
    ("OSB Sayısı", "Organize sanayi bölgesi sayısı", "cok", "sanayi", False),
    ("Kişi Başına Sanayi Elektrik Tüketimi (KWh)", "Kişi başı sanayi elektriği", "yuksek", "sanayi", False),
    ("Madencilik ve Taşocakçılığı Girişim Sayısı", "Madencilik girişimi sayısı", "cok", "sanayi", False),
    ("Lisanslı Elektrik Üretimi (GWh)", "Elektrik üretimi", "cok", "enerji", False),
    ("Lisanssız Kurulu Güç (MW)", "Lisanssız (çoğu güneş) kurulu güç", "cok", "enerji", False),
    ("Kişi Başına Mesken Elektrik Tüketimi (KWh)", "Kişi başı konut elektriği", "yuksek", "enerji", False),
    ("Ortanca Yaş", "Ortanca yaş", "yuksek", "nufus", False),
    ("Ortanca Yaş", "Ortanca yaş", "dusuk", "nufus", False),
    ("Doğurganlık Hızı (Çocuk Sayısı)", "Doğurganlık hızı", "yuksek", "aile", False),
    ("Doğurganlık Hızı (Çocuk Sayısı)", "Doğurganlık hızı", "dusuk", "aile", False),
    ("Ortalama Hanehalkı Büyüklüğü", "Hanehalkı büyüklüğü", "yuksek", "aile", False),
    ("Ortalama Hanehalkı Büyüklüğü", "Hanehalkı büyüklüğü", "dusuk", "aile", False),
    ("Net Göç Hızı (Binde)", "Net göç hızı", "yuksek", "nufus", False),
    ("Yıllık Nüfus Artış Hızı (Binde)", "Nüfus artış hızı", "yuksek", "nufus", False),
    ("Nüfus Yoğunluğu", "Nüfus yoğunluğu", "yuksek", "nufus", False),
    ("Nüfus Yoğunluğu", "Nüfus yoğunluğu", "dusuk", "nufus", False),
    ("Yaşlı Bağımlılık Oranı (%)", "Yaşlı bağımlılık oranı", "yuksek", "nufus", False),
    # 100 kadına düşen erkek (cinsiyet oranı) kullanıcı isteğiyle çıkarıldı (2 Kasım 2026)
    ("Kır Nüfus Oranı (%)", "Kırda yaşayanların oranı", "yuksek", "nufus", False),
    ("Yoğun Kent Nüfus Oranı (%)", "Yoğun kentte yaşayanların oranı", "yuksek", "nufus", False),
    ("Kaba Evlenme Hızı (Binde)", "Evlenme hızı", "yuksek", "aile", False),
    ("Kaba Boşanma Hızı (Binde)", "Boşanma hızı", "dusuk", "aile", False),
    ("Kadının Ortalama İlk Evlenme Yaşı", "Kadınların ilk evlenme yaşı", "yuksek", "aile", False),
    ("Doğuşta Beklenen Yaşam Süresi", "Doğuşta beklenen yaşam süresi", "yuksek", "saglik", False),
    ("Bebek Ölüm Hızı (Binde)", "Bebek ölüm hızı", "dusuk", "saglik", False),
    ("Bin Kişi Başına Düşen Toplam Hekim Sayısı", "Kişi başı hekim", "yuksek", "saglik", False),
    ("Bin Kişiye Düşen Hemşire Sayısı", "Kişi başı hemşire", "yuksek", "saglik", False),
    ("Yüz Bin Kişi Başına Hastane Yatak Sayısı", "Kişi başı hastane yatağı", "yuksek", "saglik", False),
    ("Aile Hekimliğine Birimi Başına Düşen Nüfus", "Aile hekimi başına nüfus", "dusuk", "saglik", False),
    ("15 Yaş ve Üzeri Yüksekokul veya Fakülte Mezunu Oranı (%)", "Üniversite mezunu oranı", "yuksek", "egitim", False),
    ("Ortalama Eğitim Süresi (Yıl)", "Ortalama eğitim süresi", "yuksek", "egitim", False),
    ("6 Yaş ve Üzeri Okuma Yazma Bilen Oranı (%)", "Okuryazarlık oranı", "yuksek", "egitim", False),
    ("Okul Öncesi Net Okullaşma Oranı (3-5 Yaş) (%)", "Okul öncesi okullaşma", "yuksek", "egitim", False),
    ("Ortaöğretimde Net Okullaşma Oranı (%)", "Lisede okullaşma", "yuksek", "egitim", False),
    ("Ortaokullarda Net Okullaşma Oranı (%)", "Ortaokulda okullaşma", "yuksek", "egitim", False),
    ("Ortaöğretimde Kız Net Okullaşma Oranı (%)", "Kızların lisede okullaşması", "yuksek", "egitim", False),
    ("İlkokullarda Öğretmen Başına Düşen Öğrenci Sayısı", "İlkokulda öğretmen başına öğrenci", "dusuk", "egitim", False),
    ("Ortaöğretimde Derslik Başına Düşen Öğrenci Sayısı", "Lisede derslik başına öğrenci", "dusuk", "egitim", False),
    ("Yükseköğretim (Önlisans ve Lisans) Öğrenci Sayısı: Öğrenci", "Nüfusa göre üniversite öğrencisi", "yuksek", "egitim", True),
    ("Yükseköğretim Öğretim Elemanı Sayısı: Profesör", "Nüfusa göre profesör", "yuksek", "egitim", True),
    ("Halk Kütüphanelerinden Bin Kişi Başına Yararlanma Sayısı", "Kütüphane kullanımı", "yuksek", "kultur", False),
    ("Halk Kütüphanelerinde Kitap Sayısı", "Nüfusa göre kütüphane kitabı", "yuksek", "kultur", True),
    ("Tiyatro Seyirci Sayısı", "Nüfusa göre tiyatro seyircisi", "yuksek", "kultur", True),
    ("Sinema Seyirci Sayısı", "Nüfusa göre sinema seyircisi", "yuksek", "kultur", True),
    ("Kültür ve Turizm Bakanlığına Bağlı Müze ve Ören Yeri Ziyaretçi Sayısı", "Müze ve ören yeri ziyaretçisi", "cok", "kultur", False),
    ("Ören Yeri Sayısı", "Ören yeri sayısı", "cok", "kultur", False),
    ("Kültür ve Turizm Bakanlığına Bağlı Müzelerde Eser Sayısı", "Müzelerdeki eser sayısı", "cok", "kultur", False),
    ("Özel Müze Sayısı", "Özel müze sayısı", "cok", "kultur", False),
    ("Turizm İşletme Belgeli Tesislerde Yabancı Turist Geceleme Sayısı", "Yabancı turist gecelemesi", "cok", "turizm", False),
    ("Turizm İşletme Belgeli Tesislerde Vatandaş Geceleme Sayısı", "Yerli turist gecelemesi", "cok", "turizm", False),
    ("Turizm İşletme Belgeli Tesislerde Geceleme Sayısı", "Nüfusa göre turist gecelemesi", "yuksek", "turizm", True),
    ("Turizm İşletme Belgeli Konaklama Tesisleri Yatak Sayısı", "Nüfusa göre otel yatağı", "yuksek", "turizm", True),
    ("Bin Kişi Başına Otomobil Sayısı", "Kişi başı otomobil", "yuksek", "ulasim", False),
    ("Motosiklet Sayısı", "Nüfusa göre motosiklet", "yuksek", "ulasim", True),
    ("Hava Yoluyla Yolculuk Yapan Yolcu Sayısı", "Havalimanı yolcusu", "cok", "ulasim", False),
    ("Demir Yolu (km)", "Demiryolu uzunluğu", "cok", "ulasim", False),
    ("Otoyol (km)", "Otoyol uzunluğu", "cok", "ulasim", False),
    ("Bir Milyon Nüfusta Trafik Kazalarında Ölü Sayısı", "Nüfusa göre trafik ölümü", "dusuk", "ulasim", False),
    ("100.000 Kişiye Düşen Sabit Genişbant Abone Sayısı", "Sabit genişbant aboneliği", "yuksek", "haberlesme", False),
    ("Fiber Optik Kablo Uzunluğu (km)", "Fiber kablo uzunluğu", "cok", "haberlesme", False),
    ("Kişi Başı Ortalama Belediye Atık Miktarı (Kg/Kişi Gün)", "Kişi başı belediye atığı", "dusuk", "cevre", False),
    ("Belediyelerde Kişi Başı Çekilen Günlük Su Miktarı (Litre/Kişi Gün)", "Kişi başı su kullanımı", "dusuk", "cevre", False),
    ("Atık Su Arıtma Tesisi ile Hizmet Verilen Belediye Nüfusunun Belediye Nüfusu İçindeki Payı (%)", "Atık su arıtmaya bağlı nüfus", "yuksek", "cevre", False),
    ("Beşeri Kalkınma Endeksi (0-1)", "Beşeri kalkınma endeksi", "yuksek", "ekonomi", False),
    ("Ortalama Sosyoekonomik Seviye (SES) Skoru", "Ortalama sosyoekonomik statü", "yuksek", "ekonomi", False),
    ("Beşeri Sermaye Endeksi (0-1)", "Beşeri sermaye endeksi", "yuksek", "egitim", False),
    ("Konut Satış Sayıları (İlk Satış)", "Nüfusa göre yeni konut satışı", "yuksek", "konut", True),
    ("Toplam Girişim Sayısı", "Nüfusa göre girişim", "yuksek", "ekonomi", True),
    ("Bilgi ve İletişim Girişim Sayısı", "Nüfusa göre bilişim girişimi", "yuksek", "haberlesme", True),
    ("Konaklama ve Yiyecek Hizmeti Faaliyetleri Girişim Sayısı", "Nüfusa göre otel ve lokanta", "yuksek", "turizm", True),
    ("İmalat Girişim Sayısı", "Nüfusa göre imalat girişimi", "yuksek", "sanayi", True),
    ("Tarım, Ormancılık ve Balıkçılık Girişim Sayısı", "Nüfusa göre tarım girişimi", "yuksek", "tarim", True),
]
# Büyük iller için elle seçilen öne çıkan gösterge (aynı ilin birinci olduğu başka göstergeler arasında daha anlamlı olanı)
TERCIH = {"Ankara": "Üniversite mezunu oranı", "Kocaeli": "Kişi başı ihracat"}
YON_ADI = {"yuksek": "en yüksek", "dusuk": "en düşük", "cok": "en çok", "az": "en az"}

# Balon sürüsü eksenleri: (anahtar, ad, gösterge, ondalık, birim)
SURU = [  # (anahtar, ad, gösterge, ondalık, birim, grup)
    ("gsyh", "Kişi başı GSYH", "Kişi Başına GSYH (TL)", 0, "TL", "Ekonomi ve üretim"),
    ("mevduat", "Kişi başı mevduat", "Kişi Başına Toplam Mevduat (TL)", 0, "TL", "Ekonomi ve üretim"),
    ("elektrik", "Kişi başı elektrik tüketimi", "Kişi Başına Toplam Elektrik Tüketimi (KWh)", 0, "kWh", "Ekonomi ve üretim"),
    ("sanayi", "Sanayinin katma değerdeki payı", "Katma Değerde Sektör Payı: Sanayi (Cari Fiyatlarla) (%)", 1, "%", "Ekonomi ve üretim"),
    ("tarim", "Tarımın katma değerdeki payı", "Katma Değerde Sektör Payı: Tarım, Ormancılık ve Balıkçılık (Cari Fiyatlarla) (%)", 1, "%", "Ekonomi ve üretim"),
    ("yas", "Ortanca yaş", "Ortanca Yaş", 1, "yaş", "Nüfus ve aile"),
    ("dogurganlik", "Doğurganlık", "Doğurganlık Hızı (Çocuk Sayısı)", 2, "çocuk", "Nüfus ve aile"),
    ("artis", "Nüfus artış hızı", "Yıllık Nüfus Artış Hızı (Binde)", 1, "‰", "Nüfus ve aile"),
    ("goc", "Net göç", "Net Göç Hızı (Binde)", 1, "‰", "Nüfus ve aile"),
    ("hane", "Hanehalkı büyüklüğü", "Ortalama Hanehalkı Büyüklüğü", 1, "kişi", "Nüfus ve aile"),
    ("bosanma", "Boşanma hızı", "Kaba Boşanma Hızı (Binde)", 2, "‰", "Nüfus ve aile"),
    ("universite", "Üniversite mezunu", "15 Yaş ve Üzeri Yüksekokul veya Fakülte Mezunu Oranı (%)", 1, "%", "Eğitim ve sağlık"),
    ("kadinuni", "Kadınlarda üniversite mezunu", "15 Yaş ve Üzeri Kadın Yüksekokul veya Fakülte Mezunu Oranı (%)", 1, "%", "Eğitim ve sağlık"),
    ("okuloncesi", "Okul öncesi okullaşma", "Okul Öncesi Net Okullaşma Oranı (3-5 Yaş) (%)", 1, "%", "Eğitim ve sağlık"),
    ("yasam", "Yaşam süresi", "Doğuşta Beklenen Yaşam Süresi", 1, "yıl", "Eğitim ve sağlık"),
    ("bebek", "Bebek ölüm hızı", "Bebek Ölüm Hızı (Binde)", 1, "‰", "Eğitim ve sağlık"),
    ("hekim", "Bin kişiye düşen hekim", "Bin Kişi Başına Düşen Toplam Hekim Sayısı", 1, "hekim", "Eğitim ve sağlık"),
    ("otomobil", "Bin kişiye düşen otomobil", "Bin Kişi Başına Otomobil Sayısı", 0, "otomobil", "Yaşam ve çevre"),
    ("aritma", "Atık su arıtma hizmeti", "Atık Su Arıtma Tesisi ile Hizmet Verilen Belediye Nüfusunun Belediye Nüfusu İçindeki Payı (%)", 1, "%", "Yaşam ve çevre"),
    ("atik", "Kişi başı belediye atığı", "Kişi Başı Ortalama Belediye Atık Miktarı (Kg/Kişi Gün)", 2, "kg/gün", "Yaşam ve çevre"),
]


def main():
    db = sqlite3.connect(KOK / "build" / "veri.db")
    iller = list(db.execute("SELECT geo, name, plate FROM entities WHERE level='province' ORDER BY plate"))
    kodlar = [g for g, _, _ in iller]

    def son(gosterge, yil=None):
        """(yıl, {il: değer}) — en son yıl (ya da verilen yıl)."""
        if yil is None:
            yil = db.execute("SELECT max(time) FROM values_long v JOIN entities e ON e.geo=v.geo "
                             "WHERE e.level='province' AND indicator=? AND value IS NOT NULL", (gosterge,)).fetchone()[0]
        d = {g: v for g, v in db.execute("SELECT v.geo, value FROM values_long v JOIN entities e ON e.geo=v.geo "
                                          "WHERE e.level='province' AND indicator=? AND time=? AND value IS NOT NULL",
                                          (gosterge, yil))}
        return yil, d

    nufus_yil = {}

    def nufus(yil):
        if yil not in nufus_yil:
            y = yil
            while True:
                _, d = son("Toplam Nüfus", y)
                if len(d) == 81 or int(y) < 2007:
                    break
                y = str(int(y) - 1)
            nufus_yil[yil] = d
        return nufus_yil[yil]

    # ---- il listesi ve karo yerleşimi
    geo = json.loads((VERI / "geo" / "province.json").read_text(encoding="utf-8"))
    merkez = {}
    for ft in geo["features"]:
        pts = []
        g = ft["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        # en büyük halkanın ağırlık merkezi (yaklaşık)
        best = max((p[0] for p in polys), key=len)
        xs = [c[0] for c in best]
        ys = [c[1] for c in best]
        merkez[ft["id"]] = (sum(xs) / len(xs), sum(ys) / len(ys))
    SUT, SAT = 16, 8
    lon = np.array([merkez[k][0] for k in kodlar])
    lat = np.array([merkez[k][1] for k in kodlar])
    x = (lon - lon.min()) / (lon.max() - lon.min()) * (SUT - 1)
    y = (lat.max() - lat) / (lat.max() - lat.min()) * (SAT - 1)
    hucre = [(c, r) for r in range(SAT) for c in range(SUT)]
    maliyet = np.array([[(x[i] - c) ** 2 + (y[i] - r) ** 2 for c, r in hucre] for i in range(81)])
    sat, sut = linear_sum_assignment(maliyet)
    karo = {kodlar[i]: hucre[j] for i, j in zip(sat, sut)}

    tip = json.loads((VERI / "il-tipolojisi.json").read_text(encoding="utf-8"))
    tip_il = tip["iller"]

    def oecd_sinif(kod):
        k = tip_il.get(kod)
        kk = k[0] if isinstance(k, list) else (k or {}).get("kentsel_kirsal")
        return {"PU": 0, "IN": 1, "PRC": 2, "PRR": 2}.get(kk)

    _, pop = son("Toplam Nüfus")
    il_out = [{"kod": g, "ad": ad, "plaka": p, "bolge": BOLGE[p], "karo": list(karo[g]), "oecd": oecd_sinif(g),
               "nufus": pop[g]} for g, ad, p in iller]

    # ---- pasta
    pasta = []
    for anahtar, ad, gosterge, cumle, grup in PASTA:
        if anahtar == "alan":
            yil, yog = son("Nüfus Yoğunluğu")
            p = nufus(yil)
            d = {g: p[g] / yog[g] for g in kodlar if yog.get(g)}
        else:
            yil, d = son(gosterge, PASTA_YIL.get(gosterge))
        top = sum(d.values())
        pay = {g: d[g] / top * 100 for g in kodlar if g in d}
        sirali = sorted(pay.items(), key=lambda kv: -kv[1])
        acc, yari = 0, 0
        for _, v in sirali:
            acc += v
            yari += 1
            if acc >= 50:
                break
        assert len(d) == 81, (gosterge, yil, len(d))
        ek = {}
        if anahtar in PASTA_ORAN:
            p = nufus(yil)
            ek = {"oran": [round(d[g] / p[g] * 1e5, 1) for g in kodlar],
                  "trOran": round(sum(d.values()) / sum(p[g] for g in kodlar) * 1e5, 1)}
        pasta.append({"anahtar": anahtar, "ad": ad, "grup": grup, "yil": yil, "cumle": cumle, **ek,
                      "pay": [round(pay.get(g, 0), 3) for g in kodlar], "yariIl": yari,
                      "ilk": [[g, round(v, 1)] for g, v in sirali[:3]]})

    # ---- birinci
    adaylar = []
    for gosterge, kisa, yon, ikon, kisi in ADAY:
        yil, d = son(gosterge)
        if len(d) < 78:
            print("az veri:", gosterge, len(d))
            continue
        if kisi:
            p = nufus(yil)
            d = {g: v / p[g] * 1000 for g, v in d.items() if p.get(g)}
        ters = yon in ("dusuk", "az")
        degerler = sorted(d.values(), reverse=not ters)
        ilk = degerler[0]
        if sum(1 for v in degerler if v == ilk) > 3:
            print("çok eşit birinci, atlandı:", gosterge)
            continue
        sira = {g: 1 + sum(1 for v in degerler if (v < d[g] if ters else v > d[g])) for g in d}
        adaylar.append({"gosterge": gosterge, "kisa": kisa, "yon": yon, "ikon": ikon, "kisi": kisi,
                        "yil": yil, "deger": d, "sira": sira})
    n_a = len(adaylar)
    INF = 1e6
    M = np.full((81, n_a), INF)
    for j, a in enumerate(adaylar):
        for i, g in enumerate(kodlar):
            if g in a["sira"]:
                M[i, j] = a["sira"][g] ** 2 + j / (n_a * 50)
    adlar = {g: ad for g, ad, _ in iller}
    for il_ad, kisa in TERCIH.items():
        i = next(k for k, g in enumerate(kodlar) if adlar[g] == il_ad)
        j = next(k for k, a in enumerate(adaylar) if a["kisa"] == kisa)
        M[:, j] = INF
        M[i, :] = INF
        M[i, j] = 0
    sat, sut = linear_sum_assignment(M)
    birinci = {}
    for i, j in zip(sat, sut):
        a = adaylar[j]
        g = kodlar[i]
        birinci[g] = {"kisa": a["kisa"], "yon": YON_ADI[a["yon"]], "ikon": a["ikon"], "sira": a["sira"][g],
                      "deger": a["deger"][g], "yil": a["yil"], "gosterge": a["gosterge"], "kisi": a["kisi"]}
    for o in il_out:
        o["birinci"] = birinci[o["kod"]]
    from collections import Counter
    print("sıra dağılımı:", sorted(Counter(b["sira"] for b in birinci.values()).items()))

    # ---- balon sürüsü
    suru = []
    for anahtar, ad, gosterge, ond, birim, grup in SURU:
        yil, d = son(gosterge)
        assert sum(d.get(g) is not None for g in kodlar) >= 80, gosterge
        tr = db.execute("SELECT value FROM values_long WHERE geo='TR' AND indicator=? AND time=?",
                        (gosterge, yil)).fetchone()
        tr = tr[0] if tr else None
        if tr is None and anahtar == "mevduat":  # Türkiye değeri: toplam mevduat / ADNKS nüfusu (aynı yıl)
            m_ = db.execute("SELECT value FROM values_long WHERE geo='TR' AND indicator='Toplam Mevduat (Bin TL)' AND time=?", (yil,)).fetchone()
            n_ = db.execute("SELECT value FROM values_long WHERE geo='TR' AND indicator='Toplam Nüfus' AND time=?", (yil,)).fetchone()
            tr = m_[0] * 1000 / n_[0] if m_ and n_ else None
        suru.append({"anahtar": anahtar, "ad": ad, "gosterge": gosterge, "yil": yil, "ondalik": ond, "birim": birim,
                     "grup": grup, "tr": tr, "deger": [d.get(g) for g in kodlar]})

    def tr(gosterge):
        r = db.execute("SELECT time, value FROM values_long WHERE geo='TR' AND indicator=? AND value IS NOT NULL "
                       "ORDER BY time DESC LIMIT 1", (gosterge,)).fetchone()
        return {"yil": r[0], "deger": r[1]}
    ozet = {
        "nufus": tr("Toplam Nüfus"),
        "gsyh": tr("Gayrisafi Yurt İçi Hasıla (GSYH) (Bin TL)"),
        "kbGsyhDolar": tr("Kişi Başına GSYH ($)"),
        "ilce": db.execute("SELECT count(*) FROM entities WHERE level='district'").fetchone()[0],
        "ortancaYas": tr("Ortanca Yaş"),
        "ihracat": tr("Toplam İhracat (1000 $)"),  # ana sayfa özet rakamları (3 Kasım 2026)
    }
    # ---- SEGE: 1963–2025 gelişmişlik sıralaması (çalışma yılları)
    SEGE_YIL = ["1963", "1970", "1980", "1985", "1991", "1996", "2003", "2011", "2017", "2025"]
    sira = {}
    for g, t, v in db.execute("SELECT v.geo, time, value FROM values_long v JOIN entities e ON e.geo=v.geo "
                              "WHERE e.level='province' AND indicator='Sosyo-Ekonomik Gelişmişlik Sıralaması'"):
        if t in SEGE_YIL and v is not None:
            sira[(g, t)] = int(v)
    sege_n = {t: sum(1 for (g, y) in sira if y == t) for t in SEGE_YIL}
    sege = {"yillar": [int(t) for t in SEGE_YIL], "n": [sege_n[t] for t in SEGE_YIL],
            "sira": [[sira.get((g, t)) for t in SEGE_YIL] for g in kodlar]}
    for t in SEGE_YIL:  # her yılda sıralar 1..n eksiksiz olmalı
        assert sorted(sira[(g, y)] for (g, y) in sira if y == t) == list(range(1, sege_n[t] + 1)), t

    # ---- İliniz nerede: 12 göstergede il profili ve benzer iller
    PROFIL = [  # (gösterge, kısa ad, birim, ondalık, log ölçek, ikon)
        ("Ortanca Yaş", "Ortanca yaş", "yaş", 1, False, "nufus"),
        ("Doğurganlık Hızı (Çocuk Sayısı)", "Doğurganlık hızı", "çocuk", 2, False, "aile"),
        ("Ortalama Hanehalkı Büyüklüğü", "Hanehalkı büyüklüğü", "kişi", 1, False, "aile"),
        ("Net Göç Hızı (Binde)", "Net göç hızı", "‰", 1, False, "nufus"),
        ("Kişi Başına GSYH (TL)", "Kişi başı GSYH", "TL", 0, False, "ekonomi"),
        ("Kişi Başına İhracat ($) (Faaliyet İline Göre)", "Kişi başı ihracat", "$", 0, True, "ticaret"),
        ("15 Yaş ve Üzeri Yüksekokul veya Fakülte Mezunu Oranı (%)", "Üniversite mezunu oranı", "%", 1, False, "egitim"),
        ("Okul Öncesi Net Okullaşma Oranı (3-5 Yaş) (%)", "Okul öncesi okullaşma", "%", 1, False, "egitim"),
        ("Doğuşta Beklenen Yaşam Süresi", "Doğuşta beklenen yaşam süresi", "yıl", 1, False, "saglik"),
        ("Bin Kişi Başına Düşen Toplam Hekim Sayısı", "Bin kişiye hekim", "hekim", 1, False, "saglik"),
        ("Bin Kişi Başına Otomobil Sayısı", "Bin kişiye otomobil", "otomobil", 0, False, "ulasim"),
        ("100.000 Kişiye Düşen Sabit Genişbant Abone Sayısı", "Genişbant (100 bin kişiye)", "abone", 0, False, "haberlesme"),
    ]
    profil = []
    for gosterge, kisa, birim, ond, log, ikon in PROFIL:
        yil, d = son(gosterge)
        r = db.execute("SELECT value FROM values_long WHERE geo='TR' AND indicator=? AND time=?", (gosterge, yil)).fetchone()
        trv = r[0] if r else None
        if trv is None and "İhracat" in gosterge:
            _, ih = son("Faaliyet İline Göre İhracat (1000 $)", yil)
            p = nufus(yil)
            trv = sum(ih.values()) * 1000 / sum(p[g] for g in ih)
        profil.append({"kisa": kisa, "gosterge": gosterge, "birim": birim, "ondalik": ond, "log": log, "ikon": ikon,
                       "yil": yil, "tr": trv, "deger": [d.get(g) for g in kodlar]})
    # benzer iller: standartlaştırılmış (log ölçekli olanlar log alınarak) 12 göstergede Öklid uzaklığı
    Z = []
    for pr in profil:
        v = np.array([math.log(x) if pr["log"] else x for x in pr["deger"]], dtype=float)
        Z.append((v - v.mean()) / v.std())
    Z = np.array(Z).T
    uz = np.sqrt(((Z[:, None, :] - Z[None, :, :]) ** 2).sum(-1))
    benzer = [[int(j) for j in np.argsort(uz[i])[1:4]] for i in range(81)]

    # ---- Düzey 2 profili: aynı göstergeler 26 bölge için (bölge düzeyinde yayımlanmayan gösterge atlanır)
    d2ler = list(db.execute("SELECT geo, name FROM entities WHERE level='region26' ORDER BY geo"))
    d2kod = [g for g, _ in d2ler]
    il_ust = dict(db.execute("SELECT geo, parent FROM entities WHERE level='province'"))
    il_bolge = {g: BOLGE[p] for g, _, p in iller}
    d2_bolge = {}
    for g, _, p in sorted(iller, key=lambda x: x[2]):  # bölgenin coğrafi bölgesi: plakası en küçük ilinki
        d2_bolge.setdefault(il_ust[g], il_bolge[g])

    def son_d2(gosterge, yil):
        return {g: v for g, v in db.execute("SELECT v.geo, value FROM values_long v JOIN entities e ON e.geo=v.geo "
                                             "WHERE e.level='region26' AND indicator=? AND time=? AND value IS NOT NULL",
                                             (gosterge, yil))}
    profil_d2 = []
    for pr in profil:
        d = son_d2(pr["gosterge"], pr["yil"])
        if len(d) < 26:
            continue
        profil_d2.append({**pr, "deger": [d.get(g) for g in d2kod]})
    Z = []
    for pr in profil_d2:
        v = np.array([math.log(x) if pr["log"] else x for x in pr["deger"]], dtype=float)
        Z.append((v - v.mean()) / v.std())
    Z = np.array(Z).T
    uz = np.sqrt(((Z[:, None, :] - Z[None, :, :]) ** 2).sum(-1))
    benzer_d2 = [[int(j) for j in np.argsort(uz[i])[1:4]] for i in range(26)]
    profil_d2_out = {
        "birimler": [{"kod": g, "ad": ad, "bolge": d2_bolge[g]} for g, ad in d2ler],
        "gostergeler": profil_d2, "benzer": benzer_d2,
        "ilUst": [il_ust[g] for g in kodlar],
    }

    # ---- Türkiye 100 kişi olsaydı: birim grafiği
    def trv(gosterge):
        r = db.execute("SELECT time, value FROM values_long WHERE geo='TR' AND indicator=? AND value IS NOT NULL "
                       "ORDER BY time DESC LIMIT 1", (gosterge,)).fetchone()
        return r[0], r[1]

    def yuze(degerler):
        """En büyük kalan yöntemiyle toplamı 100 olan tam sayılar."""
        top = sum(degerler)
        ham = [v / top * 100 for v in degerler]
        tam = [int(math.floor(v)) for v in ham]
        for k in sorted(range(len(ham)), key=lambda k: -(ham[k] - tam[k]))[:100 - sum(tam)]:
            tam[k] += 1
        return tam, [round(v, 1) for v in ham]

    def gorunum(anahtar, ad, taban, yil, kategoriler, cinsiyet=None, grup="Nüfus ve toplum", vurgu=None):
        out_k = []
        adet, oran = yuze([v for _, v in kategoriler])
        for (k, _), a, o in zip(kategoriler, adet, oran):
            out_k.append({"ad": k, "adet": a, "oran": o})
        g = {"anahtar": anahtar, "ad": ad, "taban": taban, "yil": yil, "kategoriler": out_k, "grup": grup}
        if vurgu is not None:
            g["vurgu"] = vurgu
        if cinsiyet:
            g["cinsiyet"] = {}
            for c, degerler in cinsiyet.items():
                a, o = yuze(degerler)
                g["cinsiyet"][c] = [{"adet": x, "oran": y} for x, y in zip(a, o)]
        return g

    yil, top_n = trv("Toplam Nüfus")
    _, c014 = trv("0-14 Yaş Grubu Nüfus")
    _, c1564 = trv("15-64 Yaş Grubu Nüfus")
    yuz = [gorunum("yas", "Yaş", "nüfus", yil, [("0–14 yaş", c014), ("15–64 yaş", c1564), ("65 yaş ve üstü", top_n - c014 - c1564)])]
    yy, yk = trv("Yoğun Kent Nüfus Oranı (%)")
    _, ok = trv("Orta Yoğun Kent Nüfus Oranı (%)")
    _, kk = trv("Kır Nüfus Oranı (%)")
    yuz.append(gorunum("yerlesim", "Yerleşim", "nüfus", yy, [("Yoğun kent", yk), ("Orta yoğun kent", ok), ("Kır", kk)]))
    bol = [0.0] * 7
    for o in il_out:
        bol[o["bolge"]] += o["nufus"]
    yuz.append(gorunum("bolge", "Bölge", "nüfus", yil, list(zip(BOLGELER, bol))))
    E_ = "Eğitim Durumuna Göre Nüfus (15+ Yaş): "
    ey, _ = trv("15 Yaş ve Üzeri Okuma Yazma Bilmeyen Sayısı")
    def eg(ek):
        g = lambda ad: trv(E_ + ad + ek)[1]
        return [g("Okuma Yazma Bilmeyen"), g("Okuma Yazma Bilen Fakat Bir Okul Bitirmeyen"),
                g("İlkokul Mezunu") + g("İlköğretim Mezunu") + g("Ortaokul veya Dengi Meslek Okulu Mezunu"),
                g("Lise veya Dengi Meslek Okulu Mezunu"),
                g("Yükseköğretim Mezunu") + g("Yüksek Lisans Mezunu") + g("Doktora Mezunu")]
    erkek, kadin = eg(", Erkek"), eg(", Kadın")
    toplam = [a + b for a, b in zip(erkek, kadin)]
    yuz.append(gorunum("egitim", "Eğitim", "15 yaş ve üstü nüfus", ey,
                       list(zip(["Okuma yazma bilmiyor", "Okul bitirmemiş", "İlkokul ya da ortaokul", "Lise", "Üniversite ve üstü"], toplam)),
                       {"Kadın": kadin, "Erkek": erkek}))
    iy, ist = trv("İstihdam Oranı (15+ yaş) (%)")
    _, kat = trv("İşgücüne Katılma Oranı (15+ yaş) (%)")
    yuz.append(gorunum("isgucu", "İş", "15 yaş ve üstü nüfus", iy, [("Çalışıyor", ist), ("İş arıyor (işsiz)", kat - ist), ("İşgücü dışında", 100 - kat)]))
    M_ = "Medeni Duruma Göre Nüfus (15+ Yaş): "
    def md(ek):
        return [trv(M_ + ad + ek)[1] for ad in ("Hiç Evlenmemiş", "Evli", "Boşanmış", "Eşi Ölmüş")]
    my, _ = trv(M_ + "Evli")
    yuz.append(gorunum("medeni", "Medeni durum", "15 yaş ve üstü nüfus", my,
                       list(zip(["Hiç evlenmemiş", "Evli", "Boşanmış", "Eşi ölmüş"], md(""))),
                       {"Kadın": md(", Kadın"), "Erkek": md(", Erkek")}))
    H_ = "Türüne Göre Hanehalkı Sayısı: "
    hy, _ = trv(H_ + "Tek Çekirdek Aileli")
    yuz.append(gorunum("hane", "Hane tipi", "hanehalkı", hy,
                       [("Tek çekirdek aile", trv(H_ + "Tek Çekirdek Aileli")[1]), ("Geniş aile", trv(H_ + "Geniş Aileli")[1]),
                        ("Tek kişilik hane", trv(H_ + "Tek Kişilik")[1]),
                        ("Çekirdek aile olmayan çok kişilik hane", trv(H_ + "Çok Kişilik, Çekirdek Aile Olmayan")[1])]))
    # İşgücü ve gelir
    for g_ in yuz:
        if g_["anahtar"] == "isgucu":
            g_["grup"] = "İşgücü ve gelir"
    S_ = "Sektörünün Toplam İstihdam İçerisindeki Payı (15+ yaş) (%)"
    sy, _ = trv("Tarım " + S_)
    sek = [trv(a + " " + S_)[1] for a in ("Tarım", "Sanayi", "Hizmetler")]
    assert abs(sum(sek) - 100) < 1.5, sek
    yuz.append(gorunum("sektor", "Sektör", "çalışanlar", sy,
                       list(zip(["Tarım", "Sanayi (inşaat dahil)", "Hizmetler"], sek)), grup="İşgücü ve gelir"))
    K_ = "SKA 08 İnsana Yakışır İş ve Ekonomik Büyüme: 8.3.1 Sektör ve cinsiyete göre sosyal güvenlik kuruluşuna kayıtlı olmadan çalışanların toplam istihdamdaki oranı ({}) (%)"
    ky, kt = trv(K_.format("Toplam"))
    _, kkd = trv(K_.format("Kadın"))
    _, ker = trv(K_.format("Erkek"))
    yuz.append(gorunum("kayitdisi", "Sosyal güvence", "çalışanlar", ky,
                       [("Sosyal güvenlik kuruluşuna kayıtlı", 100 - kt), ("Kayıt dışı", kt)],
                       {"Kadın": [100 - kkd, kkd], "Erkek": [100 - ker, ker]}, grup="İşgücü ve gelir", vurgu=1))
    py_, pv = trv("Yoksulluk Oranı (%) (Medyan Gelirin %60'ına Göre)")
    yuz.append(gorunum("yoksulluk", "Göreli yoksulluk", "nüfus", py_,
                       [("Yoksulluk sınırının üzerinde", 100 - pv), ("Yoksulluk sınırının altında", pv)], grup="İşgücü ve gelir"))

    # ---- Zaman çizelgesi 2000–2025: veriden çıkarılan dönüm noktaları
    def tseri(gosterge, geo="TR"):
        return [(int(t), v) for t, v in db.execute("SELECT time, value FROM values_long WHERE geo=? AND indicator=? "
                                                   "AND value IS NOT NULL ORDER BY time", (geo, gosterge))]

    def esik(seri, deger, yukari=True):
        """Serinin eşiği ilk aştığı yıl (önceki yıl eşiğin öbür tarafındaysa); yoksa None."""
        for (y0, v0), (y1, v1) in zip(seri, seri[1:]):
            if (yukari and v0 < deger <= v1) or (not yukari and v0 > deger >= v1):
                return y1, v1
        return None

    def tr_sayi(v, d=0):
        s_ = f"{v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")
        return s_

    def olay(yil, ikon, baslik, metin, seri, birim, ond, vurgu=None):
        return {"yil": yil, "ikon": ikon, "baslik": baslik, "metin": metin, "birim": birim, "ondalik": ond,
                "seri": [[y, v] for y, v in seri], "vurgu": vurgu if vurgu is not None else yil}

    zaman = []
    kb = tseri("Kişi Başına GSYH ($)")
    e = esik(kb, 10000)
    if e:
        zaman.append(olay(e[0], "ekonomi", "Kişi başına GSYH 10 bin doları aştı",
                          f"2000 yılında {tr_sayi(kb[0][1])} $ olan kişi başına GSYH, {e[0]} yılında {tr_sayi(e[1])} $ düzeyine ulaşmıştır. {kb[-1][0]} yılında kişi başına GSYH {tr_sayi(kb[-1][1])} $ olarak gerçekleşmiştir.",
                          kb, "$", 0))
    th = tseri("Bölgesel Eşitsizlik: Theil Endeksi, İller (Kişi Başına GSYH)")
    e = esik(th, th[0][1] * 0.6, yukari=False)
    if e:
        zaman.append(olay(e[0], "ekonomi", "İller arası gelir eşitsizliğinde belirgin azalma",
                          f"İller arasındaki kişi başına gelir eşitsizliği (Theil endeksi) {e[0]} yılında 2000 yılı düzeyinin %60'ının altına gerilemiştir. "
                          f"Endeksin {th[-1][0]} yılındaki değeri, 2000 yılı değerinin %{round(th[-1][1] / th[0][1] * 100)} oranına karşılık gelmektedir.", th, "", 3))
    ist = tseri("Türkiye GSYH'si İçindeki Pay (Cari Fiyatlarla) (%)", "TR100")
    if ist:
        zirve = max(ist, key=lambda x: x[1])
        zaman.append(olay(zirve[0], "ekonomi", "İstanbul'un GSYH içindeki payı en yüksek düzeyde",
                          f"İstanbul'un Türkiye GSYH'si içindeki payı {zirve[0]} yılında %{tr_sayi(zirve[1], 1)} ile dönemin en yüksek düzeyine ulaşmıştır. Bu pay {ist[-1][0]} yılında %{tr_sayi(ist[-1][1], 1)} olarak gerçekleşmiştir.",
                          ist, "%", 1))
    ih = tseri("Toplam İhracat (1000 $)")
    e = esik(ih, 250e6)
    if e:
        zaman.append(olay(e[0], "ticaret", "İhracat 250 milyar doları aştı",
                          f"İllerin toplam ihracatı {ih[0][0]} yılında {tr_sayi(ih[0][1] / 1e6)} milyar $ iken {e[0]} yılında {tr_sayi(e[1] / 1e6)} milyar $ düzeyine ulaşmıştır.",
                          [(y, v / 1e6) for y, v in ih], "milyar $", 0))
    nf = tseri("Toplam Nüfus")
    for esik_n in (75e6, 80e6, 85e6):
        e = esik(nf, esik_n)
        if e:
            zaman.append(olay(e[0], "nufus", f"Nüfus {int(esik_n / 1e6)} milyonu aştı",
                              f"Adrese Dayalı Nüfus Kayıt Sistemi sonuçlarına göre {e[0]} yılı sonunda Türkiye nüfusu {tr_sayi(e[1] / 1e6, 1)} milyon kişidir.",
                              [(y, v / 1e6) for y, v in nf], "milyon", 1))
    oy = tseri("Ortanca Yaş")
    e = esik(oy, 30)
    if e:
        zaman.append(olay(e[0], "nufus", "Ortanca yaş 30'un üzerine çıktı",
                          f"Ortanca yaş {e[0]} yılında {tr_sayi(e[1], 1)} olmuştur; diğer bir ifadeyle nüfusun yarısı bu yaşın üzerindedir. {oy[-1][0]} yılında ortanca yaş {tr_sayi(oy[-1][1], 1)} olarak gerçekleşmiştir.", oy, "yaş", 1))
    y65 = tseri("65 Yaş ve Üzeri Nüfus")
    nfd = dict(nf)
    pay65 = [(y, v / nfd[y] * 100) for y, v in y65 if y in nfd]
    e = esik(pay65, 10)
    if e:
        zaman.append(olay(e[0], "nufus", "65 ve daha yukarı yaştaki nüfusun payı %10'u aştı",
                          f"65 ve daha yukarı yaştaki nüfusun toplam nüfus içindeki payı {e[0]} yılında %10'un üzerine çıkmıştır. Bu oran {pay65[-1][0]} yılında %{tr_sayi(pay65[-1][1], 1)} olarak gerçekleşmiştir.",
                          pay65, "%", 1))
    dg = tseri("Doğurganlık Hızı (Çocuk Sayısı)")
    e = esik(dg, 1.6, yukari=False)
    if e:
        zaman.append(olay(e[0], "aile", "Toplam doğurganlık hızı 1,6 çocuğun altına geriledi",
                          f"Kadın başına ortalama çocuk sayısı {dg[0][0]} yılında {tr_sayi(dg[0][1], 2)} iken {e[0]} yılında {tr_sayi(e[1], 2)}, "
                          f"{dg[-1][0]} yılında ise {tr_sayi(dg[-1][1], 2)} olmuştur. Nüfusun kendini yenileyebilmesi için gereken düzey 2,1 çocuktur.", dg, "çocuk", 2))
    ev = tseri("Kadının Ortalama İlk Evlenme Yaşı")
    e = esik(ev, 25)
    if e:
        zaman.append(olay(e[0], "aile", "Kadınlarda ortalama ilk evlenme yaşı 25'e yükseldi",
                          f"Kadınlarda ortalama ilk evlenme yaşı {ev[0][0]} yılında {tr_sayi(ev[0][1], 1)} iken {e[0]} yılında {tr_sayi(e[1], 1)}, {ev[-1][0]} yılında ise {tr_sayi(ev[-1][1], 1)} olmuştur.",
                          ev, "yaş", 1))
    hh = tseri("Ortalama Hanehalkı Büyüklüğü")
    e = esik(hh, 3.5, yukari=False)
    if e:
        zaman.append(olay(e[0], "aile", "Ortalama hanehalkı büyüklüğü 3,5 kişinin altına geriledi",
                          f"Ortalama hanehalkı büyüklüğü {hh[0][0]} yılında {tr_sayi(hh[0][1], 1)} kişi iken {e[0]} yılında {tr_sayi(e[1], 1)}, {hh[-1][0]} yılında ise {tr_sayi(hh[-1][1], 1)} kişi olmuştur.",
                          hh, "kişi", 1))
    un = tseri("15 Yaş ve Üzeri Yüksekokul veya Fakülte Mezunu Oranı (%)")
    for esik_u in (10, 20):
        e = esik(un, esik_u)
        if e:
            zaman.append(olay(e[0], "egitim", f"Yükseköğretim mezunlarının payı %{esik_u} düzeyine ulaştı",
                              f"15 ve daha yukarı yaştaki nüfus içinde yükseköğretim mezunlarının payı {un[0][0]} yılında %{tr_sayi(un[0][1], 1)} iken {e[0]} yılında %{tr_sayi(e[1], 1)} olmuştur.",
                              un, "%", 1))
    bo = tseri("Bebek Ölüm Hızı (Binde)")
    e = esik(bo, 10, yukari=False)
    if e and e[1] < 10:
        zaman.append(olay(e[0], "saglik", "Bebek ölüm hızı binde 10'un altına geriledi",
                          f"Bin canlı doğumda bir yaşını doldurmadan ölen bebek sayısı {bo[0][0]} yılında {tr_sayi(bo[0][1], 1)} iken {e[0]} yılında {tr_sayi(e[1], 1)} olmuştur.",
                          bo, "‰", 1))
    hat = dict(tseri("Toplam Nüfus", "TR631"))
    km = dict(tseri("Toplam Nüfus", "TR632"))
    if 2022 in hat and 2023 in hat:
        dh = (hat[2023] / hat[2022] - 1) * 100
        dk = (km[2023] / km[2022] - 1) * 100 if 2022 in km and 2023 in km else None
        zaman.append(olay(2023, "nufus", "6 Şubat 2023 depremleri",
                          f"Kahramanmaraş merkezli depremlerin ardından bir yıl içinde Hatay'ın nüfusu %{tr_sayi(abs(dh), 1)}"
                          + (f", Kahramanmaraş'ın nüfusu %{tr_sayi(abs(dk), 1)} oranında azalmıştır." if dk is not None else " oranında azalmıştır."),
                          [(y, v / 1e6) for y, v in sorted(hat.items())], "milyon (Hatay)", 2))
    zaman.sort(key=lambda o: (o["yil"], o["baslik"]))

    out = {
        "ozet": ozet,
        "zaman": zaman,
        "yuz": yuz,
        "profil": {"gostergeler": profil, "benzer": benzer},
        "profilD2": profil_d2_out,
        "sege": sege,
        "kaynak": "TÜİK (build/veri.db), OECD TL2024 kentsel–kırsal sınıfı; hesaplama: platform",
        "bolgeler": BOLGELER,
        "oecdSinif": ["Ağırlıklı kentsel", "Ara (geçiş)", "Ağırlıklı kırsal"],
        "karo": {"sutun": SUT, "satir": SAT},
        "iller": il_out,
        "pasta": pasta,
        "suru": suru,
        "nufusYil": son("Toplam Nüfus")[0],
    }
    (VERI / "vitrin.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"vitrin.json: {len(il_out)} il, {len(pasta)} pasta ölçüsü, {n_a} aday gösterge, {len(suru)} eksen")
    for o in il_out:
        b = o["birinci"]
        print(f"  {o['ad']:15s} {b['sira']:2d}. {b['yon']:9s} {b['kisa']}  ({b['yil']})")


if __name__ == "__main__":
    main()
