@echo off
setlocal
where node >nul 2>&1 || goto :missingNode
node "%~dp0scripts\start.mjs" %*
set "launcherExitCode=%errorlevel%"
if not "%launcherExitCode%"=="0" pause
exit /b %launcherExitCode%

:missingNode
chcp 65001 >nul
rem 이 파일은 UTF-8이라, 코드 페이지를 바꾼 뒤에 읽히는 줄부터 한글이 깨지지 않는다.
echo.
echo   Node.js를 찾을 수 없어요.
echo   https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요.
echo.
pause
exit /b 1
