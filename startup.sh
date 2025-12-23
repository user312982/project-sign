#!/bin/bash

# Startup Script for ASL Recognition Application
# This script will start both the Flask API server and the frontend

echo "========================================="
echo "🚀 Starting ASL Recognition Application"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 1
    else
        return 0
    fi
}

# Stop function to clean up processes
cleanup() {
    echo -e "\n${YELLOW}Stopping application...${NC}"

    # Kill Python processes
    if [ ! -z "$API_PID" ]; then
        echo "Stopping Flask API server (PID: $API_PID)"
        kill $API_PID 2>/dev/null
    fi

    # Kill HTTP server
    if [ ! -z "$FRONTEND_PID" ]; then
        echo "Stopping frontend server (PID: $FRONTEND_PID)"
        kill $FRONTEND_PID 2>/dev/null
    fi

    echo -e "${GREEN}Application stopped.${NC}"
    exit 0
}

# Set up trap for SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Check for Python
if ! command_exists python3; then
    echo -e "${RED}Error: Python 3 is required but not installed.${NC}"
    echo "Please install Python 3 and try again."
    exit 1
fi

# Check for Node.js (optional, for package management)
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${BLUE}Node.js found: $NODE_VERSION${NC}"
else
    echo -e "${YELLOW}Warning: Node.js not found. Make sure MediaPipe is loaded via CDN.${NC}"
fi

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}Virtual environment not found. Creating one...${NC}"
    python3 -m venv .venv

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Virtual environment created successfully.${NC}"
    else
        echo -e "${RED}Failed to create virtual environment.${NC}"
        exit 1
    fi
fi

# Activate virtual environment
echo "Activating virtual environment..."
source .venv/bin/activate

# Check if requirements are installed
echo "Checking dependencies..."
python3 -c "import flask, tensorflow, numpy, cv2" 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pip install -r requirements.txt

    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install dependencies.${NC}"
        exit 1
    fi
fi

# Check if models exist
if [ ! -f "models/R_keypoint_classifier_final.h5" ] || [ ! -f "models/L_keypoint_classifier_final.h5" ]; then
    echo -e "${RED}Error: Model files not found in models/ directory.${NC}"
    echo "Please ensure the following files exist:"
    echo "  - models/R_keypoint_classifier_final.h5"
    echo "  - models/L_keypoint_classifier_final.h5"
    echo "  - models/labels_dual.json"
    exit 1
fi

# Check if ports are available
if ! check_port 5000; then
    echo -e "${RED}Error: Port 5000 is already in use.${NC}"
    echo "Please stop the process using port 5000 and try again."
    exit 1
fi

if ! check_port 8001; then
    echo -e "${RED}Error: Port 8001 is already in use.${NC}"
    echo "Please stop the process using port 8001 or edit this script to use a different port."
    exit 1
fi

# Start Flask API server
echo -e "${BLUE}Starting Flask API server on port 5000...${NC}"
python3 api_server.py &
API_PID=$!

# Wait a bit for API server to start
sleep 3

# Check if API server started successfully
if ! kill -0 $API_PID 2>/dev/null; then
    echo -e "${RED}Failed to start Flask API server.${NC}"
    exit 1
fi

# Start frontend server
echo -e "${BLUE}Starting frontend server on port 8001...${NC}"
python3 -m http.server 8001 &
FRONTEND_PID=$!

# Wait a bit for frontend server to start
sleep 2

# Check if frontend server started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}Failed to start frontend server.${NC}"
    kill $API_PID 2>/dev/null
    exit 1
fi

# Success!
echo ""
echo "========================================="
echo -e "${GREEN}✅ Application started successfully!${NC}"
echo "========================================="
echo ""
echo "🌐 Access the application at:"
echo -e "   Frontend: ${BLUE}http://localhost:8001${NC}"
echo -e "   API:      ${BLUE}http://localhost:5000${NC}"
echo ""
echo "📋 API Endpoints:"
echo "   - GET  http://localhost:5000/health"
echo "   - POST http://localhost:5000/predict"
echo "   - GET  http://localhost:5000/labels"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the application${NC}"
echo ""

# Wait for processes
wait