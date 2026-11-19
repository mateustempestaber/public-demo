@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Quintal do Carmo - aberto para os amigos
if not exist bore.exe (
  echo Falta o bore.exe nesta pasta.
  echo Baixe em https://github.com/ekzhang/bore/releases  ^(arquivo bore-v0.6.0-x86_64-pc-windows-msvc.zip^)
  echo e coloque o bore.exe aqui, ao lado deste arquivo.
  pause
  exit /b
)
echo 1/2 Ligando o sistema na porta 8787...
start "Quintal - sistema (porta 8787)" /min bin\quintal-escalas-windows.exe -porta 8787 -dados dados.json
timeout /t 2 >nul
echo 2/2 Abrindo o tunel. O endereco para os amigos aparece abaixo, no formato bore.pub:NUMERO
echo Mande para eles:  http://bore.pub:NUMERO     (troque NUMERO pelo que aparecer)
echo Deixe esta janela aberta. Para parar, feche esta janela e a do sistema.
echo.
bore.exe local 8787 --to bore.pub
pause
