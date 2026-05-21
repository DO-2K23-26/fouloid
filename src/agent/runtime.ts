import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import type {
  AgentMessage,
  IggyMessenger
} from "../types/agent.js";

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
      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(message.text)
      ]);

      const text = normalizeTextContent(response.content);

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
