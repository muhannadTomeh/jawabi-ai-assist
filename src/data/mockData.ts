// Jawabi MVP Mock Data
import type { User, Chatbot, KnowledgeItem, Channel, HandoverSettings, AnalyticsSummary } from '@/types';

export const mockUser: User = {
  id: 'user-1',
  email: 'sarah@company.com',
  name: 'Sarah Johnson',
  createdAt: new Date('2024-01-15'),
  role: 'user',
};

export const mockChatbot: Chatbot = {
  id: 'bot-1',
  userId: 'user-1',
  name: 'Support Assistant',
  language: 'English',
  tone: 'professional',
  fallbackMessage: "I'm sorry, I couldn't understand your question. A team member will assist you shortly.",
  isActive: true,
  createdAt: new Date('2024-01-20'),
  updatedAt: new Date('2024-02-01'),
};

export const mockKnowledgeItems: KnowledgeItem[] = [
  {
    id: 'kb-1',
    chatbotId: 'bot-1',
    type: 'faq',
    title: 'Business Hours',
    question: 'What are your business hours?',
    answer: 'We are open Monday to Friday, 9 AM to 6 PM EST.',
    createdAt: new Date('2024-01-21'),
  },
  {
    id: 'kb-2',
    chatbotId: 'bot-1',
    type: 'faq',
    title: 'Refund Policy',
    question: 'What is your refund policy?',
    answer: 'We offer a 30-day money-back guarantee on all products.',
    createdAt: new Date('2024-01-21'),
  },
  {
    id: 'kb-3',
    chatbotId: 'bot-1',
    type: 'text',
    title: 'Company Overview',
    content: 'We are a leading provider of digital solutions, helping businesses transform their operations through innovative technology.',
    createdAt: new Date('2024-01-22'),
  },
  {
    id: 'kb-4',
    chatbotId: 'bot-1',
    type: 'file',
    title: 'Product Catalog',
    fileName: 'product-catalog-2024.pdf',
    fileUrl: '/files/product-catalog.pdf',
    createdAt: new Date('2024-01-25'),
  },
];

export const mockChannels: Channel[] = [
  {
    id: 'ch-1',
    chatbotId: 'bot-1',
    platform: 'telegram',
    isConnected: true,
    config: { botToken: '****' },
    createdAt: new Date('2024-01-22'),
  },
  {
    id: 'ch-2',
    chatbotId: 'bot-1',
    platform: 'messenger',
    isConnected: false,
    createdAt: new Date('2024-01-22'),
  },
];

export const mockHandoverSettings: HandoverSettings = {
  id: 'hs-1',
  chatbotId: 'bot-1',
  enabled: true,
  triggerOnLowConfidence: true,
  lowConfidenceThreshold: 0.5,
  triggerKeywords: ['human', 'agent', 'support', 'help'],
  failedResponsesThreshold: 3,
  handoverMessage: 'I\'m connecting you with a team member who can better assist you. Please wait a moment.',
};

export const mockAnalytics: AnalyticsSummary = {
  id: 'an-1',
  chatbotId: 'bot-1',
  period: 'week',
  totalMessages: 1247,
  handovers: 43,
  topQuestions: [
    { question: 'What are your business hours?', count: 156 },
    { question: 'How do I reset my password?', count: 134 },
    { question: 'What is your refund policy?', count: 98 },
    { question: 'How can I contact support?', count: 87 },
    { question: 'Do you offer free shipping?', count: 72 },
  ],
  topTopics: [
    { topic: 'Account', count: 312 },
    { topic: 'Billing', count: 278 },
    { topic: 'Products', count: 245 },
    { topic: 'Shipping', count: 189 },
    { topic: 'Returns', count: 156 },
  ],
  channelUsage: [
    { channel: 'Telegram', count: 756 },
    { channel: 'Messenger', count: 491 },
  ],
};
