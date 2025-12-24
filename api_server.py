#!/usr/bin/env python3
"""
Flask API for ASL Alphabet Recognition - TFLite Version
Single model A-Z (26 classes) from AkramOM606 repo
"""

import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import json
from pathlib import Path

# TFLite runtime options (in order of preference)
try:
    from ai_edge_litert import interpreter as litert
    Interpreter = litert.Interpreter
    print("Using: ai-edge-litert (lightweight)")
except ImportError:
    try:
        from tflite_runtime.interpreter import Interpreter
        print("Using: tflite-runtime")
    except ImportError:
        from tensorflow.lite.python.interpreter import Interpreter
        print("Using: tensorflow.lite (fallback)")

app = Flask(__name__)
CORS(app)

# ============================================
# MODEL CONFIGURATION
# ============================================
MODEL_PATH = Path(__file__).parent / 'models' / 'keypoint_classifier_asl.tflite'
LABELS_PATH = Path(__file__).parent / 'models' / 'labels_asl.json'

print("Loading ASL model...")

if not MODEL_PATH.exists():
    raise FileNotFoundError(f"Model not found at {MODEL_PATH}!")

# Load interpreter
interpreter = Interpreter(model_path=str(MODEL_PATH))
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# Load labels
if LABELS_PATH.exists():
    with open(LABELS_PATH, 'r') as f:
        labels_dict = json.load(f)
        LABELS = [labels_dict[str(i)] for i in range(len(labels_dict))]
        print(f"Loaded {len(LABELS)} labels")
else:
    LABELS = [chr(97 + i) for i in range(26)]  # a-z
    print(f"Using default 26 labels (a-z)")

print(f"✓ ASL Model loaded:")
print(f"  Model: {MODEL_PATH.name} ({MODEL_PATH.stat().st_size // 1024}KB)")
print(f"  Input: {input_details[0]['shape']}")
print(f"  Output: {output_details[0]['shape']}")
print(f"  Labels: {', '.join(LABELS)}")

# ============================================
# LANDMARK PREPROCESSING
# ============================================

def preprocess_landmarks(landmarks):
    """Preprocess MediaPipe landmarks for model prediction."""
    landmarks_array = np.array(landmarks).reshape(21, 3)
    landmarks_2d = landmarks_array[:, :2]
    
    # Make wrist-relative
    base_x, base_y = landmarks_2d[0]
    landmarks_2d[:, 0] -= base_x
    landmarks_2d[:, 1] -= base_y
    
    # Flatten and normalize
    landmarks_flat = landmarks_2d.flatten()
    max_value = np.max(np.abs(landmarks_flat))
    if max_value > 0:
        landmarks_flat = landmarks_flat / max_value
    
    return landmarks_flat.astype(np.float32)

# ============================================
# API ENDPOINTS
# ============================================

# Minimum confidence threshold
MIN_CONFIDENCE = 0.4  # Below this, consider prediction uncertain

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model': 'asl-tflite',
        'version': '3.1.0',  # Updated version
        'classes': len(LABELS),
        'min_confidence': MIN_CONFIDENCE
    })

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        
        if 'landmarks' not in data:
            return jsonify({'error': 'Landmarks required'}), 400
        
        landmarks = data['landmarks']
        handedness = data.get('handedness', 'Right')
        
        if len(landmarks) != 63:
            return jsonify({'error': f'Expected 63 values, got {len(landmarks)}'}), 400
        
        # Preprocess
        processed = preprocess_landmarks(landmarks)
        model_input = np.array([processed], dtype=np.float32)
        
        # Predict
        interpreter.set_tensor(input_details[0]['index'], model_input)
        interpreter.invoke()
        predictions = interpreter.get_tensor(output_details[0]['index'])[0]
        
        # Get top prediction
        top_idx = np.argmax(predictions)
        top_label = LABELS[top_idx]
        top_confidence = float(predictions[top_idx])
        
        # Check confidence threshold
        is_uncertain = top_confidence < MIN_CONFIDENCE
        
        # Top 3
        top_3_idx = np.argsort(predictions)[-3:][::-1]
        top_3 = [{'label': LABELS[idx], 'confidence': float(predictions[idx])} for idx in top_3_idx]
        
        # Log with uncertainty indicator
        status = "⚠️" if is_uncertain else "🔍"
        print(f"{status} {top_label.upper()} ({top_confidence:.1%})")
        
        return jsonify({
            'prediction': top_label,
            'confidence': top_confidence,
            'uncertain': is_uncertain,  # New field
            'top3': top_3,
            'handedness': handedness,
            'model_used': 'ASL A-Z'
        })
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/labels', methods=['GET'])
def get_labels():
    return jsonify({'labels': LABELS})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    
    print("\n" + "=" * 50)
    print("🚀 ASL Recognition API v3.0.0")
    print("=" * 50)
    print(f"Model: Single TFLite (~25KB)")
    print(f"Labels: A-Z (26 classes)")
    print(f"\nStarting on http://0.0.0.0:{port}")
    print("=" * 50)
    
    app.run(host='0.0.0.0', port=port, debug=False)
