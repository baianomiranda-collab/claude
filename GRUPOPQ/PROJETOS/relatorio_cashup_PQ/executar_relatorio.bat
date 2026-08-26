@echo off
cd /d "%~dp0"

echo ============================================================
echo   RELATORIO DE ORCAMENTOS - CASH-UP
echo ============================================================
echo.

set PYEXE=

py -3 --version >nul 2>&1
if %errorlevel%==0 (
    set PYEXE=py -3
    goto :python_ok
)

echo ERRO: Python nao encontrado.
echo Instale o Python em https://python.org ou verifique sua instalacao.
echo.
pause
exit /b 1

:python_ok
echo Python encontrado, verificando dependencias...
%PYEXE% -c "import playwright, dotenv" >nul 2>&1
if not %errorlevel%==0 (
    echo.
    echo ERRO: dependencias nao instaladas.
    echo Execute: pip install -r requirements.txt ^&^& py -3 -m playwright install chromium
    echo.
    pause
    exit /b 1
)

echo Dependencias OK, iniciando...
echo.
%PYEXE% relatorio_cashup.py

echo.
echo ============================================================
echo   Pressione qualquer tecla para fechar esta janela...
echo ============================================================
pause >nul
