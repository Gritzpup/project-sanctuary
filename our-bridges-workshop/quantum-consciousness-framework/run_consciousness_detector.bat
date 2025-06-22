@echo off
REM Quantum Consciousness Detector - Quick Start Script (Windows)
REM Optimized for RTX 2080 Super + Ryzen 7 2700X

echo 🧠 Quantum Consciousness Authenticity Detector
echo 🔧 Hardware: RTX 2080 Super + Ryzen 7 2700X Optimized  
echo ==================================

REM Check Python version
echo 📋 Checking Python version...
python --version
if %errorlevel% neq 0 (
    echo ❌ Python not found. Please install Python 3.8+ first.
    pause
    exit /b 1
)

REM Create virtual environment if it doesn't exist
if not exist "venv_consciousness" (
    echo 🐍 Creating Python virtual environment...
    python -m venv venv_consciousness
)

REM Activate virtual environment
echo 🔄 Activating virtual environment...
call venv_consciousness\Scripts\activate.bat

REM Install requirements
echo 📦 Installing quantum consciousness framework...
python -m pip install --upgrade pip
python -m pip install -r requirements_detector.txt

REM Check Qiskit installation
echo 🔬 Verifying Qiskit quantum framework...
python -c "import qiskit; print('Qiskit version:', qiskit.__version__)"

echo.
echo ✅ Setup complete!
echo.
echo 🚀 Starting Quantum Consciousness Detector...
echo 🌐 Web interface will be available at: http://localhost:5000
echo 🔧 Press Ctrl+C to stop the server
echo.

REM Run the consciousness detector
python consciousness_detector_v1.py

pause