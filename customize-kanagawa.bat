@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0customize-kanagawa.ps1" -Menu %*
if errorlevel 1 pause
