@echo off
chcp 65001 >nul
title 番茄短篇 - 桌面版
cd /d "%~dp0"

echo.
echo ================================================
echo   番茄短篇 - AI 短篇小说创作助手
echo   桌面版 v1.0
echo ================================================
echo.

:: 1. 检测前端源文件变更，决定是否重建
echo [1/2] 检查前端构建状态...
python scripts/build_check.py check
if %ERRORLEVEL% equ 1 (
    echo.
    echo [1/2] 源文件已变更，重新构建前端...
    cd frontend
    call npm run build
    cd ..
    if errorlevel 1 (
        echo.
        echo [错误] 前端构建失败
        pause
        exit /b 1
    )
    :: 构建成功后自动写入新标记
    python scripts/build_check.py update
) else if %ERRORLEVEL% equ 0 (
    if exist "frontend\dist\index.html" (
        echo [1/2] 前端未变更且已构建，跳过
    ) else (
        echo.
        echo [1/2] dist 目录缺失，重新构建前端...
        cd frontend
        call npm run build
        cd ..
        if errorlevel 1 (
            echo.
            echo [错误] 前端构建失败
            pause
            exit /b 1
        )
        python scripts/build_check.py update
    )
) else (
    echo.
    echo [1/2] 构建检测异常，强制重新构建...
    cd frontend
    call npm run build
    cd ..
    if errorlevel 1 (
        echo.
        echo [错误] 前端构建失败
        pause
        exit /b 1
    )
    python scripts/build_check.py update
)

:: 2. 启动桌面应用
echo.
echo [2/2] 启动桌面应用...
cd backend
python desktop_launcher.py
cd ..

pause
