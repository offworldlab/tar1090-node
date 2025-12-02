#!/bin/bash
set -e

echo "Starting aircraft data proxy service..."
node /opt/proxy/server.js &
PROXY_PID=$!

echo "Waiting for proxy to be ready..."
sleep 2

cleanup() {
    echo "Shutting down..."
    kill $PROXY_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT

echo "Starting tar1090..."
exec /init "$@"
