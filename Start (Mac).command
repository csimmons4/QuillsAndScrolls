#!/bin/bash
cd "$(dirname "$0")"
echo "Clearing any previous server processes..."
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:5174 | xargs kill -9 2>/dev/null
sleep 1
echo "Starting Quills & Scrolls..."
npm run dev &

# Wait until both servers are ready before opening the browser
echo "Waiting for servers..."
until curl -s http://127.0.0.1:5173 > /dev/null && curl -s http://127.0.0.1:5174/api/characters > /dev/null; do
  sleep 1
done

echo "Ready! Opening browser..."
open http://localhost:5173
wait
