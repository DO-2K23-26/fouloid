import { ChatOpenAI } from "@langchain/openai";
import { createLangChainAgentRuntime } from "../agent/runtime.js";
import { createIggyConnection } from "../iggy/connection.js";
import { createIggyMessenger } from "../iggy/messenger.js";
import type { AgentAppConfig } from "../types/agent.js";

export async function startApplication(
  config: AgentAppConfig
) {
  const { client, clientConfig } = await createIggyConnection(config);
  const messenger = createIggyMessenger(
    client,
    clientConfig,
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
