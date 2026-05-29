#!/bin/bash
set -euo pipefail

BODY=$(cat $MANIFEST)


NAME=$(echo "$BODY"        | jq -r '.name        // empty')
CODE=$(echo "$BODY"        | jq -r '.code        // empty')
METHOD=$(echo "$BODY"      | jq -r '.method      // "GET"' | tr '[:lower:]' '[:upper:]')
ROUTE=$(echo "$BODY"       | jq -r '.route       // empty')
ENVIRONMENT=$(echo "$BODY" | jq -r '.environment // "nodejs-baptiste"')
SECRETS=$(echo "$BODY" | jq -r '.secrets // "nodejs-baptiste"')
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

# node $CODE --check
echo "$NAME"

fission fn delete --name $NAME -n $NAMESPACE
fission httptrigger delete --name "$NAME-trigger" -n $NAMESPACE

# Try to update existing function first, if it exists
  # Function doesn't exist, create it
if ! ERR=$(fission fn create \
		--name "$NAME" \
		--env "$ENVIRONMENT" \
		--code "$CODE" \
		--secret "$SECRETS" \
		--namespace "$NAMESPACE" 2>&1); then
		echo "{\"error\":$(echo "$ERR" | jq -Rs .)}"; exit 0
fi

# Try to update existing trigger first, if it exists
if ! ERR=$(fission httptrigger create \
		--name "$NAME-trigger" \
		--url  "$ROUTE" \
		--method "$METHOD" \
		--function "$NAME" \
		--namespace "$NAMESPACE" 2>&1); then
		echo "{\"error\":$(echo "$ERR" | jq -Rs .)}"; exit 0
fi

echo "{\"success\":true,\"function\":\"$NAME\",\"route\":\"$ROUTE\"}"

