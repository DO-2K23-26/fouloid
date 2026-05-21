#!/usr/bin/env bash

HOST=${1:-localhost}
PORT=${2:-8090}

echo "Waiting for Iggy at $HOST:$PORT..."

until nc -z "$HOST" "$PORT"; do
	sleep 1
done

echo "Iggy is ready."
