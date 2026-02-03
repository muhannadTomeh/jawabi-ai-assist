// Jawabi MVP Data Types

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  role: 'user' | 'admin';
}

export interface Chatbot {
  id: string;
  userId: string;
  name: string;
  language: string;
  tone: 'professional' | 'friendly' | 'casual' | 'formal';
  fallbackMessage: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeItem {
  id: string;
  chatbotId: string;
  type: 'text' | 'faq' | 'file';
  title: string;
  content?: string;
  question?: string;
  answer?: string;
  fileName?: string;
  fileUrl?: string;
  createdAt: Date;
}

export interface Channel {
  id: string;
  chatbotId: string;
  platform: 'telegram' | 'messenger';
  isConnected: boolean;
  config?: Record<string, string>;
  createdAt: Date;
}

export interface HandoverSettings {
  id: string;
  chatbotId: string;
  enabled: boolean;
  triggerOnLowConfidence: boolean;
  lowConfidenceThreshold: number;
  triggerKeywords: string[];
  failedResponsesThreshold: number;
  handoverMessage: string;
}

export interface AnalyticsSummary {
  id: string;
  chatbotId: string;
  period: 'day' | 'week' | 'month';
  totalMessages: number;
  handovers: number;
  topQuestions: Array<{ question: string; count: number }>;
  topTopics: Array<{ topic: string; count: number }>;
  channelUsage: Array<{ channel: string; count: number }>;
}

export interface SystemLog {
  id: string;
  type: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
