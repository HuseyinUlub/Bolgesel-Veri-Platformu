@echo off
rem Veri tabanini (build\veri.db) ve sitenin veri dosyalarini (public\veri) yeniden olusturur.
rem "npm run veri" ile ayni isi yapar; PowerShell ve npm gerekmez, Python yeterli.
cd /d "%~dp0"
set PYTHONUTF8=1
where py >nul 2>nul && (py pipeline\build_data.py & goto :bitti)
where python >nul 2>nul && (python pipeline\build_data.py & goto :bitti)
echo Python bulunamadi. https://www.python.org adresinden kurup tekrar deneyin.
:bitti
echo.
if exist build\veri.db (echo Tamam: build\veri.db olusturuldu.) else (echo veri.db olusmadi; yukaridaki hata mesajina bakin.)
pause
