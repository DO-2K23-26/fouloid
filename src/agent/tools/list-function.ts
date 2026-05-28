import { tool } from "langchain";
import z from "zod";
import { listFunctionsWithRoutes } from "./fission-triggers.js";

export async function listFunctions(): Promise<string> {
  const functions = await listFunctionsWithRoutes();
  if (!functions.length) {
    return "No functions found.";
  }
  return functions
    .map((f) => {
      const endpoint = f.route ? `${f.method ?? "GET"} ${f.route}` : "(no HTTP trigger)";
      return `- ${f.name} → ${endpoint}`;
    })
    .join("\n");
}

export const listFunctionsTool = tool(
  async () => {
    return await listFunctions();
  },
  {
    name: "list_functions",
    description: "List all deployed Fission functions with their HTTP route and method",
    schema: z.object({}),
  },
);
