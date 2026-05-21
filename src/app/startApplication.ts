import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { createLangChainAgentRuntime } from "../agent/runtime.js";
import { startHealthServer } from "../health/server.js";
import { createIggyConnection } from "../iggy/connection.js";
import { createIggyMessenger } from "../iggy/messenger.js";
import type { AgentAppConfig } from "../types/agent.js";

export async function startApplication(
  config: AgentAppConfig
) {
  console.log(
    `[app] starting "${config.agentName}" — model=${config.openAI.model}, iggy=${config.iggyAddress}, stream=${config.topics.stream}, in=${config.topics.inputTopic}, out=${config.topics.outputTopic}`
  );
  const startedAt = Date.now();

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

  console.log(`[app] probing model ${config.openAI.model}...`);
  try {
    await model.invoke([new HumanMessage("ping")]);
  } catch (error) {
    await client.destroy().catch(() => {});
    const reason =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Model "${config.openAI.model}" probe failed: ${reason}`,
      { cause: error instanceof Error ? error : undefined }
    );
  }
  console.log(`[app] model probe ok`);

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

  await startHealthServer(config.healthPort, {
    agentName: config.agentName,
    startedAt
  });

  console.log(
    `[app] "${config.agentName}" ready — listening on ${config.topics.inputTopic}, publishing to ${config.topics.outputTopic}`
  );
}
