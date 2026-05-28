#!/usr/bin/env node
// Run once to generate the platform keypair and push it to Kubernetes.
// Usage: node scripts/setup-platform-key.mjs [namespace]

import { generateKeyPairSync } from "node:crypto";
import { execSync } from "node:child_process";

const namespace = process.argv[2] ?? "fulloid";

const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// Store the private key in a K8s Secret (only accessible to provisioning scripts)
execSync(
  `kubectl create secret generic platform-signing-key \
    --from-literal=private-key=${JSON.stringify(privateKey)} \
    -n ${namespace} \
    --dry-run=client -o yaml | kubectl apply -f -`,
  { stdio: "inherit" }
);

console.log("\nPlatform key created. Add this to deploy-app.yaml ConfigMap under PLATFORM_PUBLIC_KEY:\n");
console.log(publicKey);
