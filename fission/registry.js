// Shared fouloid registry backed by a Kubernetes ConfigMap.
// GET /registry  → returns all registered agents as JSON
// POST /registry → upserts one agent entry { name, role, tools, law }
module.exports = async function (context) {
  const fs = require('fs');
  const https = require('https');

  const token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8').trim();
  const ca = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
  const CM_PATH = '/api/v1/namespaces/fulloid/configmaps/fouloid-registry';

  const k8s = (path, method, body) => new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'kubernetes.default.svc',
      port: 443,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      ca,
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });

  const method = context.request.method.toUpperCase();

  // Ensure the ConfigMap exists
  const ensureConfigMap = async () => {
    const get = await k8s(CM_PATH, 'GET', null);
    if (get.status === 404) {
      await k8s('/api/v1/namespaces/fulloid/configmaps', 'POST', {
        apiVersion: 'v1', kind: 'ConfigMap',
        metadata: { name: 'fouloid-registry', namespace: 'fulloid' },
        data: { registry: '{}' },
      });
    }
    return get.status !== 404;
  };

  if (method === 'GET') {
    await ensureConfigMap();
    const cm = await k8s(CM_PATH, 'GET', null);
    if (cm.status !== 200) return { status: 500, body: { error: 'failed to read registry' } };
    try {
      return { status: 200, body: JSON.parse(cm.body.data?.registry || '{}') };
    } catch {
      return { status: 200, body: {} };
    }
  }

  if (method === 'POST') {
    const entry = context.request.body;
    if (!entry || !entry.name) {
      return { status: 400, body: { error: 'entry.name is required' } };
    }
    await ensureConfigMap();
    const cm = await k8s(CM_PATH, 'GET', null);
    let registry = {};
    try { registry = JSON.parse(cm.body.data?.registry || '{}'); } catch {}

    registry[entry.name] = {
      ...entry,
      registeredAt: new Date().toISOString(),
    };

    const patch = await k8s(CM_PATH, 'PATCH', {
      data: { registry: JSON.stringify(registry) },
    });
    // PATCH needs strategic-merge-patch content type — retry with PUT if PATCH fails
    if (patch.status >= 400) {
      // Fall back: PUT the full ConfigMap
      const full = cm.body;
      full.data = { registry: JSON.stringify(registry) };
      delete full.metadata.resourceVersion; // let server manage it
      const put = await k8s(CM_PATH, 'PUT', full);
      if (put.status >= 400) return { status: 500, body: { error: 'failed to update registry', detail: put.body } };
    }
    return { status: 200, body: { ok: true, registered: entry.name, total: Object.keys(registry).length } };
  }

  return { status: 405, body: { error: 'use GET or POST' } };
};
