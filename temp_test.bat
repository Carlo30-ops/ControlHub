@echo off
where node >nul 2>&1
if 0 neq 0 (
    echo ERR
    exit /b 1
)
