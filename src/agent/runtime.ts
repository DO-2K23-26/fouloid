import type { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { log } from "../logger.js";
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
      let activeModelName = "reasoning";
      let turn = 0;
      const MAX_TURNS = 30;

      while (shouldContinue) {
        if (++turn > MAX_TURNS) {
          console.error(`[agent] exceeded ${MAX_TURNS} turns for id=${message.id}, aborting`);
          break;
        }

        console.log(`[agent] → model=${activeModelName} turn=${turn}/${MAX_TURNS} history=${messages.length}`);
        const llmStart = Date.now();
        log.info({ action: "llm_call", model: activeModelName, turn, history_len: messages.length });
        const response = await activeModel.invoke(messages);
        log.info({ action: "llm_response", model: activeModelName, turn, latency_ms: Date.now() - llmStart, tool_calls_count: response.tool_calls?.length ?? 0, first_tool: response.tool_calls?.[0]?.name ?? null });

        const responseText = normalizeTextContent(response.content);
        if (responseText) {
          console.log(`[agent] ← text: ${responseText.substring(0, 200)}`);
        }

        // No tool calls — treat content as final response (fallback for non-required models)
        if (!response.tool_calls || response.tool_calls.length === 0) {
          const elapsedMs = Date.now() - startedAt;
          console.log(`[agent] model replied in ${elapsedMs}ms (${responseText.length} chars out)`);
          await messenger.send({ id: createMessageId(), sender: agentName, text: responseText, timestamp: Date.now(), replyTo: message.id });
          shouldContinue = false;
          break;
        }

        if (response.tool_calls.length > 1) {
          console.warn(`[agent] model returned ${response.tool_calls.length} tool calls despite parallel_tool_calls=false — executing all sequentially`);
        }

        messages.push(response);

        // Pick model for next turn based on the first tool being called
        const nextToolName = response.tool_calls[0]?.name ?? "";
        activeModelName = CODING_TOOLS.has(nextToolName) ? "coding" : "reasoning";
        activeModel = activeModelName === "coding" ? codingWithTools : reasoningWithTools;

        for (const toolCall of response.tool_calls) {
          console.log(`[agent] ← tool_call: ${toolCall.name}(${JSON.stringify(toolCall.args).substring(0, 300)})`);

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
            console.log(`[agent] executing tool: ${toolCall.name}`);
            const toolStart = Date.now();
            const toolResult = await t.invoke(toolCall.args);
            const toolLatency = Date.now() - toolStart;
            const resultStr = String(toolResult);
            console.log(`[agent] tool ${toolCall.name} returned: ${resultStr.substring(0, 500)}`);
            log.info({
              action: "tool_call",
              turn,
              tool: toolCall.name,
              args: toolCall.args,
              result: resultStr.substring(0, 2000),
              latency_ms: toolLatency,
            });
            messages.push(new ToolMessage({ content: resultStr, tool_call_id: toolCall.id ?? "" }));
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[agent] tool ${toolCall.name} failed: ${errorMsg}`);
            log.error({ action: "tool_error", turn, tool: toolCall.name, args: toolCall.args, error: errorMsg });
            messages.push(new ToolMessage({ content: `Error: ${errorMsg}`, tool_call_id: toolCall.id ?? "" }));
          }
        }
      }
    },
  };
}
