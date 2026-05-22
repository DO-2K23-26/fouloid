import { tool } from "langchain";
import z from "zod";

export function listFunctions(): string {
  return "Here are all the available functions."
}

export const listFunctionsTool = tool(
  (_, config) => {
    return listFunctions()
  },
  {
    name: "list_functions",
    description: "Allow to list all available functions",
    schema: z.object({
    }),
  },
);

