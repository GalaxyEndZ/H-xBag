@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo =======================================
echo    HAXBAG DESKTOP - WINDOWS 64 BITS
echo =======================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale o Node.js 22 LTS e tente novamente.
  goto :fail
)
if not exist ".env.local" (
  echo [ERRO] Falta o arquivo .env.local com o Supabase PUBLICAVEL.
  echo Copie .env.example para .env.local e preencha com as credenciais ja usadas no site.
  goto :fail
)
if "%HAXBAG_RELEASE_REPOSITORY%"=="" set "HAXBAG_RELEASE_REPOSITORY=GalaxyEndZ/H-xBagReleases"
echo [ATUALIZACOES] Instalador usara o repositorio: %HAXBAG_RELEASE_REPOSITORY%
echo [DICA] Para publicar automaticamente, use o workflow do GitHub Actions.
echo.
echo [1/3] Instalando dependencias do projeto e do Electron...
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail
echo.
echo [2/3] Criando instalador EXE...
call npm run desktop:installer
if errorlevel 1 goto :fail
echo.
echo [3/3] Criando EXE portatil...
call npm run desktop:portable
if errorlevel 1 goto :fail
echo.
echo Concluido! Abra a pasta dist-desktop para encontrar os executaveis.
start "" "%~dp0dist-desktop"
pause
exit /b 0
:fail
echo.
echo Falhou. Confira a mensagem de erro acima e tente novamente.
pause
exit /b 1
