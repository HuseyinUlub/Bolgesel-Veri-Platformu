/**
 * Dosya indirme. Site claude.ai yayınında (artifact) açıldığında tarayıcı indirmesi çerçeve içinde engellenir;
 * bu durumda platformun `downloads` yeteneği kullanılır ve izleyiciye kaydetme onayı gösterilir.
 * Normal sunucuda (window.claude yok) klasik bağlantı ile indirilir.
 *
 * Dönüş: 'indirildi' | 'iptal' (izleyici onaylamadı) — hata durumunda istisna fırlatır.
 */
let yetenekP;
function yetenek() {
  if (!window.claude?.use) return Promise.resolve(null);
  return (yetenekP ??= window.claude.use('downloads').catch(() => null));
}

function baglanti(ad, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = ad;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function indir(ad, icerik, tur) {
  const blob = icerik instanceof Blob ? icerik : new Blob([icerik], { type: tur });
  const d = await yetenek();
  if (!d) { baglanti(ad, blob); return 'indirildi'; }
  try {
    await d.save({ filename: ad, data: blob });
    return 'indirildi';
  } catch (e) {
    if (e?.code === 'declined') return 'iptal';
    if (e?.code === 'rate_limited') throw new Error('Açık bir kaydetme onayı var; lütfen önce onu yanıtlayın.');
    throw new Error(e?.message || 'İndirme bu görünümde kullanılamıyor.');
  }
}
