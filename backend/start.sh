#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ -f .env.local ]; then
  source .env.local
  echo "Razorpay test mode: enabled (key ${RAZORPAY_KEY_ID:0:12}...)"
else
  echo "No .env.local found — running in mock payment mode"
fi
# Free port 8080 if an old instance is running
lsof -ti :8080 | xargs kill -9 2>/dev/null || true

mvn install -DskipTests
mvn spring-boot:run -pl application
