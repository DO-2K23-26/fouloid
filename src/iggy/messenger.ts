import type {
  AgentMessage,
  IggyClient,
  IggyMessagePayload,
  IggyMessenger,
  IggyTopicsConfig
} from "../types/agent.js";

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createIggyMessenger(
  client: IggyClient,
  topics: IggyTopicsConfig
): IggyMessenger {
  return {
    async send(message) {
      const payload = Buffer.from(JSON.stringify(message));

      await client.sendMessage(
        topics.stream,
        topics.outputTopic,
        payload
      );
    },

    async subscribe(handler) {
      await client.subscribe(
        topics.stream,
        topics.inputTopic,
        async (message: IggyMessagePayload) => {
          let parsed: Partial<AgentMessage>;

          try {
            parsed = JSON.parse(
              message.payload.toString()
            ) as Partial<AgentMessage>;
          } catch (error) {
            console.error(
              "Failed to parse input topic message",
              error
            );
            return;
          }

          if (
            typeof parsed.sender !== "string" ||
            typeof parsed.text !== "string"
          ) {
            console.error(
              "Ignoring invalid input message payload"
            );
            return;
          }

          const replyTo =
            typeof parsed.replyTo === "string"
              ? parsed.replyTo
              : undefined;

          await handler({
            id:
              typeof parsed.id === "string"
                ? parsed.id
                : createMessageId(),
            sender: parsed.sender,
            text: parsed.text,
            timestamp:
              typeof parsed.timestamp === "number"
                ? parsed.timestamp
                : Date.now(),
            replyTo
          });
        }
      );
    }
  };
}
