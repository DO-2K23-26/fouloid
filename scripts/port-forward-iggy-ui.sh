#!/usr/bin/env bash
set -eu

API_PORT="${1:-3000}"
UI_PORT="${2:-3050}"

cleanup() {
  kill "${PF_API_PID}" "${PF_UI_PID}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

kubectl -n fulloid port-forward svc/iggy "${API_PORT}:3000" >/tmp/iggy-api-port-forward.log 2>&1 &
PF_API_PID=$!
kubectl -n fulloid port-forward svc/iggy-web-ui "${UI_PORT}:3050" >/tmp/iggy-web-ui-port-forward.log 2>&1 &
PF_UI_PID=$!

echo "Iggy API: http://127.0.0.1:${API_PORT}"
echo "Iggy UI: http://127.0.0.1:${UI_PORT}"
wait
