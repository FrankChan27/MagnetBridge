@echo off
setlocal
set SCRIPT_DIR=%~dp0
set ROOT=%SCRIPT_DIR%..\..
where node >nul 2>nul
if errorlevel 1 (
  echo MagnetBridge needs Node.js 22+. Install it from https://nodejs.org then run this again.
  exit /b 1
)
powershell -NoProfile -File "%SCRIPT_DIR%detect-idm.ps1"
node "%ROOT%\cli\magnetbridge.mjs" %*
