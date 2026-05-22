#!/usr/bin/env bash
set -eu

kubectl apply -f manifests/iggy-ui.yaml
kubectl -n fulloid rollout status deploy/iggy
kubectl -n fulloid rollout status deploy/iggy-web-ui
