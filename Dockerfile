FROM python:3.11-slim

WORKDIR /app

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy requirements first for caching
COPY requirements.txt .

# Install Python dependencies with memory optimization
# Use tensorflow-cpu (smaller than full tensorflow)
RUN pip install --no-cache-dir \
    flask>=2.3.0 \
    flask-cors>=4.0.0 \
    tensorflow-cpu>=2.10.0 \
    numpy>=1.24.0 \
    pillow>=9.5.0 \
    gunicorn

# Copy application files
COPY . .

# Environment variables for memory optimization
ENV PORT=5000
ENV FLASK_ENV=production
ENV TF_CPP_MIN_LOG_LEVEL=2
ENV TF_ENABLE_ONEDNN_OPTS=0
ENV PYTHONUNBUFFERED=1
ENV MALLOC_ARENA_MAX=2

# Expose API port
EXPOSE ${PORT}

# Health check with longer start period for model loading
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/health')" || exit 1

# Run with single worker to save memory
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --workers 1 --threads 2 --timeout 300 --preload api_server:app"]

