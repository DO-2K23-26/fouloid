# fouloid — Fission Function Deploy API

`deploy-pauline` is a Fission function that lets you create and expose new Fission functions via a REST API call, without needing `kubectl` or the `fission` CLI on your machine.

---

## Architecture overview

```
POST /deploy-pauline  →  deploy-pauline.sh (bash-pauline env)
                               │
                               │  fission CLI (in-pod, in-cluster auth)
                               ▼
                     Fission control plane (fission namespace)
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
                 Package    Function  HTTPTrigger
               (CRD: code)  (CRD)      (CRD: route)
```

The function is a **bash script** that shells out to the `fission` CLI using the pod's mounted service account token. The created functions run on `nodejs-baptiste` (Node.js 22).

---

## Environments

### `bash-pauline` — runs `deploy-pauline`

Image: `popopolette/fission-env-bash:0.0.1`

A custom Alpine image built for this use case. It contains:

- **Python** — minimal HTTP server implementing the Fission runtime protocol (specialize + dispatch)
- **bash + jq** — to run shell scripts and parse JSON request bodies
- **`fission` CLI** at `/usr/local/bin/fission` — to create functions and triggers from inside a pod

Source: `fission/bash-env/`

### `nodejs-baptiste` — runs all other functions

Image: `baraly/fulloid-faas:0.0.5`

Custom Node.js 22 runtime. Functions deployed via `deploy-pauline` land here by default.

It includes:

- **A fixed `server.js`** — the stock Fission Node.js runtime couldn't load extension-less files; this image fixes that
- **`fission` CLI** at `/usr/local/bin/fission`
- **A large set of pre-installed npm packages** (no bundling needed)

| Category      | Packages                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| HTTP          | `axios`, `node-fetch`                                                                                      |
| AI / LLM      | `openai`, `@anthropic-ai/sdk`, `@langchain/core`, `@langchain/openai`, `@langchain/anthropic`, `langchain` |
| Validation    | `zod`                                                                                                      |
| Messaging     | `nats`, `amqplib`, `amqp-connection-manager`, `kafkajs`                                                    |
| Database      | `pg`, `ioredis`                                                                                            |
| Queue         | `bull`, `p-queue`, `p-retry`, `bottleneck`                                                                 |
| Kubernetes    | `@kubernetes/client-node`                                                                                  |
| Utilities     | `uuid`, `nanoid`, `lodash`                                                                                 |
| Observability | `prom-client`                                                                                              |
| WebSocket     | `ws`                                                                                                       |
| AST           | `acorn`, `@babel/parser`, `@babel/generator`                                                               |

---

## RBAC setup

Both environments run as the `fouloid-deployer` ServiceAccount. It needs namespace-scoped permissions to create Fission CRDs, and cluster-scoped list permissions because the `fission` CLI checks for duplicate triggers cluster-wide.

```bash
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: ServiceAccount
metadata:
  name: fouloid-deployer
  namespace: fission-dev
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: fouloid-deployer
  namespace: fission-dev
rules:
- apiGroups: ["fission.io"]
  resources: ["packages", "functions", "httptriggers", "environments"]
  verbs: ["create", "get", "list", "update", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: fouloid-deployer
  namespace: fission-dev
subjects:
- kind: ServiceAccount
  name: fouloid-deployer
  namespace: fission-dev
roleRef:
  kind: Role
  name: fouloid-deployer
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: fouloid-deployer-cluster
rules:
- apiGroups: ["fission.io"]
  resources: ["httptriggers", "functions", "packages", "environments"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: fouloid-deployer-cluster
subjects:
- kind: ServiceAccount
  name: fouloid-deployer
  namespace: fission-dev
roleRef:
  kind: ClusterRole
  name: fouloid-deployer-cluster
  apiGroup: rbac.authorization.k8s.io
EOF
```

---

## Environment patch — `nodejs-baptiste`

By default Fission sets `automountServiceAccountToken: false` on pool pods and only mounts the SA token in the fetcher sidecar. This patch exposes the token to the function container too, so the `fission` CLI can authenticate.

```bash
kubectl patch environment nodejs-baptiste -n fission-dev --type=json -p '[
  {"op": "add", "path": "/spec/runtime/podspec/serviceAccountName", "value": "fouloid-deployer"},
  {"op": "add", "path": "/spec/runtime/podspec/automountServiceAccountToken", "value": true}
]'

kubectl patch environment nodejs-baptiste -n fission-dev --type=json -p '[
  {"op": "replace", "path": "/spec/runtime/podspec/containers/0", "value": {
    "name": "nodejs-baptiste",
    "resources": {},
    "volumeMounts": [{"name": "fission-fetcher-sa-token", "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount", "readOnly": true}]
  }}
]'
```

The `bash-pauline` environment already has these settings baked into its spec (no extra patch needed).

---

## Deploying `deploy-pauline`

```bash
fission fn create \
  --name deploy-pauline \
  --env bash-pauline \
  --code fission/deploy-pauline.sh \
  --namespace fission-dev

fission httptrigger create \
  --name deploy-pauline-trigger \
  --url /deploy-pauline \
  --method POST \
  --function deploy-pauline \
  --namespace fission-dev
```

To redeploy after code changes:

```bash
fission fn delete --name deploy-pauline --namespace fission-dev
fission httptrigger delete --name deploy-pauline-trigger --namespace fission-dev
fission fn create --name deploy-pauline --env bash-pauline --code fission/deploy-pauline.sh --namespace fission-dev
fission httptrigger create --name deploy-pauline-trigger --url /deploy-pauline --method POST --function deploy-pauline --namespace fission-dev
```

---

## API reference

### `POST /deploy-pauline`

| Field         | Type   | Required | Default           | Description                                |
| ------------- | ------ | -------- | ----------------- | ------------------------------------------ |
| `name`        | string | yes      | —                 | Function name. Must match `[a-z0-9-]+`.    |
| `code`        | string | yes      | —                 | Full source code of the function (CJS).    |
| `method`      | string | no       | `GET`             | HTTP method: GET, POST, PUT, DELETE, HEAD. |
| `route`       | string | no       | `/{name}`         | URL path for the HTTP trigger.             |
| `environment` | string | no       | `nodejs-baptiste` | Fission environment to use.                |
| `namespace`   | string | no       | `fission-dev`     | Kubernetes namespace.                      |

**Success (200):**

```json
{ "success": true, "function": "my-func", "route": "/my-func" }
```

**Error (200 with error field):**

```json
{ "error": "name and code are required" }
```

### `GET /list-functions`

Returns a list of all functions deployed via `liste-function-baptiste` in the cluster.

---

## Function code format

Functions run on `nodejs-baptiste` and must be **CommonJS modules**:

```javascript
module.exports = async function (context) {
  // context.request  — raw Express request (body, headers, query…)
  return {
    status: 200,
    body: { hello: "world" },
    headers: {}, // optional
  };
};
```

Arrow shorthand:

```javascript
module.exports = async (ctx) => ({ status: 200, body: "ok" });
```

---

## How it works internally

1. `deploy-pauline.sh` reads the JSON request body from **stdin** (how the bash env passes HTTP bodies).
2. **`jq`** parses `name`, `code`, `method`, `route`, `environment`, `namespace` and validates them.
3. The code is written to a temp file `/tmp/<name>-<ts>.js`.
4. **`fission fn create --code`** uploads the file to Fission's storage and creates a `Package` + `Function` CRD.
5. **`fission httptrigger create`** creates the `HTTPTrigger` CRD.
6. The temp file is deleted and the result is echoed as JSON to stdout (which the Python server returns as the HTTP response).

The `fission` CLI authenticates via the service account token at `/var/run/secrets/kubernetes.io/serviceaccount/token`.

---

## Example functions

All tested end-to-end.

### Echo — return the request body

```bash
curl -X POST http://<router>/deploy-pauline \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ex-echo",
    "method": "POST",
    "code": "module.exports = async (ctx) => { const body = ctx.request?.body || ctx.body || {}; return { status: 200, body }; };"
  }'
```

```bash
curl -X POST http://<router>/ex-echo \
  -H "Content-Type: application/json" \
  -d '{"message": "hello", "user": "pauline"}'
# → {"message":"hello","user":"pauline"}
```

---

### GitHub repo info — external HTTP call with axios

```bash
curl -X POST http://<router>/deploy-pauline \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ex-github",
    "code": "const axios = require(\"axios\"); module.exports = async (ctx) => { const res = await axios.get(\"https://api.github.com/repos/fission/fission\"); return { status: 200, body: { stars: res.data.stargazers_count, forks: res.data.forks_count, name: res.data.full_name } }; };"
  }'
```

```bash
curl http://<router>/ex-github
# → {"stars":8857,"forks":787,"name":"fission/fission"}
```

---

### UUID generator

```bash
curl -X POST http://<router>/deploy-pauline \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ex-uuid",
    "code": "const { v4: uuidv4 } = require(\"uuid\"); module.exports = async (ctx) => ({ status: 200, body: { id: uuidv4(), ts: new Date().toISOString() } });"
  }'
```

```bash
curl http://<router>/ex-uuid
# → {"id":"d118456c-4784-4db8-b4fd-6bc43a6cd0de","ts":"2026-05-22T08:09:55.094Z"}
```

---

## Deleting a function

```bash
fission fn delete --name my-func --namespace fission-dev
fission httptrigger delete --name my-func-trigger --namespace fission-dev
```
