import { tool } from "langchain";
import z from "zod";
import { getFissionApiBaseUrl } from "./fission-config.js";

type FissionFunction = {
  metadata: { name: string };
  spec: { environment: { name: string } };
};

export async function listFunctions(): Promise<string> {
  const res = await fetch(`${getFissionApiBaseUrl()}/list-functions`);
  if (!res.ok) {
    throw new Error(`Failed to list functions: ${res.status} ${await res.text()}`);
  }
  const functions = (await res.json()) as FissionFunction[];
  if (!functions.length) {
    return "No functions found.";
  }
  return functions
    .map((f) => `- ${f.metadata.name} (env: ${f.spec.environment.name})`)
    .join("\n");
}

export const listFunctionsTool = tool(
  async () => {
    return await listFunctions();
  },
  {
    name: "list_functions",
    description: "List all deployed Fission functions",
    schema: z.object({}),
  },
);
