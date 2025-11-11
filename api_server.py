#!/usr/bin/env python3
"""
Flask API for ASL Alphabet Recognition
Serves predictions from trained Keras model
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import base64
import json
from pathlib import Path

app = Flask(__name__)
CORS(app)  # Enable CORS for browser access

# Load model - Try simple model first
MODEL_PATH = Path(__file__).parent / 'models' / 'asl_simple.h5'

print("Loading model...")
if MODEL_PATH.exists():
    # Simple landmark-based model
    print(f"Loading landmark-based model: {MODEL_PATH}")
    model = tf.keras.models.load_model(str(MODEL_PATH))
    
    # Load labels from JSON
    labels_path = Path(__file__).parent / 'models' / 'labels_simple.json'
    if labels_path.exists():
        with open(labels_path, 'r') as f:
            labels_data = json.load(f)
            LABELS = labels_data['labels']
    else:
        # Auto-detect from model output
        num_classes = model.output_shape[-1]
        LABELS = [chr(65 + i) for i in range(num_classes)]
    
    MODEL_TYPE = 'landmarks'  # Uses hand landmarks, not images
    IMG_SIZE = None
    USE_GRAYSCALE = None
    
else:
    # Fallback to image-based model
    MODEL_PATH = Path(__file__).parent / 'models' / 'asl_model.h5'
    if not MODEL_PATH.exists():
        raise FileNotFoundError("No model found! Please train a model first.")
    
    model = tf.keras.models.load_model(str(MODEL_PATH))
    
    # Detect IMG_SIZE from model input shape
    input_shape = model.input_shape
    IMG_SIZE = input_shape[1]  # Get height (assuming square images)
    USE_GRAYSCALE = input_shape[-1] == 1
    
    # Detect labels from output shape
    num_classes = model.output_shape[-1]
    if num_classes == 25:
        # Model without J (J requires motion)
        LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 
                  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
    elif num_classes == 26:
        LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
                  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
    else:
        # Generate generic labels
        LABELS = [chr(65 + i) for i in range(num_classes)]
    
    MODEL_TYPE = 'image'
    
print(f"✓ Model loaded: {MODEL_PATH}")
print(f"  Type: {MODEL_TYPE}")
print(f"  Input shape: {model.input_shape}")
print(f"  Output shape: {model.output_shape}")
print(f"  Labels: {LABELS}")
if MODEL_TYPE == 'image':
    print(f"  Grayscale: {USE_GRAYSCALE}")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'model': 'loaded'})

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict ASL letter from image or landmarks
    Expects: JSON with base64 encoded image or landmarks array
    Returns: JSON with prediction and confidence
    """
    try:
        # Get JSON data
        data = request.get_json()
        
        # Check if using landmarks (simple model) or image
        if MODEL_TYPE == 'landmarks' and 'landmarks' in data:
            # Use landmarks directly
            landmarks = np.array(data['landmarks'])
            
            # Ensure correct shape (63 features)
            if landmarks.shape != (63,):
                return jsonify({'error': 'Invalid landmarks shape. Expected (63,)'}), 400
            
            # Add batch dimension
            landmarks = np.expand_dims(landmarks, axis=0)
            
            # Make prediction
            predictions = model.predict(landmarks, verbose=0)[0]
            
        elif 'image' in data:
            # Image-based prediction
            if MODEL_TYPE == 'landmarks':
                return jsonify({'error': 'This model requires hand landmarks, not images'}), 400
            
            # Decode base64 image
            image_data = data['image']
            if ',' in image_data:
                # Remove data:image/png;base64, prefix
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convert to grayscale if model expects it
            if USE_GRAYSCALE:
                image = image.convert('L')  # Grayscale
            
            # Resize to model input size
            image = image.resize((IMG_SIZE, IMG_SIZE))
            
            # Convert to numpy array and normalize
            img_array = np.array(image) / 255.0
            
            # Add channel dimension if grayscale
            if USE_GRAYSCALE and len(img_array.shape) == 2:
                img_array = np.expand_dims(img_array, axis=-1)
            
            img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension
            
            # Make prediction
            predictions = model.predict(img_array, verbose=0)[0]
        else:
            return jsonify({'error': 'No image or landmarks provided'}), 400
        
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
        print(f"🔍 PREDICTION RESULT:")
        print(f"   Top: {top_label} ({top_confidence:.1%})")
        print(f"   Top 3:")
        for i, pred in enumerate(top_3, 1):
            print(f"     {i}. {pred['label']}: {pred['confidence']:.1%}")
        print(f"{'='*50}\n")
        
        return jsonify({
            'prediction': top_label,
            'confidence': top_confidence,
            'top3': top_3
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
    print("\n" + "="*60)
    print("🚀 ASL Alphabet Recognition API")
    print("="*60)
    print(f"Model: {MODEL_PATH.name}")
    print(f"Type: {MODEL_TYPE}")
    print(f"Labels: {len(LABELS)} ({', '.join(LABELS)})")
    if MODEL_TYPE == 'image':
        print(f"Image size: {IMG_SIZE}x{IMG_SIZE}")
        print(f"Color mode: {'Grayscale' if USE_GRAYSCALE else 'RGB'}")
    else:
        print(f"Input: 63 hand landmarks (21 points × 3 coords)")
    print("\nEndpoints:")
    print("  GET  /health  - Health check")
    print("  POST /predict - Predict ASL letter")
    print("  GET  /labels  - Get all labels")
    print("\nStarting server on http://localhost:5000")
    print("="*60)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
