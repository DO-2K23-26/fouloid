import { ChatOpenAI } from "@langchain/openai";
import { createLangChainAgentRuntime } from "../agent/runtime.js";
import { createIggyConnection } from "../iggy/connection.js";
import { createIggyMessenger } from "../iggy/messenger.js";
import type { AgentAppConfig } from "../types/agent.js";

export async function startApplication(
  config: AgentAppConfig
) {
  console.log(
    `[app] starting "${config.agentName}" — model=${config.openAI.model}, iggy=${config.iggyAddress}, stream=${config.topics.stream}, in=${config.topics.inputTopic}, out=${config.topics.outputTopic}`
  );

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
      console.log(`[app] skipping echo of own message id=${message.id}`);
      return;
    }

    console.log(
      `[app] received id=${message.id} from ${message.sender}: ${message.text}`
    );

    await agent.handleMessage(message);
  });

  console.log(
    `[app] "${config.agentName}" ready — listening on ${config.topics.inputTopic}, publishing to ${config.topics.outputTopic}`
  );
}
