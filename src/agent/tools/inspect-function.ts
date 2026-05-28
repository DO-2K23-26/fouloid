import { tool } from "langchain";
import z from "zod";
import { listFunctionsWithRoutes } from "./fission-triggers.js";

export async function inspectFunction(name: string): Promise<string> {
  const functions = await listFunctionsWithRoutes();
  const fn = functions.find((f) => f.name === name);
  if (!fn) {
    return `Function "${name}" not found.`;
  }
  const endpoint = fn.route ? `${fn.method ?? "GET"} ${fn.route}` : "(no HTTP trigger)";
  return `Function "${fn.name}" endpoint: ${endpoint}\nCode:\n${fn.code}`;
}

export const inspectFunctionTool = tool(
  async ({ name }) => {
    return await inspectFunction(name);
  },
  {
    name: "inspect_function",
    description: "Retrieve the source code and HTTP endpoint of a Fission function. Use this to debug a failing function or get the exact route before invoking it.",
    schema: z.object({
      name: z.string().describe("Name of the Fission function to inspect"),
    }),
  },
);
