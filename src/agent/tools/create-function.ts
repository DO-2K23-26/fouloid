import { tool } from "langchain";
import z from "zod";

export function createFunction(functionName: string, description: string, code: string): string {
  return `You created function ${functionName} with description ${description} and code ${code}`
}

export const createFunctionTool = tool(
  ({ functionName, description, code }, config) => {
    return createFunction(functionName, description, code)
  },
  {
    name: "create_function",
    description: "Allow to create a new function",
    schema: z.object({
      functionName: z.string().nonempty().describe("Name of the registered function"),
      description: z.string().describe("Description of the function"),
      code: z.string().describe("The code of the function")
    }),
  },
);

