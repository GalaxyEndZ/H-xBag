@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".env.local" (
 echo [ERRO] Copie .env.example para .env.local e configure o Supabase.
 pause
 exit /b 1
)
echo Instalando dependencias necessarias...
call npm install --no-audit --no-fund
if errorlevel 1 (
 pause
 exit /b 1
)
call npm run desktop:dev
pause
