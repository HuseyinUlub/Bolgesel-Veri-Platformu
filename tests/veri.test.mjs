// Veri çıktısı ve JS/Python ortak kuralları için hızlı testler:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// format.js import.meta.env kullanmıyor, doğrudan içe aktarılabilir
const { slugify, sayi } = await import('../src/lib/format.js');
const M = JSON.parse(readFileSync(new URL('../public/veri/manifest.json', import.meta.url)));

test('JS slugify, Python slugify ile aynı dosya adlarını üretir', () => {
  for (const k of M.kategoriler) assert.equal(`k/${slugify(k.ad)}.json`, k.dosya, k.ad);
});

test('Her kategori dosyası mevcut', () => {
  for (const k of M.kategoriler) assert.ok(existsSync(new URL(`../public/veri/${k.dosya}`, import.meta.url)), k.dosya);
});

test('Bölge sayıları: 1 ülke, 12 Düzey1, 26 Düzey2, 81 il (+ varsa 26 OECD kenti)', () => {
  const say = {};
  for (const b of Object.values(M.bolgeler)) say[b.duzey] = (say[b.duzey] ?? 0) + 1;
  assert.deepEqual(say, { country: 1, region12: 12, region26: 26, province: 81, ...(say.fua ? { fua: 26 } : {}) });
});

test('Her ilin plaka kodu ve Düzey 2 üst bölgesi var', () => {
  for (const [kod, b] of Object.entries(M.bolgeler)) {
    if (b.duzey !== 'province') continue;
    assert.ok(b.plaka >= 1 && b.plaka <= 81, kod);
    assert.equal(M.bolgeler[b.ust]?.duzey, 'region26', kod);
  }
});

test('Türkçe sayı biçimi', () => {
  assert.equal(sayi(15754053), '15.754.053');
  assert.equal(sayi(15.884, 2), '15,88');
  assert.equal(sayi(null), 'Veri yok');
});

test('Gini 2023 düzeltmesi ve 3 basamak gösterim (VizStudio eki)', () => {
  const k = M.kategoriler.find((k) => k.gostergeler.some((g) => g.id === 'gini-katsayisi'));
  if (!k) return; // ek yoksa atla
  const g = k.gostergeler.find((g) => g.id === 'gini-katsayisi');
  const d = JSON.parse(readFileSync(new URL(`../public/veri/${k.dosya}`, import.meta.url)));
  assert.equal(g.ondalik, 3);
  assert.equal(d['gini-katsayisi']['2023']['TR10'], 0.425);
});

test('Yıllık nüfus artış hızında negatif değerler korunuyor (Konsolide eki)', () => {
  const d = JSON.parse(readFileSync(new URL('../public/veri/k/nufus.json', import.meta.url)));
  const s = d['yillik-nufus-artis-hizi-binde'];
  if (!s) return;
  assert.ok(s['2020']['TR10'] < 0, 'İstanbul 2020 nüfusu azaldı, hız negatif olmalı');
});
