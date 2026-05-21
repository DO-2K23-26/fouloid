import { ChatOpenAI } from "@langchain/openai";
import { pathToFileURL } from "node:url";
import { createLangChainAgentRuntime } from "./agent/runtime.js";
import { createIggyConnection } from "./iggy/connection.js";
import { createIggyMessenger } from "./iggy/messenger.js";
import type { AgentAppConfig } from "./types/agent.js";

export async function startApplication(
  config: AgentAppConfig
) {
  const client = await createIggyConnection(config);
  const messenger = createIggyMessenger(
    client,
    config.topics
  );
  const model = new ChatOpenAI({
    apiKey: config.openAI.apiKey,
    model: config.openAI.model,
    configuration: config.openAI.baseURL
      ? { baseURL: config.openAI.baseURL }
      : undefined
  });

  const agent = createLangChainAgentRuntime({
    agentName: config.agentName,
    model,
    messenger,
    systemPrompt: config.systemPrompt
  });

  await messenger.subscribe(async (message) => {
    if (message.sender === config.agentName) {
      return;
    }

    console.log(
      `[${config.agentName}] received from ${message.sender}: ${message.text}`
    );

    await agent.handleMessage(message);
  });

  console.log(
    `Agent "${config.agentName}" listening on ${config.topics.inputTopic} and publishing to ${config.topics.outputTopic}`
  );
}

export function getConfigFromEnv(): AgentAppConfig {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const iggyAddress =
    process.env.IGGY_ADDRESS ?? "127.0.0.1:8090";
  const stream = process.env.IGGY_STREAM ?? "agents";
  const inputTopic =
    process.env.IGGY_INPUT_TOPIC ?? "agent-input";
  const outputTopic =
    process.env.IGGY_OUTPUT_TOPIC ?? "agent-output";
  const agentName =
    process.env.AGENT_NAME ?? "langchain-agent";

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is required to start the application."
    );
  }

  return {
    agentName,
    iggyAddress,
    topics: {
      stream,
      inputTopic,
      outputTopic
    },
    openAI: {
      apiKey,
      model,
      baseURL: process.env.OPENAI_BASE_URL
    },
    systemPrompt: process.env.AGENT_SYSTEM_PROMPT
  };
}

async function main() {
  await startApplication(getConfigFromEnv());
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error("Application failed to start", error);
    process.exitCode = 1;
  });
}
