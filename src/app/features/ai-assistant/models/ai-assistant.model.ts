export interface AiChatRequest {
  conversationId: string | null;
  message: string;
}

export interface AiChatResponse {
  conversationId: string;
  response: string;
  timestamp: string;
}

export interface AiConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  id: number;
  role: 'USER' | 'ASSISTANT' | string;
  content: string;
  createdAt: string;
}

export interface AiConversationMessagesResponse {
  conversationId: string;
  messages: AiMessage[];
}

export interface AiPageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
