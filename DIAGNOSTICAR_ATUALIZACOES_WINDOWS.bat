@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ===============================================
echo    HAXBAG - DIAGNOSTICO DO GITHUB RELEASES
echo ===============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Instale Node.js para executar este diagnostico.
  goto :fail
)
node desktop\check-public-release.cjs
if errorlevel 1 (
  echo.
  echo O repositório ainda nao esta pronto para oferecer auto-update.
  echo Verifique HAXBAG_ATUALIZACAO_V298.md e o workflow no GitHub.
  goto :fail
)
echo.
echo [OK] Existe uma release publica com metadados de atualizacao.
pause
exit /b 0
:fail
pause
exit /b 1
