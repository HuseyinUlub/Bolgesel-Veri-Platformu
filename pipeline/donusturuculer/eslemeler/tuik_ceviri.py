"""
tuik_ceviri.py — TÜİK Bölgesel İstatistikler (İngilizce) sütun adlarını Türkçe gösterge adına çevirir.

Yalnızca tuik-bolgesel.csv eşleme dosyası ÜRETİLİRKEN kullanılır (bir kez). Üretilen eşleme elle
düzeltilebilir; veri hattı bu modülü değil eşleme dosyasını okur.

Biçim:  "<Konu>: <kırılım, kırılım> (<birim>)"
"""

import re

# konu -> (Türkçe konu, birim | None, kategori)
KONU = {
    "Animal products": ("Hayvansal Ürünler", None, "Tarım"),
    "Areas for land under protective cover by type (decare)": ("Örtü Altı Tarım Alanı", "Dekar", "Tarım"),
    "Agricultural equipment and machinery": ("Tarımsal Alet ve Makine Sayısı", "Adet", "Tarım"),
    "Harvested area of cereals and other crops (hectares)": ("Tahıllar ve Diğer Bitkisel Ürünler Hasat Alanı", "Hektar", "Tarım"),
    "Vegetable and fruit production for land under protective cover (tons)": ("Örtü Altı Sebze ve Meyve Üretimi", "Ton", "Tarım"),
    "Production of area of cereals and other crops (tons)": ("Tahıllar ve Diğer Bitkisel Ürünler Üretimi", "Ton", "Tarım"),
    "Livestock": ("Canlı Hayvan Sayısı", "Baş", "Tarım"),
    "Land use": ("Arazi Kullanımı", None, "Tarım"),
    "Organic crop production (transition period included)": ("Organik Bitkisel Üretim (Geçiş Süreci Dahil)", None, "Tarım"),
    "Construction permit-Number of buildings": ("Yapı Ruhsatı - Bina Sayısı", None, "İnşaat ve Konut"),
    "Occupancy permit-Number of buildings": ("Yapı Kullanma İzin Belgesi - Bina Sayısı", None, "İnşaat ve Konut"),
    "Construction permit-Floor area": ("Yapı Ruhsatı - Yüzölçümü", "m²", "İnşaat ve Konut"),
    "Occupancy permit-Floor area": ("Yapı Kullanma İzin Belgesi - Yüzölçümü", "m²", "İnşaat ve Konut"),
    "Construction permit-Number of dwelling units": ("Yapı Ruhsatı - Daire Sayısı", None, "İnşaat ve Konut"),
    "Occupancy permit-Number of dwelling units": ("Yapı Kullanma İzin Belgesi - Daire Sayısı", None, "İnşaat ve Konut"),
    "House Sales (2013 and later)": ("Konut Satışları", None, "İnşaat ve Konut"),
    "Distribution of household consumption expenditure by types of expenditure, 2024":
        ("Hanehalkı Tüketim Harcamasının Türlerine Göre Dağılımı (COICOP 2018)", "%", "Tüketim Harcamaları"),
    "Suicides by sex and age group": ("İntihar Sayısı", None, "Demografi"),
    "Number of marriages by age group": ("Yaş Grubuna Göre Evlenme Sayısı", None, "Demografi"),
    "Number of divorces by age group": ("Yaş Grubuna Göre Boşanma Sayısı", None, "Demografi"),
    "Divorces by cause": ("Nedenine Göre Boşanma Sayısı", None, "Demografi"),
    "Divorces by duration of marriage": ("Evlilik Süresine Göre Boşanma Sayısı", None, "Demografi"),
    "Deaths by age group": ("Yaş Grubuna Göre Ölüm Sayısı", None, "Demografi"),
    "Distribution of Selected Causes of Death by Usual Residence": ("Seçilmiş Ölüm Nedenlerine Göre Ölüm Sayısı", None, "Demografi"),
    "Daily and monthly infant deaths": ("Günlük ve Aylık Bebek Ölümleri", None, "Demografi"),
    "Births by age group of mother": ("Anne Yaşına Göre Doğum Sayısı", None, "Demografi"),
    "Births by month": ("Aylara Göre Doğum Sayısı", None, "Demografi"),
    "Number of students for vocational training school and undergraduate programs of higher education institutions":
        ("Yükseköğretim (Önlisans ve Lisans) Öğrenci Sayısı", None, "Eğitim"),
    "Number of teaching staff within own unit for higher education institutions":
        ("Yükseköğretim Öğretim Elemanı Sayısı", None, "Eğitim"),
    "Population by literacy status (6 years of age and over)": ("Okuma Yazma Durumuna Göre Nüfus (6+ Yaş)", None, "Eğitim"),
    "Population by education status (15 years of age and over)": ("Eğitim Durumuna Göre Nüfus (15+ Yaş)", None, "Eğitim"),
    "Number of students per school, division, teacher and classroom by level of education (2012 and later)":
        ("Eğitim Kademesine Göre Öğrenci Başına Düşen", None, "Eğitim"),
    "Number of schools, divisions, students, teachers and classrooms by level of education (2012 and later)":
        ("Eğitim Kademesine Göre Okul, Şube, Öğrenci, Öğretmen ve Derslik Sayısı", None, "Eğitim"),
    "Electricity consumptions by users": ("Kullanım Yerlerine Göre Elektrik Tüketimi", None, "Enerji"),
    "Number of municipalities, districts and villages": ("İdari Yapı", None, "Nüfus"),
    "Number of hospitals and beds": ("Hastane", None, "Sağlık"),
    "Number of the poor and poverty rate by equivalised household disposable income (60% of the median income )":
        ("Yoksulluk", None, "Gelir ve Yaşam Koşulları"),
    "Number of enterprises according to business registers": ("İş Kayıtlarına Göre Girişim Sayısı", None, "Sanayi"),
    "Rate of change in 12 months moving averages in the consumer price index by December (%), 2003=100":
        ("TÜFE 12 Aylık Ortalamalara Göre Değişim (Aralık, 2003=100)", "%", "Enflasyon ve Fiyat"),
    "Annual rate of change (December to December) in the consumer price index (%), 2003=100":
        ("TÜFE Yıllık Değişim (Aralık-Aralık, 2003=100)", "%", "Enflasyon ve Fiyat"),
    "Economically active population (Labour force) by educational status [Between 25 and 64 years-thousand people]":
        ("Eğitim Durumuna Göre İşgücü (25-64 Yaş)", "Bin Kişi", "İşgücü"),
    "Employment by educational status [Between 25 and 64 years-thousand people]":
        ("Eğitim Durumuna Göre İstihdam (25-64 Yaş)", "Bin Kişi", "İşgücü"),
    "Average number of usual weekly hours of work in main job [15 years old and over]":
        ("Ana İşte Olağan Haftalık Ortalama Çalışma Süresi (15+ Yaş)", "Saat", "İşgücü"),
    "Economically active population (Labour force) by educational status [15 years old and over-thousand people]":
        ("Eğitim Durumuna Göre İşgücü (15+ Yaş)", "Bin Kişi", "İşgücü"),
    "Employment by age group [15 years old and over-thousand people]": ("Yaş Grubuna Göre İstihdam", "Bin Kişi", "İşgücü"),
    "Unemployment by age group [15 years old and over-thousand people]": ("Yaş Grubuna Göre İşsiz", "Bin Kişi", "İşgücü"),
    "Employment by status in employment [15 years old and over-thousand people]":
        ("İşteki Duruma Göre İstihdam (15+ Yaş)", "Bin Kişi", "İşgücü"),
    "Economically active population (Labour force) by age group [15 years old and over-thousand people]":
        ("Yaş Grubuna Göre İşgücü", "Bin Kişi", "İşgücü"),
    "Employment by full-time/part-time [15 years old and over-thousand people]":
        ("Tam/Yarı Zamanlı Çalışmaya Göre İstihdam (15+ Yaş)", "Bin Kişi", "İşgücü"),
    "Employment by educational status [15 years old and over-thousand people]":
        ("Eğitim Durumuna Göre İstihdam (15+ Yaş)", "Bin Kişi", "İşgücü"),
    "Economic activity rate (Labour force participation rate) by age group [15 years old and over-%]":
        ("Yaş Grubuna Göre İşgücüne Katılma Oranı", "%", "İşgücü"),
    "Employment rates by age group [15 years old and over-%]": ("Yaş Grubuna Göre İstihdam Oranı", "%", "İşgücü"),
    "Unemployment rate by age group [15 years old and over-%]": ("Yaş Grubuna Göre İşsizlik Oranı", "%", "İşgücü"),
    "Sex ratio according to Address Based Population Registration System": ("Cinsiyet", None, "Nüfus"),
    "Young population by sex": ("Genç Nüfus", None, "Nüfus"),
    "Child population by age group": ("Çocuk Nüfus", None, "Nüfus"),
    "Population by age group and sex according to Address Based Population Registration System":
        ("Yaş Grubu ve Cinsiyete Göre Nüfus", None, "Nüfus"),
    "According to Statistical Regional level 1 in-migration, out-migration, net-migration and net-migration rate according to Address Based Population Registration System (ABPRS)":
        ("Düzey 1'e Göre Göç", None, "Göç"),
    "Population by marital status (15 years of age and over)": ("Medeni Duruma Göre Nüfus (15+ Yaş)", None, "Nüfus"),
    "Number of households by type": ("Türüne Göre Hanehalkı Sayısı", None, "Nüfus"),
    "Population Projection": ("Nüfus Projeksiyonu", None, "Nüfus"),
    "Number of arriving citizens by province of border gate and mode of transport":
        ("Sınır Kapısına ve Ulaşım Türüne Göre Gelen Vatandaş", None, "Turizm"),
    "Number of departing foreigners by province of border gate and mode of transport":
        ("Sınır Kapısına ve Ulaşım Türüne Göre Giden Yabancı", None, "Turizm"),
    "Number of arriving foreigners by province of border gate and mode of transport":
        ("Sınır Kapısına ve Ulaşım Türüne Göre Gelen Yabancı", None, "Turizm"),
    "Number of departing citizens by province of border gate and mode of transport":
        ("Sınır Kapısına ve Ulaşım Türüne Göre Giden Vatandaş", None, "Turizm"),
    "Number of local unit, employment and payments in insurance and reinsurance":
        ("Sigorta ve Reasürans", None, "Ekonomi"),
    "Number of local unit, employment and payments in activities auxiliary to financial services and insurance activities":
        ("Finansal Hizmetler ve Sigortacılık İçin Yardımcı Faaliyetler", None, "Ekonomi"),
    "Number of local unit, employment and payments in credit institutions": ("Kredi Kuruluşları", None, "Ekonomi"),
    "Number of local unit, employment and payments in financial service activities (except insurance and pension funding)":
        ("Finansal Hizmet Faaliyetleri (Sigorta ve Emeklilik Fonları Hariç)", None, "Ekonomi"),
    "Road traffic accidents": ("Karayolu Trafik Kazaları", None, "Ulaştırma"),
    "airports": ("Havalimanları", None, "Ulaştırma"),
}

# Konusu olmayan / özel tek sütunlar (tam başlık -> ad, kategori)
TAM = {
    "Road construction and work machinery": ("Yol Yapım ve İş Makinesi Sayısı", "Ulaştırma"),
    "Air traffic arrivals-departures / Turkish": ("Hava Trafiği Geliş-Gidiş: Türk Havayolu", "Ulaştırma"),
    "Air traffic arrivals-departures / Foreign": ("Hava Trafiği Geliş-Gidiş: Yabancı Havayolu", "Ulaştırma"),
    "Air traffic arrivals-departures / Others": ("Hava Trafiği Geliş-Gidiş: Diğer", "Ulaştırma"),
}

PARCA = {
    "Total": "Toplam", "Toplam": "Toplam", "Male": "Erkek", "Female": "Kadın", "Unknown": "Bilinmeyen",
    "Bilinmeyen": "Bilinmeyen", "Other": "Diğer", "Others": "Diğer",
    # tarım
    "Meat for poultry (tons)": "Kanatlı Eti (Ton)", "Number of hen eggs (1000)": "Tavuk Yumurtası (Bin Adet)",
    "Glass greenhouses": "Cam Sera", "Plastic greenhouses": "Plastik Sera", "High tunnel": "Yüksek Tünel",
    "Low tunnel": "Alçak Tünel", "Plough": "Pulluk", "Sowing machine": "Mibzer", "Manure spreading machinery": "Gübre Dağıtma Makinesi",
    "Water pump": "Su Motopompu", "Stationary milking plant machine": "Sabit Süt Sağım Tesisi",
    "Mobile milking plant machine": "Seyyar Süt Sağım Makinesi", "Combine harvester": "Biçerdöver", "Tractor": "Traktör",
    "Unmanufactured tobacco": "İşlenmemiş Tütün",
    "Plants for perfumary, pharmacy etc. sugarbeets and forage plants seeds": "Parfüm, Eczacılık vb. Bitkiler, Şeker Pancarı ve Yem Bitkisi Tohumları",
    "Potatoes, dried leguminous, edible roots and tubers": "Patates, Kuru Baklagiller, Yenilebilir Kök ve Yumrular",
    "Straw and forage": "Saman ve Yem Bitkileri", "Plants used for sugar manufacturing": "Şeker Üretiminde Kullanılan Bitkiler",
    "Cereals": "Tahıllar", "Raw vegetable materials used in textiles": "Tekstilde Kullanılan Ham Bitkiler", "Oil seeds": "Yağlı Tohumlar",
    "Pepper": "Biber", "Tomatoes": "Domates", "Bean (fresh)": "Taze Fasulye", "Cucumber": "Hıyar", "Marrow": "Kabak",
    "Watermelon": "Karpuz", "Melon": "Kavun", "Lettuce": "Marul", "Eggplant": "Patlıcan", "Strawberries": "Çilek", "Banana": "Muz",
    "Bovine animals of 2 years and over (head)": "Sığır, 2 Yaş ve Üzeri", "Bovine animals of under 2 years (head)": "Sığır, 2 Yaş Altı",
    "Buffaloes (head)": "Manda", "Camels (head)": "Deve", "Pigs (head)": "Domuz", "Sheeps (head)": "Koyun", "Goats (head)": "Keçi",
    "Horses, mules and asses (head)": "At, Katır ve Eşek", "Calves: male (head)": "Buzağı, Erkek", "Calves: female (head)": "Buzağı, Dişi",
    "Bovine animals between 1 and 2 years: Male (head)": "Sığır, 1-2 Yaş, Erkek",
    "Bovine animals between 1 and 2 years: female (head)": "Sığır, 1-2 Yaş, Dişi",
    "Land under permanent crops": "Uzun Ömürlü Bitkiler",
    "Area of fruits beverage and spices crops (hectare)": "Meyve, İçecek ve Baharat Bitkileri Alanı (Hektar)",
    "Area of olive trees (hectare)": "Zeytinlik Alanı (Hektar)",
    "Number of holdings": "İşletme Sayısı", "Production area (Hectare)": "Üretim Alanı (Hektar)", "Productions (Tons)": "Üretim Miktarı (Ton)",
    # inşaat
    "Total building": "Toplam", "Residential buildings": "Konut Amaçlı", "Non residential buildings": "Konut Dışı",
    "One dwelling buildings": "Tek Daireli", "Two and more dwelling buildings": "İki ve Daha Fazla Daireli",
    "Residences for communities": "Toplu Yaşam Amaçlı", "Hotel buildings": "Otel", "Office buildings": "Ofis",
    "Wholesale and retail trade buildings": "Toptan ve Perakende Ticaret", "Traffic and communication buildings": "Trafik ve İletişim",
    "Industrial buildings and warehouses": "Sanayi ve Depo",
    "Public entertainment, education, hospital or institutional care buildings": "Kültür, Eğitim, Sağlık ve Kurumsal Bakım",
    "Other non residential buildings": "Diğer Konut Dışı", "Other non residential": "Diğer Konut Dışı",
    "House Sales (Total)": "Toplam", "Mortgaged Sales": "İpotekli Satış", "Other Sales": "Diğer Satış",
    # tüketim (COICOP 2018)
    "Total consumption expenditures of households": "Toplam", "Food and non-alcoholic beverages": "Gıda ve Alkolsüz İçecekler",
    "Alcoholic beverages and tobacco": "Alkollü İçecekler ve Tütün", "Clothing and footwear": "Giyim ve Ayakkabı",
    "Housing and rent": "Konut ve Kira", "Furniture, houses appliances and home care services": "Mobilya, Ev Aletleri ve Ev Bakım Hizmetleri",
    "Health": "Sağlık", "Transportation": "Ulaştırma", "Information and communication": "Bilgi ve İletişim",
    "Recreation, sport and culture": "Eğlence, Spor ve Kültür", "Restaurants and accommodation services": "Lokanta ve Konaklama",
    "Insurance and financial services": "Sigorta ve Finansal Hizmetler",
    "Personal care, social protection and miscellaneous goods and services": "Kişisel Bakım, Sosyal Koruma ve Çeşitli Mal ve Hizmetler",
    # demografi
    "Groom": "Erkek", "Bride": "Kadın", "Husband": "Erkek", "Wife": "Kadın",
    "Adultery": "Zina", "Attempt against life, cruelty or serious insult": "Hayata Kast, Pek Kötü veya Onur Kırıcı Davranış",
    "Infamous crime or dishonorable conduct": "Suç İşleme ve Haysiyetsiz Hayat Sürme", "Willful desertion": "Terk",
    "Insanity": "Akıl Hastalığı", "Incompatibility": "Şiddetli Geçimsizlik",
    "Less than 1 year": "1 Yıldan Az", "1 year": "1 Yıl", "2 years": "2 Yıl", "3 years": "3 Yıl", "4 years": "4 Yıl", "5 years": "5 Yıl",
    "6-10 years": "6-10 Yıl", "11-15 years": "11-15 Yıl", "16 years and over": "16 Yıl ve Üzeri",
    "Diseases of the circulatory system": "Dolaşım Sistemi Hastalıkları", "Neoplasms": "İyi ve Kötü Huylu Tümörler",
    "Diseases of the respiratory system": "Solunum Sistemi Hastalıkları",
    "Endocrine, nutritional and metabolic diseases": "Endokrin, Beslenme ve Metabolizma Hastalıkları",
    "Diseases of the nervous system and the sense organs": "Sinir Sistemi ve Duyu Organları Hastalıkları",
    "External causes of injury and poisoning": "Yaralanma ve Zehirlenmelerin Dış Nedenleri", "Covid-19": "Covid-19",
    "Daily infant deaths": "Günlük (0-29 Gün)", "Monthly infant deaths": "Aylık (1-11 Ay)",
    "Less than 15": "15 Yaş Altı",
    "January": "Ocak", "February": "Şubat", "March": "Mart", "April": "Nisan", "May": "Mayıs", "June": "Haziran",
    "July": "Temmuz", "August": "Ağustos", "September": "Eylül", "October": "Ekim", "November": "Kasım", "December": "Aralık",
    # eğitim
    "New admissions": "Yeni Kayıt", "Students": "Öğrenci", "Graduates": "Mezun",
    "Total teaching staff": "Toplam Öğretim Elemanı", "Professor": "Profesör", "Associate Professor": "Doçent",
    "Assistant Professor": "Dr. Öğretim Üyesi", "Other teaching staff": "Diğer Öğretim Elemanı",
    "Illiterate": "Okuma Yazma Bilmeyen", "Literate": "Okuma Yazma Bilen",
    "Literate but no school completed": "Okuma Yazma Bilen Fakat Bir Okul Bitirmeyen",
    "Primary school graduate": "İlkokul Mezunu", "Primary education graduate": "İlköğretim Mezunu",
    "Junior high school or vocational school at junior high school level graduate": "Ortaokul veya Dengi Meslek Okulu Mezunu",
    "High school or vocational school at high school level graduate": "Lise veya Dengi Meslek Okulu Mezunu",
    "Higher education graduate": "Yükseköğretim Mezunu", "Master graduate": "Yüksek Lisans Mezunu", "Doctorate graduate": "Doktora Mezunu",
    "Pre-Primary education": "Okul Öncesi", "Primary school": "İlkokul", "Lower secondary school": "Ortaokul",
    "Primary and lower secondary school": "İlkokul ve Ortaokul", "Total upper secondary education": "Ortaöğretim Toplamı",
    "Total of secondary education": "Ortaöğretim Toplamı", "General secondary education": "Genel Ortaöğretim",
    "Vocational and technical secondary education": "Mesleki ve Teknik Ortaöğretim",
    "School": "Okul", "Division": "Şube", "Class-room": "Derslik", "Teacher": "Öğretmen",
    "Male student": "Erkek Öğrenci", "Female student": "Kız Öğrenci", "Male teacher": "Erkek Öğretmen", "Female teacher": "Kadın Öğretmen",
    # enerji, genel, sağlık, gelir
    "Agricultural activities (MWh)": "Tarımsal Faaliyetler (MWh)",
    "Number of municipalities": "Belediye Sayısı", "Number of districts": "İlçe Sayısı", "Number of villages": "Köy Sayısı",
    "The total number of hospital beds per one hundred thousand people": "Yüz Bin Kişi Başına Hastane Yatağı Sayısı",
    "60% of the median income": "Medyan Gelirin %60'ı", "Poverty threshold (TL)": "Yoksulluk Sınırı (TL)",
    # sanayi (NACE Rev.2 bölümleri)
    "Agriculture, forestry and fishery": "Tarım, Ormancılık ve Balıkçılık", "Mining and quarrying": "Madencilik ve Taş Ocakçılığı",
    "Manufacturing": "İmalat", "Eklekrtik, gas, steam and air conditioning production and distribution": "Elektrik, Gaz, Buhar ve İklimlendirme",
    "Water supply, sewerage, waste management and treatment activities": "Su Temini, Kanalizasyon ve Atık Yönetimi",
    "Construction": "İnşaat", "Wholesale and retail trade, repair of motor vehicles and motorcycles": "Toptan ve Perakende Ticaret",
    "Transport and storage": "Ulaştırma ve Depolama", "Accommodation and food service activities": "Konaklama ve Yiyecek Hizmetleri",
    "Finane and insurance activities": "Finans ve Sigorta", "Real estate activities": "Gayrimenkul",
    "Vocational, scientific and technical activities": "Mesleki, Bilimsel ve Teknik Faaliyetler",
    "Administrative and support service activities": "İdari ve Destek Hizmetleri", "Education": "Eğitim",
    "Human health and social service activities": "İnsan Sağlığı ve Sosyal Hizmetler",
    "Culture, arts, entertainment, recreation and sports": "Kültür, Sanat, Eğlence ve Spor", "Other service activities": "Diğer Hizmetler",
    # TÜFE ana harcama grupları (COICOP 1999)
    "Food And Non-Alcoholic Beverages": "Gıda ve Alkolsüz İçecekler", "Alcoholic Beverages And Tobacco": "Alkollü İçecekler ve Tütün",
    "Clothing And Footwear": "Giyim ve Ayakkabı", "Housing, Water, Electricity, Gas And Other Fuels": "Konut",
    "Furnishings, Household Equipment, Routine Maintenance Of The House": "Ev Eşyası", "Transport": "Ulaştırma",
    "Communications": "Haberleşme", "Recreation And Culture": "Eğlence ve Kültür", "Hotels, Cafes And Restaurants": "Lokanta ve Oteller",
    "Miscellaneous Goods And Services": "Çeşitli Mal ve Hizmetler",
    # işgücü
    "Less than high school (ISCED 1-2)": "Lise Altı", "High and vocational high school (ISCED 3)": "Lise ve Meslek Lisesi",
    "Higher education (ISCED 5-6)": "Yükseköğretim", "Hours": "", "Regular and casual employee": "Ücretli, Maaşlı veya Yevmiyeli",
    "Employer and own account worker": "İşveren ve Kendi Hesabına", "Unpaid family worker": "Ücretsiz Aile İşçisi",
    "Part time": "Yarı Zamanlı", "Full-time": "Tam Zamanlı",
    # nüfus
    "Male population": "Erkek Nüfus", "Sex ratio (%)": "Cinsiyet Oranı (100 Kadına Düşen Erkek)", "Child population": "Toplam",
    "Age group": "", "ABPRS population": "Nüfus", "In-migration": "Aldığı Göç", "Net-migration": "Net Göç",
    "Never married": "Hiç Evlenmemiş", "Married": "Evli", "Divorced": "Boşanmış", "Widoved": "Eşi Ölmüş",
    "One-person households": "Tek Kişilik", "One-family households": "Tek Çekirdek Aileli", "Extended-family households": "Geniş Aileli",
    "Multi-person no-family households": "Çok Kişilik, Çekirdek Aile Olmayan", "Population projection": "",
    # turizm, finans, ulaştırma
    "Air way": "Havayolu", "Rail way": "Demiryolu", "Road way": "Karayolu", "Sea way": "Denizyolu", "Excursion": "Günübirlikçi",
    "Number of local unit": "Yerel Birim Sayısı", "Annual average number of persons engaged": "Yıllık Ortalama Çalışan Sayısı",
    "Annual average number of employees": "Yıllık Ortalama Ücretli Çalışan Sayısı", "Wages and salaries, 1000 TL": "Maaş ve Ücretler (Bin TL)",
    "Number of dead persons per one million motor vehicles": "Bir Milyon Motorlu Taşıt Başına Ölü Sayısı",
    "Number of injured persons per one million motor vehicles": "Bir Milyon Motorlu Taşıt Başına Yaralı Sayısı",
    "Number of dead persons per one million private cars": "Bir Milyon Otomobil Başına Ölü Sayısı",
    "Number of injured persons per one million private cars": "Bir Milyon Otomobil Başına Yaralı Sayısı",
    "Number of passengers": "Yolcu Sayısı", "Freight carried": "Taşınan Yük (Ton)",
    "Landing for domestic services": "İç Hat Gelen", "Taking off for domestic services": "İç Hat Giden",
    "Taking off for domestic rervices": "İç Hat Giden",
    "Landing for international services": "Dış Hat Gelen", "Taking off for international services": "Dış Hat Giden",
    "Taking off for international rervices": "Dış Hat Giden",
}


def _yas(t):
    """'15 - 24', '0-4 age', '75 +', '55 years old and over', '25 and over', '15-24 age group' -> '15-24 Yaş' ..."""
    t = re.sub(r"\s+", " ", t).strip()
    m = re.fullmatch(r"(\d+) ?- ?(\d+)(?: age(?: group)?)?", t)
    if m:
        return f"{m.group(1)}-{m.group(2)} Yaş"
    m = re.fullmatch(r"(\d+) ?(?:\+|and over|years old and over)(?: age)?", t) or re.fullmatch(r"(\d+)\+ age", t)
    if m:
        return f"{m.group(1)}+ Yaş"
    return None


BEBEK = {"0": "0 Gün", "1-6": "1-6 Gün", "7-29": "7-29 Gün", "1-4": "1-4 Ay", "5-8": "5-8 Ay", "9-11": "9-11 Ay"}


def parca_cevir(t, bebek=False):
    t = re.sub(r"\s+", " ", t).strip()
    if bebek and t in BEBEK:
        return BEBEK[t], None
    unit = None
    m = re.search(r"\s*\((m²)\)$", t)
    if m:
        t, unit = t[: m.start()].strip(), m.group(1)
    if t in PARCA:
        return PARCA[t], unit
    y = _yas(t)
    if y:
        return y, unit
    raise KeyError(t)


def cevir(sutun):
    """(ad, kategori) döndürür; bilinmeyen parça için KeyError."""
    s = re.sub(r"\s+", " ", sutun).strip().rstrip(" :").strip()
    if s in TAM:
        return TAM[s]
    konu, _, alt = s.partition(" : ")
    konu = konu.strip()
    tr, birim, kat = KONU[konu]
    parcalar = []
    for p in alt.split("/"):
        if not p.strip():
            continue
        c, u = parca_cevir(p, bebek=konu.startswith("Daily and monthly infant"))
        birim = u or birim
        if c:
            parcalar.append(c)
    # "Toplam" başka kırılımla birlikteyse gereksiz ("Konut Amaçlı, Toplam" -> "Konut Amaçlı")
    if len(parcalar) > 1:
        parcalar = [p for p in parcalar if p != "Toplam"] or ["Toplam"]
    # parça kendi birimini taşıyorsa (ör. "Yoksulluk Sınırı (TL)") konu birimi eklenmez
    ic_birim = parcalar and re.search(r"\([^)]*\)$", parcalar[-1])
    ad = tr + (": " + ", ".join(parcalar) if parcalar else "")
    if birim and not ic_birim:
        ad += f" ({birim})"
    return ad, kat
