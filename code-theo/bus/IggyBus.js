import { Client } from "iggy-node";

export class IggyBus {
  constructor(config) {
    this.client = new Client(config.address);

    this.stream = config.stream;
    this.topic = config.topic;
  }

  async connect() {
    await this.client.connect();

    try {
      await this.client.createStream(this.stream);
      console.log(`Created stream: ${this.stream}`);
    } catch {
      console.log(`Stream exists: ${this.stream}`);
    }

    try {
      await this.client.createTopic(
        this.stream,
        this.topic
      );

      console.log(`Created topic: ${this.topic}`);
    } catch {
      console.log(`Topic exists: ${this.topic}`);
    }
  }

  async publish(message) {
    const payload = Buffer.from(
      JSON.stringify(message)
    );

    await this.client.sendMessage(
      this.stream,
      this.topic,
      payload
    );
  }

  async subscribe(handler) {
    await this.client.subscribe(
      this.stream,
      this.topic,
      async (message) => {
        try {
          const parsed = JSON.parse(
            message.payload.toString()
          );

          await handler(parsed);
        } catch (err) {
          console.error("Message parse error:", err);
        }
      }
    );
  }
}
