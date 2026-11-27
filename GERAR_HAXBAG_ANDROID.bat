@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title HäxBag Mobile - APK Android de teste

if not exist ".env.local" (
  echo [HaxBag] Configure primeiro o arquivo .env.local com os dados PUBLICOS do Supabase.
  echo Leia HAXBAG_MOBILE_V306_GUIA.md.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [HaxBag] Node.js e npm nao encontrados. Instale Node.js 22 ou superior.
  pause
  exit /b 1
)

call npm install --no-audit --no-fund
if errorlevel 1 goto :error
call npm run mobile:deps
if errorlevel 1 goto :error
call npm run mobile:check
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error
call npm run mobile:apk
if errorlevel 1 goto :error

echo.
echo APK de testes gerado em mobile\output\.
pause
exit /b 0

:error
echo.
echo [HaxBag] A geracao foi interrompida. Confira a mensagem de erro acima.
echo Para compilar nativamente, instale Android Studio e Android SDK.
pause
exit /b 1
