import type {
  AgentAppConfig,
  IggyClient
} from "../types/agent.js";

function isAlreadyExistsError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const details = [error.name, error.message]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return (
    details.includes("already exists") ||
    details.includes("alreadyexist") ||
    details.includes("stream exists") ||
    details.includes("topic exists")
  );
}

async function ensureTopic(
  client: IggyClient,
  stream: string,
  topic: string
) {
  try {
    await client.createTopic(stream, topic);
    console.log(`Created topic: ${topic}`);
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }

    console.log(`Topic exists: ${topic}`);
  }
}

async function loadIggyClient(address: string) {
  let Client: new (address: string) => IggyClient;

  try {
    // @ts-expect-error iggy-node is expected to be provided at runtime.
    ({ Client } = await import("iggy-node"));
  } catch (error) {
    throw new Error(
      `Unable to load "iggy-node". Install or link an Iggy client package before starting the app. Original error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  try {
    return new Client(address);
  } catch (error) {
    throw new Error(
      `Failed to initialize Iggy client for address "${address}". Original error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function createIggyConnection(
  config: Pick<AgentAppConfig, "iggyAddress" | "topics">
) {
  const client = await loadIggyClient(config.iggyAddress);

  await client.connect();

  try {
    await client.createStream(config.topics.stream);
    console.log(`Created stream: ${config.topics.stream}`);
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }

    console.log(`Stream exists: ${config.topics.stream}`);
  }

  await ensureTopic(
    client,
    config.topics.stream,
    config.topics.inputTopic
  );
  await ensureTopic(
    client,
    config.topics.stream,
    config.topics.outputTopic
  );

  return client;
}
