#!/usr/bin/env bash

echo "Waiting for Iggy..."

until nc -z localhost 8090; do
	sleep 1
done

echo "Iggy is ready."
