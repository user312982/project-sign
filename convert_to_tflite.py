#!/usr/bin/env python3
"""
Convert Keras H5 models to TFLite format for reduced memory usage.
This allows running on Railway free tier (512MB RAM limit).
"""

import tensorflow as tf
from pathlib import Path
import numpy as np

def convert_to_tflite(h5_path, tflite_path):
    """Convert a Keras H5 model to TFLite format with optimization."""
    print(f"Converting: {h5_path} -> {tflite_path}")
    
    # Load the Keras model
    model = tf.keras.models.load_model(str(h5_path))
    print(f"  Input shape: {model.input_shape}")
    print(f"  Output shape: {model.output_shape}")
    
    # Convert to TFLite with float16 quantization for smaller size
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    
    # Optimizations for smaller model size
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    
    # Convert
    tflite_model = converter.convert()
    
    # Save
    with open(tflite_path, 'wb') as f:
        f.write(tflite_model)
    
    # Report sizes
    h5_size = Path(h5_path).stat().st_size
    tflite_size = len(tflite_model)
    reduction = (1 - tflite_size / h5_size) * 100
    
    print(f"  H5 size: {h5_size / 1024:.1f} KB")
    print(f"  TFLite size: {tflite_size / 1024:.1f} KB")
    print(f"  Size reduction: {reduction:.1f}%")
    print()
    
    return tflite_path

def test_tflite_model(tflite_path):
    """Test that the TFLite model works correctly."""
    print(f"Testing: {tflite_path}")
    
    # Load the TFLite model
    interpreter = tf.lite.Interpreter(model_path=str(tflite_path))
    interpreter.allocate_tensors()
    
    # Get input/output details
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    print(f"  Input: {input_details[0]['shape']} ({input_details[0]['dtype']})")
    print(f"  Output: {output_details[0]['shape']} ({output_details[0]['dtype']})")
    
    # Test inference with random data
    input_shape = input_details[0]['shape']
    test_input = np.random.randn(*input_shape).astype(np.float32)
    
    interpreter.set_tensor(input_details[0]['index'], test_input)
    interpreter.invoke()
    
    output = interpreter.get_tensor(output_details[0]['index'])
    print(f"  Test output shape: {output.shape}")
    print(f"  Test passed! ✓")
    print()

def main():
    models_dir = Path(__file__).parent / 'models'
    
    print("=" * 50)
    print("TFLite Model Conversion")
    print("=" * 50)
    print()
    
    # Convert both models
    models_to_convert = [
        ('R_keypoint_classifier_final.h5', 'R_keypoint_classifier.tflite'),
        ('L_keypoint_classifier_final.h5', 'L_keypoint_classifier.tflite'),
    ]
    
    for h5_name, tflite_name in models_to_convert:
        h5_path = models_dir / h5_name
        tflite_path = models_dir / tflite_name
        
        if not h5_path.exists():
            print(f"⚠️ Model not found: {h5_path}")
            continue
        
        convert_to_tflite(h5_path, tflite_path)
        test_tflite_model(tflite_path)
    
    print("=" * 50)
    print("✓ Conversion complete!")
    print("=" * 50)

if __name__ == '__main__':
    main()
