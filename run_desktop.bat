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

:: 1. 检查前端是否已构建
if not exist "frontend\dist\index.html" (
    echo [1/2] 构建前端...
    cd frontend
    call npm run build
    cd ..
    if errorlevel 1 (
        echo.
        echo [错误] 前端构建失败
        pause
        exit /b 1
    )
) else (
    echo [1/2] 前端已构建，跳过
)

:: 2. 启动桌面应用
echo [2/2] 启动桌面应用...
cd backend
python desktop_launcher.py
cd ..

pause
