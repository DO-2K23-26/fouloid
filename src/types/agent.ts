export interface AgentMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  replyTo?: string;
}

export interface IggyTopicsConfig {
  stream: string;
  inputTopic: string;
  outputTopic: string;
}

export interface AgentAppConfig {
  agentName: string;
  iggyAddress: string;
  iggyUsername: string;
  iggyPassword: string;
  topics: IggyTopicsConfig;
  openAI: {
    apiKey: string;
    model: string;
    baseURL?: string;
  };
  systemPrompt?: string;
  healthPort: number;
}

export interface IggyMessenger {
  send(message: AgentMessage): Promise<void>;
  subscribe(
    handler: (message: AgentMessage) => Promise<void>
  ): Promise<void>;
}
