FROM python:3.11-slim

WORKDIR /app

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install Python dependencies - TFLite runtime is much smaller than TensorFlow
RUN pip install --no-cache-dir \
    flask>=2.3.0 \
    flask-cors>=4.0.0 \
    tflite-runtime \
    numpy>=1.24.0 \
    pillow>=9.5.0 \
    gunicorn

# Copy application files
COPY . .

# Environment variables
ENV PORT=5000
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Expose API port
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/health')" || exit 1

# Run with single worker
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --workers 1 --threads 2 --timeout 120 api_server:app"]

