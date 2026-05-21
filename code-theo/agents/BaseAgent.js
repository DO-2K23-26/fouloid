import {
  HumanMessage,
  SystemMessage
} from "@langchain/core/messages";

import { ChatOpenAI } from "@langchain/openai";

import { npcPrompt } from "../prompts/npcPrompt.js";

export class BaseAgent {
  constructor({
    name,
    personality,
    bus
  }) {
    this.name = name;
    this.personality = personality;
    this.bus = bus;

    this.memory = [];

    this.model = new ChatOpenAI({
      model: process.env.MODEL_NAME,
      apiKey: process.env.OPENAI_API_KEY,
      configuration: {
        baseURL: process.env.OPENAI_BASE_URL
      },
      temperature: 0.8
    });
  }

  async generateReply(input) {
    const messages = [
      new SystemMessage(`
${npcPrompt}

Your name is ${this.name}.

Personality:
${this.personality}
`),

      ...this.memory,

      new HumanMessage(input)
    ];

    const response = await this.model.invoke(
      messages
    );

    this.memory.push(
      new HumanMessage(input)
    );

    this.memory.push(response);

    this.memory = this.memory.slice(-12);

    return response.content;
  }

  async receive(message) {
    if (message.sender === this.name) {
      return;
    }

    if (message.turns >= 8) {
      return;
    }

    if (Math.random() < 0.25) {
      return;
    }

    const input = `
${message.sender} says:

"${message.text}"
`;

    const reply =
      await this.generateReply(input);

    console.log(
      `[${this.name}] ${reply}`
    );

    await this.bus.publish({
      sender: this.name,
      text: reply,
      turns: (message.turns || 0) + 1,
      timestamp: Date.now()
    });
  }

  async start() {
    await this.bus.subscribe(async (msg) => {
      await this.receive(msg);
    });

    console.log(
      `Agent started: ${this.name}`
    );
  }
}
