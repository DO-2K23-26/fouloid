module.exports = async function(context) {
  const body = context.request.body;
  const task = body.task || 'Join iggy channel fulloid-control, listen for messages, and reply to each one.';
  const cloneName = body.name || `clone-${Date.now()}`;
  const cloneNamespace = cloneName;

  // Parse generation/word from name: "gen1-wanderer" → generation=1, word="wanderer"
  const genMatch = cloneName.match(/^gen(\d+)-(.+)$/);
  const generation = genMatch ? String(parseInt(genMatch[1], 10)) : '1';
  const word = genMatch ? genMatch[2] : cloneName;

  // Parent is derived from the caller's AGENT_NAME (passed in body, or inferred)
  const parentName = body.parent || '';

  const fs = require('fs');
  const https = require('https');

  const token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8').trim();
  const ca = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');

  const k8s = (path, method, reqBody) => new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'kubernetes.default.svc',
      port: 443,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      ca
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('parse error: ' + data)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    if (reqBody) req.write(JSON.stringify(reqBody));
    req.end();
  });

  try {
    // 1. Create namespace with genealogy labels
    await k8s('/api/v1/namespaces', 'POST', {
      apiVersion: 'v1', kind: 'Namespace',
      metadata: {
        name: cloneNamespace,
        labels: {
          'fouloid.io/agent': 'true',
          'fouloid.io/generation': generation,
          'fouloid.io/word': word,
          'fouloid.io/parent': parentName,
        }
      }
    });

    // 2. Copy app-config with overrides including genealogy metadata
    const origCfg = await k8s('/api/v1/namespaces/fulloid/configmaps/app-config', 'GET', null);
    await k8s(`/api/v1/namespaces/${cloneNamespace}/configmaps`, 'POST', {
      apiVersion: 'v1', kind: 'ConfigMap',
      metadata: { name: 'app-config', namespace: cloneNamespace },
      data: {
        ...origCfg.data,
        AGENT_NAME: cloneName,
        AGENT_KICKOFF: task,
        AGENT_GENERATION: generation,
        AGENT_WORD: word,
        AGENT_PARENT: parentName,
        IGGY_ADDRESS: 'iggy.fulloid.svc.cluster.local:8090'
      }
    });

    // 3. Copy app-secrets
    const origSecret = await k8s('/api/v1/namespaces/fulloid/secrets/app-secrets', 'GET', null);
    await k8s(`/api/v1/namespaces/${cloneNamespace}/secrets`, 'POST', {
      apiVersion: 'v1', kind: 'Secret', type: 'Opaque',
      metadata: { name: 'app-secrets', namespace: cloneNamespace },
      data: origSecret.data
    });

    // 4. Copy fouloid-app-keys (identity keys required by the agent)
    const origKeys = await k8s('/api/v1/namespaces/fulloid/secrets/fouloid-app-keys', 'GET', null);
    await k8s(`/api/v1/namespaces/${cloneNamespace}/secrets`, 'POST', {
      apiVersion: 'v1', kind: 'Secret', type: 'Opaque',
      metadata: { name: 'fouloid-app-keys', namespace: cloneNamespace },
      data: origKeys.data
    });

    // 5. ServiceAccount
    await k8s(`/api/v1/namespaces/${cloneNamespace}/serviceaccounts`, 'POST', {
      apiVersion: 'v1', kind: 'ServiceAccount',
      metadata: { name: 'app', namespace: cloneNamespace }
    });

    // 6. ClusterRoleBinding
    await k8s('/apis/rbac.authorization.k8s.io/v1/clusterrolebindings', 'POST', {
      apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'ClusterRoleBinding',
      metadata: { name: `${cloneNamespace}-admin` },
      roleRef: { kind: 'ClusterRole', name: 'cluster-admin', apiGroup: 'rbac.authorization.k8s.io' },
      subjects: [{ kind: 'ServiceAccount', name: 'app', namespace: cloneNamespace }]
    });

    // 7. Deployment using envFrom to load full config + secrets
    await k8s(`/apis/apps/v1/namespaces/${cloneNamespace}/deployments`, 'POST', {
      apiVersion: 'apps/v1', kind: 'Deployment',
      metadata: { name: 'app', namespace: cloneNamespace },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: 'app' } },
        template: {
          metadata: { labels: { app: 'app' } },
          spec: {
            serviceAccountName: 'app',
            containers: [{
              name: 'app',
              image: 'ghcr.io/do-2k23-26/fouloid:latest',
              envFrom: [
                { configMapRef: { name: 'app-config' } },
                { secretRef: { name: 'app-secrets' } },
                { secretRef: { name: 'fouloid-app-keys' } }
              ],
              ports: [{ containerPort: 8080 }]
            }]
          }
        }
      }
    });

    return { status: 200, body: { cloneNamespace, cloneName, deploymentName: 'app', generation, word, parent: parentName } };
  } catch (err) {
    return { status: 500, body: { error: err.message } };
  }
};
