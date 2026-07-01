@echo off
chcp 65001 >nul
title fanqie-short-novel build
cd /d "%~dp0\.."

echo.
echo ================================================
echo   fanqie-short-novel Build Script
echo ================================================
echo.

rem ---- 1. Build Frontend ----
echo [1/5] Checking frontend build...
if not exist "frontend\dist\index.html" (
    echo [!] Frontend not built, building now...
    cd frontend
    call npm run build
    cd ..
    if errorlevel 1 (
        echo [FAIL] Frontend build failed
        pause
        exit /b 1
    )
    echo [OK] Frontend build done
) else (
    echo [OK] Frontend already built
)

rem ---- 2. Copy ICO ----
echo [2/5] Preparing resource files...
set ICO_SRC=frontend\public\favicon.ico
set ICO_DST=frontend\dist\favicon.ico
if not exist "%ICO_DST%" (
    if exist "%ICO_SRC%" (
        copy "%ICO_SRC%" "%ICO_DST%" >nul
        echo [OK] favicon.ico copied to dist
    ) else (
        echo [!] favicon.ico not found, skipping
    )
) else (
    echo [OK] favicon.ico exists
)

rem ---- 3. Kill old process ----
echo [3/5] Stopping running instance...
taskkill /f /im "fanqie-short-novel.exe" >nul 2>&1
echo [OK] Done

rem ---- 4. PyInstaller ----
echo [4/5] Running PyInstaller (this may take a while)...

rem try python -m PyInstaller first, fallback to pyinstaller
set PACK_CMD=python -m PyInstaller
where pyinstaller >nul 2>&1
if %errorlevel% equ 0 set PACK_CMD=pyinstaller

rem clean old build dirs
if exist "build-exe\" rmdir /s /q "build-exe"
if exist "dist-exe\" rmdir /s /q "dist-exe"

%PACK_CMD% scripts\build_exe.spec --distpath dist-exe --workpath build-exe --noconfirm
if errorlevel 1 (
    echo.
    echo [FAIL] PyInstaller build failed
    pause
    exit /b 1
)
echo [OK] PyInstaller build done

rem ---- 5. Cleanup & Copy ----
echo [5/5] Cleanup and finalize...
if exist "build-exe\" rmdir /s /q "build-exe"
echo [OK] Temp files cleaned

if exist ".env" (
    copy ".env" "dist-exe\fanqie-short-novel\.env" >nul
    echo [OK] .env copied to output
)

rem create shortcut
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%CD%\dist-exe\fanqie-short-novel.lnk'); $s.TargetPath = '%CD%\dist-exe\fanqie-short-novel\fanqie-short-novel.exe'; $s.IconLocation = '%CD%\dist-exe\fanqie-short-novel\fanqie-short-novel.exe,0'; $s.Save()"
echo [OK] Shortcut created

echo.
echo ================================================
echo   BUILD SUCCESS
echo   Output: dist-exe\fanqie-short-novel\
echo   Exe:    dist-exe\fanqie-short-novel\fanqie-short-novel.exe
echo ================================================
echo.

pause
