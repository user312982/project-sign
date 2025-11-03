#!/bin/bash
# Script untuk menjalankan Flask API Server

cd "$(dirname "$0")"

echo "================================================"
echo "  ASL Alphabet Recognition - API Server"
echo "================================================"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "⚠️  Virtual environment tidak ditemukan!"
    echo "📦 Membuat virtual environment..."
    python3 -m venv venv
    echo "✓ Virtual environment dibuat"
    echo ""
fi

# Activate virtual environment
echo "🔄 Mengaktifkan virtual environment..."
source venv/bin/activate

# Check if dependencies are installed
if ! python -c "import tensorflow" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    echo ""
    pip install -q flask flask-cors tensorflow pillow numpy
    echo ""
    echo "✓ Dependencies installed"
    echo ""
fi

# Check if model exists
if [ ! -f "models/asl_model.h5" ]; then
    echo "❌ Model tidak ditemukan di models/asl_model.h5"
    echo "   Pastikan Anda sudah melatih model terlebih dahulu"
    exit 1
fi

echo "================================================"
echo "  🚀 Starting API Server..."
echo "================================================"
echo ""
echo "Model: models/asl_model.h5"
echo "URL: http://localhost:5000"
echo ""
echo "Tekan Ctrl+C untuk stop server"
echo ""

python3 api_server.py
