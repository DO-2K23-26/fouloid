import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { createLangChainAgentRuntime } from "../agent/runtime.js";
import { verifyIncomingMessage } from "../crypto/identity.js";
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

  await startHealthServer(config.healthPort, {
    agentName: config.agentName,
    startedAt
  });

  const { client, clientConfig } = await createIggyConnection(config);
  const messenger = createIggyMessenger(
    client,
    clientConfig,
    config.topics,
    config.agentName,
    config.identity
  );
  function buildModel(cfg: typeof config.openAI) {
    return new ChatOpenAI({
      apiKey: cfg.apiKey,
      model: cfg.model,
      configuration: cfg.baseURL ? { baseURL: cfg.baseURL } : undefined
    });
  }

  const codingModel = buildModel(config.openAI);
  const reasoningModel = config.reasoningModel
    ? buildModel(config.reasoningModel)
    : codingModel;

  console.log(`[app] probing coding model ${config.openAI.model}...`);
  try {
    await codingModel.invoke([new HumanMessage("ping")]);
  } catch (error) {
    await client.destroy().catch(() => { });
    const reason =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Model "${config.openAI.model}" probe failed: ${reason}`,
      { cause: error instanceof Error ? error : undefined }
    );
  }
  console.log(`[app] coding model probe ok`);

  if (config.reasoningModel) {
    console.log(`[app] probing reasoning model ${config.reasoningModel.model}...`);
    try {
      await reasoningModel.invoke([new HumanMessage("ping")]);
    } catch (error) {
      await client.destroy().catch(() => { });
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Reasoning model "${config.reasoningModel.model}" probe failed: ${reason}`,
        { cause: error instanceof Error ? error : undefined }
      );
    }
    console.log(`[app] reasoning model probe ok`);
  }

  const runtime = createLangChainAgentRuntime({
    agentName: config.agentName,
    codingModel,
    reasoningModel,
    messenger,
    systemPrompt: config.systemPrompt
  });

  await messenger.subscribe(async (message) => {
    if (message.sender === config.agentName) {
      console.log(`[app] skipping echo of own message id=${message.id}`);
      return;
    }

    if (config.identity) {
      const result = verifyIncomingMessage(config.identity.platformPublicKey, message);
      if (!result.valid) {
        console.warn(`[security] rejected message id=${message.id} from ${message.sender}: ${result.reason}`);
        return;
      }
    }

    console.log(
      `[app] received id=${message.id} from ${message.sender}: ${message.text}`
    );

    await runtime.handleMessage(message);
  });

  console.log(
    `[app] "${config.agentName}" ready — listening on ${config.topics.inputTopic}, publishing to ${config.topics.outputTopic}`
  );

  if (config.kickoff) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    console.log(`[app] kickoff: processing id=${id} "${config.kickoff}"`);
    await runtime.handleMessage({
      id,
      sender: "system",
      text: config.kickoff,
      timestamp: Date.now()
    });
  }
}
