import { tool } from "langchain";
import z from "zod";
import { getFissionApiBaseUrl } from "./fission-config.js";

export async function createFunction(
  name: string,
  code: string,
  method?: string,
  route?: string,
  environment?: string,
  namespace?: string
): Promise<string> {
  const body: Record<string, string> = { name, code };
  if (method) body.method = method;
  if (route) body.route = route;
  if (environment) body.environment = environment;
  if (namespace) body.namespace = namespace;

  const res = await fetch(`${getFissionApiBaseUrl()}/deploy-pauline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Failed to create function: ${res.status} ${text}`);
  }
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(text); } catch { parsed = {}; }
  if (parsed.error) {
    // Strip fission CLI help text — keep only the last meaningful error line
    const rawError = String(parsed.error);
    const lines = rawError.split("\n").map(l => l.trim()).filter(Boolean);
    const errorLine = [...lines].reverse().find((l: string) => l.startsWith("Error:")) ?? lines[lines.length - 1] ?? rawError;
    const debugInfo = parsed.debug ? ` (env=${(parsed.debug as any).env}, ns=${(parsed.debug as any).ns})` : "";
    throw new Error(`Failed to create function "${name}": ${errorLine}${debugInfo}`);
  }
  const actualMethod = (parsed.method as string | undefined) ?? method ?? "POST";
  const actualRoute = (parsed.route as string | undefined) ?? route ?? `/${name}`;
  return `Function "${name}" deployed at ${actualMethod} ${actualRoute}. Invoke it with route="${actualRoute}".`;
}

export const createFunctionTool = tool(
  async ({ name, code, method, route, environment, namespace }) => {
    return await createFunction(name, code, method, route, environment, namespace);
  },
  {
    name: "create_function",
    description: "Deploy or replace a Fission serverless function with an HTTP trigger. The function runs in a pool pod and must be fully self-contained.",
    schema: z.object({
      name: z.string().regex(/^[a-z0-9-]+$/).describe("Function name (lowercase alphanumeric and hyphens only)"),
      code: z.string().describe(
        "Complete, runnable source code. No placeholders, no stubs.\n" +
        "Node.js (environment=nodejs-baptiste) template:\n" +
        "  module.exports = async function(context) {\n" +
        "    const body = context.request.body;\n" +
        "    // ... full logic here ...\n" +
        "    return { status: 200, body: { result: 'value' } };\n" +
        "  };\n" +
        "Bash (environment=bash-pauline) template:\n" +
        "  #!/bin/bash\n" +
        "  set -euo pipefail\n" +
        "  BODY=$(cat)\n" +
        "  NAME=$(echo \"$BODY\" | jq -r '.name // empty')\n" +
        "  # ... full logic ...\n" +
        "  echo '{\"ok\":true}'"
      ),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "HEAD"]).optional().describe("HTTP method (default: POST)"),
      route: z.string().optional().describe("URL path for the HTTP trigger, e.g. /create-fulloid (default: /{name})"),
      environment: z.string().optional().describe("Fission environment: 'nodejs-baptiste' for Node.js (default), 'bash-pauline' for bash with kubectl/jq/fission"),
      namespace: z.string().optional().describe("Kubernetes namespace for the Fission function (default: fission-dev). NEVER use 'fulloid' — that is the agent namespace, not the functions namespace."),
    }),
  },
);
