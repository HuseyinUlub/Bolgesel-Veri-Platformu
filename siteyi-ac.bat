@echo off
rem Yayina hazir siteyi (dist) yerel sunucuyla acar. Node gerekmez, Python yeterli.
rem Kapatmak icin bu pencereyi kapatin.
cd /d "%~dp0dist"
if not exist index.html (
  echo dist klasoru bulunamadi. Once "npm run build" calistirin.
  pause
  exit /b 1
)
start "" http://localhost:8000/
where py >nul 2>nul && (py -m http.server 8000 & goto :eof)
where python >nul 2>nul && (python -m http.server 8000 & goto :eof)
echo Python bulunamadi. https://www.python.org adresinden kurup tekrar deneyin.
pause
