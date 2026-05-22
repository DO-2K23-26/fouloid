import { tool } from "langchain";
import z from "zod";
import { getFissionRouterUrl } from "./fission-config.js";

function getFissionFunctionUrl(functionName: string) {
  const encodedFunctionName = encodeURIComponent(functionName);

  return `${getFissionRouterUrl()}/${encodedFunctionName}`;
}

export async function invokeFunction(
  functionName: string,
  body: Record<string, unknown>
): Promise<string> {
  const url = getFissionFunctionUrl(functionName);
  const startedAt = Date.now();

  console.log(`[fission] invoking ${functionName} via ${url}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const responseText = await response.text();
    const elapsedMs = Date.now() - startedAt;

    if (!response.ok) {
      console.error(
        `[fission] ${functionName} failed in ${elapsedMs}ms (${response.status} ${response.statusText}) ${responseText}`
      );
      throw new Error(
        `Fission function "${functionName}" returned ${response.status} ${response.statusText}: ${responseText}`
      );
    }

    console.log(
      `[fission] ${functionName} replied in ${elapsedMs}ms (${responseText.length} chars, status=${response.status})`
    );

    return responseText;
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;

    if (!(error instanceof Error)) {
      console.error(
        `[fission] ${functionName} failed in ${elapsedMs}ms with non-Error rejection`
      );
      throw error;
    }

    console.error(
      `[fission] ${functionName} failed in ${elapsedMs}ms: ${error.message}`
    );
    throw error;
  }
}

export const invokeFunctionTool = tool(
  async ({ functionName, body }) => {
    return invokeFunction(functionName, body);
  },
  {
    name: "invoke_function",
    description: "Allow to invoke a function that is already registered inside fission",
    schema: z.object({
      functionName: z.string().nonempty().describe("Name of the registered function"),
      body: z
        .record(z.string(), z.unknown())
        .describe("JSON body to send to the registered function")
    }),
  },
);
