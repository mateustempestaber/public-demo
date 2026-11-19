@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Quintal do Carmo - Escala 5x2 (homologacao)
echo Abrindo em http://localhost:8787  (deixe esta janela aberta)
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8787"
bin\quintal-escalas-windows.exe -porta 8787 -dados dados.json
pause
