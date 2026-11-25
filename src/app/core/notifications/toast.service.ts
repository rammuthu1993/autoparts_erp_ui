import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<ToastMessage[]>([]);
  private sequence = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(message: string, title = 'Successfully completed'): void {
    this.show('success', title, message);
  }

  error(message: string, title = 'Something went wrong'): void {
    this.show('error', title, message);
  }

  info(message: string, title = 'Information'): void {
    this.show('info', title, message);
  }

  warning(message: string, title = 'Attention required'): void {
    this.show('warning', title, message);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
    this.messages.update(items => items.filter(item => item.id !== id));
  }

  private show(type: ToastType, title: string, message: string): void {
    const id = ++this.sequence;
    this.messages.update(items => [...items.slice(-3), { id, type, title, message }]);
    this.timers.set(id, setTimeout(() => this.dismiss(id), type === 'error' ? 6500 : 4200));
  }
}
