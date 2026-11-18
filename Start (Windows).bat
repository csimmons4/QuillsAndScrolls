@echo off
REM Quills ^& Scrolls — one-click launcher for Windows.
REM Double-click this file. On the first run it installs everything it needs
REM (a private copy of Node.js if this PC doesn't have one, then the app files)
REM and then it starts the app and opens your browser. Nothing to download by hand.

setlocal
cd /d "%~dp0"

set "NODE_VERSION=v24.22.3"

REM ── 1. Make sure a recent enough Node.js is available (22.12 or newer) ──────
REM (Written with goto labels: cmd mis-reads brackets inside if-blocks.)
where node >nul 2>&1
if errorlevel 1 goto check_local_node
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)" >nul 2>&1
if not errorlevel 1 goto have_node

:check_local_node
REM A private copy from an earlier run is used only if it's the right version
if not exist ".runtime\node\node.exe" goto install_node
set "LOCAL_NODE_VERSION="
for /f "delims=" %%v in ('".runtime\node\node.exe" -v') do set "LOCAL_NODE_VERSION=%%v"
if "%LOCAL_NODE_VERSION%"=="%NODE_VERSION%" goto use_local_node
rmdir /s /q ".runtime\node"

:install_node
echo.
echo Setting up Node.js (only needed once, please wait a minute)...
if not exist ".runtime" mkdir ".runtime"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "Invoke-WebRequest -Uri 'https://nodejs.org/dist/%NODE_VERSION%/node-%NODE_VERSION%-win-x64.zip' -OutFile '.runtime\node.zip';" ^
  "Expand-Archive -Path '.runtime\node.zip' -DestinationPath '.runtime' -Force;" ^
  "Move-Item -Force '.runtime\node-%NODE_VERSION%-win-x64' '.runtime\node';" ^
  "Remove-Item '.runtime\node.zip'"
if exist ".runtime\node\node.exe" goto use_local_node
echo.
echo Could not set up Node.js automatically ^(are you online?^).
echo You can also install it yourself from https://nodejs.org and try again.
pause
exit /b 1

:use_local_node
set "PATH=%CD%\.runtime\node;%PATH%"

:have_node

REM ── 2. Install the app files (first time, and again after an update) ───────
REM A copy of package-lock.json is kept after each install; if the current one differs,
REM the app's files changed (an update) and are installed again.
if not exist "node_modules" goto npm_install
node -e "const fs=require('fs');try{process.exit(fs.readFileSync('package-lock.json','utf8')===fs.readFileSync('node_modules/.qs-installed-lock','utf8')?0:1)}catch(e){process.exit(1)}" >nul 2>&1
if not errorlevel 1 goto start_app

:npm_install
echo.
echo Installing app files (may take a minute)...
call npm install
if errorlevel 1 goto npm_failed
node -e "require('fs').copyFileSync('package-lock.json','node_modules/.qs-installed-lock')"
goto start_app

:npm_failed
echo.
echo Something went wrong installing the app files.
pause
exit /b 1

:start_app

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
