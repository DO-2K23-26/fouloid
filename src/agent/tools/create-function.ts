import { tool } from "langchain";
import z from "zod";
import { getFissionApiBaseUrl } from "./fission-config.js";

export async function createFunction(
  name: string,
  code: string,
  httpMethod: string,
  route: string
): Promise<string> {
  const res = await fetch(`${getFissionApiBaseUrl()}/create-function`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, code, httpMethod, route }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create function: ${res.status} ${await res.text()}`);
  }
  return `Function "${name}" created at ${httpMethod} ${route}.`;
}

export const createFunctionTool = tool(
  async ({ name, code, httpMethod, route }) => {
    return await createFunction(name, code, httpMethod, route);
  },
  {
    name: "create_function",
    description: "Deploy a Fission function exposed as an HTTP endpoint",
    schema: z.object({
      name: z.string().min(1).describe("Name of the Fission function"),
      code: z.string().describe("Source code of the function"),
      httpMethod: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).describe("HTTP method for the function route"),
      route: z.string().min(1).describe("URL route for the function (e.g. /create-fulloid)"),
    }),
  },
);
