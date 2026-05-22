import type { ChatOpenAI } from "@langchain/openai";
import type { AgentMessage, IggyMessenger } from "../types/agent.js";
import { invokeFunctionTool } from "./tools/invoke-function.js";
import { createFunctionTool } from "./tools/create-function.js";
import { listFunctionsTool } from "./tools/list-function.js";

const DEFAULT_SYSTEM_PROMPT = [
  "You are a queue-driven LangChain agent.",
  "Reply briefly and clearly.",
  "Treat each incoming queue message as the latest user input.",
  "If a message asks you to tell another agent to do something, reply with the actionable instruction itself instead of a short acknowledgement.",
].join(" ");

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTextContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return String(content ?? "");
}

export function createLangChainAgentRuntime({
  agentName,
  model,
  messenger,
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
}: {
  agentName: string;
  model: ChatOpenAI;
  messenger: IggyMessenger;
  systemPrompt?: string;
}) {
  return {
    async handleMessage(message: AgentMessage) {
      console.log(
        `[agent] invoking model for id=${message.id} (${message.text.length} chars in)`,
      );
      const startedAt = Date.now();

      const tools = [invokeFunctionTool, createFunctionTool, listFunctionsTool];
      const modelWithTools = model.bindTools(tools);

      const messages: Array<{
        role: string;
        content: string;
        tool_call_id?: string;
      }> = [
        {
          role: "user",
          content: systemPrompt + "\n\n" + message.text,
        },
      ];

      let shouldContinue = true;

      while (shouldContinue) {
        const response = await modelWithTools.invoke(messages);

        if (!response.tool_calls || response.tool_calls.length === 0) {
          // No more tool calls, extract final response
          const text =
            typeof response.content === "string"
              ? response.content
              : normalizeTextContent(response.content);

          const elapsedMs = Date.now() - startedAt;
          console.log(
            `[agent] model replied in ${elapsedMs}ms (${text.length} chars out)`,
          );

          await messenger.send({
            id: createMessageId(),
            sender: agentName,
            text,
            timestamp: Date.now(),
            replyTo: message.id,
          });

          shouldContinue = false;
          break;
        }

        // Add assistant message with tool calls
        messages.push({
          role: "assistant",
          content:
            typeof response.content === "string"
              ? response.content
              : normalizeTextContent(response.content),
        });

        // Process tool calls
        for (const toolCall of response.tool_calls) {
          console.log(`[agent] executing tool: ${toolCall.name}`);

          const tool = tools.find((t) => t.name === toolCall.name) as any;
          if (!tool) {
            console.error(`[agent] tool not found: ${toolCall.name}`);
            continue;
          }

          try {
            const toolResult = await tool.invoke(toolCall.args);
            console.log(
              `[agent] tool ${toolCall.name} returned: ${String(toolResult).substring(0, 100)}`,
            );

            messages.push({
              role: "tool",
              content: String(toolResult),
              tool_call_id: toolCall.id,
            });
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            console.error(`[agent] tool ${toolCall.name} failed: ${errorMsg}`);
            messages.push({
              role: "tool",
              content: `Error: ${errorMsg}`,
              tool_call_id: toolCall.id,
            });
          }
        }
      }
    },
  };
}
