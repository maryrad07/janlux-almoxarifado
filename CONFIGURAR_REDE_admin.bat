@echo off
:: Este script precisa ser executado UMA UNICA VEZ como Administrador
:: Clique com o botao direito e selecione "Executar como administrador"

chcp 65001 >nul
title JANLUX — Configuracao de Rede (Administrador)
color 0B

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   JANLUX — Configuracao de Acesso pela Rede Local   ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: Verifica se está rodando como Admin
net session >nul 2>&1
if errorlevel 1 (
    echo  [ERRO] Este script precisa ser executado como ADMINISTRADOR!
    echo.
    echo  Clique com o botao direito neste arquivo e escolha:
    echo  "Executar como administrador"
    echo.
    pause
    exit /b 1
)

echo  [1/2] Abrindo porta 3000 no Firewall do Windows...
netsh advfirewall firewall delete rule name="JANLUX Sistema 3000" >nul 2>&1
netsh advfirewall firewall add rule name="JANLUX Sistema 3000" dir=in action=allow protocol=TCP localport=3000 profile=private,domain description="Permite acesso ao sistema JANLUX pela rede local"

if errorlevel 1 (
    echo  [ERRO] Falha ao configurar o firewall.
    pause
    exit /b 1
)

echo  [OK] Porta 3000 liberada no Firewall!
echo.

:: Descobre o IP local
echo  [2/2] Identificando o endereco IP desta maquina...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%

echo  [OK] Endereco IP encontrado: %IP%
echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║                  CONFIGURACAO CONCLUIDA!                ║
echo  ╠══════════════════════════════════════════════════════════╣
echo  ║                                                          ║
echo  ║  As outras maquinas da rede devem acessar:              ║
echo  ║                                                          ║
echo  ║     http://%IP%:3000                         ║
echo  ║                                                          ║
echo  ║  IMPORTANTE:                                            ║
echo  ║  1. O sistema JANLUX precisa estar iniciado             ║
echo  ║     neste computador (use o atalho da area              ║
echo  ║     de trabalho ou o iniciar_sistema.bat)               ║
echo  ║                                                          ║
echo  ║  2. Todas as maquinas devem estar na mesma              ║
echo  ║     rede Wi-Fi ou cabo (rede local).                    ║
echo  ║                                                          ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
pause
