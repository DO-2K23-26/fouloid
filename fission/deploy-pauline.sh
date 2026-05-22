#!/bin/bash
set -euo pipefail

BODY=$(cat)

NAME=$(echo "$BODY"        | jq -r '.name        // empty')
CODE=$(echo "$BODY"        | jq -r '.code        // empty')
METHOD=$(echo "$BODY"      | jq -r '.method      // "GET"' | tr '[:lower:]' '[:upper:]')
ROUTE=$(echo "$BODY"       | jq -r '.route       // empty')
ENVIRONMENT=$(echo "$BODY" | jq -r '.environment // "nodejs-baptiste"')
NAMESPACE=$(echo "$BODY"   | jq -r '.namespace   // "fission-dev"')

if [ -z "$NAME" ] || [ -z "$CODE" ]; then
  echo '{"error":"name and code are required"}'; exit 0
fi
if ! echo "$NAME" | grep -qE '^[a-z0-9-]+$'; then
  echo '{"error":"name must only contain lowercase letters, numbers and hyphens"}'; exit 0
fi
if ! echo "$ENVIRONMENT" | grep -qE '^[a-z0-9-]+$' || ! echo "$NAMESPACE" | grep -qE '^[a-z0-9-]+$'; then
  echo '{"error":"invalid environment or namespace"}'; exit 0
fi
case "$METHOD" in GET|POST|PUT|DELETE|HEAD) ;; *)
  echo '{"error":"invalid method"}'; exit 0 ;;
esac

[ -z "$ROUTE" ] && ROUTE="/$NAME"

CODE_PATH="/tmp/${NAME}-$(date +%s%N).js"
echo "$BODY" | jq -r '.code' > "$CODE_PATH"

if ! ERR=$(fission fn create \
    --name "$NAME" \
    --env "$ENVIRONMENT" \
    --code "$CODE_PATH" \
    --namespace "$NAMESPACE" 2>&1); then
  rm -f "$CODE_PATH"
  echo "{\"error\":$(echo "$ERR" | jq -Rs .)}"; exit 0
fi

if ! ERR=$(fission httptrigger create \
    --name "${NAME}-trigger" \
    --url  "$ROUTE" \
    --method "$METHOD" \
    --function "$NAME" \
    --namespace "$NAMESPACE" 2>&1); then
  rm -f "$CODE_PATH"
  echo "{\"error\":$(echo "$ERR" | jq -Rs .)}"; exit 0
fi

rm -f "$CODE_PATH"
echo "{\"success\":true,\"function\":\"$NAME\",\"route\":\"$ROUTE\"}"
