#!/usr/bin/env python3
"""
Flask API for ASL Alphabet Recognition
Serves predictions from trained Keras model
"""

# Memory optimization for Railway free tier (512MB limit)
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Reduce TF logging
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'  # Disable oneDNN for memory

from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf

# Configure TensorFlow for minimal memory usage
tf.get_logger().setLevel('ERROR')
gpus = tf.config.experimental.list_physical_devices('GPU')
if gpus:
    for gpu in gpus:
        tf.config.experimental.set_memory_growth(gpu, True)

import numpy as np
from PIL import Image, ImageDraw
import io
import base64
import json
from pathlib import Path

app = Flask(__name__)
CORS(app)  # Enable CORS for browser access

# Load dual hand models from ASL-ML
MODEL_R_PATH = Path(__file__).parent / 'models' / 'R_keypoint_classifier_final.h5'
MODEL_L_PATH = Path(__file__).parent / 'models' / 'L_keypoint_classifier_final.h5'
LABELS_DUAL_PATH = Path(__file__).parent / 'models' / 'labels_dual.json'

print("Loading dual hand models...")
if not MODEL_R_PATH.exists():
    raise FileNotFoundError(f"Right hand model not found at {MODEL_R_PATH}!")
if not MODEL_L_PATH.exists():
    raise FileNotFoundError(f"Left hand model not found at {MODEL_L_PATH}!")

model_right = tf.keras.models.load_model(str(MODEL_R_PATH))
model_left = tf.keras.models.load_model(str(MODEL_L_PATH))

# For backward compatibility, keep 'model' as model_right
model = model_right

# Detect IMG_SIZE from model input shape
input_shape = model.input_shape
# Dual hand models expect 42 values (21 landmarks × 2 coords)
# But we still support image mode for backward compatibility
MODEL_TYPE = 'landmark'  # Changed to landmark-based

# Load labels for dual hand models (27 classes: a-z + space)
if LABELS_DUAL_PATH.exists():
    print(f"Loading labels from: {LABELS_DUAL_PATH}")
    with open(LABELS_DUAL_PATH, 'r') as f:
        labels_dict = json.load(f)
        LABELS = [labels_dict[str(i)] for i in range(len(labels_dict))]
        print(f"Loaded {len(LABELS)} labels from JSON")
else:
    # Fallback for dual hand models (27 classes)
    LABELS = [chr(97 + i) for i in range(26)] + ['space']
    print(f"Using default 27 labels (a-z + space)")

# For image conversion (backward compatibility)
IMG_SIZE = 64
USE_GRAYSCALE = False
    
print(f"✓ Dual hand models loaded:")
print(f"  Right hand: {MODEL_R_PATH.name}")
print(f"  Left hand: {MODEL_L_PATH.name}")
print(f"  Type: {MODEL_TYPE}")
print(f"  Input shape: {model.input_shape}")
print(f"  Output shape: {model.output_shape}")
print(f"  Labels: {LABELS}")

# ============================================
# LANDMARK PREPROCESSING (ASL-ML Format)
# ============================================

def preprocess_landmarks(landmarks):
    """
    Preprocess MediaPipe landmarks for dual hand model prediction.
    Converts 63 values (21 landmarks × 3 coords) to 42 values (21 landmarks × 2 coords).
    Applies wrist-relative normalization as per ASL-ML preprocessing.
    
    Args:
        landmarks: List of 63 values [x1,y1,z1, x2,y2,z2, ..., x21,y21,z21]
    
    Returns:
        numpy array of 42 normalized values [x1,y1, x2,y2, ..., x21,y21]
    """
    # Reshape to (21, 3) and extract only x, y (drop z)
    landmarks_array = np.array(landmarks).reshape(21, 3)
    landmarks_2d = landmarks_array[:, :2]  # Take only x, y coordinates
    
    # Make wrist-relative (subtract wrist position from all landmarks)
    base_x, base_y = landmarks_2d[0]
    landmarks_2d[:, 0] -= base_x
    landmarks_2d[:, 1] -= base_y
    
    # Flatten to 1D array
    landmarks_flat = landmarks_2d.flatten()
    
    # Normalize by max absolute value
    max_value = np.max(np.abs(landmarks_flat))
    if max_value > 0:
        landmarks_flat = landmarks_flat / max_value
    
    return landmarks_flat

# ============================================
# LANDMARK TO IMAGE CONVERSION
# ============================================

def landmarks_to_image(landmarks, img_size=64, use_grayscale=False):
    """
    Convert MediaPipe hand landmarks (21 points x 3 coords) to image
    that can be fed to the CNN model.
    
    Args:
        landmarks: List of 63 values [x1,y1,z1, x2,y2,z2, ..., x21,y21,z21]
        img_size: Output image size (default 64x64)
        use_grayscale: Whether to output grayscale or RGB
    
    Returns:
        PIL Image object
    """
    # Reshape landmarks to (21, 3)
    landmarks_array = np.array(landmarks).reshape(21, 3)
    
    # Normalize to image coordinates (0 to img_size)
    # MediaPipe coordinates are normalized 0-1
    x_coords = landmarks_array[:, 0] * img_size
    y_coords = landmarks_array[:, 1] * img_size
    
    # Create white background image
    if use_grayscale:
        img = Image.new('L', (img_size, img_size), color=255)
    else:
        img = Image.new('RGB', (img_size, img_size), color=(255, 255, 255))
    
    draw = ImageDraw.Draw(img)
    
    # MediaPipe hand connections (pairs of landmark indices)
    HAND_CONNECTIONS = [
        (0, 1), (1, 2), (2, 3), (3, 4),  # Thumb
        (0, 5), (5, 6), (6, 7), (7, 8),  # Index
        (0, 9), (9, 10), (10, 11), (11, 12),  # Middle
        (0, 13), (13, 14), (14, 15), (15, 16),  # Ring
        (0, 17), (17, 18), (18, 19), (19, 20),  # Pinky
        (5, 9), (9, 13), (13, 17)  # Palm
    ]
    
    # Draw connections (lines between landmarks)
    line_color = 0 if use_grayscale else (0, 0, 0)  # Black
    for connection in HAND_CONNECTIONS:
        start_idx, end_idx = connection
        start_point = (int(x_coords[start_idx]), int(y_coords[start_idx]))
        end_point = (int(x_coords[end_idx]), int(y_coords[end_idx]))
        draw.line([start_point, end_point], fill=line_color, width=2)
    
    # Draw landmarks (points)
    point_color = 50 if use_grayscale else (50, 50, 50)  # Dark gray
    for i in range(21):
        x, y = int(x_coords[i]), int(y_coords[i])
        radius = 3
        draw.ellipse([x-radius, y-radius, x+radius, y+radius], fill=point_color)
    
    return img

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'model': 'loaded'})

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict ASL letter from landmarks with handedness detection.
    Expects: JSON with 'landmarks' (array of 63 values) and optional 'handedness' ('Left' or 'Right')
    Returns: JSON with prediction and confidence
    """
    try:
        # Get JSON data
        data = request.get_json()
        
        # Check if landmarks are provided
        if 'landmarks' not in data:
            return jsonify({'error': 'Landmarks required. Send 63 values (21 landmarks × 3 coords)'}), 400
        
        landmarks = data['landmarks']
        handedness = data.get('handedness', 'Right')  # Default to Right hand
        
        if len(landmarks) != 63:
            return jsonify({'error': f'Expected 63 landmark values, got {len(landmarks)}'}), 400
        
        print(f"📍 Received landmarks: {len(landmarks)} values, Handedness: {handedness}")
        
        # Preprocess landmarks (63 → 42 values, normalized)
        processed_landmarks = preprocess_landmarks(landmarks)
        print(f"   Preprocessed to {len(processed_landmarks)} values (42 = 21 landmarks × 2 coords)")
        
        # Select model based on handedness
        if handedness == 'Left':
            selected_model = model_left
            model_name = "Left Hand"
        else:
            selected_model = model_right
            model_name = "Right Hand"
        
        # Prepare input for model (shape: 1, 42)
        model_input = np.array([processed_landmarks], dtype=np.float32)
        
        # Make prediction
        predictions = selected_model.predict(model_input, verbose=0)[0]
        
        # Get top prediction
        top_idx = np.argmax(predictions)
        top_label = LABELS[top_idx]
        top_confidence = float(predictions[top_idx])
        
        # Get top 3 predictions
        top_3_idx = np.argsort(predictions)[-3:][::-1]
        top_3 = [
            {
                'label': LABELS[idx],
                'confidence': float(predictions[idx])
            }
            for idx in top_3_idx
        ]
        
        # DEBUG: Print prediction results to console
        print(f"\n{'='*50}")
        print(f"🔍 PREDICTION RESULT ({model_name} Model):")
        print(f"   Top: {top_label} ({top_confidence:.1%})")
        print(f"   Top 3:")
        for i, pred in enumerate(top_3, 1):
            print(f"     {i}. {pred['label']}: {pred['confidence']:.1%}")
        print(f"{'='*50}\n")
        
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
    import os
    
    # Get port from environment variable (for Railway/Render/Docker)
    port = int(os.environ.get('PORT', 5000))
    
    print("\n" + "="*60)
    print("🚀 ASL Alphabet Recognition API (Dual Hand Models)")
    print("="*60)
    print(f"Right Hand Model: {MODEL_R_PATH.name}")
    print(f"Left Hand Model: {MODEL_L_PATH.name}")
    print(f"Type: {MODEL_TYPE}")
    print(f"Labels: {len(LABELS)} ({', '.join(LABELS)})")
    print(f"Input: 42 values (21 landmarks × 2 coords)")
    print("\nEndpoints:")
    print("  GET  /health  - Health check")
    print("  POST /predict - Predict ASL letter (requires 'landmarks' and optional 'handedness')")
    print("  GET  /labels  - Get all labels")
    print(f"\nStarting server on http://0.0.0.0:{port}")
    print("="*60)
    
    app.run(host='0.0.0.0', port=port, debug=False)

