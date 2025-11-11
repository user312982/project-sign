"""
Model Sederhana ASL (A, B, C) - Pure OpenCV + TensorFlow
Tanpa MediaPipe - Menggunakan image-based detection
"""

import cv2
import numpy as np
from tensorflow import keras
from tensorflow.keras import layers
import os
from datetime import datetime

class SimpleASLTrainer:
    def __init__(self):
        self.labels = ['A', 'B', 'C']
        self.num_classes = len(self.labels)
        self.samples_per_class = 50  # Lebih sedikit untuk cepat
        self.img_size = 64  # Ukuran image
        self.data = []
        self.labels_data = []
        
    def preprocess_hand(self, frame):
        """Extract hand region using skin color detection"""
        # Convert to HSV
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        
        # Skin color range
        lower_skin = np.array([0, 20, 70], dtype=np.uint8)
        upper_skin = np.array([20, 255, 255], dtype=np.uint8)
        
        # Create mask
        mask = cv2.inRange(hsv, lower_skin, upper_skin)
        
        # Morphological operations
        kernel = np.ones((5,5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        
        # Find largest contour
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            # Get largest contour
            largest_contour = max(contours, key=cv2.contourArea)
            
            if cv2.contourArea(largest_contour) > 5000:  # Minimum area
                x, y, w, h = cv2.boundingRect(largest_contour)
                
                # Add padding
                padding = 20
                x = max(0, x - padding)
                y = max(0, y - padding)
                w = min(frame.shape[1] - x, w + 2*padding)
                h = min(frame.shape[0] - y, h + 2*padding)
                
                # Extract hand region
                hand_roi = frame[y:y+h, x:x+w]
                
                # Resize to target size
                hand_resized = cv2.resize(hand_roi, (self.img_size, self.img_size))
                
                return hand_resized, (x, y, w, h), True
        
        return None, None, False
    
    def collect_data(self):
        """Collect training data"""
        cap = cv2.VideoCapture(0)
        
        print("="*60)
        print("DATA COLLECTION - Simple ASL Model")
        print("="*60)
        
        for label_idx, label in enumerate(self.labels):
            print(f"\n📍 Letter: {label}")
            print(f"   Target: {self.samples_per_class} samples")
            print(f"   Press SPACE to start, 'q' to skip")
            
            collected = 0
            collecting = False
            
            while collected < self.samples_per_class:
                ret, frame = cap.read()
                if not ret:
                    break
                
                frame = cv2.flip(frame, 1)
                display = frame.copy()
                
                # Preprocess
                hand_img, bbox, detected = self.preprocess_hand(frame)
                
                if detected and bbox:
                    x, y, w, h = bbox
                    cv2.rectangle(display, (x, y), (x+w, y+h), (0, 255, 0), 2)
                    
                    # Collect if active
                    if collecting and hand_img is not None:
                        # Convert to grayscale and normalize
                        gray = cv2.cvtColor(hand_img, cv2.COLOR_BGR2GRAY)
                        normalized = gray / 255.0
                        
                        self.data.append(normalized)
                        self.labels_data.append(label_idx)
                        collected += 1
                        
                        # Visual feedback
                        cv2.circle(display, (50, 50), 20, (0, 255, 0), -1)
                
                # Display info
                cv2.putText(display, f"Letter: {label}", (10, 30), 
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                cv2.putText(display, f"Collected: {collected}/{self.samples_per_class}", 
                           (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                
                if collecting:
                    cv2.putText(display, "COLLECTING...", (10, 110), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                else:
                    cv2.putText(display, "Press SPACE", (10, 110), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
                
                cv2.imshow('Data Collection', display)
                
                key = cv2.waitKey(1) & 0xFF
                if key == ord(' '):
                    collecting = not collecting
                elif key == ord('q'):
                    break
                elif key == 27:
                    cap.release()
                    cv2.destroyAllWindows()
                    return False
            
            print(f"   ✓ Completed: {collected} samples")
        
        cap.release()
        cv2.destroyAllWindows()
        
        print(f"\n{'='*60}")
        print(f"Total: {len(self.data)} samples")
        return True
    
    def build_model(self):
        """Build CNN model"""
        model = keras.Sequential([
            layers.Input(shape=(self.img_size, self.img_size, 1)),
            
            # Conv Block 1
            layers.Conv2D(32, (3, 3), activation='relu'),
            layers.MaxPooling2D((2, 2)),
            layers.Dropout(0.25),
            
            # Conv Block 2
            layers.Conv2D(64, (3, 3), activation='relu'),
            layers.MaxPooling2D((2, 2)),
            layers.Dropout(0.25),
            
            # Dense layers
            layers.Flatten(),
            layers.Dense(128, activation='relu'),
            layers.Dropout(0.5),
            layers.Dense(self.num_classes, activation='softmax')
        ])
        
        model.compile(
            optimizer='adam',
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        
        return model
    
    def train(self):
        """Train model"""
        print(f"\n{'='*60}")
        print("TRAINING")
        print(f"{'='*60}")
        
        # Prepare data
        X = np.array(self.data)
        y = np.array(self.labels_data)
        
        # Add channel dimension
        X = np.expand_dims(X, axis=-1)
        
        # Shuffle
        indices = np.random.permutation(len(X))
        X = X[indices]
        y = y[indices]
        
        # Split
        split = int(0.8 * len(X))
        X_train, X_val = X[:split], X[split:]
        y_train, y_val = y[:split], y[split:]
        
        print(f"Train: {len(X_train)}, Val: {len(X_val)}")
        
        # Build
        model = self.build_model()
        
        # Train
        history = model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=30,
            batch_size=8,
            verbose=1,
            callbacks=[
                keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True)
            ]
        )
        
        # Evaluate
        val_loss, val_acc = model.evaluate(X_val, y_val, verbose=0)
        print(f"\n✓ Final accuracy: {val_acc:.4f}")
        
        return model
    
    def save_model(self, model):
        """Save model"""
        os.makedirs('models', exist_ok=True)
        
        path = 'models/asl_simple.h5'
        model.save(path)
        
        print(f"\n✓ Model saved: {path}")
        print(f"  Size: {os.path.getsize(path) / (1024*1024):.2f} MB")
        print(f"  Classes: {', '.join(self.labels)}")
    
    def test_model(self, model):
        """Test model"""
        print(f"\n{'='*60}")
        print("TESTING")
        print(f"{'='*60}")
        
        cap = cv2.VideoCapture(0)
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame = cv2.flip(frame, 1)
            display = frame.copy()
            
            hand_img, bbox, detected = self.preprocess_hand(frame)
            
            if detected and hand_img is not None and bbox:
                x, y, w, h = bbox
                cv2.rectangle(display, (x, y), (x+w, y+h), (0, 255, 0), 2)
                
                # Predict
                gray = cv2.cvtColor(hand_img, cv2.COLOR_BGR2GRAY)
                normalized = gray / 255.0
                input_data = np.expand_dims(np.expand_dims(normalized, axis=-1), axis=0)
                
                predictions = model.predict(input_data, verbose=0)[0]
                top_idx = np.argmax(predictions)
                confidence = predictions[top_idx]
                
                if confidence > 0.5:
                    label = self.labels[top_idx]
                    cv2.putText(display, f"{label}: {confidence*100:.1f}%", 
                               (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            
            cv2.imshow('Test', display)
            
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        
        cap.release()
        cv2.destroyAllWindows()

def main():
    print("="*60)
    print("ASL SIMPLE TRAINER (OpenCV Only)")
    print("="*60)
    
    trainer = SimpleASLTrainer()
    
    # Collect
    print("\n[1/4] Collecting data...")
    if not trainer.collect_data():
        return
    
    # Train
    print("\n[2/4] Training...")
    model = trainer.train()
    
    # Save
    print("\n[3/4] Saving...")
    trainer.save_model(model)
    
    # Test
    print("\n[4/4] Testing...")
    test = input("Test model? (y/n): ")
    if test.lower() == 'y':
        trainer.test_model(model)
    
    print("\n✅ DONE!")

if __name__ == "__main__":
    main()
