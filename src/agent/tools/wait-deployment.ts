import https from "node:https";
import { readFileSync } from "node:fs";
import { tool } from "langchain";
import z from "zod";

function k8sGet(path: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let token: string;
    let ca: Buffer;
    try {
      token = readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/token", "utf8").trim();
      ca = readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt");
    } catch {
      reject(new Error("Not running in-cluster"));
      return;
    }
    const url = `https://kubernetes.default.svc${path}`;
    const req = https.get(url, { ca, headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let data = "";
      res.on("data", (chunk: string) => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data) as Record<string, unknown>); } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
  });
}

export async function waitDeployment(namespace: string, name: string, timeoutSeconds = 120): Promise<string> {
  const deadline = Date.now() + timeoutSeconds * 1000;
  const path = `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`;

  while (Date.now() < deadline) {
    const dep = await k8sGet(path) as any;

    if (dep.code === 404 || dep.reason === "NotFound") {
      return `Deployment "${name}" not found in namespace "${namespace}".`;
    }

    const desired = dep.spec?.replicas ?? 1;
    const ready = dep.status?.readyReplicas ?? 0;
    const available = dep.status?.availableReplicas ?? 0;

    if (ready >= desired && available >= desired) {
      return `Deployment "${namespace}/${name}" is ready (${ready}/${desired} replicas).`;
    }

    const conditions = (dep.status?.conditions ?? []) as any[];
    const progressing = conditions.find((c: any) => c.type === "Progressing");
    if (progressing?.reason === "ProgressDeadlineExceeded") {
      return `Deployment "${namespace}/${name}" failed to progress: ${progressing.message}`;
    }

    await new Promise((r) => setTimeout(r, 5000));
  }

  const dep = await k8sGet(path) as any;
  const ready = dep.status?.readyReplicas ?? 0;
  const desired = dep.spec?.replicas ?? 1;
  return `Deployment "${namespace}/${name}" timed out after ${timeoutSeconds}s (${ready}/${desired} replicas ready).`;
}

export const waitDeploymentTool = tool(
  async ({ namespace, name, timeoutSeconds }) => {
    return await waitDeployment(namespace, name, timeoutSeconds ?? 120);
  },
  {
    name: "wait_deployment",
    description: "Wait until a Kubernetes Deployment is ready (all replicas running). Use this after spawning a clone to verify it started correctly before finishing.",
    schema: z.object({
      namespace: z.string().describe("Kubernetes namespace of the deployment"),
      name: z.string().describe("Name of the deployment to wait for"),
      timeoutSeconds: z.number().optional().describe("Max seconds to wait (default 120)"),
    }),
  },
);
