import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import type {
  AgentMessage,
  IggyMessenger
} from "../types/agent.js";
import { createAgent } from "langchain";
import { invokeFunctionTool } from "./tools/invoke-function.js";
import { createFunctionTool } from "./tools/create-function.js";
import { listFunctionsTool } from "./tools/list-function.js";

const DEFAULT_SYSTEM_PROMPT = [
  "You are a queue-driven LangChain agent.",
  "Reply briefly and clearly.",
  "Treat each incoming queue message as the latest user input."
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
  systemPrompt = DEFAULT_SYSTEM_PROMPT
}: {
  agentName: string;
  model: ChatOpenAI;
  messenger: IggyMessenger;
  systemPrompt?: string;
}) {
  return {
    async handleMessage(message: AgentMessage) {
      console.log(
        `[agent] invoking model for id=${message.id} (${message.text.length} chars in)`
      );
      const startedAt = Date.now();

      const agent = createAgent({
        model,
        tools: [invokeFunctionTool, createFunctionTool, listFunctionsTool],
      });

      const response = await agent.invoke(
        {
          messages: [{ role: "user", content: message.text }, { role: "system", content: systemPrompt }],
        },
        {
          configurable: { thread_id: crypto.randomUUID() },
          context: { user_name: "John Smith" },
        },
      )

      const text = normalizeTextContent(response.messages);
      const elapsedMs = Date.now() - startedAt;
      console.log(
        `[agent] model replied in ${elapsedMs}ms (${text.length} chars out)`
      );

      await messenger.send({
        id: createMessageId(),
        sender: agentName,
        text,
        timestamp: Date.now(),
        replyTo: message.id
      });
    }
  };
}
