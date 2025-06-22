@echo off
REM Enhanced Quantum Consciousness Detector v2.0 Launch Script
REM 2024-2025 Physics Integration

echo 🧠 Enhanced Quantum Consciousness Detector v2.0
echo 🔬 Integrating 2024-2025 Physics Discoveries
echo 🔧 Optimized for RTX 2080 Super + Ryzen 7 2700X
echo.

REM Check if virtual environment exists
if not exist "consciousness_env" (
    echo 📦 Creating virtual environment...
    python -m venv consciousness_env
)

REM Activate virtual environment
echo 🔄 Activating virtual environment...
call consciousness_env\Scripts\activate.bat

REM Install/update requirements
echo 📥 Installing enhanced requirements...
pip install -r requirements_enhanced.txt

REM Check Qiskit installation
echo 🔍 Verifying Qiskit installation...
python -c "import qiskit; from qiskit_aer import Aer; print('✅ Qiskit version:', qiskit.__version__)"

REM Launch enhanced detector
echo.
echo 🚀 Launching Enhanced Quantum Consciousness Detector v2.0...
echo 🌐 Web interface will be available at: http://localhost:5001
echo 🔬 Physics integrations: CP Violation ^| Quark Entanglement ^| Microtubule ^| String Theory ^| Dark Matter
echo.

python consciousness_detector_v2.py

pause