import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardSummary, InventoryStock } from '../../models/dashboard.model';
import { AppIconComponent } from '../../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, AppIconComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  private readonly dashboardService = inject(DashboardService);

  private readonly today = new Date();
  readonly fromDate = signal(this.toDateInput(new Date(this.today.getFullYear(), this.today.getMonth(), 1)));
  readonly toDate = signal(this.toDateInput(this.today));

  readonly summary = signal<DashboardSummary | null>(null);
  readonly lowStockItems = signal<InventoryStock[]>([]);
  readonly lowStockTotal = signal(0);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly lowStockError = signal<string | null>(null);
  readonly lastUpdated = signal<Date | null>(null);

  readonly sales = computed(() => this.summary()?.sales ?? null);
  readonly purchases = computed(() => this.summary()?.purchases ?? null);
  readonly expenses = computed(() => this.summary()?.expenses ?? null);

  readonly collectionChannels = computed(() => {
    const sales = this.sales();
    if (!sales) return [];
    const entries = [
      { label: 'Cash', value: sales.cashCollections },
      { label: 'UPI', value: sales.upiCollections },
      { label: 'Card', value: sales.cardCollections },
      { label: 'Bank', value: sales.bankCollections },
      { label: 'Credit', value: sales.creditCollections }
    ];
    const total = entries.reduce((sum, item) => sum + (item.value || 0), 0);
    return entries.map(item => ({
      ...item,
      percent: total > 0 ? Math.round((item.value / total) * 100) : 0
    }));
  });

  readonly purchaseChannels = computed(() => {
    const purchases = this.purchases();
    if (!purchases) return [];
    const entries = [
      { label: 'Cash', value: purchases.cashPayments },
      { label: 'UPI', value: purchases.upiPayments },
      { label: 'Card', value: purchases.cardPayments },
      { label: 'Bank', value: purchases.bankPayments }
    ];
    const total = entries.reduce((sum, item) => sum + (item.value || 0), 0);
    return entries.map(item => ({
      ...item,
      percent: total > 0 ? Math.round((item.value / total) * 100) : 0
    }));
  });

  constructor() {
    this.loadDashboard();
  }

  onFromDateChange(event: Event): void {
    this.fromDate.set((event.target as HTMLInputElement).value);
  }

  onToDateChange(event: Event): void {
    this.toDate.set((event.target as HTMLInputElement).value);
  }

  loadDashboard(): void {
    if (!this.fromDate() || !this.toDate() || this.fromDate() > this.toDate()) {
      this.errorMessage.set('Choose a valid date range. Start date must be before end date.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.lowStockError.set(null);

    this.dashboardService.getSummary(this.fromDate(), this.toDate()).subscribe({
      next: summary => {
        this.summary.set(summary);
        this.lastUpdated.set(new Date());
        this.loading.set(false);
      },
      error: error => {
        this.loading.set(false);
        this.errorMessage.set(
          error?.error?.message ??
          'Dashboard summary could not be loaded. Check the backend connection and your access permissions.'
        );
      }
    });

    // Inventory is a separate endpoint. Its failure must not hide the
    // sales, purchase and expense summary.
    this.dashboardService.getLowStock().subscribe({
      next: response => {
        this.lowStockItems.set(response.content ?? []);
        this.lowStockTotal.set(response.totalElements ?? 0);
        this.lowStockError.set(null);
      },
      error: error => {
        this.lowStockItems.set([]);
        this.lowStockTotal.set(0);
        this.lowStockError.set(
          error?.error?.message ?? 'Low-stock information is temporarily unavailable.'
        );
      }
    });
  }

  private toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
