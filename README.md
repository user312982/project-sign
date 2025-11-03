# 🤟 ASL Alphabet Translator# sign.Translate - ASL Alphabet Recognition



**American Sign Language to Text Translator** - Real-time hand gesture recognition using MediaPipe and TensorFlow.Real-time American Sign Language (ASL) alphabet recognition using TensorFlow.js and MediaPipe Hands.



## ✨ Features![Modern UI](https://img.shields.io/badge/UI-Modern%20Clean-8b5cf6)

![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.11.0-orange)

- 🎥 **Real-time Detection** - Live camera feed with hand tracking![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-blue)

- 🤖 **AI-Powered** - CNN model trained on 78,000+ ASL alphabet images

- 🎨 **Clean Black & White UI** - Minimalist interface design## ✨ Features

- 🗣️ **Text-to-Speech** - Convert translated text to audio

- 📱 **Mobile Support** - Responsive design works on all devices- 🎯 **Real-time ASL A-Z detection** with ML model

- ✋ **Gesture Controls** - Pause/resume with hand gestures- 🎨 **Modern clean UI** inspired by professional translators

- 📹 **Auto-start camera** with instant detection

## 🚀 Quick Start- 👆 **Gesture controls** - Thumbs Up to pause, Open Palm to resume

- 🗣️ **Text-to-speech** for translations

### Prerequisites- 📋 **Copy to clipboard** functionality

- 📖 **Built-in ASL alphabet reference**

- Python 3.13+

- Modern web browser (Chrome/Firefox recommended)## 🚀 Quick Start

- Webcam

### Option 1: Run Without Training (Fallback Mode)

### Installation

```bash

```bashpython3 -m http.server 8000

# Clone repository```

git clone <your-repo-url>

cd project-signOpen: `http://localhost:8000`



# Create virtual environmentThe app will work with rule-based detection while showing "Fallback Mode".

python3 -m venv .venv

source .venv/bin/activate  # Linux/Mac### Option 2: Train Custom ML Model

# or

.venv\Scripts\activate  # Windows**1. Install Dependencies:**



# Install dependencies```bash

pip install flask flask-cors tensorflow opencv-python pillow numpy./setup.sh

```# or manually:

pip install opencv-python mediapipe tensorflow numpy scikit-learn tensorflowjs

### Running the Application```



**Terminal 1 - Start API Server:****2. Collect Training Data:**

```bash

python3 api_server.py```bash

```cd models

python3 collect_data.py

Wait for output:```

```

🚀 ASL Alphabet Recognition API- Collect 150 samples per letter (A-Z)

Running on http://localhost:5000- Total: 3,900 samples

```- Takes ~1-2 hours



**Terminal 2 - Start Web Server:****3. Train Model:**

```bash

python3 -m http.server 8000```bash

```python3 train_model.py

```

**Browser:**

Open http://localhost:8000- Training time: ~15-30 minutes

- Output: `asl_alphabet_model/` folder

## 🎯 How to Use

**4. Refresh Browser:**

### Making Gestures

Model will auto-load and status will show "Loaded ✓" (green).

1. **Allow camera access** when prompted

2. **Position your hand** clearly in front of the camera## 📖 Documentation

3. **Hold gesture** for 2-3 seconds

4. **Watch translation** appear in the right panel- **ASL_ALPHABET_GUIDE.md** - Complete training guide

- **ASL_REFERENCE.md** - ASL alphabet quick reference

### Gesture Controls

## 🎮 How to Use

- **👍 Thumbs Up** = Pause translation

- **✋ Open Palm** = Resume translation1. **Open the app** - Camera starts automatically

2. **Make ASL gestures** - Letters A-Z are detected

### Action Buttons3. **Translation appears** - Text builds in real-time

4. **Use controls:**

- **🔊** - Text-to-speech (read translated text)   - 🔊 Speak - Text-to-speech

- **🗑️** - Clear all text   - 🗑️ Clear - Clear translation

- **📋** - Copy text to clipboard   - 📋 Copy - Copy to clipboard

   - 🔤 Alphabet - View ASL reference

## 📁 Project Structure

### Gesture Controls:

```- 👍 **Thumbs Up** (hold 1s) → **PAUSE** detection

project-sign/- ✋ **Open Palm** (hold 1s) → **RESUME** detection

├── index.html              # Main web application

├── alphabet.html           # ASL alphabet reference guide## 🏗️ Tech Stack

├── styles.css              # Black & white theme styles

├── script.js               # Frontend logic- **Frontend:** Vanilla JavaScript, CSS3

├── api_client.js          # API communication- **ML:** TensorFlow.js (LayersModel)

├── api_server.py          # Backend inference server- **Hand Tracking:** MediaPipe Hands

├── models/- **Training:** Python, TensorFlow, Keras

│   ├── asl_alphabet_model_quick.h5    # Trained model

│   └── train_asl_model.py             # Training script## 📁 Project Structure

└── .venv/                             # Python environment

``````

project-sign/

## 🔧 Configuration├── index.html                  # Main app (clean UI)

├── styles.css                  # Modern dark theme

### API Server├── script.js                   # Core logic + ML

├── setup.sh                    # Quick setup script

Edit `api_server.py`:├── models/

```python│   ├── collect_data.py         # Data collection

# Change port│   ├── train_model.py          # Model training

app.run(host='0.0.0.0', port=5000)│   ├── check_dependencies.py   # Dependency checker

│   └── asl_alphabet_model/     # Trained model (after training)

# Change model└── README.md                   # This file

MODEL_PATH = 'models/your_model.h5'```

```

## 🎯 Model Performance

### Frontend

With proper training:

Edit `api_client.js`:- **Accuracy:** 85-95%

```javascript- **Input:** 63 features (21 landmarks × 3 coords)

// Change API URL- **Output:** 26 classes (A-Z)

const API_URL = 'http://localhost:5000';- **Architecture:** 128→64→32→26 (Dense layers)



// Change prediction interval## 🐛 Troubleshooting

const CAPTURE_INTERVAL = 1000; // milliseconds

```**Model Status shows "Fallback Mode":**

- Model not trained yet

## 🎨 Color Theme- Train following ASL_ALPHABET_GUIDE.md



This application uses a **strict black and white palette**:**Low accuracy:**

- Collect more data (200+ samples/letter)

- Background: `#000000` (black)- Ensure good lighting

- Text: `#FFFFFF` (white)- Hold gestures steady

- Borders: `#FFFFFF33` (white with transparency)

- No other colors are used**Camera not working:**

- Allow camera permission

## 🧪 Model Training- Use HTTPS or localhost

- Check no other app using camera

To retrain the model with your own dataset:

## 📱 Responsive Design

```bash

cd models- ✅ Desktop: Two-panel layout (video | translation)

- ✅ Tablet: Stacked layout

# Place your dataset in models/asl_alphabet_train/- ✅ Mobile: Optimized controls



# Train model## 🎨 UI Design

python3 train_asl_model.py

```Inspired by modern translation apps with:

- Clean two-panel layout

**Dataset Structure:**

```- Minimal distractions

asl_alphabet_train/- Professional appearance

  asl_alphabet_train/

    A/ (3000 images)## 🔮 Future Enhancements

    B/ (3000 images)

    ...- [ ] Words & phrases detection

    Z/ (3000 images)- [ ] Multiple sign language support (BSL, etc.)

```- [ ] History/bookmarks

- [ ] Voice commands

## 📊 Model Specifications- [ ] Mobile app version



- **Architecture**: CNN (Conv2D layers + Dense layers)## 📜 License

- **Input**: 50x50 grayscale images

- **Output**: 26 classes (A-Z)MIT License - feel free to use for learning and projects!

- **Training**: 20 epochs, Adam optimizer

- **Expected Accuracy**: 85-95%## 🙏 Credits



## 🛠️ Troubleshooting- TensorFlow.js team

- MediaPipe team

### API Server Not Connecting- ASL community



**Solution:**---

```bash

# Check if server is running**Made with ❤️ for accessibility**

curl http://localhost:5000/health

# Restart server
pkill -f api_server
python3 api_server.py
```

### Camera Not Working

1. Refresh browser (F5)
2. Check camera permissions in browser settings
3. Ensure no other app is using camera

### Low Accuracy

1. Improve lighting conditions
2. Position hand clearly in frame
3. Hold gesture steady for 2-3 seconds
4. Retrain model with more data

## 📝 API Endpoints

### `GET /health`
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "model": "loaded"
}
```

### `POST /predict`
Predict ASL letter from image

**Request:**
```json
{
  "image": "data:image/jpeg;base64,..."
}
```

**Response:**
```json
{
  "prediction": "A",
  "confidence": 0.95,
  "top3": [
    {"label": "A", "confidence": 0.95},
    {"label": "S", "confidence": 0.03},
    {"label": "M", "confidence": 0.01}
  ]
}
```

### `GET /labels`
Get all supported labels

**Response:**
```json
{
  "labels": ["A", "B", "C", ..., "Z"]
}
```

## 🌐 Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 📄 License

MIT License - feel free to use and modify

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 🙏 Credits

- **MediaPipe** - Hand tracking
- **TensorFlow** - Machine learning
- **ASL Dataset** - Kaggle ASL Alphabet dataset

---

Made with ❤️ for the deaf and hard-of-hearing community
