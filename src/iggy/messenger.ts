import {
  type Client,
  type ClientConfig,
  PollingStrategy,
  groupConsumerStream
} from "apache-iggy";
import type {
  AgentIdentityConfig,
  AgentMessage,
  IggyMessenger,
  IggyTopicsConfig
} from "../types/agent.js";
import { signMessage } from "../crypto/identity.js";
import { log } from "../logger.js";

type PollResponse = Awaited<ReturnType<Client["message"]["poll"]>>;

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createIggyMessenger(
  client: Client,
  clientConfig: ClientConfig,
  topics: IggyTopicsConfig,
  consumerGroup: string,
  identity?: AgentIdentityConfig
): IggyMessenger {
  function prepare(message: AgentMessage): AgentMessage {
    return identity ? signMessage(identity, message) : message;
  }

  return {
    async send(message) {
      const signed = prepare(message);
      await client.message.send({
        streamId: topics.stream,
        topicId: topics.outputTopic,
        messages: [{ payload: JSON.stringify(signed) }]
      });
      console.log(
        `[iggy] sent id=${message.id} to ${topics.outputTopic} (${message.text.length} chars)`
      );
      log.info({
        action: "iggy_send",
        message_id: message.id,
        to: topics.outputTopic,
        reply_to: message.replyTo,
        text: message.text,
      });
    },

    async inject(message) {
      const signed = prepare(message);
      await client.message.send({
        streamId: topics.stream,
        topicId: topics.inputTopic,
        messages: [{ payload: JSON.stringify(signed) }]
      });
      console.log(
        `[iggy] injected id=${message.id} to ${topics.inputTopic} (${message.text.length} chars)`
      );
    },

    async subscribe(handler) {
      console.log(
        `[iggy] subscribing to ${topics.stream}/${topics.inputTopic} as group "${consumerGroup}"`
      );
      const stream = await groupConsumerStream(clientConfig)({
        groupName: consumerGroup,
        streamId: topics.stream,
        topicId: topics.inputTopic,
        pollingStrategy: PollingStrategy.Next,
        count: 10,
        autocommit: true
      });

      void (async () => {
        for await (const response of stream as AsyncIterable<PollResponse>) {
          if (response.messages.length > 0) {
            console.log(
              `[iggy] polled ${response.messages.length} message(s) from ${topics.inputTopic} (offset=${response.currentOffset})`
            );
          }
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
                  : undefined,
              certificate:
                typeof parsed.certificate === "string"
                  ? parsed.certificate
                  : undefined,
              signature:
                typeof parsed.signature === "string"
                  ? parsed.signature
                  : undefined,
            });
          }
        }
      })().catch((error) => {
        console.error("Consumer stream loop failed", error);
      });
    }
  };
}
