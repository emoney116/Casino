@echo off
setlocal

cd /d "%~dp0"

echo Starting Casino Prototype...
echo.

if not exist "node_modules" (
  echo Installing dependencies. This may take a minute the first time.
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency install failed. Make sure Node.js and npm are installed.
    pause
    exit /b 1
  )
)

echo Launching local dev server at http://127.0.0.1:5173
echo Close this window to stop the server.
echo.

start "" "http://127.0.0.1:5173"
call npm run dev -- --port 5173

pause
