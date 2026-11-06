@echo off
chcp 65001 >nul
title JANLUX — Sistema de Almoxarifado e Expedição
color 0A

cd /d "%~dp0"

:: Configura caminhos do Node.js
if exist "C:\Program Files\nodejs\node.exe" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
) else if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
)

:: Verifica se o Node.js está instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo =======================================================
    echo   [ERRO] Node.js não foi encontrado neste computador!
    echo   Baixe e instale em: https://nodejs.org
    echo =======================================================
    echo.
    pause
    exit /b 1
)

:: Verifica se a porta 3000 já está ativa
powershell -Command "try { $c = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 3000); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo [INFO] O sistema JANLUX já está em execução!
    echo Abrindo navegador em http://localhost:3000 ...
    start http://localhost:3000
    exit /b 0
)

echo.
echo =======================================================
echo   JANLUX ELÉTRICOS LTDA.
echo   SISTEMA DE ALMOXARIFADO, EMBALAGENS E EXPEDIÇÃO
echo =======================================================
echo.
echo   [1/2] Iniciando o servidor...
echo   [2/2] O navegador será aberto automaticamente!
echo.
echo   Acesso Local:       http://localhost:3000
echo   Usuário Admin:      admin  / Senha: admin123
echo   Usuário Operador:   sandra / Senha: sandra123
echo.
echo   IMPORTANTE: Deixe esta janela aberta enquanto estiver
echo   usando o sistema. Para encerrar, feche esta janela.
echo =======================================================
echo.

node src\server.js

echo.
echo Servidor finalizado.
pause
