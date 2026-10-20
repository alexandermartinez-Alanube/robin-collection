@echo off
cd /d "%~dp0"

:loop
echo [%date% %time%] Iniciando consumidor de Robin... >> service.log
node pubsub-consumer.js >> consumer.log 2>&1
echo [%date% %time%] El proceso terminó (posible caída), reiniciando en 5s... >> service.log
timeout /t 5 /nobreak >nul
goto loop
