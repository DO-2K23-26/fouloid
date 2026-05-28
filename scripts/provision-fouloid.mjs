#!/usr/bin/env node
// Generates a keypair for a fouloid, signs it with the platform key, and stores the result
// in a K8s Secret. Run this before deploying a new fouloid.
// Usage: node scripts/provision-fouloid.mjs <agent-name> [namespace]

import { generateKeyPairSync, sign } from "node:crypto";
import { execSync } from "node:child_process";

const [,, agentName, namespace = "fulloid"] = process.argv;
if (!agentName) {
  console.error("Usage: node scripts/provision-fouloid.mjs <agent-name> [namespace]");
  process.exit(1);
}

// Read the platform private key from K8s
const platformPrivateKey = execSync(
  `kubectl get secret platform-signing-key -n ${namespace} -o jsonpath='{.data.private-key}' | base64 -d`
).toString();

// Generate keypair for the fouloid
const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// Sign the certificate
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const issuedAt = Date.now();
const expiresAt = issuedAt + DEFAULT_TTL_MS;
const partial = { agentName, publicKey, issuedAt, expiresAt };
const platformSignature = sign(
  null,
  Buffer.from(JSON.stringify(partial)),
  platformPrivateKey
).toString("base64");

const certificate = Buffer.from(
  JSON.stringify({ ...partial, platformSignature })
).toString("base64");

// Store in K8s Secret
const secretName = `fouloid-${agentName}-keys`;
execSync(
  `kubectl create secret generic ${secretName} \
    --from-literal=FOULOID_PRIVATE_KEY=${JSON.stringify(privateKey)} \
    --from-literal=FOULOID_CERTIFICATE=${certificate} \
    -n ${namespace} \
    --dry-run=client -o yaml | kubectl apply -f -`,
  { stdio: "inherit" }
);

console.log(`\nSecret "${secretName}" created in namespace "${namespace}".`);
console.log(`Add this to your Deployment under envFrom:\n`);
console.log(`  - secretRef:\n      name: ${secretName}`);
