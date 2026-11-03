@echo off
rem TÜİK ve OECD verilerini API'den indirir, sitedeki değerlerle karşılaştırır ve rapor yazar.
rem Hiçbir veriyi değiştirmez. Raporu inceledikten sonra guncellemeyi-uygula.bat ile uygulayın.
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONUTF8=1
set PY=python
where py >nul 2>nul && set PY=py
%PY% tools\guncelle\guncelle.py
if errorlevel 1 (echo Güncelleme raporu üretilemedi; build\guncelleme\log klasörüne bakın.) else (
  for /f "delims=" %%f in ('dir /b /o-d build\guncelleme\rapor-*.md') do (start "" "build\guncelleme\%%f" & goto :bitti)
)
:bitti
pause
