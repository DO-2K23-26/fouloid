import type { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
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
      let activeModel = reasoningWithTools;
      let iterations = 0;
      const MAX_ITERATIONS = 20;

      while (shouldContinue) {
        if (++iterations > MAX_ITERATIONS) {
          console.error(`[agent] exceeded ${MAX_ITERATIONS} iterations for id=${message.id}, aborting`);
          break;
        }
        const response = await activeModel.invoke(messages);

        // No tool calls — treat content as final response (fallback for non-required models)
        if (!response.tool_calls || response.tool_calls.length === 0) {
          const text = normalizeTextContent(response.content);
          const elapsedMs = Date.now() - startedAt;
          console.log(`[agent] model replied in ${elapsedMs}ms (${text.length} chars out)`);
          await messenger.send({ id: createMessageId(), sender: agentName, text, timestamp: Date.now(), replyTo: message.id });
          shouldContinue = false;
          break;
        }

        messages.push(response);

        // Pick model for next turn based on the tool being called
        const nextToolName = response.tool_calls?.[0]?.name ?? "";
        activeModel = CODING_TOOLS.has(nextToolName) ? codingWithTools : reasoningWithTools;

        for (const toolCall of response.tool_calls) {
          console.log(`[agent] executing tool: ${toolCall.name} (model=${CODING_TOOLS.has(toolCall.name) ? "coding" : "reasoning"})`);

          // finish tool — send the message and stop
          if (toolCall.name === "finish") {
            const text = String((toolCall.args as any)?.message ?? "Done.");
            const elapsedMs = Date.now() - startedAt;
            console.log(`[agent] model replied in ${elapsedMs}ms (${text.length} chars out)`);
            await messenger.send({ id: createMessageId(), sender: agentName, text, timestamp: Date.now(), replyTo: message.id });
            messages.push(new ToolMessage({ content: text, tool_call_id: toolCall.id ?? "" }));
            shouldContinue = false;
            break;
          }

          const t = tools.find((t) => t.name === toolCall.name) as any;
          if (!t) {
            console.error(`[agent] tool not found: ${toolCall.name}`);
            messages.push(new ToolMessage({ content: `Error: tool "${toolCall.name}" not found`, tool_call_id: toolCall.id ?? "" }));
            continue;
          }

          try {
            const toolResult = await t.invoke(toolCall.args);
            console.log(`[agent] tool ${toolCall.name} returned: ${String(toolResult).substring(0, 500)}`);
            messages.push(new ToolMessage({ content: String(toolResult), tool_call_id: toolCall.id ?? "" }));
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[agent] tool ${toolCall.name} failed: ${errorMsg}`);
            messages.push(new ToolMessage({ content: `Error: ${errorMsg}`, tool_call_id: toolCall.id ?? "" }));
          }
        }
      }
    },
  };
}
