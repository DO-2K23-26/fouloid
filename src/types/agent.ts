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
  topics: IggyTopicsConfig;
  openAI: {
    apiKey: string;
    model: string;
    baseURL?: string;
  };
  systemPrompt?: string;
}

export interface IggyMessenger {
  send(message: AgentMessage): Promise<void>;
  subscribe(
    handler: (message: AgentMessage) => Promise<void>
  ): Promise<void>;
}

export interface IggyMessagePayload {
  payload: Buffer;
}

export interface IggyClient {
  connect(): Promise<void>;
  createStream(stream: string): Promise<void>;
  createTopic(stream: string, topic: string): Promise<void>;
  sendMessage(
    stream: string,
    topic: string,
    payload: Buffer
  ): Promise<void>;
  subscribe(
    stream: string,
    topic: string,
    handler: (message: IggyMessagePayload) => Promise<void>
  ): Promise<void>;
}
