@echo off
REM Quills ^& Scrolls — one-click launcher for Windows.
REM Double-click this file. On the first run it installs everything it needs
REM (a private copy of Node.js if this PC doesn't have one, then the app files)
REM and then it starts the app and opens your browser. Nothing to download by hand.

setlocal
cd /d "%~dp0"

set "NODE_VERSION=v20.18.1"

REM ── 1. Make sure Node.js is available ───────────────────────────────────────
where node >nul 2>&1
if %errorlevel%==0 goto have_node
if exist ".runtime\node\node.exe" goto use_local_node

echo.
echo Setting up Node.js (first time only, please wait a minute)...
if not exist ".runtime" mkdir ".runtime"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "Invoke-WebRequest -Uri 'https://nodejs.org/dist/%NODE_VERSION%/node-%NODE_VERSION%-win-x64.zip' -OutFile '.runtime\node.zip';" ^
  "Expand-Archive -Path '.runtime\node.zip' -DestinationPath '.runtime' -Force;" ^
  "Move-Item -Force '.runtime\node-%NODE_VERSION%-win-x64' '.runtime\node';" ^
  "Remove-Item '.runtime\node.zip'"
if not exist ".runtime\node\node.exe" (
  echo.
  echo Could not set up Node.js automatically ^(are you online?^).
  echo You can also install it yourself from https://nodejs.org and try again.
  pause
  exit /b 1
)

:use_local_node
set "PATH=%CD%\.runtime\node;%PATH%"

:have_node

REM ── 2. Install the app files (first time only) ──────────────────────────────
if not exist "node_modules" (
  echo.
  echo Installing app files (first time only, may take a minute)...
  call npm install
  if errorlevel 1 (
    echo.
    echo Something went wrong installing the app files.
    pause
    exit /b 1
  )
)

REM ── 3. Start the app and open the browser ───────────────────────────────────
echo.
echo Starting Quills ^& Scrolls...
start "" npm run dev

echo Waiting for the app to be ready...
:wait_loop
timeout /t 2 /nobreak >nul
curl -s http://127.0.0.1:5174/api/characters >nul 2>&1
if errorlevel 1 goto wait_loop

echo Ready! Opening your browser...
start "" http://localhost:5173
