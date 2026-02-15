#!/usr/bin/env bash
set -e

echo "🚀 Booting Chess Analyzer Dev Environment"

docker compose down
docker compose build
docker compose up