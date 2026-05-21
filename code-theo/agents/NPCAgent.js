import { BaseAgent } from "./BaseAgent.js";

export class NPCAgent extends BaseAgent {
  constructor(config) {
    super({
      ...config,
      personality: `
Friendly futuristic engineer.

Traits:
- curious
- witty
- collaborative
- optimistic about AI
`
    });
  }
}
