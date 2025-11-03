#!/usr/bin/env python3
"""
ASL Alphabet CNN Model Training
Based on: github.com/parakh-gupta/Sign_language_alphabet_recognizer
Simplified and optimized for faster training
"""

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.preprocessing.image import ImageDataGenerator
import json
import os
from pathlib import Path

# ============================================
# Configuration
# ============================================

SCRIPT_DIR = Path(__file__).parent.absolute()
DATASET_PATH = SCRIPT_DIR / 'asl_alphabet_train' / 'asl_alphabet_train'
MODEL_PATH = SCRIPT_DIR / 'asl_model.h5'

# Image settings - following reference architecture
IMG_SIZE = 50  # Grayscale 50x50 (from reference)
IMG_CHANNELS = 1  # Grayscale

# Training settings
EPOCHS = 20  # Reasonable for good accuracy
BATCH_SIZE = 64
VALIDATION_SPLIT = 0.2

# ASL Alphabet labels
LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 
          'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 
          'U', 'V', 'W', 'X', 'Y', 'Z']

print("=" * 70)
print("🎯 ASL Alphabet CNN Training (Reference Architecture)")
print("=" * 70)
print(f"Image size: {IMG_SIZE}x{IMG_SIZE} grayscale")
print(f"Epochs: {EPOCHS}")
print(f"Batch size: {BATCH_SIZE}")
print("=" * 70)

# ============================================
# Data Generators with Grayscale
# ============================================

def create_generators():
    """Create data generators for grayscale images"""
    
    # Training generator with augmentation
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=10,
        width_shift_range=0.1,
        height_shift_range=0.1,
        shear_range=0.1,
        zoom_range=0.1,
        validation_split=VALIDATION_SPLIT
    )
    
    # Validation generator
    val_datagen = ImageDataGenerator(
        rescale=1./255,
        validation_split=VALIDATION_SPLIT
    )
    
    # Training data
    train_generator = train_datagen.flow_from_directory(
        str(DATASET_PATH),
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        classes=LABELS,
        color_mode='grayscale',  # Important: grayscale
        subset='training',
        shuffle=True,
        seed=42
    )
    
    # Validation data
    val_generator = val_datagen.flow_from_directory(
        str(DATASET_PATH),
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        classes=LABELS,
        color_mode='grayscale',  # Important: grayscale
        subset='validation',
        shuffle=False,
        seed=42
    )
    
    return train_generator, val_generator

# ============================================
# CNN Model Architecture (Similar to Reference)
# ============================================

def create_model():
    """
    Create CNN model similar to reference architecture
    Input: 50x50x1 grayscale images
    Output: 26 classes (A-Z)
    """
    
    model = keras.Sequential([
        # Input layer
        layers.Input(shape=(IMG_SIZE, IMG_SIZE, IMG_CHANNELS)),
        
        # Conv Block 1
        layers.Conv2D(32, (3, 3), activation='relu'),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.25),
        
        # Conv Block 2
        layers.Conv2D(64, (3, 3), activation='relu'),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.25),
        
        # Conv Block 3
        layers.Conv2D(128, (3, 3), activation='relu'),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.25),
        
        # Flatten and Dense layers
        layers.Flatten(),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(128, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(26, activation='softmax')
    ])
    
    model.compile(
        optimizer='adam',
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    return model

# ============================================
# Training
# ============================================

def main():
    print("\n1. Creating data generators...")
    train_gen, val_gen = create_generators()
    
    print(f"   Training samples: {train_gen.samples}")
    print(f"   Validation samples: {val_gen.samples}")
    
    print("\n2. Creating CNN model...")
    model = create_model()
    model.summary()
    
    print("\n3. Training model...")
    
    # Callbacks
    callbacks = [
        keras.callbacks.ModelCheckpoint(
            str(MODEL_PATH),
            save_best_only=True,
            monitor='val_accuracy',
            verbose=1
        ),
        keras.callbacks.EarlyStopping(
            monitor='val_accuracy',
            patience=5,
            restore_best_weights=True,
            verbose=1
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=3,
            verbose=1
        )
    ]
    
    # Train
    history = model.fit(
        train_gen,
        epochs=EPOCHS,
        validation_data=val_gen,
        callbacks=callbacks,
        verbose=1
    )
    
    # Save final model
    model.save(str(MODEL_PATH))
    print(f"\n✅ Model saved: {MODEL_PATH}")
    
    # Save labels
    labels_file = SCRIPT_DIR / 'labels.json'
    with open(str(labels_file), 'w') as f:
        json.dump({'labels': LABELS}, f, indent=2)
    print(f"✅ Labels saved: {labels_file}")
    
    # Show results
    final_acc = history.history['accuracy'][-1]
    final_val_acc = history.history['val_accuracy'][-1]
    
    print("\n" + "=" * 70)
    print("✅ Training Complete!")
    print("=" * 70)
    print(f"Final training accuracy: {final_acc:.2%}")
    print(f"Final validation accuracy: {final_val_acc:.2%}")
    print(f"\nModel ready at: {MODEL_PATH}")
    print(f"Model size: {MODEL_PATH.stat().st_size / 1024 / 1024:.1f} MB")
    print("=" * 70)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Training interrupted")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
