import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api/api-config';
import {
  AiChatRequest, AiChatResponse, AiConversation, AiConversationMessagesResponse,
  AiPageResponse
} from '../models/ai-assistant.model';

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/api/v1/ai`;

  chat(request: AiChatRequest): Observable<AiChatResponse> {
    return this.http.post<AiChatResponse>(`${this.baseUrl}/chat`, request);
  }

  getConversations(page = 0, size = 20): Observable<AiPageResponse<AiConversation>> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sortBy', 'updatedAt')
      .set('sortDir', 'desc');
    return this.http.get<AiPageResponse<AiConversation>>(`${this.baseUrl}/conversations/paged`, { params });
  }

  getMessages(conversationId: string): Observable<AiConversationMessagesResponse> {
    return this.http.get<AiConversationMessagesResponse>(
      `${this.baseUrl}/conversations/${conversationId}/messages`
    );
  }

  renameConversation(conversationId: string, title: string): Observable<AiConversation> {
    return this.http.patch<AiConversation>(
      `${this.baseUrl}/conversations/${conversationId}/title`, { title }
    );
  }

  archiveConversation(conversationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/conversations/${conversationId}`);
  }

  cancel(conversationId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/conversations/${conversationId}/cancel`, {});
  }
}
