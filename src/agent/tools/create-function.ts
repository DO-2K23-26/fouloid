import { tool } from "langchain";
import z from "zod";

const FISSION_ENDPOINT = process.env.FISSION_ENDPOINT ?? "http://localhost:8888";

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${FISSION_ENDPOINT}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function createFunction(
  functionName: string,
  envName: string,
  code: string
): Promise<string> {
  const envRes = await post("/v2/environments", {
    metadata: { name: envName, namespace: "default" },
    spec: {
      version: 3,
      runtime: { image: `fission/${envName}-env` },
    },
  });
  if (!envRes.ok && envRes.status !== 409) {
    throw new Error(`Failed to create environment: ${envRes.status} ${await envRes.text()}`);
  }

  const pkgName = `${functionName}-pkg`;
  const pkgRes = await post("/v2/packages", {
    metadata: { name: pkgName, namespace: "default" },
    spec: {
      environment: { name: envName, namespace: "default" },
      source: {
        type: "literal",
        literal: Buffer.from(code).toString("base64"),
      },
    },
  });
  if (!pkgRes.ok && pkgRes.status !== 409) {
    throw new Error(`Failed to create package: ${pkgRes.status} ${await pkgRes.text()}`);
  }

  const fnRes = await post("/v2/functions", {
    metadata: { name: functionName, namespace: "default" },
    spec: {
      environment: { name: envName, namespace: "default" },
      package: {
        packageRef: { name: pkgName, namespace: "default" },
        functionName,
      },
    },
  });
  if (!fnRes.ok) {
    throw new Error(`Failed to create function: ${fnRes.status} ${await fnRes.text()}`);
  }

  return `Function "${functionName}" created in environment "${envName}".`;
}

export const createFunctionTool = tool(
  async ({ functionName, envName, code }) => {
    return await createFunction(functionName, envName, code);
  },
  {
    name: "create_function",
    description: "Create a Fission environment (if needed) then deploy a function to it",
    schema: z.object({
      functionName: z.string().min(1).describe("Name of the Fission function"),
      envName: z.string().min(1).describe("Fission environment name (e.g. node, python)"),
      code: z.string().describe("Source code of the function"),
    }),
  },
);
