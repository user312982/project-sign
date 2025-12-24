# ASL Recognition API Deployment

## Quick Deploy Options

### Option 1: Railway (Recommended - Free Tier)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Deploy on Railway**
   - Go to [Railway](https://railway.app)
   - Click "New Project" → "Deploy from GitHub Repo"
   - Select your repository
   - Railway auto-detects Dockerfile and deploys

3. **Get your API URL**
   - After deployment, click on your service
   - Go to Settings → Domains
   - Generate a domain (e.g., `your-app.up.railway.app`)

---

### Option 2: Docker Compose (Self-Hosted/VPS)

```bash
# Build and run
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

**Access:**
- Frontend: http://localhost:8001
- API: http://localhost:5000

---

### Option 3: Render (Free Tier)

1. Push to GitHub
2. Go to [Render](https://render.com)
3. Create "New Web Service"
4. Connect your GitHub repo
5. Set environment to "Docker"
6. Deploy

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FLASK_ENV` | Flask environment | `production` |
| `PORT` | API port (auto-set by Railway) | `5000` |

---

## Frontend Configuration

After deploying the API, update your frontend to point to the production API URL.

**Option A: Edit `api_client.js`**
The API URL is auto-detected. For custom domains, set `window.API_CONFIG.API_URL` in `index.html`.

**Option B: Use Environment Variable**
If using a bundler (Vite, webpack), set `VITE_API_URL` environment variable.

---

## Verifying Deployment

```bash
# Health check
curl https://your-app.up.railway.app/health

# Test prediction (requires landmarks data)
curl -X POST https://your-app.up.railway.app/predict \
  -H "Content-Type: application/json" \
  -d '{"landmarks": [...],"handedness": "Right"}'
```
