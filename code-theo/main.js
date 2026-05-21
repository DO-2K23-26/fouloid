import dotenv from "dotenv";

dotenv.config();

import { IggyBus } from "./bus/IggyBus.js";

import { NPCAgent } from "./agents/NPCAgent.js";

async function main() {
  const bus = new IggyBus({
    address: process.env.IGGY_ADDRESS,
    stream: process.env.IGGY_STREAM,
    topic: process.env.IGGY_TOPIC
  });

  await bus.connect();

  const alice = new NPCAgent({
    name: "Alice",
    bus
  });

  const bob = new NPCAgent({
    name: "Bob",
    bus
  });

  const charlie = new NPCAgent({
    name: "Charlie",
    bus
  });

  await alice.start();
  await bob.start();
  await charlie.start();

  await bus.publish({
    sender: "system",
    text: `
Discuss whether AI agents should
govern Mars colonies.
`,
    turns: 0,
    timestamp: Date.now()
  });

  console.log(
    "Initial conversation published."
  );
}

main().catch(console.error);
