@echo off
start "carrot-hub server" /d "%~dp0server" cmd /k npm run dev
start "carrot-hub client" /d "%~dp0client" cmd /k npm run dev
