import type { AgentAppConfig } from "../types/agent.js";

export function getConfigFromEnv(): AgentAppConfig {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const iggyAddress =
    process.env.IGGY_ADDRESS ?? "127.0.0.1:8090";
  const iggyUsername = process.env.IGGY_USERNAME ?? "iggy";
  const iggyPassword = process.env.IGGY_PASSWORD ?? "iggy";
  const stream = process.env.IGGY_STREAM ?? "agents";
  const inputTopic =
    process.env.IGGY_INPUT_TOPIC ?? "agent-input";
  const outputTopic =
    process.env.IGGY_OUTPUT_TOPIC ?? "agent-output";
  const agentName =
    process.env.AGENT_NAME ?? "langchain-agent";
  const healthPortRaw = process.env.HEALTH_PORT ?? "8080";
  const healthPort = Number(healthPortRaw);

  if (!Number.isInteger(healthPort) || healthPort < 1 || healthPort > 65535) {
    throw new Error(
      `Invalid HEALTH_PORT "${healthPortRaw}". Expected an integer between 1 and 65535.`
    );
  }

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is required to start the application."
    );
  }

  const reasoningModel = process.env.REASONING_MODEL;
  const reasoningBaseURL = process.env.REASONING_BASE_URL;

  return {
    agentName,
    iggyAddress,
    iggyUsername,
    iggyPassword,
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
    reasoningModel: reasoningModel
      ? { apiKey, model: reasoningModel, baseURL: reasoningBaseURL }
      : undefined,
    systemPrompt: process.env.AGENT_SYSTEM_PROMPT,
    healthPort,
    kickoff: process.env.AGENT_KICKOFF
  };
}
