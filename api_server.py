#!/usr/bin/env python3
"""
Flask API for ASL Alphabet Recognition - TFLite Version
Uses lightweight tflite-runtime for Railway free tier compatibility.
"""

import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # Suppress TF warnings

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from PIL import Image, ImageDraw
import io
import base64
import json
from pathlib import Path

# Try tflite-runtime first (lightweight), fallback to tensorflow
try:
    from tflite_runtime.interpreter import Interpreter
    print("Using: tflite-runtime (lightweight)")
except ImportError:
    from tensorflow.lite.python.interpreter import Interpreter
    print("Using: tensorflow.lite (fallback)")

app = Flask(__name__)
CORS(app)  # Enable CORS for browser access

# Load TFLite models
MODEL_R_PATH = Path(__file__).parent / 'models' / 'R_keypoint_classifier.tflite'
MODEL_L_PATH = Path(__file__).parent / 'models' / 'L_keypoint_classifier.tflite'
LABELS_PATH = Path(__file__).parent / 'models' / 'labels_dual.json'

print("Loading TFLite models...")

# Check if models exist
if not MODEL_R_PATH.exists():
    raise FileNotFoundError(f"Right hand model not found at {MODEL_R_PATH}!")
if not MODEL_L_PATH.exists():
    raise FileNotFoundError(f"Left hand model not found at {MODEL_L_PATH}!")

# Load interpreters
interpreter_right = Interpreter(model_path=str(MODEL_R_PATH))
interpreter_right.allocate_tensors()

interpreter_left = Interpreter(model_path=str(MODEL_L_PATH))
interpreter_left.allocate_tensors()

# Get input/output details
input_details_r = interpreter_right.get_input_details()
output_details_r = interpreter_right.get_output_details()
input_details_l = interpreter_left.get_input_details()
output_details_l = interpreter_left.get_output_details()

# Load labels
if LABELS_PATH.exists():
    print(f"Loading labels from: {LABELS_PATH}")
    with open(LABELS_PATH, 'r') as f:
        labels_dict = json.load(f)
        LABELS = [labels_dict[str(i)] for i in range(len(labels_dict))]
        print(f"Loaded {len(LABELS)} labels from JSON")
else:
    LABELS = [chr(97 + i) for i in range(26)] + ['space']
    print(f"Using default 27 labels (a-z + space)")

print(f"✓ TFLite models loaded:")
print(f"  Right hand: {MODEL_R_PATH.name}")
print(f"  Left hand: {MODEL_L_PATH.name}")
print(f"  Input shape: {input_details_r[0]['shape']}")
print(f"  Output shape: {output_details_r[0]['shape']}")
print(f"  Labels: {LABELS}")

# ============================================
# LANDMARK PREPROCESSING
# ============================================

def preprocess_landmarks(landmarks):
    """
    Preprocess MediaPipe landmarks for model prediction.
    Converts 63 values (21 landmarks × 3 coords) to 42 values (21 × 2 coords).
    """
    landmarks_array = np.array(landmarks).reshape(21, 3)
    landmarks_2d = landmarks_array[:, :2]  # Take only x, y
    
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
# TFLite INFERENCE
# ============================================

def predict_tflite(interpreter, input_details, output_details, input_data):
    """Run inference on TFLite model."""
    interpreter.set_tensor(input_details[0]['index'], input_data)
    interpreter.invoke()
    return interpreter.get_tensor(output_details[0]['index'])

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'model': 'tflite', 'version': '2.0.0'})

@app.route('/predict', methods=['POST'])
def predict():
    """Predict ASL letter from landmarks."""
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
        
        # Select model based on handedness
        if handedness == 'Left':
            predictions = predict_tflite(interpreter_left, input_details_l, output_details_l, model_input)[0]
            model_name = "Left Hand (TFLite)"
        else:
            predictions = predict_tflite(interpreter_right, input_details_r, output_details_r, model_input)[0]
            model_name = "Right Hand (TFLite)"
        
        # Get predictions
        top_idx = np.argmax(predictions)
        top_label = LABELS[top_idx]
        top_confidence = float(predictions[top_idx])
        
        # Top 3
        top_3_idx = np.argsort(predictions)[-3:][::-1]
        top_3 = [{'label': LABELS[idx], 'confidence': float(predictions[idx])} for idx in top_3_idx]
        
        print(f"🔍 {model_name}: {top_label} ({top_confidence:.1%})")
        
        return jsonify({
            'prediction': top_label,
            'confidence': top_confidence,
            'top3': top_3,
            'handedness': handedness,
            'model_used': model_name
        })
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/labels', methods=['GET'])
def get_labels():
    """Get all possible labels"""
    return jsonify({'labels': LABELS})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    
    print("\n" + "=" * 50)
    print("🚀 ASL Recognition API (TFLite - Lightweight)")
    print("=" * 50)
    print(f"Models: TFLite format (~110KB each)")
    print(f"Runtime: tflite-runtime (~5MB)")
    print(f"Labels: {len(LABELS)} ({', '.join(LABELS)})")
    print(f"\nStarting on http://0.0.0.0:{port}")
    print("=" * 50)
    
    app.run(host='0.0.0.0', port=port, debug=False)
