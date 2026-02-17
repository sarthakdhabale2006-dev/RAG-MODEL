
export enum AppMode {
  CHAT = 'chat',
  LIVE = 'live',
  GENERATE = 'generate',
  ANALYST = 'analyst',
  RAG = 'rag'
}

export type AgentRole = 'general' | 'analyst' | 'coder' | 'researcher';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'image' | 'video' | 'analysis' | 'error';
  mediaUrl?: string;
  isThinking?: boolean;
  groundingSources?: any[];
  analysisData?: any; // For chart/table data
}

export interface RAGFile {
  id: string;
  name: string;
  content: string;
  type: string;
  status: 'indexing' | 'ready';
}

export interface UserPreferences {
  theme: 'dark' | 'light';
  mode: AppMode;
  thinkingEnabled: boolean;
  activeRole: AgentRole;
}

export interface GenerationConfig {
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  imageSize?: "1K" | "2K" | "4K";
}
