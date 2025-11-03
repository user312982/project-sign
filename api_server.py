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

# Load model
MODEL_PATH = Path(__file__).parent / 'models' / 'asl_model.h5'

print("Loading model...")
# Try new model first, fallback to quick model
if MODEL_PATH.exists():
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
else:
    # Fallback to quick model
    MODEL_PATH = Path(__file__).parent / 'models' / 'asl_alphabet_model_quick.h5'
    model = tf.keras.models.load_model(str(MODEL_PATH))
    IMG_SIZE = 32
    USE_GRAYSCALE = False
    LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
              'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
    
print(f"✓ Model loaded: {MODEL_PATH}")
print(f"  Input shape: {model.input_shape}")
print(f"  Output shape: {model.output_shape}")
print(f"  Grayscale: {USE_GRAYSCALE}")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'model': 'loaded'})

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict ASL letter from image
    Expects: JSON with base64 encoded image
    Returns: JSON with prediction and confidence
    """
    try:
        # Get JSON data
        data = request.get_json()
        
        if 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400
        
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
    print(f"Labels: {len(LABELS)} (A-Z)")
    print(f"Image size: {IMG_SIZE}x{IMG_SIZE}")
    print(f"Color mode: {'Grayscale' if USE_GRAYSCALE else 'RGB'}")
    print("\nEndpoints:")
    print("  GET  /health  - Health check")
    print("  POST /predict - Predict ASL letter from image")
    print("  GET  /labels  - Get all labels")
    print("\nStarting server on http://localhost:5000")
    print("="*60)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
