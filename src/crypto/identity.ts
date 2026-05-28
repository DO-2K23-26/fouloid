import { sign, verify } from "node:crypto";
import type { AgentMessage, AgentIdentityConfig, FouloidCertificate } from "../types/agent.js";

function messagePayload(msg: AgentMessage): Buffer {
  return Buffer.from(`${msg.id}:${msg.sender}:${msg.text}:${msg.timestamp}`);
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function certPayload(cert: Omit<FouloidCertificate, "platformSignature">): Buffer {
  return Buffer.from(JSON.stringify({
    agentName: cert.agentName,
    publicKey: cert.publicKey,
    issuedAt: cert.issuedAt,
    expiresAt: cert.expiresAt,
  }));
}

export function signCertificate(
  platformPrivateKeyPem: string,
  agentName: string,
  publicKeyPem: string,
  ttlMs = DEFAULT_TTL_MS
): string {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ttlMs;
  const partial = { agentName, publicKey: publicKeyPem, issuedAt, expiresAt };
  const platformSignature = sign(null, certPayload(partial), platformPrivateKeyPem).toString("base64");
  const cert: FouloidCertificate = { ...partial, platformSignature };
  return Buffer.from(JSON.stringify(cert)).toString("base64");
}

export function signMessage(identity: AgentIdentityConfig, msg: AgentMessage): AgentMessage {
  const signature = sign(null, messagePayload(msg), identity.privateKey).toString("base64");
  return { ...msg, certificate: identity.certificate, signature };
}

export function verifyIncomingMessage(
  platformPublicKeyPem: string,
  msg: AgentMessage
): { valid: boolean; reason?: string } {
  if (!msg.certificate || !msg.signature) {
    return { valid: false, reason: "missing certificate or signature" };
  }

  let cert: FouloidCertificate;
  try {
    cert = JSON.parse(Buffer.from(msg.certificate, "base64").toString("utf8")) as FouloidCertificate;
  } catch {
    return { valid: false, reason: "invalid certificate encoding" };
  }

  if (typeof cert.expiresAt !== "number") {
    return { valid: false, reason: "certificate missing expiresAt" };
  }
  if (Date.now() > cert.expiresAt) {
    return { valid: false, reason: `certificate expired at ${new Date(cert.expiresAt).toISOString()}` };
  }

  const partial = { agentName: cert.agentName, publicKey: cert.publicKey, issuedAt: cert.issuedAt, expiresAt: cert.expiresAt };
  const certOk = verify(
    null,
    certPayload(partial),
    platformPublicKeyPem,
    Buffer.from(cert.platformSignature, "base64")
  );
  if (!certOk) {
    return { valid: false, reason: "certificate not signed by platform" };
  }

  if (cert.agentName !== msg.sender) {
    return { valid: false, reason: `certificate is for "${cert.agentName}", not "${msg.sender}"` };
  }

  const msgOk = verify(
    null,
    messagePayload(msg),
    cert.publicKey,
    Buffer.from(msg.signature, "base64")
  );
  if (!msgOk) {
    return { valid: false, reason: "invalid message signature" };
  }

  return { valid: true };
}
