# fouloid — Fission Function Deploy API

`deploy-pauline` is a Fission function that lets you create and expose new Fission functions via a REST API call, without needing `kubectl` or the `fission` CLI on your machine.

---

## Architecture overview

```
POST /deploy-pauline  →  deploy-pauline function (nodejs-baptiste env)
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

The function shells out to the `fission` CLI (available at `/usr/local/bin/fission` inside the image) using the pod's mounted service account token for Kubernetes auth. No kubeconfig needed on the caller's machine.

---

## The `nodejs-baptiste` environment

### What is a Fission environment?

In Fission, an **environment** is a pre-warmed pool of pods that can run functions. When you call a function for the first time, Fission picks a warm pod from the pool, injects your function code into it (via the fetcher sidecar), and keeps it alive for subsequent calls. This is the **poolmgr** (pool manager) executor strategy.

The environment defines:
- which Docker image to use as the runtime
- how many pods to keep warm (`poolsize`)
- environment variables (e.g. `NODE_PATH`, `LOAD_ESM`)

### The image: `baraly/fulloid-faas:0.0.5`

This is a custom Node.js 22 runtime image built for this cluster. It extends the standard Fission Node.js runtime with:

- **The `fission` CLI binary** at `/usr/local/bin/fission` — allows functions to programmatically create other functions from inside a pod
- **A fixed `server.js`** — the stock Fission Node.js runtime had a bug where it couldn't load extension-less files (the fetcher stores code at `/userfunc/deployarchive` with no `.js` extension). This image fixes that.
- **`LOAD_ESM` support** — the runtime defaults to ESM mode but respects `LOAD_ESM=false` to switch to CJS. Functions written with `module.exports` are CJS.
- **A large set of pre-installed npm packages** so functions don't need bundling.

### Pre-installed packages

All of these are available via `require(...)` in any function without bundling:

| Category | Packages |
|----------|----------|
| HTTP | `axios`, `node-fetch` |
| AI / LLM | `openai`, `@anthropic-ai/sdk`, `@langchain/core`, `@langchain/openai`, `@langchain/anthropic`, `langchain` |
| Validation | `zod` |
| Messaging | `nats`, `amqplib`, `amqp-connection-manager`, `kafkajs` |
| Database | `pg`, `ioredis` |
| Queue | `bull`, `p-queue`, `p-retry`, `bottleneck` |
| Kubernetes | `@kubernetes/client-node` |
| Utilities | `uuid`, `nanoid`, `lodash` |
| Observability | `prom-client` |
| WebSocket | `ws` |
| AST | `acorn`, `@babel/parser`, `@babel/generator` |

### Environment spec (current state)

```bash
kubectl get environment nodejs-baptiste -n fission-dev -o yaml
```

Key fields:
- `spec.runtime.image: baraly/fulloid-faas:0.0.5`
- `spec.poolsize: 3` — 3 warm pods always running
- `spec.runtime.podspec.serviceAccountName: fouloid-deployer` — patched to allow the fission CLI to authenticate
- `spec.runtime.podspec.containers[0].volumeMounts` — patched to mount the SA token into the function container

---

## RBAC setup

By default, Fission pool pods have no Kubernetes permissions. We created a dedicated `fouloid-deployer` service account with the permissions the `fission` CLI needs when running inside a pod.

### Resources created

**ServiceAccount** — the identity the pool pods run as:
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: fouloid-deployer
  namespace: fission-dev
```

**Role** — namespace-scoped create/manage permissions for Fission CRDs:
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: fouloid-deployer
  namespace: fission-dev
rules:
- apiGroups: ["fission.io"]
  resources: ["packages", "functions", "httptriggers", "environments"]
  verbs: ["create", "get", "list", "update", "delete"]
```

**RoleBinding** — binds the Role to the ServiceAccount:
```yaml
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
```

**ClusterRole** — the `fission` CLI also does cluster-scoped `list` on httptriggers to check for duplicates:
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: fouloid-deployer-cluster
rules:
- apiGroups: ["fission.io"]
  resources: ["httptriggers", "functions", "packages", "environments"]
  verbs: ["get", "list"]
```

**ClusterRoleBinding:**
```yaml
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
```

Apply everything at once:

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

## Environment patch

Two patches were applied to `nodejs-baptiste` so that the `fission` CLI can authenticate from inside a pool pod.

By default, Fission sets `automountServiceAccountToken: false` on pool pods and only mounts the token in the fetcher sidecar — not in the function container. These patches fix that.

```bash
# 1. Switch the pod's service account and re-enable token automount
kubectl patch environment nodejs-baptiste -n fission-dev --type=json -p '[
  {"op": "add", "path": "/spec/runtime/podspec/serviceAccountName", "value": "fouloid-deployer"},
  {"op": "add", "path": "/spec/runtime/podspec/automountServiceAccountToken", "value": true}
]'

# 2. Mount the SA token volume into the function container
#    (the volume already exists in the pod — the fetcher sidecar uses it — 
#     but it was only mounted in the fetcher, not in the user function container)
kubectl patch environment nodejs-baptiste -n fission-dev --type=json -p '[
  {"op": "replace", "path": "/spec/runtime/podspec/containers/0", "value": {
    "name": "nodejs-baptiste",
    "resources": {},
    "volumeMounts": [
      {
        "name": "fission-fetcher-sa-token",
        "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
        "readOnly": true
      }
    ]
  }}
]'
```

After patching, the pool manager automatically rolls out new pods. Verify:

```bash
kubectl get pods -n fission-dev -l environmentName=nodejs-baptiste
# wait for new pods, then:
kubectl exec -n fission-dev <pod> -c nodejs-baptiste -- ls /var/run/secrets/kubernetes.io/serviceaccount/
# should show: ca.crt  namespace  token
```

---

## Deploying `deploy-pauline`

```bash
# Package (zip must contain a file named exactly like the function)
zip deploy-pauline.zip deploy-pauline.js

# Create the function
fission fn create \
  --name deploy-pauline \
  --env nodejs-baptiste \
  --deployarchive deploy-pauline.zip \
  --namespace fission-dev

# Expose it
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
zip deploy-pauline.zip deploy-pauline.js
fission fn create --name deploy-pauline --env nodejs-baptiste --deployarchive deploy-pauline.zip --namespace fission-dev
fission httptrigger create --name deploy-pauline-trigger --url /deploy-pauline --method POST --function deploy-pauline --namespace fission-dev
```

---

## API reference

### `POST /deploy-pauline`

**Body (JSON):**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | yes | — | Function name. Must match `[a-z0-9-]+`. |
| `code` | string | yes | — | Full source code of the function (CJS). |
| `method` | string | no | `GET` | HTTP method: GET, POST, PUT, DELETE, HEAD. |
| `route` | string | no | `/{name}` | URL path for the HTTP trigger. |
| `environment` | string | no | `nodejs-baptiste` | Fission environment to use. |
| `namespace` | string | no | `fission-dev` | Kubernetes namespace. |

**Success response (200):**
```json
{ "success": true, "function": "my-func", "route": "/my-func" }
```

**Error response (400/500):**
```json
{ "error": "name and code are required" }
```

**Validation rules:**
- `name`, `environment`, `namespace` must match `[a-z0-9-]+`
- `route` is sanitized to `[a-z0-9-/_]` only
- `method` must be GET, POST, PUT, DELETE, or HEAD

---

## Function code format

Functions must be **CommonJS modules** (`module.exports`). The `nodejs-baptiste` environment runs in CJS mode by default.

```javascript
module.exports = async function (context) {
  // context.request  — raw Express request (body, headers, query, params…)
  // context.method   — HTTP method string

  return {
    status: 200,
    body: { hello: "world" },  // object or string
    headers: {},               // optional
  };
};
```

Arrow shorthand:

```javascript
module.exports = async (ctx) => ({
  status: 200,
  body: "ok",
});
```

---

## How it works internally

1. **Validates** the request (name, code, method, route, env, namespace).
2. **Writes** the function code to a temp file at `/tmp/<name>-<ts>.js`.
3. **Runs** `fission fn create --code <tempfile>` — this uploads the code to Fission's storage service and creates a `Package` + `Function` CRD.
4. **Runs** `fission httptrigger create` — creates an `HTTPTrigger` CRD that maps the route to the function.
5. **Deletes** the temp file.

The `fission` CLI authenticates against the Kubernetes API using the service account token mounted at `/var/run/secrets/kubernetes.io/serviceaccount/token` (the standard in-cluster config path).

---

## Example functions

All examples below were tested and work end-to-end.

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

Call it:
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

Call it:
```bash
curl http://<router>/ex-github
# → {"stars":8857,"forks":787,"name":"fission/fission"}
```

---

### UUID generator — unique ID + timestamp on every call

```bash
curl -X POST http://<router>/deploy-pauline \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ex-uuid",
    "code": "const { v4: uuidv4 } = require(\"uuid\"); module.exports = async (ctx) => ({ status: 200, body: { id: uuidv4(), ts: new Date().toISOString() } });"
  }'
```

Call it:
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

Or via kubectl:
```bash
kubectl delete function my-func -n fission-dev
kubectl delete httptrigger my-func-trigger -n fission-dev
```
