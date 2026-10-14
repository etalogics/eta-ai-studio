@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.17 or newer, then reopen this launcher.
  pause
  exit /b 1
)
if not exist .next\BUILD_ID (
  echo First run requires npm ci and npm run build. See the laptop setup steps in README.md.
  pause
  exit /b 1
)
node server.mjs --production
pause
