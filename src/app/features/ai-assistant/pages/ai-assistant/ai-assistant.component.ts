import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AiAssistantService } from '../../services/ai-assistant.service';
import { AiConversation, AiMessage } from '../../models/ai-assistant.model';

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiAssistantComponent implements OnInit {
  private readonly ai = inject(AiAssistantService);

  readonly conversations = signal<AiConversation[]>([]);
  readonly historyOpen = signal(false);
  readonly messages = signal<AiMessage[]>([]);
  readonly draft = signal('');
  readonly activeConversationId = signal<string | null>(null);
  readonly loadingHistory = signal(false);
  readonly loadingMessages = signal(false);
  readonly sending = signal(false);
  readonly cancelling = signal(false);
  readonly errorMessage = signal('');
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly totalConversations = signal(0);

  readonly suggestions = [
    'Which products are running low on stock?',
    'Show the current stock of GAP-000001',
    'What were our sales this month?',
    'Which customers have outstanding balances?',
    'Show recent purchase orders',
    'Compare sales and purchases for this month'
  ];

  ngOnInit(): void {
    this.loadConversations();
  }

  toggleHistory(): void { this.historyOpen.update(open => !open); }

  loadConversations(page = 0): void {
    this.loadingHistory.set(true);
    this.ai.getConversations(page).subscribe({
      next: result => {
        this.conversations.set(result.content ?? []);
        this.page.set(result.page ?? 0);
        this.totalPages.set(result.totalPages ?? 0);
        this.totalConversations.set(result.totalElements ?? 0);
        this.loadingHistory.set(false);
      },
      error: error => {
        this.loadingHistory.set(false);
        this.showError(error, 'Unable to load conversation history.');
      }
    });
  }

  newConversation(): void {
    this.historyOpen.set(false);
    this.activeConversationId.set(null);
    this.messages.set([]);
    this.draft.set('');
    this.errorMessage.set('');
  }

  openConversation(conversation: AiConversation): void {
    if (this.sending()) return;
    this.historyOpen.set(false);
    this.activeConversationId.set(conversation.id);
    this.messages.set([]);
    this.errorMessage.set('');
    this.loadingMessages.set(true);
    this.ai.getMessages(conversation.id).subscribe({
      next: result => {
        this.messages.set(result.messages ?? []);
        this.loadingMessages.set(false);
      },
      error: error => {
        this.loadingMessages.set(false);
        this.showError(error, 'Unable to load this conversation.');
      }
    });
  }

  useSuggestion(value: string): void {
    this.draft.set(value);
    this.sendMessage();
  }

  sendMessage(): void {
    const message = this.draft().trim();
    if (!message || this.sending()) return;
    if (message.length > 8000) {
      this.errorMessage.set('Your message cannot exceed 8,000 characters.');
      return;
    }

    const optimistic: AiMessage = {
      id: Date.now(),
      role: 'USER',
      content: message,
      createdAt: new Date().toISOString()
    };
    this.messages.update(items => [...items, optimistic]);
    this.draft.set('');
    this.errorMessage.set('');
    this.sending.set(true);

    this.ai.chat({
      conversationId: this.activeConversationId(),
      message
    }).subscribe({
      next: response => {
        this.activeConversationId.set(response.conversationId);
        const answer: AiMessage = {
          id: Date.now() + 1,
          role: 'ASSISTANT',
          content: response.response || 'The assistant returned an empty response. Please try again.',
          createdAt: response.timestamp || new Date().toISOString()
        };
        this.messages.update(items => [...items, answer]);
        this.sending.set(false);
        this.loadConversations();
      },
      error: error => {
        this.sending.set(false);
        this.showError(error, 'The AI request could not be completed.');
        this.messages.update(items => items.filter(item => item.id !== optimistic.id));
        this.draft.set(message);
      }
    });
  }

  cancelGeneration(): void {
    const id = this.activeConversationId();
    if (!id) {
      this.errorMessage.set('This new conversation is still being created. Cancellation becomes available after the server returns its conversation ID.');
      return;
    }
    if (!id || !this.sending() || this.cancelling()) return;
    this.cancelling.set(true);
    this.ai.cancel(id).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.sending.set(false);
      },
      error: error => {
        this.cancelling.set(false);
        this.showError(error, 'The request could not be cancelled.');
      }
    });
  }

  renameConversation(conversation: AiConversation, event: Event): void {
    event.stopPropagation();
    const title = window.prompt('Enter a new conversation title', conversation.title)?.trim();
    if (!title || title === conversation.title) return;
    if (title.length > 200) {
      this.errorMessage.set('Conversation title cannot exceed 200 characters.');
      return;
    }
    this.ai.renameConversation(conversation.id, title).subscribe({
      next: updated => {
        this.conversations.update(items => items.map(item => item.id === updated.id ? updated : item));
      },
      error: error => this.showError(error, 'Unable to rename conversation.')
    });
  }

  archiveConversation(conversation: AiConversation, event: Event): void {
    event.stopPropagation();
    if (!window.confirm(`Archive "${conversation.title}"?`)) return;
    this.ai.archiveConversation(conversation.id).subscribe({
      next: () => {
        this.conversations.update(items => items.filter(item => item.id !== conversation.id));
        if (this.activeConversationId() === conversation.id) this.newConversation();
      },
      error: error => this.showError(error, 'Unable to archive conversation.')
    });
  }

  previousPage(): void {
    if (this.page() > 0) this.loadConversations(this.page() - 1);
  }

  nextPage(): void {
    if (this.page() + 1 < this.totalPages()) this.loadConversations(this.page() + 1);
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  trackMessage(_index: number, message: AiMessage): number { return message.id; }

  private showError(error: unknown, fallback: string): void {
    const httpError = error as HttpErrorResponse;
    const backendMessage = httpError?.error?.message || httpError?.error?.detail;
    if (httpError?.status === 403) {
      this.errorMessage.set('Your account does not have permission to use the AI Assistant (AI_ASSISTANT.USE).');
    } else if (httpError?.status === 429) {
      this.errorMessage.set('The AI service is busy or the request limit was reached. Please wait and try again.');
    } else if (httpError?.status === 409) {
      this.errorMessage.set('Another AI request is already running for this conversation.');
    } else {
      this.errorMessage.set(typeof backendMessage === 'string' ? backendMessage : fallback);
    }
  }
}
