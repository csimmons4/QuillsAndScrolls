@echo off
cd /d "%~dp0"
echo Starting Quills ^& Scrolls...
start "" npm run dev

echo Waiting for servers to start...
:wait_loop
timeout /t 2 /nobreak >nul
curl -s http://127.0.0.1:5174/api/characters >nul 2>&1
if errorlevel 1 goto wait_loop

echo Ready! Opening browser...
start "" http://localhost:5173
