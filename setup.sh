#!/bin/bash

# ASL Alphabet Sign Language Translator - Quick Start

echo "=================================================="
echo "ASL Alphabet Sign Language Translator"
echo "Quick Start Setup"
echo "=================================================="
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed!"
    echo "Please install Python 3 first."
    exit 1
fi

echo "✓ Python 3 found: $(python3 --version)"
echo ""

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed!"
    echo "Please install pip3 first."
    exit 1
fi

echo "✓ pip3 found"
echo ""

# Check dependencies
echo "Checking Python dependencies..."
python3 models/check_dependencies.py

if [ $? -ne 0 ]; then
    echo ""
    read -p "Install missing packages? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Installing packages..."
        pip3 install opencv-python mediapipe tensorflow numpy scikit-learn tensorflowjs
        
        echo ""
        echo "✓ Packages installed!"
    else
        echo "Skipping installation."
    fi
fi

echo ""
echo "=================================================="
echo "Setup Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo ""
echo "1. START WEB APP:"
echo "   python3 -m http.server 8000"
echo "   Then open: http://localhost:8000"
echo ""
echo "2. TRAIN MODEL (optional):"
echo "   cd models"
echo "   python3 collect_data.py    # Collect A-Z data"
echo "   python3 train_model.py     # Train model"
echo ""
echo "3. Website will use Fallback Mode until model is trained"
echo ""
echo "=================================================="
