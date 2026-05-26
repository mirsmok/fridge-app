#!/bin/sh
# Zatrzymaj poprzednie instancje
pkill -f "node server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

echo "Uruchamianie backendu..."
cd /root/fridge-app/backend && node server.js &
BACKEND_PID=$!

echo "Uruchamianie frontendu..."
cd /root/fridge-app/frontend && npx vite &
FRONTEND_PID=$!

echo ""
echo "==================================="
echo " Lodówka działa na:"
echo " http://localhost:5173"
echo "==================================="
echo " Backend PID: $BACKEND_PID"
echo " Frontend PID: $FRONTEND_PID"
echo " Ctrl+C aby zatrzymać"
echo "==================================="

wait
