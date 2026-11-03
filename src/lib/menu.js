/** Başlıktaki "Araçlar" menüsü: tüm sayfalarda aynı içerik (src/site.config.js → araclar) */
import { SITE } from '../site.config.js';
import { esc } from './format.js';

export function araclarMenusu(el) {
  if (!el) return;
  if (!SITE.araclar?.length && !SITE.digerAraclar?.length) {
    // menüde araç yoksa "Araçlar" açılır menüsü gösterilmez
    (el.closest('.araclar-menu') ?? el).remove();
    return;
  }
  const bag = (a) =>
    `<a href="${a.href}" class="arac-bag"><span class="arac-ad">${esc(a.ad)}</span>` +
    (a.aciklama ? `<small>${esc(a.aciklama)}</small>` : '') + '</a>';
  el.innerHTML =
    SITE.araclar.map(bag).join('') +
    (SITE.digerAraclar?.length
      ? `<div class="arac-ayrac">Diğer</div>${SITE.digerAraclar.map((a) => `<a href="${a.href}" class="arac-bag arac-bag--kucuk">${esc(a.ad)}</a>`).join('')}`
      : '');
}
