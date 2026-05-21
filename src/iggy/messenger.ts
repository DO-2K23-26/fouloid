import {
  type Client,
  type ClientConfig,
  PollingStrategy,
  singleConsumerStream
} from "apache-iggy";
import type {
  AgentMessage,
  IggyMessenger,
  IggyTopicsConfig
} from "../types/agent.js";

type PollResponse = Awaited<ReturnType<Client["message"]["poll"]>>;

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createIggyMessenger(
  client: Client,
  clientConfig: ClientConfig,
  topics: IggyTopicsConfig
): IggyMessenger {
  return {
    async send(message) {
      await client.message.send({
        streamId: topics.stream,
        topicId: topics.outputTopic,
        messages: [{ payload: JSON.stringify(message) }]
      });
    },

    async subscribe(handler) {
      const stream = await singleConsumerStream(clientConfig)({
        streamId: topics.stream,
        topicId: topics.inputTopic,
        partitionId: 1,
        pollingStrategy: PollingStrategy.Next,
        count: 10,
        autocommit: true
      });

      void (async () => {
        for await (const response of stream as AsyncIterable<PollResponse>) {
          for (const polled of response.messages) {
            let parsed: Partial<AgentMessage>;

            try {
              parsed = JSON.parse(
                polled.payload.toString()
              ) as Partial<AgentMessage>;
            } catch (error) {
              console.error(
                "Failed to parse input topic message",
                error
              );
              continue;
            }

            if (
              typeof parsed.sender !== "string" ||
              typeof parsed.text !== "string"
            ) {
              console.error(
                "Ignoring invalid input message payload"
              );
              continue;
            }

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
              replyTo:
                typeof parsed.replyTo === "string"
                  ? parsed.replyTo
                  : undefined
            });
          }
        }
      })().catch((error) => {
        console.error("Consumer stream loop failed", error);
      });
    }
  };
}
