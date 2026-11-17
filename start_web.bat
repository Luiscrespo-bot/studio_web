@echo off
title MX10 Studio ^& TCL Smart Remote Web
cd /d "%~dp0"
echo ========================================================
echo   MX10 Studio ^& TCL Smart Remote Web (TSX / JS / CSS)
echo ========================================================
echo.
echo Iniciando servidor Vite en http://localhost:5173...
echo.
npm run dev -- --open
pause

