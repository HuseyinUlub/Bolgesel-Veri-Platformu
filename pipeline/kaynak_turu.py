"""Göstergelerin veri kaynağı türü (oecd-ozgun / oecd-ulusal / platform / ulusal). Bkz. tools/kaynak-turu/siniflandir.py."""

# (gösterge adında geçen ifade, ulusal kaynak)
ULUSAL_KARSILIK = [
    ("Genel Seçimlere Katılım", "Yüksek Seçim Kurulu seçim sonuçları"),
    ("Kasten Öldürme", "Emniyet Genel Müdürlüğü ve Adalet Bakanlığı istatistikleri (il düzeyinde açık veri sınırlı)"),
    ("Motorlu Taşıt Hırsızlığı", "Emniyet Genel Müdürlüğü istatistikleri (il düzeyinde açık veri sınırlı)"),
    ("Uluslararası Göç", "TÜİK uluslararası göç istatistikleri"),
    ("Elektrikli Taşıt", "TÜİK motorlu kara taşıtları istatistikleri"),
    ("Hibrit Taşıt", "TÜİK motorlu kara taşıtları istatistikleri"),
    ("Hastaneden Taburcu", "Sağlık Bakanlığı sağlık istatistikleri yıllığı"),
    ("Ar-Ge Harcamasının", "TÜİK araştırma-geliştirme faaliyetleri araştırması"),
    ("Araştırmacıların", "TÜİK araştırma-geliştirme faaliyetleri araştırması"),
    ("İkincil Arıtmalı", "TÜİK belediye atık su istatistikleri"),
    ("En Az Lise Mezunu İşgücü", "TÜİK Hanehalkı İşgücü Anketi"),
]
PLATFORM = ("hesaplanmıştır", "platform", "Platform", "Türetilmiş")


def tur(ad, kaynak):
    kaynak = kaynak or ""
    if kaynak.startswith("OECD"):
        for ifade, ulusal in ULUSAL_KARSILIK:
            if ifade in ad:
                return "oecd-ulusal", ulusal
        return "oecd-ozgun", ""
    if any(k in kaynak for k in PLATFORM):
        return "platform", ""
    return "ulusal", ""


# Gösterge başlığında parantez içinde gösterilen kısa kaynak adı
KISA = [
    ("OECD", "OECD"),
    ("Türkiye İstatistik Kurumu", "TÜİK"),
    ("TÜİK", "TÜİK"),
    ("Millî Eğitim", "MEB"),
    ("Bilgi Teknolojileri ve İletişim", "BTK"),
    ("Enerji Piyasası", "EPDK"),
    ("Bankacılık Düzenleme", "BDDK"),
    ("Sosyal Güvenlik Kurumu", "SGK"),
    ("Çalışma ve Sosyal Güvenlik", "ÇSGB"),
    ("Sağlık Bakanlığı", "Sağlık Bakanlığı"),
    ("Kültür ve Turizm", "Kültür ve Turizm Bakanlığı"),
    ("Sanayi ve Teknoloji", "Sanayi ve Teknoloji Bakanlığı"),
    ("DPT", "DPT"),
]


def kisa(ad, kaynak):
    """Başlıkta gösterilecek kısa kaynak (ör. TÜİK, OECD). SEGE serileri birden çok kurumun çalışmalarını birleştirir."""
    if "SEGE" in ad or "Gelişmişlik" in ad:
        return "DPT, Sanayi ve Teknoloji Bakanlığı"
    k = kaynak or ""
    # platform hesaplamaları verinin geldiği kurumla anılır
    if k.startswith("Platform hesaplaması") and "TÜİK" in k:
        return "TÜİK"
    for ifade, ad_ in KISA:
        if k.startswith(ifade) or (ifade != "OECD" and ifade in k):
            return ad_
    return None


def gorunen(ad, kaynak):
    """Sitede gösterilen başlık: ad + (kısa kaynak); adında zaten OECD geçen OECD göstergelerine eklenmez."""
    k = kisa(ad, kaynak)
    if not k or (k == "OECD" and "OECD" in ad):
        return ad
    return f"{ad} ({k})"
