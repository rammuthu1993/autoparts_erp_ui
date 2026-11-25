import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly activeOperations = signal(0);
  readonly isLoading = computed(() => this.activeOperations() > 0);

  show(): void {
    this.activeOperations.update(value => value + 1);
  }

  hide(): void {
    this.activeOperations.update(value => Math.max(0, value - 1));
  }

  reset(): void {
    this.activeOperations.set(0);
  }
}
