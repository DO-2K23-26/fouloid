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
  if (!res.ok) {
    throw new Error(`Failed to create function: ${res.status} ${await res.text()}`);
  }
  return `Function "${name}" created at ${method ?? "GET"} ${route ?? `/${name}`}.`;
}

export const createFunctionTool = tool(
  async ({ name, code, method, route, environment, namespace }) => {
    return await createFunction(name, code, method, route, environment, namespace);
  },
  {
    name: "create_function",
    description: "Deploy a Fission function exposed as an HTTP endpoint",
    schema: z.object({
      name: z.string().regex(/^[a-z0-9-]+$/).describe("Function name (lowercase alphanumeric and hyphens)"),
      code: z.string().describe("Full source code of the function (CJS)"),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "HEAD"]).optional().describe("HTTP method (default: GET)"),
      route: z.string().optional().describe("URL path for the HTTP trigger (default: /{name})"),
      environment: z.string().optional().describe("Fission environment to use (default: nodejs-baptiste)"),
      namespace: z.string().optional().describe("Kubernetes namespace (default: fission-dev)"),
    }),
  },
);
