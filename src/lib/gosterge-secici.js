/**
 * Tema başlıklı gösterge seçici (Analiz Masası).
 *
 * Uzun gösterge listesini TÜİK tema başlıklarına (src/lib/basliklar.js, UST_BASLIKLAR) göre düzenler:
 * solda temalar, sağda seçili temanın alt başlıkları (veri kategorileri) ve aynı konudaki kırılımlar
 * katlanabilir gruplar halinde. Arama bütün temalarda yapılır; sol sütun her temadaki eşleşme sayısını gösterir.
 *
 * Kullanım:
 *   const s = gostergeSecici(kap, { ogeler, temalar, deger, onSec, etiket });
 *   s.deger(id)      // dışarıdan seçimi değiştirir
 *   s.yenile(ogeler, temalar)  // listeyi değiştirir
 * ogeler: [{ id, ad, tema, alt, konu, isaret, etiket }]  (etiket: adın yanında küçük not, ör. "Yalnız Düzey 2")  (tema: tema id; alt: alt başlık; konu: grup adı ya da null)
 * temalar: [{ id, ad }]
 */
import { esc } from './format.js';
import { sadelestir } from './arama.js';
import '../styles/gosterge-secici.css';

const SINIR = 400; // aramada en çok gösterilecek sonuç

export function gostergeSecici(kap, { ogeler, temalar, deger, onSec, etiket = 'Gösterge seçin', isaretNotu = '◆ İşaretli göstergeler İlişki sekmesinde de karşılaştırılabilir.' }) {
  let byId, temaAd, isaretVar;
  function veriKur(o2, t2) {
    ogeler = o2; temalar = t2;
    byId = new Map(ogeler.map((o) => [o.id, o]));
    temaAd = new Map(temalar.map((t) => [t.id, t.ad]));
    // tema adı aramaya katılmaz ("işsizlik" araması bütün İstihdam temasını getirmesin)
    for (const o of ogeler) o._m = sadelestir(`${o.ad} ${o.konu ?? ''} ${o.alt ?? ''} ${o.etiket ?? ''}`);
    isaretVar = ogeler.some((o) => o.isaret);
  }
  veriKur(ogeler, temalar);
  const durum = { secili: deger, tema: byId.get(deger)?.tema ?? temalar[0]?.id, q: '', acik: false };
  const kimlik = `gsec-${Math.random().toString(36).slice(2, 8)}`;

  kap.classList.add('gsec');
  kap.innerHTML = `
    <button type="button" class="gsec-tetik" aria-haspopup="dialog" aria-expanded="false" aria-controls="${kimlik}">
      <span class="gsec-yol"></span><span class="gsec-ad"></span><span class="gsec-ok" aria-hidden="true"></span>
    </button>
    <div class="gsec-panel" id="${kimlik}" role="dialog" aria-label="${esc(etiket)}" hidden>
      <div class="gsec-ust">
        <input type="search" class="gsec-ara" placeholder="Bütün göstergelerde ara (ör. işsizlik, ihracat, doğurganlık)" autocomplete="off" aria-label="Göstergelerde ara">
        <button type="button" class="gsec-kapat" aria-label="Kapat">×</button>
      </div>
      <div class="gsec-govde">
        <nav class="gsec-temalar" aria-label="Temalar"></nav>
        <div class="gsec-liste" role="listbox" aria-label="Göstergeler"></div>
      </div>
      <div class="gsec-alt"></div>
    </div>`;
  const $ = (s) => kap.querySelector(s);
  const tetik = $('.gsec-tetik'), panel = $('.gsec-panel'), ara = $('.gsec-ara'), nav = $('.gsec-temalar'), liste = $('.gsec-liste');

  function tetikYaz() {
    const o = byId.get(durum.secili);
    kap.dataset.deger = durum.secili ?? '';
    $('.gsec-yol').textContent = o ? [temaAd.get(o.tema), o.alt, o.konu].filter(Boolean).join(' › ') : '';
    $('.gsec-ad').textContent = o ? o.ad : etiket;
    tetik.title = o ? `${$('.gsec-yol').textContent} › ${o.ad}` : etiket;
  }

  const eslesen = () => {
    const p = sadelestir(durum.q).split(' ').filter(Boolean);
    return p.length ? ogeler.filter((o) => p.every((x) => o._m.includes(x))) : null;
  };

  function ciz() {
    const bulunan = eslesen();
    const arama = !!bulunan;
    const sayac = new Map();
    for (const o of bulunan ?? ogeler) sayac.set(o.tema, (sayac.get(o.tema) ?? 0) + 1);
    if (arama && durum.tema !== 'tum' && !sayac.get(durum.tema)) durum.tema = 'tum';
    if (!arama && durum.tema === 'tum') durum.tema = byId.get(durum.secili)?.tema ?? temalar[0].id;

    nav.innerHTML = (arama ? `<button type="button" data-tema="tum" aria-current="${durum.tema === 'tum'}"><span>Bütün temalar</span><b>${bulunan.length}</b></button>` : '') +
      temalar.map((t) => {
        const n = sayac.get(t.id) ?? 0;
        return `<button type="button" data-tema="${t.id}" aria-current="${durum.tema === t.id}"${n ? '' : ' disabled'}><span>${esc(t.ad)}</span><b>${n}</b></button>`;
      }).join('');

    const gor = (bulunan ?? ogeler).filter((o) => durum.tema === 'tum' || o.tema === durum.tema);
    const kesik = arama && gor.length > SINIR;
    const kume = kesik ? gor.slice(0, SINIR) : gor;
    // tema → alt başlık → konu
    const agac = new Map();
    for (const o of kume) {
      if (!agac.has(o.tema)) agac.set(o.tema, new Map());
      const a = agac.get(o.tema);
      const altK = o.alt ?? '';
      if (!a.has(altK)) a.set(altK, new Map());
      const k = a.get(altK);
      const konuK = o.konu ?? '';
      if (!k.has(konuK)) k.set(konuK, []);
      k.get(konuK).push(o);
    }
    const oge = (o, konu) => {
      const ad = konu && o.ad.startsWith(`${konu}: `) ? o.ad.slice(konu.length + 2) : o.ad;
      return `<button type="button" role="option" class="gsec-oge" data-id="${esc(o.id)}" aria-selected="${o.id === durum.secili}">${esc(ad)}${o.isaret ? ' <span class="gsec-isaret" title="Analize uygun gösterge">◆</span>' : ''}${o.etiket ? ` <span class="gsec-etiket">${esc(o.etiket)}</span>` : ''}</button>`;
    };
    liste.innerHTML = [...agac].map(([tema, altlar]) => `
      ${durum.tema === 'tum' ? `<h3 class="gsec-tema-bas">${esc(temaAd.get(tema))}</h3>` : ''}
      ${[...altlar].map(([alt, konular]) => `<section class="gsec-alt-grup">
        ${alt ? `<h4>${esc(alt)} <span>${[...konular.values()].reduce((t, l) => t + l.length, 0)}</span></h4>` : ''}
        ${[...konular].map(([konu, l]) => (konu
          ? `<details class="gsec-konu"${arama || l.some((o) => o.id === durum.secili) ? ' open' : ''}><summary><span>${esc(konu)}</span><span class="gsec-n">${l.length}</span></summary>${l.map((o) => oge(o, konu)).join('')}</details>`
          : l.map((o) => oge(o, null)).join(''))).join('')}
      </section>`).join('')}`).join('') || '<p class="gsec-bos">Aramaya uyan gösterge bulunamadı. Daha kısa ya da farklı bir sözcük deneyin.</p>';
    $('.gsec-alt').innerHTML = arama
      ? `${bulunan.length} gösterge bulundu${kesik ? `; ilk ${SINIR} gösteriliyor, aramayı daraltabilirsiniz` : ''}.`
      : `${temaAd.get(durum.tema)}: ${gor.length} gösterge.${isaretVar && isaretNotu ? ` ${isaretNotu}` : ''}`;
  }

  function ac() {
    if (durum.acik) return;
    durum.acik = true;
    panel.hidden = false;
    tetik.setAttribute('aria-expanded', 'true');
    durum.tema = byId.get(durum.secili)?.tema ?? durum.tema;
    ciz();
    // panel görünüm alanının sağından taşmasın
    panel.style.left = '';
    if (!matchMedia('(max-width: 760px)').matches) {
      const r = panel.getBoundingClientRect();
      if (r.right > innerWidth - 16) panel.style.left = `${Math.round(innerWidth - 16 - r.right)}px`;
    }
    ara.focus();
    liste.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' });
  }
  function kapat(odak = true) {
    if (!durum.acik) return;
    durum.acik = false;
    panel.hidden = true;
    tetik.setAttribute('aria-expanded', 'false');
    if (odak) tetik.focus();
  }
  function sec(id) {
    durum.secili = id;
    tetikYaz();
    kapat();
    onSec?.(id);
  }

  tetik.addEventListener('click', () => (durum.acik ? kapat() : ac()));
  $('.gsec-kapat').addEventListener('click', () => kapat());
  ara.addEventListener('input', () => { durum.q = ara.value; if (durum.q.trim()) durum.tema = 'tum'; ciz(); liste.scrollTop = 0; });
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tema]');
    if (!b) return;
    durum.tema = b.dataset.tema;
    ciz();
    liste.scrollTop = 0;
  });
  liste.addEventListener('click', (e) => {
    const b = e.target.closest('.gsec-oge');
    if (b) sec(b.dataset.id);
  });
  // klavye: oklarla görünür göstergeler arasında gezinme, Enter ile seçme, Esc ile kapatma
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); kapat(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const ogs = [...liste.querySelectorAll('.gsec-oge')].filter((b) => b.offsetParent !== null);
    if (!ogs.length) return;
    e.preventDefault();
    const i = ogs.indexOf(document.activeElement);
    const j = e.key === 'ArrowDown' ? (i < 0 ? 0 : Math.min(ogs.length - 1, i + 1)) : Math.max(0, i - 1);
    ogs[j].focus();
  });
  ara.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const b = liste.querySelector('.gsec-oge'); if (b) { e.preventDefault(); sec(b.dataset.id); } }
  });
  document.addEventListener('pointerdown', (e) => { if (durum.acik && !kap.contains(e.target)) kapat(false); });

  tetikYaz();
  return {
    deger(id) { if (id == null) return durum.secili; durum.secili = id; tetikYaz(); if (durum.acik) ciz(); return id; },
    /** Öğe listesini değiştirir (ör. düzey değişince) */
    yenile(o2, t2 = temalar) { veriKur(o2, t2); if (!t2.some((t) => t.id === durum.tema)) durum.tema = t2[0]?.id; tetikYaz(); if (durum.acik) ciz(); },
    ac, kapat,
  };
}
