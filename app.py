#!/usr/bin/env python3
"""
Railway/Render entrypoint for Flask API.
This file exists to satisfy the standard Flask entrypoint detection.
"""

# Import the Flask app from api_server
from api_server import app

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
