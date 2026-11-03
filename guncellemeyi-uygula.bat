@echo off
rem veri-guncelle.bat ile hazırlanan son raporu onaylıyorsanız çalıştırın:
rem aday dosyaları veri-ekleri klasörüne yazar, veri tabanını ve Analiz Masası verisini yeniden üretir, siteyi derler.
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONUTF8=1
set PY=python
where py >nul 2>nul && set PY=py
echo Son güncelleme raporundaki değişiklikler uygulanacak. Devam etmek için bir tuşa basın, vazgeçmek için pencereyi kapatın.
pause >nul
%PY% tools\guncelle\guncelle.py --indirme-yok --uygula
if errorlevel 1 (echo Veri hattı hata verdi; build\guncelleme\log klasörüne bakın. & pause & exit /b 1)
where npm >nul 2>nul && (call npm run build) || echo npm bulunamadı; siteyi derlemek için "npm run build" çalıştırın.
pause
