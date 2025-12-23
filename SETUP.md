# ASL Sign Language Translator - Setup Guide

## Quick Start (5 minutes)

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd project-sign
```

### 2. Setup Python Environment
```bash
# Create virtual environment
python3 -m venv .venv

# Activate it
source .venv/bin/activate  # Linux/Mac
# or
.venv\Scripts\activate  # Windows

# Install dependencies (5-10 minutes)
pip install -r requirements.txt
```

### 3. Run Application

**Terminal 1 - API Server:**
```bash
source .venv/bin/activate
python3 api_server.py
```
Wait for: `Running on http://localhost:5000`

**Terminal 2 - Frontend:**
```bash
python3 -m http.server 8001
```

**Browser:**
Open http://localhost:8001

---

## Alternative: Docker (Recommended for Production)

If you have Docker installed:

```bash
# One-time build (10 minutes)
docker-compose build

# Run (instant)
docker-compose up
```

Open http://localhost:8001

---

## Troubleshooting

### Error: `ModuleNotFoundError: No module named 'flask'`
- Make sure virtual environment is activated:
  ```bash
  source .venv/bin/activate
  which python3  # Should show path inside .venv
  ```

### Error: TensorFlow installation fails
- Try without GPU:
  ```bash
  pip install tensorflow-cpu
  ```

### Port already in use
- Change port in commands:
  ```bash
  python3 -m http.server 8002  # Instead of 8001
  ```

---

## File Structure

```
project-sign/
├── requirements.txt       # Python dependencies (MUST HAVE)
├── Dockerfile            # Docker config (optional)
├── docker-compose.yml    # Docker orchestration (optional)
├── .venv/                # Virtual env (DO NOT commit to git)
├── models/               # ML models (large files)
├── api_server.py         # Backend
├── index.html            # Frontend
└── script.js             # Frontend logic
```

**IMPORTANT:** Add to `.gitignore`:
```
.venv/
__pycache__/
*.pyc
venv/
```

---

## Dependencies Info

Total size after install: ~2.5 GB
- TensorFlow: ~500 MB
- MediaPipe: ~100 MB
- OpenCV: ~50 MB
- Other libraries: ~50 MB

Install time: 5-10 minutes (depends on internet speed)
