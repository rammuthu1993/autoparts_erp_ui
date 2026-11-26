import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthStateService } from '../../../../core/auth/services/auth-state.service';
import { ToastService } from '../../../../core/notifications/toast.service';
import { CustomerLookup, PaymentMethod, ProductLookup, SaleResponse, SupplyType } from '../../models/sales.model';
import { SalesService } from '../../services/sales.service';

@Component({
  selector: 'app-sales-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './sales-page.component.html',
  styleUrl: './sales-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SalesPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(SalesService);
  private readonly auth = inject(AuthStateService);
  private readonly toast = inject(ToastService);

  readonly rows = signal<SaleResponse[]>([]);
  readonly products = signal<ProductLookup[]>([]);
  readonly customers = signal<CustomerLookup[]>([]);
  readonly selectedSale = signal<SaleResponse | null>(null);
  readonly page = signal(0);
  readonly size = 20;
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly search = signal('');
  readonly statusFilter = signal('');
  readonly paymentFilter = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly showCreate = signal(false);
  readonly showPayment = signal(false);
  readonly paymentSaving = signal(false);
  readonly canCreate = computed(() => this.auth.hasPermission('SALES.CREATE'));
  readonly canComplete = computed(() => this.auth.hasPermission('SALES.COMPLETE'));
  readonly canCancel = computed(() => this.auth.hasPermission('SALES.CANCEL'));
  readonly canPay = computed(() => this.auth.hasPermission('SALES.PAYMENT_RECORD'));
  readonly paymentMethods: PaymentMethod[] = ['CASH', 'UPI', 'CARD', 'BANK', 'CREDIT'];

  readonly form = this.fb.group({
    customerUuid: [''],
    saleDate: [this.todayLocal(), Validators.required],
    supplyType: ['INTRA_STATE' as SupplyType, Validators.required],
    notes: [''],
    products: this.fb.array([this.createLine()])
  });

  readonly paymentForm = this.fb.group({
    paymentMethod: ['CASH' as PaymentMethod, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    referenceNumber: [''],
    notes: ['']
  });

  get productLines(): FormArray { return this.form.controls.products as FormArray; }

  ngOnInit(): void {
    this.load();
    this.loadLookups();
  }

  private createLine() {
    return this.fb.group({
      productUuid: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.001)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      discountAmount: [0, [Validators.min(0)]]
    });
  }

  addLine(): void { this.productLines.push(this.createLine()); }
  removeLine(index: number): void {
    if (this.productLines.length > 1) this.productLines.removeAt(index);
  }

  onProductSelected(index: number): void {
    const line = this.productLines.at(index);
    const product = this.products().find(item => item.uuid === line.get('productUuid')?.value);
    if (product) line.patchValue({ unitPrice: product.sellingPrice, discountAmount: 0 });
  }

  private loadLookups(): void {
    this.service.products().subscribe({
      next: response => this.products.set((response.content ?? []).filter(product => product.active))
    });
    this.service.customers().subscribe({
      next: response => this.customers.set((response.content ?? []).filter(customer => customer.active))
    });
  }

  load(): void {
    this.loading.set(true);
    this.service.list(this.page(), this.size, this.search(), this.statusFilter(), this.paymentFilter())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: response => {
          this.rows.set(response.content ?? []);
          this.totalPages.set(response.totalPages ?? 0);
          this.totalElements.set(response.totalElements ?? 0);
        }
      });
  }

  applyFilters(): void { this.page.set(0); this.load(); }
  changePage(delta: number): void {
    const next = this.page() + delta;
    if (next < 0 || next >= this.totalPages()) return;
    this.page.set(next);
    this.load();
  }

  openCreate(): void {
    if (!this.canCreate()) return;
    this.form.reset({
      customerUuid: '', saleDate: this.todayLocal(),
      supplyType: 'INTRA_STATE', notes: ''
    });
    this.productLines.clear();
    this.productLines.push(this.createLine());
    this.showCreate.set(true);
  }

  closeCreate(): void { if (!this.saving()) this.showCreate.set(false); }

  createSale(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const customer = this.customers().find(item => item.uuid === raw.customerUuid);
    const request = {
      customerUuid: raw.customerUuid || undefined,
      customerName: customer?.customerName,
      customerPhone: customer?.phone,
      saleDate: raw.saleDate!,
      supplyType: raw.supplyType!,
      notes: raw.notes || undefined,
      products: (raw.products ?? []).map(line => ({
        productUuid: line.productUuid!,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        discountAmount: Number(line.discountAmount ?? 0)
      })),
      payments: []
    };
    this.saving.set(true);
    this.service.create(request).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: sale => {
        this.showCreate.set(false);
        this.toast.success(`Draft ${sale.invoiceNumber} created. Review it and complete the invoice when ready.`, 'Sales draft created');
        this.load();
        this.openDetails(sale.uuid);
      }
    });
  }

  openDetails(uuid: string): void {
    this.service.get(uuid).subscribe({
      next: sale => this.selectedSale.set(sale)
    });
  }

  closeDetails(): void { this.selectedSale.set(null); }

  completeSale(sale: SaleResponse): void {
    if (!this.canComplete() || sale.status !== 'DRAFT') return;
    if (!confirm(`Complete invoice ${sale.invoiceNumber}? This will deduct inventory and post cash movements.`)) return;
    this.service.complete(sale.uuid).subscribe({
      next: updated => {
        this.selectedSale.set(updated);
        this.toast.success(`Invoice ${updated.invoiceNumber} completed and inventory updated.`, 'Sale completed');
        this.load();
      }
    });
  }

  cancelSale(sale: SaleResponse): void {
    if (!this.canCancel() || sale.status !== 'DRAFT') return;
    if (!confirm(`Cancel draft ${sale.invoiceNumber}?`)) return;
    this.service.cancel(sale.uuid).subscribe({
      next: updated => {
        this.selectedSale.set(updated);
        this.toast.success(`Draft ${updated.invoiceNumber} cancelled.`, 'Draft cancelled');
        this.load();
      }
    });
  }

  openPayment(sale: SaleResponse): void {
    if (!this.canPay() || sale.status !== 'COMPLETED' || sale.balanceAmount <= 0) return;
    this.paymentForm.reset({ paymentMethod: 'CASH', amount: sale.balanceAmount, referenceNumber: '', notes: '' });
    this.showPayment.set(true);
  }

  closePayment(): void { if (!this.paymentSaving()) this.showPayment.set(false); }

  recordPayment(): void {
    const sale = this.selectedSale();
    if (!sale || this.paymentForm.invalid || this.paymentSaving()) {
      this.paymentForm.markAllAsTouched();
      return;
    }
    const raw = this.paymentForm.getRawValue();
    this.paymentSaving.set(true);
    this.service.recordPayment(sale.uuid, {
      paymentMethod: raw.paymentMethod!,
      amount: Number(raw.amount),
      referenceNumber: raw.referenceNumber || undefined,
      notes: raw.notes || undefined
    }).pipe(finalize(() => this.paymentSaving.set(false))).subscribe({
      next: updated => {
        this.selectedSale.set(updated);
        this.showPayment.set(false);
        this.toast.success('Payment recorded successfully.', 'Payment received');
        this.load();
      }
    });
  }

  private todayLocal(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  money(value: number | null | undefined): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value ?? 0));
  }
  statusLabel(value: string): string { return value.replaceAll('_', ' '); }
  trackSale(_: number, sale: SaleResponse): string { return sale.uuid; }
}
