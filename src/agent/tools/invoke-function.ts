import { tool } from "langchain";
import z from "zod";

export function invokeFunction(functionName: string, args: unknown[]): string {
  return `You invoked ${functionName} with args ${args}`
}

export const invokeFunctionTool = tool(
  ({ functionName, args }, config) => {
    return invokeFunction(functionName, args)
  },
  {
    name: "invoke_function",
    description: "Allow to invoke a function that is already registered inside fission",
    schema: z.object({
      functionName: z.string().nonempty().describe("Name of the registered function"),
      args: z.array(z.unknown()).describe("A list of argument to pass to the function")
    }),
  },
);

