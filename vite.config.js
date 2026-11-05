import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { etiketEkle, paylasimEtiketleri } from './tools/og/paylasim.mjs';

/*
 * Çok sayfalı yapı: her yeni sayfa `pages` listesine eklenir.
 * Henüz taşınmamış eski sayfalar (ilharita.html, nuts2.html, ...) build
 * sırasında ESKI_SITE klasöründen olduğu gibi kopyalanır. Böylece site
 * bütün hâlinde çalışmaya devam eder, sayfalar tek tek taşınır.
 */
// Eski sayfalar depoda (kaynaklar/eski-site); ESKI_SITE ortam değişkeni ya da ../dakaveri yalnızca yedek yoldur
const DEPO_ESKI = resolve(__dirname, 'kaynaklar/eski-site');
const ESKI_SITE = process.env.ESKI_SITE || (existsSync(DEPO_ESKI) ? DEPO_ESKI : resolve(__dirname, '../dakaveri'));
// Eski sayfaların ham verisi depoda (kaynaklar/eski-site/data); yoksa eski site klasöründeki data kullanılır
const DEPO_VERI = resolve(__dirname, 'kaynaklar/eski-site/data');
const ESKI_VERI = existsSync(DEPO_VERI) ? DEPO_VERI : resolve(ESKI_SITE, 'data');

const pages = {
  index: resolve(__dirname, 'index.html'),
  gezgin: resolve(__dirname, 'gezgin.html'),
  hakkinda: resolve(__dirname, 'hakkinda.html'),
  harita: resolve(__dirname, 'harita.html'), // ilharita, nuts1, nuts2, ilceharita yerine tek sayfa
  grafik: resolve(__dirname, 'grafik.html'), // trgrafik, ilcegrafik yerine tek sayfa
  katalog: resolve(__dirname, 'katalog.html'), // bütün göstergelerin listesi
  analiz: resolve(__dirname, 'analiz.html'), // Analiz Masası: il göstergeleri, bulgular, ilişki, yer
  // ilharita: resolve(__dirname, 'ilharita.html'),   // taşındıkça açılacak
};

// Yeni sürümü yazılmış sayfalar eski kopyanın üzerine yazılmasın
const TASINAN = new Set(Object.keys(pages).map((p) => `${p}.html`));
const ESKI_ATLA = new Set(['indexold.html']);

function eskiSayfalariKopyala() {
  return {
    name: 'eski-sayfalari-kopyala',
    apply: 'build',
    closeBundle() {
      const out = resolve(__dirname, 'dist');
      if (!existsSync(ESKI_SITE)) {
        console.warn(`[eski-sayfalar] ${ESKI_SITE} bulunamadı, eski sayfalar kopyalanmadı.`);
        if (existsSync(ESKI_VERI)) cpSync(ESKI_VERI, resolve(out, 'data'), { recursive: true, force: false });
        return;
      }
      let n = 0;
      for (const f of readdirSync(ESKI_SITE)) {
        if (f.endsWith('.html') && !TASINAN.has(f) && !ESKI_ATLA.has(f)) {
          // paylaşım etiketleri ve sekme simgesi eklenerek kopyalanır
          writeFileSync(resolve(out, f), etiketEkle(readFileSync(resolve(ESKI_SITE, f), 'utf8'), f));
          n++;
        }
      }
      // Eski sayfaların kullandığı veri ve görseller (./data, ./img)
      // public/data'daki dosyalar (örn. veritabanından üretilen infografik.csv.gz) eski kopyanın üzerine yazılmaz
      cpSync(ESKI_VERI, resolve(out, 'data'), { recursive: true, force: false });
      if (existsSync(resolve(ESKI_SITE, 'img'))) cpSync(resolve(ESKI_SITE, 'img'), resolve(out, 'img'), {
        recursive: true,
        force: false,
        filter: (s) => !s.includes(' - Kopya'),
      });
      console.log(`[eski-sayfalar] ${n} eski sayfa + data/ kopyalandı (${ESKI_SITE}).`);
    },
  };
}

export default defineConfig({
  base: './', // alt klasörde de çalışsın (örn. site.gov.tr/dakaveri/)
  build: {
    rollupOptions: { input: pages },
    chunkSizeWarningLimit: 800,
  },
  plugins: [paylasimEtiketleri(), eskiSayfalariKopyala()],
});
