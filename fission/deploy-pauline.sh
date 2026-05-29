#!/bin/bash
set -euo pipefail

BODY=$(cat)

NAME=$(echo "$BODY"        | jq -r '.name        // empty')
CODE=$(echo "$BODY"        | jq -r '.code        // empty')
METHOD=$(echo "$BODY"      | jq -r '.method      // "POST"' | tr '[:lower:]' '[:upper:]')
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
  echo "{\"error\":\"invalid environment ('$ENVIRONMENT') or namespace ('$NAMESPACE')\"}"; exit 0
fi
case "$METHOD" in GET|POST|PUT|DELETE|HEAD) ;;
  *) echo '{"error":"invalid method"}'; exit 0 ;;
esac

[ -z "$ROUTE" ] && ROUTE="/$NAME"

# Validate code is not truncated
CODE_LEN=${#CODE}
if [ "$CODE_LEN" -lt 80 ]; then
  echo "{\"error\":\"Code too short (${CODE_LEN} chars). Write the complete function body — do not submit stubs or truncated code.\"}"; exit 0
fi

OPEN_BRACES=$(printf '%s' "$CODE" | tr -cd '{' | wc -c | tr -d ' ')
CLOSE_BRACES=$(printf '%s' "$CODE" | tr -cd '}' | wc -c | tr -d ' ')
if [ "$OPEN_BRACES" != "$CLOSE_BRACES" ]; then
  echo "{\"error\":\"Unbalanced braces: ${OPEN_BRACES} opening '{' vs ${CLOSE_BRACES} closing '}'. Function body appears truncated — provide the full implementation.\"}"; exit 0
fi

CODE_PATH="/tmp/${NAME}-$(date +%s%N).js"
echo "$BODY" | jq -r '.code' > "$CODE_PATH"

# Upsert: delete existing trigger and function silently before recreating
fission httptrigger delete --name "${NAME}-trigger" -n "$NAMESPACE" > /dev/null 2>&1 || true
fission fn delete --name "$NAME" -n "$NAMESPACE" > /dev/null 2>&1 || true

if ! ERR=$(fission fn create \
    --name "$NAME" \
    --env "$ENVIRONMENT" \
    --code "$CODE_PATH" \
    -n "$NAMESPACE" 2>&1); then
  rm -f "$CODE_PATH"
  echo "{\"error\":$(echo "$ERR" | jq -Rs .), \"debug\":{\"name\":\"$NAME\",\"env\":\"$ENVIRONMENT\",\"ns\":\"$NAMESPACE\"}}"; exit 0
fi

if ! ERR=$(fission httptrigger create \
    --name "${NAME}-trigger" \
    --url  "$ROUTE" \
    --method "$METHOD" \
    --function "$NAME" \
    -n "$NAMESPACE" 2>&1); then
  rm -f "$CODE_PATH"
  echo "{\"error\":$(echo "$ERR" | jq -Rs .)}"; exit 0
fi

rm -f "$CODE_PATH"
echo "{\"success\":true,\"function\":\"$NAME\",\"route\":\"$ROUTE\"}"
