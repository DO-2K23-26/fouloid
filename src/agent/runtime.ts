import type { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "langchain";
import z from "zod";
import type { AgentMessage, IggyMessenger } from "../types/agent.js";
import { invokeFunctionTool } from "./tools/invoke-function.js";
import { createFunctionTool } from "./tools/create-function.js";
import { listFunctionsTool } from "./tools/list-function.js";
import { inspectFunctionTool } from "./tools/inspect-function.js";
import { waitDeploymentTool } from "./tools/wait-deployment.js";

const DEFAULT_SYSTEM_PROMPT = [
  "You are a queue-driven LangChain agent.",
  "Reply briefly and clearly.",
  "Treat each incoming queue message as the latest user input.",
  "If a message asks you to tell another agent to do something, reply with the actionable instruction itself instead of a short acknowledgement.",
  "When you are done with all tasks, call the finish tool with your final response.",
].join(" ");

const finishTool = tool(
  async ({ message }) => message,
  {
    name: "finish",
    description: "Call this when you have completed all tasks. Provide your final summary as the message.",
    schema: z.object({
      message: z.string().describe("Final response to send"),
    }),
  },
);

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTextContent(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part !== null && "text" in part && typeof part.text === "string"
          ? part.text
          : ""
      )
      .join("")
      .trim();
  }
  return String(content ?? "");
}

const CODING_TOOLS = new Set(["create_function", "invoke_function", "inspect_function", "list_functions"]);

export function createLangChainAgentRuntime({
  agentName,
  codingModel,
  reasoningModel,
  messenger,
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
}: {
  agentName: string;
  codingModel: ChatOpenAI;
  reasoningModel: ChatOpenAI;
  messenger: IggyMessenger;
  systemPrompt?: string;
}) {
  return {
    async handleMessage(message: AgentMessage) {
      console.log(`[agent] invoking model for id=${message.id} (${message.text.length} chars in)`);
      const startedAt = Date.now();

      const tools = [
        invokeFunctionTool,
        createFunctionTool,
        listFunctionsTool,
        inspectFunctionTool,
        waitDeploymentTool,
        finishTool,
      ];

      const reasoningWithTools = reasoningModel.bindTools(tools, {
        parallel_tool_calls: false,
        tool_choice: "required",
      });
      const codingWithTools = codingModel.bindTools(tools, {
        parallel_tool_calls: false,
        tool_choice: "required",
      });

      const messages: any[] = [
        new HumanMessage(systemPrompt + "\n\n" + message.text),
      ];

      let shouldContinue = true;
      let iteration = 0;
      const MAX_ITERATIONS = 30;
      let activeModel = reasoningWithTools;
      let activeModelLabel = "reasoning";

      while (shouldContinue) {
        iteration++;
        if (iteration > MAX_ITERATIONS) {
          console.error(`[agent] max iterations (${MAX_ITERATIONS}) reached — aborting`);
          await messenger.send({ id: createMessageId(), sender: agentName, text: `Aborted after ${MAX_ITERATIONS} iterations without completion.`, timestamp: Date.now(), replyTo: message.id });
          break;
        }

        console.log(`[agent] → model=${activeModelLabel} turn=${iteration}/${MAX_ITERATIONS} history=${messages.length}`);
        const response = await activeModel.invoke(messages);

        const responseText = normalizeTextContent(response.content);
        if (responseText) {
          console.log(`[agent] ← text: ${responseText.substring(0, 200)}`);
        }
        if (response.tool_calls?.length) {
          for (const tc of response.tool_calls) {
            const argsStr = JSON.stringify(tc.args ?? {});
            console.log(`[agent] ← tool_call: ${tc.name}(${argsStr.substring(0, 300)})`);
          }
        }

        // No tool calls — treat content as final response (fallback for non-required models)
        if (!response.tool_calls || response.tool_calls.length === 0) {
          const elapsedMs = Date.now() - startedAt;
          console.log(`[agent] model replied in ${elapsedMs}ms (${responseText.length} chars out)`);
          await messenger.send({ id: createMessageId(), sender: agentName, text: responseText, timestamp: Date.now(), replyTo: message.id });
          shouldContinue = false;
          break;
        }

        // Only execute the FIRST tool call — if the model batched multiple, push "skipped"
        // ToolMessages for the rest so the history stays valid (every tool_call_id must have
        // a ToolMessage). This forces the model to re-plan step-by-step with real results.
        const [firstCall, ...skippedCalls] = response.tool_calls;
        if (skippedCalls.length > 0) {
          console.warn(`[agent] model returned ${response.tool_calls.length} tool calls — executing only "${firstCall.name}", skipping ${skippedCalls.map(c => c.name).join(", ")}`);
        }

        // Push a new AIMessage containing ONLY the first tool call (valid history)
        messages.push(new AIMessage({
          content: normalizeTextContent(response.content),
          tool_calls: [firstCall],
        }));

        // Pick model for next turn based on the tool being called
        const nextToolName = firstCall?.name ?? "";
        const usesCoding = CODING_TOOLS.has(nextToolName);
        activeModel = usesCoding ? codingWithTools : reasoningWithTools;
        activeModelLabel = usesCoding ? "coding" : "reasoning";

        console.log(`[agent] executing tool: ${firstCall.name}`);

        if (firstCall.name === "finish") {
          const text = String((firstCall.args as any)?.message ?? "Done.");
          const elapsedMs = Date.now() - startedAt;
          console.log(`[agent] model replied in ${elapsedMs}ms (${text.length} chars out)`);
          await messenger.send({ id: createMessageId(), sender: agentName, text, timestamp: Date.now(), replyTo: message.id });
          messages.push(new ToolMessage({ content: text, tool_call_id: firstCall.id ?? "" }));
          shouldContinue = false;
        } else {
          const t = tools.find((t) => t.name === firstCall.name) as any;
          if (!t) {
            console.error(`[agent] tool not found: ${firstCall.name}`);
            messages.push(new ToolMessage({ content: `Error: tool "${firstCall.name}" not found`, tool_call_id: firstCall.id ?? "" }));
          } else {
            try {
              const toolResult = await t.invoke(firstCall.args);
              console.log(`[agent] tool ${firstCall.name} returned: ${String(toolResult).substring(0, 500)}`);
              messages.push(new ToolMessage({ content: String(toolResult), tool_call_id: firstCall.id ?? "" }));
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              console.error(`[agent] tool ${firstCall.name} failed: ${errorMsg}`);
              messages.push(new ToolMessage({ content: `Error: ${errorMsg}`, tool_call_id: firstCall.id ?? "" }));
            }
          }
        }
      }
    },
  };
}
