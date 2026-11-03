@echo off
rem Veri Masasi menusunu acar (kontrol, uygula, gecmis). Python gerekir.
cd /d "%~dp0\.."
set PYTHONUTF8=1
where py >nul 2>nul && (py veri-masasi\veri_masasi.py & goto :eof)
where python >nul 2>nul && (python veri-masasi\veri_masasi.py & goto :eof)
echo Python bulunamadi.
pause
