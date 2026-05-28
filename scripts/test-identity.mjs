#!/usr/bin/env node
// Tests the full crypto roundtrip locally — no K8s, no Iggy needed.
// Usage: node scripts/test-identity.mjs

import { generateKeyPairSync, sign } from "node:crypto";

// --- helpers (mirrors src/crypto/identity.ts) ---

function certPayload(cert) {
  return Buffer.from(JSON.stringify({
    agentName: cert.agentName,
    publicKey: cert.publicKey,
    issuedAt: cert.issuedAt,
    expiresAt: cert.expiresAt,
  }));
}

function messagePayload(msg) {
  return Buffer.from(`${msg.id}:${msg.sender}:${msg.text}:${msg.timestamp}`);
}

// --- test helpers ---

let passed = 0;
let failed = 0;

function expect(label, value, expected) {
  if (value === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    got:      ${JSON.stringify(value)}`);
    failed++;
  }
}

// --- setup: generate platform keypair + two fouloid keypairs ---

const platform = generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const alice = generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const bob = generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

function issueCert(agentName, publicKey, ttlMs = 24 * 60 * 60 * 1000) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ttlMs;
  const partial = { agentName, publicKey, issuedAt, expiresAt };
  const platformSignature = sign(null, certPayload(partial), platform.privateKey).toString("base64");
  return Buffer.from(JSON.stringify({ ...partial, platformSignature })).toString("base64");
}

function buildMessage(sender, privateKey, certBase64, overrides = {}) {
  const msg = {
    id: `test-${Date.now()}`,
    sender,
    text: "hello world",
    timestamp: Date.now(),
    certificate: certBase64,
    ...overrides,
  };
  msg.signature = sign(null, messagePayload(msg), privateKey).toString("base64");
  if (overrides.signature !== undefined) msg.signature = overrides.signature;
  return msg;
}

// inline verifyIncomingMessage (same logic as identity.ts)
import { verify } from "node:crypto";

function verifyIncomingMessage(platformPublicKey, msg) {
  if (!msg.certificate || !msg.signature) return { valid: false, reason: "missing certificate or signature" };

  let cert;
  try { cert = JSON.parse(Buffer.from(msg.certificate, "base64").toString("utf8")); }
  catch { return { valid: false, reason: "invalid certificate encoding" }; }

  if (typeof cert.expiresAt !== "number") return { valid: false, reason: "certificate missing expiresAt" };
  if (Date.now() > cert.expiresAt) return { valid: false, reason: `certificate expired at ${new Date(cert.expiresAt).toISOString()}` };

  const partial = { agentName: cert.agentName, publicKey: cert.publicKey, issuedAt: cert.issuedAt, expiresAt: cert.expiresAt };
  if (!verify(null, certPayload(partial), platformPublicKey, Buffer.from(cert.platformSignature, "base64")))
    return { valid: false, reason: "certificate not signed by platform" };

  if (cert.agentName !== msg.sender) return { valid: false, reason: `certificate is for "${cert.agentName}", not "${msg.sender}"` };

  if (!verify(null, messagePayload(msg), cert.publicKey, Buffer.from(msg.signature, "base64")))
    return { valid: false, reason: "invalid message signature" };

  return { valid: true };
}

// --- tests ---

const aliceCert = issueCert("fouloid-alice", alice.publicKey);
const bobCert = issueCert("fouloid-bob", bob.publicKey);

console.log("\n--- Happy path ---");
{
  const msg = buildMessage("fouloid-alice", alice.privateKey, aliceCert);
  const r = verifyIncomingMessage(platform.publicKey, msg);
  expect("valid message from alice", r.valid, true);
}

console.log("\n--- Expired certificate ---");
{
  const expiredCert = issueCert("fouloid-alice", alice.publicKey, -1000);
  const msg = buildMessage("fouloid-alice", alice.privateKey, expiredCert);
  const r = verifyIncomingMessage(platform.publicKey, msg);
  expect("rejected", r.valid, false);
  expect("reason mentions expired", r.reason?.includes("expired"), true);
}

console.log("\n--- Certificate missing expiresAt ---");
{
  const issuedAt = Date.now();
  const partial = { agentName: "fouloid-alice", publicKey: alice.publicKey, issuedAt };
  const platformSignature = sign(null, Buffer.from(JSON.stringify(partial)), platform.privateKey).toString("base64");
  const badCert = Buffer.from(JSON.stringify({ ...partial, platformSignature })).toString("base64");
  const msg = buildMessage("fouloid-alice", alice.privateKey, badCert);
  const r = verifyIncomingMessage(platform.publicKey, msg);
  expect("rejected", r.valid, false);
  expect("reason mentions expiresAt", r.reason?.includes("expiresAt"), true);
}

console.log("\n--- Wrong platform key ---");
{
  const otherPlatform = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const msg = buildMessage("fouloid-alice", alice.privateKey, aliceCert);
  const r = verifyIncomingMessage(otherPlatform.publicKey, msg);
  expect("rejected", r.valid, false);
  expect("reason: not signed by platform", r.reason, "certificate not signed by platform");
}

console.log("\n--- Identity mismatch (alice's cert, bob's sender field) ---");
{
  const msg = buildMessage("fouloid-bob", alice.privateKey, aliceCert);
  const r = verifyIncomingMessage(platform.publicKey, msg);
  expect("rejected", r.valid, false);
  expect("reason mentions name mismatch", r.reason?.includes("fouloid-alice"), true);
}

console.log("\n--- Tampered message text ---");
{
  const msg = buildMessage("fouloid-alice", alice.privateKey, aliceCert);
  msg.text = "injected payload";
  const r = verifyIncomingMessage(platform.publicKey, msg);
  expect("rejected", r.valid, false);
  expect("reason: invalid message signature", r.reason, "invalid message signature");
}

console.log("\n--- Alice uses bob's private key to sign ---");
{
  const msg = buildMessage("fouloid-alice", bob.privateKey, aliceCert);
  const r = verifyIncomingMessage(platform.publicKey, msg);
  expect("rejected", r.valid, false);
  expect("reason: invalid message signature", r.reason, "invalid message signature");
}

console.log("\n--- Missing certificate ---");
{
  const msg = buildMessage("fouloid-alice", alice.privateKey, aliceCert);
  delete msg.certificate;
  const r = verifyIncomingMessage(platform.publicKey, msg);
  expect("rejected", r.valid, false);
}

console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
