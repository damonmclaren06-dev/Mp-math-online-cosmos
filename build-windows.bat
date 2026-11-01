@echo off
cd /d "%~dp0"
echo Installing MP Math build dependencies...
call npm install
if errorlevel 1 goto error
echo Building V_8-Deepseaplat.exe...
call npm run dist:win
if errorlevel 1 goto error
echo.
echo Build complete. Find the installer in dist\V_8-Deepseaplat.exe
pause
exit /b 0
:error
echo.
echo Build failed. Check the error above.
pause
exit /b 1
