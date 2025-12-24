# ASL Recognition API Deployment

## 🚀 Quick Deploy (TFLite Version)

This API uses TFLite models (~110KB each) instead of full TensorFlow (~500MB), making it compatible with free tier hosting.

---

## Railway Deployment (Recommended)

### 1. Push to GitHub
```bash
git add .
git commit -m "Deploy TFLite version"
git push origin main
```

### 2. Deploy on Railway
- Go to [railway.app](https://railway.app)
- Click "New Project" → "Deploy from GitHub Repo"
- Select your repository
- Railway auto-detects Dockerfile and deploys

### 3. Get API URL
- After deployment, go to Settings → Domains
- Generate a domain (e.g., `your-app.up.railway.app`)

---

## Frontend Configuration

Update your `index.html` with your Railway API URL:

```html
<script>
    window.API_CONFIG = {
        API_URL: 'https://your-app.up.railway.app'
    };
</script>
```

---

## Local Development

### Run API Locally
```bash
# Install dependencies
pip install flask flask-cors numpy pillow

# For TFLite support, install one of:
pip install ai-edge-litert  # Preferred (lightweight)
# OR
pip install tensorflow-cpu  # Fallback (heavier)

# Run
python api_server.py
```

### Test API
```bash
# Health check
curl http://localhost:5000/health

# Response:
# {"model": "tflite", "status": "ok", "version": "2.0.0"}
```

---

## Docker Compose (Self-Hosted)

```bash
# Build and run
docker-compose up -d --build

# Access
# - API: http://localhost:5000
# - Frontend: http://localhost:8001
```

---

## Memory Usage

| Component | Size |
|-----------|------|
| TFLite models | ~220KB (2 × 110KB) |
| Runtime (ai-edge-litert) | ~5MB |
| Runtime (tensorflow-cpu) | ~500MB (fallback) |

Railway free tier: 512MB RAM ✓

---

## Verifying Deployment

```bash
# Health check
curl https://your-app.up.railway.app/health

# Test prediction
curl -X POST https://your-app.up.railway.app/predict \
  -H "Content-Type: application/json" \
  -d '{"landmarks": [0.5,0.5,0,...], "handedness": "Right"}'
```
