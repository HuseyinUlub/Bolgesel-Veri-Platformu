/*
 * Paylaşım (Open Graph / Twitter) etiketleri ve sekme simgesi — bütün sayfalara tek yerden.
 * vite.config.js build sırasında kullanır (yeni sayfalar + kopyalanan eski sayfalar).
 * Mevcut dist/'i yeniden derlemeden güncellemek için: node tools/og/paylasim.mjs
 * Görseller: py -X utf8 tools/og/og_gorsel.py
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ponytail: alan adı tek satır; gov.tr alan adı alınınca burası değişir
export const SITE_URL = 'https://bolgeselveriportali.ekutlu.com';

const SITE_ADI = 'Türkiye Bölgesel Veri Analizleri';
const VARSAYILAN_ACIKLAMA =
  "81 il, 26 Düzey 2 bölge ve 2.900'ü aşkın gösterge: TÜİK, OECD, Eurostat ve MEB verileriyle harita, grafik ve analiz.";

const kacis = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const coz = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

export function etiketEkle(html, dosya) {
  if (html.includes('property="og:image"') || !html.includes('</head>')) return html;
  const baslik = coz(html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() || SITE_ADI);
  const aciklama = coz(html.match(/<meta\s+name=["']description["']\s+content=(["'])(.*?)\1/i)?.[2] || VARSAYILAN_ACIKLAMA);
  const url = `${SITE_URL}/${dosya === 'index.html' ? '' : dosya}`;
  const gorsel = `${SITE_URL}/img/og.png`;
  const etiketler = `
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
    <meta name="theme-color" content="#0b1733">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="tr_TR">
    <meta property="og:site_name" content="${kacis(SITE_ADI)}">
    <meta property="og:title" content="${kacis(baslik)}">
    <meta property="og:description" content="${kacis(aciklama)}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${gorsel}">
    <meta property="og:image:secure_url" content="${gorsel}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${kacis(SITE_ADI)}: il ve bölge göstergeleri haritası">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${kacis(baslik)}">
    <meta name="twitter:description" content="${kacis(aciklama)}">
    <meta name="twitter:image" content="${gorsel}">
`;
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  // Eski simge (bakanlık logosu) yerine yeni sekme simgesi
  return html
    .replace(/[ \t]*<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*>\r?\n?/gi, '')
    .replace('</head>', `${etiketler.replace(/\n/g, eol)}</head>`);
}

export function paylasimEtiketleri() {
  return {
    name: 'paylasim-etiketleri',
    transformIndexHtml: (html, ctx) => etiketEkle(html, ctx.filename.split(/[\\/]/).pop()),
  };
}

// Doğrudan çalıştırılırsa: dist/*.html dosyalarını yerinde günceller (etiketi olanlara dokunmaz)
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(fileURLToPath(new URL('../../dist', import.meta.url)));
  let n = 0;
  for (const f of readdirSync(dist).filter((f) => f.endsWith('.html'))) {
    const yol = resolve(dist, f);
    const eski = readFileSync(yol, 'utf8');
    const yeni = etiketEkle(eski, f);
    if (yeni !== eski) { writeFileSync(yol, yeni); n++; }
  }
  console.log(`[paylasim] ${n} sayfa güncellendi.`);
}
