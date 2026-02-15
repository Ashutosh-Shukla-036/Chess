#!/bin/bash
# FastAPI Server Startup Script

echo "Starting Chess Analyzer API..."
echo "================================"

# Check for Redis
if command -v redis-server >/dev/null 2>&1; then
    if ! pgrep -x "redis-server" >/dev/null; then
        echo "Redis is not running. Starting Redis server..."
        redis-server --daemonize yes
        echo "Redis started."
    else
        echo "Redis is already running."
    fi
else
    echo "WARNING: redis-server not found. Caching will not work."
    echo "Please install Redis: sudo apt-get install redis-server"
fi

# Activate virtual environment
# Check if venv exists, if not try .venv
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo "Virtual environment not found. Please run: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Start FastAPI server with auto-reload
echo "Starting server on http://localhost:8000"
echo "API Docs available at http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000