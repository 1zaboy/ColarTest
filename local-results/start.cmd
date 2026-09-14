@echo off
cd /d "%~dp0.."
echo.
echo Сетки цветов: http://localhost:4173/local-results/
echo Оставь это окно открытым и обнови страницу в браузере.
echo.
start "" cmd /c "timeout /t 1 >nul && start http://localhost:4173/local-results/"
python -m http.server 4173
if errorlevel 1 py -m http.server 4173
if errorlevel 1 (
  echo Python не найден, пробую npx serve...
  npx --yes serve -l 4173
)
