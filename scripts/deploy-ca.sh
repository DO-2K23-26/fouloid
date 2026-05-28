#!/bin/bash
# Deploys the CA Fission function.
# Run once after setup-platform-key.mjs and after applying ca-rbac.yaml.
# Usage: ./scripts/deploy-ca.sh [namespace] [fission-namespace]
set -euo pipefail

NAMESPACE=${1:-fulloid}
FISSION_NS=${2:-fission-dev}
FUNCTION_NAME="fouloid-ca"

echo "[ca] applying RBAC..."
kubectl apply -f manifests/ca-rbac.yaml

echo "[ca] creating/updating Fission function..."
if fission fn get --name "$FUNCTION_NAME" --namespace "$FISSION_NS" &>/dev/null; then
  fission fn update \
    --name "$FUNCTION_NAME" \
    --code fission/ca/index.js \
    --namespace "$FISSION_NS"
else
  fission fn create \
    --name "$FUNCTION_NAME" \
    --env nodejs-baptiste \
    --code fission/ca/index.js \
    --namespace "$FISSION_NS" \
    --secret platform-signing-key \
    --serviceaccount "fouloid-ca"
fi

echo "[ca] creating/updating HTTP trigger..."
if fission httptrigger get --name "${FUNCTION_NAME}-trigger" --namespace "$FISSION_NS" &>/dev/null; then
  echo "[ca] trigger already exists, skipping"
else
  fission httptrigger create \
    --name "${FUNCTION_NAME}-trigger" \
    --url "/fouloid-ca" \
    --method POST \
    --function "$FUNCTION_NAME" \
    --namespace "$FISSION_NS"
fi

echo "[ca] done. CA available at http://router.fission/fouloid-ca"
