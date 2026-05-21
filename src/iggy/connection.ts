import { Client, type ClientConfig } from "apache-iggy";
import type { AgentAppConfig } from "../types/agent.js";

function parseIggyAddress(address: string) {
  const [host, portPart] = address.split(":");
  const port = Number(portPart);

  if (!host || !Number.isFinite(port)) {
    throw new Error(
      `Invalid IGGY_ADDRESS "${address}". Expected format "host:port".`
    );
  }

  return { host, port };
}

export function createIggyClientConfig(
  config: Pick<
    AgentAppConfig,
    "iggyAddress" | "iggyUsername" | "iggyPassword"
  >
): ClientConfig {
  const { host, port } = parseIggyAddress(config.iggyAddress);

  return {
    transport: "TCP",
    options: { host, port },
    credentials: {
      username: config.iggyUsername,
      password: config.iggyPassword
    }
  };
}

export async function createIggyConnection(
  config: Pick<
    AgentAppConfig,
    "iggyAddress" | "iggyUsername" | "iggyPassword" | "topics"
  >
) {
  const clientConfig = createIggyClientConfig(config);
  const { host, port } = clientConfig.options as { host: string; port: number };

  console.log(`[iggy] connecting to ${host}:${port} as ${config.iggyUsername}`);
  const client = new Client(clientConfig);

  const stream = await client.stream.ensure(config.topics.stream);
  console.log(`[iggy] stream ready: ${stream.name} (id=${stream.id})`);

  const inputTopic = await client.topic.ensure(
    stream.id,
    config.topics.inputTopic,
    1
  );
  console.log(`[iggy] topic ready: ${inputTopic.name} (id=${inputTopic.id})`);

  const outputTopic = await client.topic.ensure(
    stream.id,
    config.topics.outputTopic,
    1
  );
  console.log(`[iggy] topic ready: ${outputTopic.name} (id=${outputTopic.id})`);

  return { client, clientConfig };
}
