/**
 * İBBS Düzey 1 / Düzey 2 bölgeleri, kapsadıkları iller ve bölgede görevli kalkınma ajansları.
 * İl listesi: ka.gov.tr "Kalkınma Planlamasında İstatistiki Bölge Birimleri Sınıflandırması".
 */
export const DUZEY1 = {
  TR1: 'İstanbul', TR2: 'Batı Marmara', TR3: 'Ege', TR4: 'Doğu Marmara', TR5: 'Batı Anadolu', TR6: 'Akdeniz',
  TR7: 'Orta Anadolu', TR8: 'Batı Karadeniz', TR9: 'Doğu Karadeniz', TRA: 'Kuzeydoğu Anadolu',
  TRB: 'Ortadoğu Anadolu', TRC: 'Güneydoğu Anadolu',
};

/** Düzey 2 kodu → [ajans, iller] */
export const AJANSLAR = {
  TR10: ['İstanbul Kalkınma Ajansı', 'İstanbul'],
  TR21: ['Trakya Kalkınma Ajansı', 'Tekirdağ, Edirne, Kırklareli'],
  TR22: ['Güney Marmara Kalkınma Ajansı', 'Balıkesir, Çanakkale'],
  TR31: ['İzmir Kalkınma Ajansı', 'İzmir'],
  TR32: ['Güney Ege Kalkınma Ajansı', 'Aydın, Denizli, Muğla'],
  TR33: ['Zafer Kalkınma Ajansı', 'Manisa, Afyonkarahisar, Kütahya, Uşak'],
  TR41: ['Bursa Eskişehir Bilecik Kalkınma Ajansı', 'Bursa, Eskişehir, Bilecik'],
  TR42: ['Doğu Marmara Kalkınma Ajansı', 'Kocaeli, Sakarya, Düzce, Bolu, Yalova'],
  TR51: ['Ankara Kalkınma Ajansı', 'Ankara'],
  TR52: ['Mevlana Kalkınma Ajansı', 'Konya, Karaman'],
  TR61: ['Batı Akdeniz Kalkınma Ajansı', 'Antalya, Isparta, Burdur'],
  TR62: ['Çukurova Kalkınma Ajansı', 'Adana, Mersin'],
  TR63: ['Doğu Akdeniz Kalkınma Ajansı', 'Hatay, Kahramanmaraş, Osmaniye'],
  TR71: ['Ahiler Kalkınma Ajansı', 'Kırıkkale, Aksaray, Niğde, Nevşehir, Kırşehir'],
  TR72: ['Orta Anadolu Kalkınma Ajansı', 'Kayseri, Sivas, Yozgat'],
  TR81: ['Batı Karadeniz Kalkınma Ajansı', 'Zonguldak, Karabük, Bartın'],
  TR82: ['Kuzey Anadolu Kalkınma Ajansı', 'Kastamonu, Çankırı, Sinop'],
  TR83: ['Orta Karadeniz Kalkınma Ajansı', 'Samsun, Tokat, Çorum, Amasya'],
  TR90: ['Doğu Karadeniz Kalkınma Ajansı', 'Trabzon, Ordu, Giresun, Rize, Artvin, Gümüşhane'],
  TRA1: ['Kuzeydoğu Anadolu Kalkınma Ajansı', 'Erzurum, Erzincan, Bayburt'],
  TRA2: ['Serhat Kalkınma Ajansı', 'Ağrı, Kars, Iğdır, Ardahan'],
  TRB1: ['Fırat Kalkınma Ajansı', 'Malatya, Elazığ, Bingöl, Tunceli'],
  TRB2: ['Doğu Anadolu Kalkınma Ajansı', 'Van, Muş, Bitlis, Hakkâri'],
  TRC1: ['İpekyolu Kalkınma Ajansı', 'Gaziantep, Adıyaman, Kilis'],
  TRC2: ['Karacadağ Kalkınma Ajansı', 'Şanlıurfa, Diyarbakır'],
  TRC3: ['Dicle Kalkınma Ajansı', 'Mardin, Batman, Şırnak, Siirt'],
};

export const d1Kodu = (d2) => d2.slice(0, 3);
