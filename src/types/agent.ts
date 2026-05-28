export interface FouloidCertificate {
  agentName: string;
  publicKey: string;
  issuedAt: number;
  expiresAt: number;
  platformSignature: string;
}

export interface AgentIdentityConfig {
  privateKey: string;
  certificate: string;
  platformPublicKey: string;
}

export interface AgentMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  replyTo?: string;
  certificate?: string;
  signature?: string;
}

export interface IggyTopicsConfig {
  stream: string;
  inputTopic: string;
  outputTopic: string;
}

export interface ModelConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
}

export interface AgentAppConfig {
  agentName: string;
  iggyAddress: string;
  iggyUsername: string;
  iggyPassword: string;
  topics: IggyTopicsConfig;
  openAI: ModelConfig;
  reasoningModel?: ModelConfig;
  systemPrompt?: string;
  healthPort: number;
  kickoff?: string;
  identity?: AgentIdentityConfig;
}

export interface IggyMessenger {
  send(message: AgentMessage): Promise<void>;
  inject(message: AgentMessage): Promise<void>;
  subscribe(
    handler: (message: AgentMessage) => Promise<void>
  ): Promise<void>;
}
