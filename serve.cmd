@echo off
setlocal
cd /d "%~dp0"
echo.
echo   Elevate - local preview
echo   --------------------------------
echo   Serving workspace at http://localhost:5173
echo   Press Ctrl+C to stop.
echo.
start "" http://localhost:5173
where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 5173
  goto :end
)
where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 5173
  goto :end
)
echo Falling back to npx serve...
npx --yes serve . -l 5173
:end
endlocal
