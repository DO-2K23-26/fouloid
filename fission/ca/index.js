// Fission CA function — signs certificates for fouloids.
// Reads PLATFORM_PRIVATE_KEY from env (mounted from K8s Secret platform-signing-key).
// Authorization is handled externally (network policy / service mesh).

const { sign } = require("crypto");

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MIN_TTL_MS = 60 * 1000; // 1 minute

// PEM keys may have literal \n when injected as env vars
function normalizePem(pem) {
  return pem.replace(/\\n/g, "\n");
}

const rawKey = process.env.PLATFORM_PRIVATE_KEY;
if (!rawKey) throw new Error("PLATFORM_PRIVATE_KEY env var is not set");
const platformPrivateKey = normalizePem(rawKey);

function certPayload(partial) {
  return Buffer.from(
    JSON.stringify({
      agentName: partial.agentName,
      publicKey: partial.publicKey,
      issuedAt: partial.issuedAt,
      expiresAt: partial.expiresAt,
    })
  );
}

module.exports = async function (context) {
  if (context.request.method !== "POST") {
    return { status: 405, body: { error: "Method not allowed" } };
  }

  // Parse and validate body
  const rawBody = context.request?.body ?? context.body ?? "{}";
  const body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  const { agentName, publicKey, ttlMs } = body;

  if (!agentName || typeof agentName !== "string") {
    return { status: 400, body: { error: "agentName is required" } };
  }
  if (!/^[a-z0-9-]+$/.test(agentName)) {
    return { status: 400, body: { error: "agentName must only contain lowercase letters, numbers and hyphens" } };
  }
  if (!publicKey || typeof publicKey !== "string" || !publicKey.includes("BEGIN PUBLIC KEY")) {
    return { status: 400, body: { error: "publicKey must be a valid PEM Ed25519 public key" } };
  }

  const safeTtl = typeof ttlMs === "number"
    ? Math.min(Math.max(ttlMs, MIN_TTL_MS), MAX_TTL_MS)
    : DEFAULT_TTL_MS;

  const issuedAt = Date.now();
  const expiresAt = issuedAt + safeTtl;
  const partial = { agentName, publicKey, issuedAt, expiresAt };

  let platformSignature;
  try {
    platformSignature = sign(null, certPayload(partial), platformPrivateKey).toString("base64");
  } catch (err) {
    return { status: 500, body: { error: `Signing failed: ${err.message}` } };
  }

  const cert = { ...partial, platformSignature };
  const certificate = Buffer.from(JSON.stringify(cert)).toString("base64");

  console.log(`[ca] signed cert for "${agentName}", expires ${new Date(expiresAt).toISOString()}`);

  return { status: 200, body: { certificate } };
};
