/**
 * Veri Gezgini gösterge araması: başlıktaki "Ara" düğmesi (ya da "/" tuşu) bir arama paneli açar.
 * Yazılan kelimeler gösterge adı, kategori ve notlarda Türkçe karakterden bağımsız aranır; sonuçlar
 * kategorilere göre gruplanır. Bir sonuca tıklayınca git({ kategori, gosterge, duzey }) çağrılır.
 *
 *   aramaKur({ manifest: M, duzeyler: DUZEYLER, git, dugmeYeri })
 */
import { esc } from './format.js';

const TR = { ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
export const sadelestir = (s) => (s ?? '')
  .toLocaleLowerCase('tr')
  .replace(/[çğıöşüâîû]/g, (c) => TR[c] ?? c)
  .replace(/i̇/g, 'i')
  .replace(/[^a-z0-9%]+/g, ' ')
  .trim();

const ENCOK = 80;

export function aramaKur({ manifest: M, duzeyler, git, dugmeYeri }) {
  const duzeyAdi = Object.fromEntries(Object.values(duzeyler).map((d) => [d.veri, d.etiket]));
  const sira = Object.values(duzeyler).map((d) => d.veri);
  // dizin: her gösterge için aranacak metin
  const dizin = [];
  for (const k of M.kategoriler) {
    for (const g of k.gostergeler) {
      const ad = sadelestir(g.ad);
      dizin.push({ k, g, ad, kelimeler: ad.split(' '), tum: `${ad} ${sadelestir(k.ad)} ${sadelestir(g.not)} ${sadelestir(g.kaynak)}` });
    }
  }

  // düğme
  const dugme = document.createElement('button');
  dugme.type = 'button';
  dugme.className = 'hikaye-donus arama-dugme';
  dugme.innerHTML = '<i class="fas fa-magnifying-glass"></i> Gösterge ara';
  dugme.title = 'Gösterge ara (/)';
  dugmeYeri.parentNode.insertBefore(dugme, dugmeYeri);

  // panel
  const panel = document.createElement('div');
  panel.className = 'arama-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Gösterge ara');
  panel.innerHTML = `
    <div class="arama-kutu">
      <div class="arama-ust">
        <i class="fas fa-magnifying-glass"></i>
        <input type="search" class="arama-girdi" placeholder="Gösterge ara: ör. patent, konut satış, kadın istihdam, ortanca yaş" autocomplete="off" spellcheck="false" aria-label="Aranacak kelime">
        <button type="button" class="arama-kapat" aria-label="Kapat">Esc</button>
      </div>
      <p class="arama-durum" aria-live="polite"></p>
      <div class="arama-sonuclar" role="listbox"></div>
    </div>`;
  document.body.appendChild(panel);
  const girdi = panel.querySelector('.arama-girdi');
  const sonuc = panel.querySelector('.arama-sonuclar');
  const durumEl = panel.querySelector('.arama-durum');
  let secili = -1;
  let ogeler = [];

  const ac = () => {
    panel.hidden = false;
    document.body.classList.add('arama-acik');
    girdi.focus();
    girdi.select();
    ara();
  };
  const kapat = () => {
    panel.hidden = true;
    document.body.classList.remove('arama-acik');
  };

  function puan(d, sorgu, parcalar) {
    let p = 0;
    if (d.ad === sorgu) p += 100;
    if (d.ad.startsWith(sorgu)) p += 40;
    if (d.ad.includes(sorgu)) p += 20;
    for (const q of parcalar) {
      if (d.kelimeler.some((w) => w.startsWith(q))) p += 10;
      else if (d.ad.includes(q)) p += 5;
    }
    return p - d.ad.length / 100; // kısa adlar biraz önde
  }

  function vurgula(ad, parcalar) {
    // sadeleştirilmiş eşleşmeleri özgün metinde işaretle (harf sayısı korunur)
    const sade = ad.toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, (c) => TR[c] ?? c);
    const isaret = new Array(ad.length).fill(false);
    for (const q of parcalar) {
      let i = sade.indexOf(q);
      while (i !== -1) {
        for (let j = i; j < i + q.length; j++) isaret[j] = true;
        i = sade.indexOf(q, i + q.length);
      }
    }
    let out = '';
    let acik = false;
    for (let i = 0; i < ad.length; i++) {
      if (isaret[i] && !acik) { out += '<mark>'; acik = true; }
      if (!isaret[i] && acik) { out += '</mark>'; acik = false; }
      out += esc(ad[i]);
    }
    return out + (acik ? '</mark>' : '');
  }

  function ara() {
    const sorgu = sadelestir(girdi.value);
    const parcalar = sorgu.split(' ').filter(Boolean);
    if (!parcalar.length) {
      sonuc.innerHTML = '';
      durumEl.textContent = `${dizin.length.toLocaleString('tr')} gösterge içinde arayın. Birden çok kelime yazarsanız hepsini içerenler listelenir.`;
      ogeler = [];
      return;
    }
    const bulunan = dizin.filter((d) => parcalar.every((q) => d.tum.includes(q)))
      .map((d) => ({ d, p: puan(d, sorgu, parcalar) }))
      .sort((a, b) => b.p - a.p);
    const goster = bulunan.slice(0, ENCOK);
    durumEl.textContent = bulunan.length
      ? `${bulunan.length} gösterge bulundu${bulunan.length > ENCOK ? ` (ilk ${ENCOK} gösteriliyor; aramayı daraltın)` : ''}.`
      : 'Sonuç yok. Daha kısa ya da farklı bir kelime deneyin.';
    // kategoriye göre grupla (grup sırası: en iyi sonucun sırası)
    const gruplar = new Map();
    for (const { d } of goster) {
      if (!gruplar.has(d.k.ad)) gruplar.set(d.k.ad, []);
      gruplar.get(d.k.ad).push(d);
    }
    ogeler = [];
    sonuc.innerHTML = [...gruplar].map(([kat, ds]) => `
      <div class="arama-grup">
        <p class="arama-kategori">${esc(kat)} <span>${ds.length}</span></p>
        ${ds.map((d) => {
          const n = ogeler.push(d) - 1;
          const g = d.g;
          const dz = sira.filter((v) => g.duzeyler.includes(v)).map((v) => duzeyAdi[v]).join(' · ');
          const yil = g.yillar?.length ? (g.yillar.length > 1 ? `${g.yillar[0]}–${g.yillar.at(-1)}` : `${g.yillar[0]}`) : '';
          const etiket = g.kaynakTuru?.startsWith('oecd') ? '<span class="kaynak-etiket kaynak-oecd-ozgun">OECD</span>' : '';
          return `<button type="button" class="arama-oge" role="option" data-n="${n}">
            <span class="arama-ad">${vurgula(g.ad, parcalar)} ${etiket}</span>
            <span class="arama-meta">${esc(dz)}${yil ? ` · ${yil}` : ''}</span>
          </button>`;
        }).join('')}
      </div>`).join('');
    secili = -1;
  }

  function sec(n) {
    const d = ogeler[n];
    if (!d) return;
    kapat();
    // önce kullanıcının bulunduğu düzey, yoksa göstergenin ilk düzeyi
    git({ kategori: d.k.ad, gosterge: d.g.id, duzeyler: d.g.duzeyler });
  }

  function isaretle(n) {
    const bs = [...sonuc.querySelectorAll('.arama-oge')];
    if (!bs.length) return;
    secili = (n + bs.length) % bs.length;
    bs.forEach((b, i) => b.classList.toggle('secili', i === secili));
    bs[secili].scrollIntoView({ block: 'nearest' });
  }

  let t;
  girdi.addEventListener('input', () => { clearTimeout(t); t = setTimeout(ara, 80); });
  girdi.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); isaretle(secili + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); isaretle(secili - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); sec(secili >= 0 ? +sonuc.querySelectorAll('.arama-oge')[secili].dataset.n : 0); }
  });
  sonuc.addEventListener('click', (e) => {
    const b = e.target.closest('.arama-oge');
    if (b) sec(+b.dataset.n);
  });
  dugme.addEventListener('click', ac);
  panel.querySelector('.arama-kapat').addEventListener('click', kapat);
  panel.addEventListener('click', (e) => { if (e.target === panel) kapat(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) kapat();
    const yaziyor = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (e.key === '/' && panel.hidden && !yaziyor) { e.preventDefault(); ac(); }
  });
  return { ac, kapat };
}
