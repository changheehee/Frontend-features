@echo off
start "carrot-hub server" /d "%~dp0server" cmd /k npm run dev
echo Waiting for the server on port 3001...
:waitForServer
powershell -NoProfile -Command "try { $client = [Net.Sockets.TcpClient]::new('127.0.0.1', 3001); $client.Close(); exit 0 } catch { Start-Sleep -Milliseconds 300; exit 1 }"
if errorlevel 1 goto waitForServer
start "carrot-hub client" /d "%~dp0client" cmd /k npm run dev
