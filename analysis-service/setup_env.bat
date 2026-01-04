@echo off
echo ===================================================
echo Setting up Python Virtual Environment for PoliticAI
echo ===================================================

cd /d "%~dp0"

echo [1/3] Creating virtual environment (venv)...
python -m venv venv

echo [2/3] Upgrading pip...
call venv\Scripts\python -m pip install --upgrade pip

echo [3/3] Installing dependencies...
echo This may take a few minutes as we are installing PyTorch and Transformers...
call venv\Scripts\pip install -r requirements.txt

echo.
echo ===================================================
echo Setup Complete!
echo ===================================================
echo.
echo To run the server, use:
echo venv\Scripts\uvicorn app.main:app --reload --port 8000
echo.
pause
