import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';
import { API_BASE_URL } from '../../../../core/http/api/api-config';
import { AuthStateService } from '../../../../core/auth/services/auth-state.service';
import { ToastService } from '../../../../core/notifications/toast.service';

type OperationType = 'purchases' | 'inventory' | 'cash-register' | 'daily-closing';
interface Page<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number; }
interface Product { id: number; uuid: string; productCode: string; name: string; partNo: string; purchasePrice: number; sellingPrice: number; minimumStock: number; unit: string; active: boolean; }
interface Supplier { id: number; uuid: string; supplierName: string; active: boolean; }
interface Purchase { id: number; uuid: string; purchaseNumber: string; supplierId: number; supplierName: string; supplierInvoiceNo: string; purchaseDate: string; status: string; grandTotal: number; notes?: string; products: any[]; }
interface Stock { productUuid: string; productCode: string; partNo: string; productName: string; quantity: number; minimumStock: number; unit: string; lowStock: boolean; }
interface Register { uuid: string; registerCode: string; name: string; description?: string; active: boolean; }
interface Session { uuid: string; registerUuid: string; registerName: string; openingBalance: number; expectedClosingBalance: number; actualClosingBalance?: number; status: string; openedAt: string; closedAt?: string; }
interface Closing { uuid: string; businessDate: string; closedAt: string; notes?: string; summary: any; }

@Component({
  selector: 'app-operations-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './operations-page.component.html',
  styleUrl: './operations-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperationsPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthStateService);
  private readonly toast = inject(ToastService);
  private readonly base = `${API_BASE_URL}/api/v1`;

  readonly type = signal<OperationType>('purchases');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly rows = signal<any[]>([]);
  readonly products = signal<Product[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly registers = signal<Register[]>([]);
  readonly activeSessions = signal<Record<string, Session | null>>({});
  readonly selected = signal<any | null>(null);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly search = signal('');
  readonly showForm = signal(false);
  readonly showAdjust = signal(false);
  readonly showRegisterForm = signal(false);
  readonly showOpenSession = signal(false);
  readonly showCloseSession = signal(false);
  readonly selectedRegister = signal<Register | null>(null);
  readonly today = this.localDate();

  readonly purchaseForm = this.fb.group({
    supplierId: [null as number | null, Validators.required],
    supplierInvoiceNo: ['', [Validators.required, Validators.maxLength(100)]],
    purchaseDate: [this.today, Validators.required],
    notes: [''],
    products: this.fb.array([this.purchaseLine()])
  });
  readonly adjustmentForm = this.fb.group({
    quantityChange: [null as number | null, Validators.required],
    reason: ['', [Validators.required, Validators.maxLength(250)]],
    notes: ['', Validators.maxLength(500)]
  });
  readonly registerForm = this.fb.group({
    registerCode: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(300)]
  });
  readonly paymentForm = this.fb.group({
    paymentMethod: ['CASH', Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    referenceNumber: [''],
    notes: ['']
  });
  readonly openingForm = this.fb.group({ openingBalance: [0, [Validators.required, Validators.min(0)]] });
  readonly closingForm = this.fb.group({ actualClosingBalance: [0, [Validators.required, Validators.min(0)]] });
  readonly dailyForm = this.fb.group({ businessDate: [this.today, Validators.required], notes: [''] });

  get purchaseLines(): FormArray { return this.purchaseForm.controls.products as FormArray; }
  get canCreatePurchase(): boolean { return this.auth.hasPermission('PURCHASES.CREATE'); }
  get canReceivePurchase(): boolean { return this.auth.hasPermission('PURCHASES.RECEIVE'); }
  get canRecordPurchasePayment(): boolean { return this.auth.hasPermission('PURCHASES.PAYMENT_RECORD'); }
  get canAdjustStock(): boolean { return this.auth.hasPermission('INVENTORY.ADJUST'); }
  get canCreateRegister(): boolean { return this.auth.hasPermission('CASH_REGISTER.CREATE'); }
  get canOpenRegister(): boolean { return this.auth.hasPermission('CASH_REGISTER.OPEN'); }
  get canCloseRegister(): boolean { return this.auth.hasPermission('CASH_REGISTER.CLOSE'); }
  get canPerformClosing(): boolean { return this.auth.hasPermission('DAILY_CLOSING.PERFORM'); }

  ngOnInit(): void {
    this.type.set(this.route.snapshot.data['operationType'] as OperationType);
    if (this.type() === 'purchases') { this.loadPurchases(); this.loadPurchaseLookups(); }
    if (this.type() === 'inventory') this.loadStock();
    if (this.type() === 'cash-register') this.loadRegisters();
    if (this.type() === 'daily-closing') this.loadClosings();
  }

  private purchaseLine() {
    return this.fb.group({
      productId: [null as number | null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.001)]],
      purchasePrice: [0, [Validators.required, Validators.min(0)]],
      discountAmount: [0, [Validators.required, Validators.min(0)]],
      taxPercent: [0, [Validators.required, Validators.min(0), Validators.max(100)]]
    });
  }
  addPurchaseLine(): void { this.purchaseLines.push(this.purchaseLine()); }
  removePurchaseLine(i: number): void { if (this.purchaseLines.length > 1) this.purchaseLines.removeAt(i); }
  onPurchaseProductSelected(i: number): void {
    const line = this.purchaseLines.at(i);
    const product = this.products().find(p => p.id === Number(line.get('productId')?.value));
    if (product) line.patchValue({ purchasePrice: product.purchasePrice, taxPercent: 0, discountAmount: 0 });
  }
  private loadPurchaseLookups(): void {
    this.http.get<Page<Supplier>>(`${this.base}/suppliers/paged`, { params: new HttpParams().set('page', '0').set('size', '200').set('sortBy', 'supplierName').set('sortDir', 'asc') })
      .subscribe({ next: r => this.suppliers.set((r.content ?? []).filter(x => x.active)), error: () => this.toast.error('Supplier list could not be loaded.') });
    this.http.get<Page<Product>>(`${this.base}/products/paged`, { params: new HttpParams().set('page', '0').set('size', '500').set('sortBy', 'name').set('sortDir', 'asc') })
      .subscribe({ next: r => this.products.set((r.content ?? []).filter(x => x.active)), error: () => this.toast.error('Product list could not be loaded.') });
  }

  loadPurchases(): void {
    this.loading.set(true);
    let params = new HttpParams().set('page', String(this.page())).set('size', '20').set('sortBy', 'id').set('sortDir', 'desc');
    if (this.search().trim()) params = params.set('search', this.search().trim());
    this.http.get<Page<Purchase>>(`${this.base}/purchases/paged`, { params }).pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: r => this.setPage(r), error: () => this.toast.error('Purchases could not be loaded.') });
  }
  openPurchaseForm(): void {
    this.purchaseForm.reset({ supplierId: null, supplierInvoiceNo: '', purchaseDate: this.today, notes: '' });
    this.purchaseLines.clear(); this.purchaseLines.push(this.purchaseLine()); this.showForm.set(true);
  }
  createPurchase(): void {
    if (this.purchaseForm.invalid || this.saving()) { this.purchaseForm.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.purchaseForm.getRawValue();
    const payload = { supplierId: Number(v.supplierId), supplierInvoiceNo: v.supplierInvoiceNo, purchaseDate: v.purchaseDate,
      notes: v.notes || undefined, products: (v.products ?? []).map(p => ({ productId: Number(p.productId), quantity: Number(p.quantity),
        purchasePrice: Number(p.purchasePrice), discountAmount: Number(p.discountAmount), taxPercent: Number(p.taxPercent) })) };
    this.http.post<Purchase>(`${this.base}/purchases`, payload).pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: () => { this.showForm.set(false); this.toast.success('Purchase draft created. Receive it after checking the supplier invoice.'); this.loadPurchases(); },
        error: () => this.toast.error('Purchase could not be created. Check the entered details.') });
  }
  receivePurchase(p: Purchase): void {
    if (!this.canReceivePurchase || p.status !== 'DRAFT') return;
    if (!confirm(`Receive purchase ${p.purchaseNumber}? This will update inventory.`)) return;
    this.http.post<Purchase>(`${this.base}/purchases/${p.uuid}/receive`, {}).subscribe({
      next: () => { this.toast.success(`Purchase ${p.purchaseNumber} received and stock updated.`); this.loadPurchases(); },
      error: () => this.toast.error('Purchase receiving failed.')
    });
  }
  openPurchaseDetails(p: Purchase): void {
    this.http.get<Purchase>(`${this.base}/purchases/${p.uuid}`).subscribe({ next: r => this.selected.set(r), error: () => this.toast.error('Purchase details could not be loaded.') });
  }
  openPurchasePayment(p: Purchase): void {
    this.selected.set(p);
    this.paymentForm.reset({ paymentMethod: 'CASH', amount: null, referenceNumber: '', notes: '' });
  }
  recordPurchasePayment(): void {
    const p = this.selected() as Purchase | null;
    if (!p || this.paymentForm.invalid || this.saving()) { this.paymentForm.markAllAsTouched(); return; }
    this.saving.set(true); const v = this.paymentForm.getRawValue();
    this.http.post(`${this.base}/purchases/${p.uuid}/payments`, { paymentMethod: v.paymentMethod, amount: Number(v.amount),
      referenceNumber: v.referenceNumber || undefined, notes: v.notes || undefined }).pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: () => { this.selected.set(null); this.toast.success('Supplier payment recorded.'); this.loadPurchases(); },
        error: () => this.toast.error('Supplier payment could not be recorded.') });
  }

  loadStock(): void {
    this.loading.set(true);
    let params = new HttpParams().set('page', String(this.page())).set('size', '20').set('sortBy', 'productName').set('sortDir', 'asc');
    if (this.search().trim()) params = params.set('search', this.search().trim());
    this.http.get<Page<Stock>>(`${this.base}/inventory/stock/paged`, { params }).pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: r => this.setPage(r), error: () => this.toast.error('Inventory stock could not be loaded.') });
  }
  openAdjustment(row: Stock): void { this.selected.set(row); this.adjustmentForm.reset({ quantityChange: null, reason: '', notes: '' }); this.showAdjust.set(true); }
  adjustStock(): void {
    const stock = this.selected() as Stock | null;
    if (!stock || this.adjustmentForm.invalid || this.saving()) { this.adjustmentForm.markAllAsTouched(); return; }
    const v = this.adjustmentForm.getRawValue(); this.saving.set(true);
    this.http.post(`${this.base}/inventory/products/${stock.productUuid}/adjustments`, v).pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: () => { this.showAdjust.set(false); this.selected.set(null); this.toast.success('Inventory adjustment saved.'); this.loadStock(); },
        error: () => this.toast.error('Stock adjustment failed. Verify the quantity and reason.') });
  }

  loadRegisters(): void {
    this.loading.set(true);
    this.http.get<Register[]>(`${this.base}/cash-registers`).pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: rows => { this.rows.set(rows ?? []); for (const r of rows ?? []) this.loadLatestSession(r); },
        error: () => this.toast.error('Cash registers could not be loaded.') });
  }
  private loadLatestSession(r: Register): void {
    this.http.get<Session>(`${this.base}/cash-registers/${r.uuid}/sessions/latest`).pipe(
      catchError(() => of(null))
    ).subscribe(s => this.activeSessions.update(current => ({ ...current, [r.uuid]: s })));
  }
  createRegister(): void {
    if (this.registerForm.invalid || this.saving()) { this.registerForm.markAllAsTouched(); return; }
    this.saving.set(true);
    this.http.post(`${this.base}/cash-registers`, this.registerForm.getRawValue()).pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: () => { this.showRegisterForm.set(false); this.toast.success('Cash register created.'); this.loadRegisters(); },
        error: () => this.toast.error('Cash register could not be created.') });
  }
  openSession(r: Register): void {
    this.selectedRegister.set(r);
    this.openingForm.reset({ openingBalance: 0 });
    this.showOpenSession.set(true);
  }
  confirmOpenSession(): void {
    const r = this.selectedRegister();
    if (!r || this.openingForm.invalid || this.saving()) { this.openingForm.markAllAsTouched(); return; }
    this.saving.set(true);
    const amount = Number(this.openingForm.getRawValue().openingBalance);
    this.http.post<Session>(`${this.base}/cash-registers/${r.uuid}/sessions`, { openingBalance: amount })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: s => { this.activeSessions.update(v => ({ ...v, [r.uuid]: s })); this.showOpenSession.set(false); this.toast.success(`Session opened for ${r.name}.`); },
        error: () => this.toast.error('Could not open cash session. Check whether another session is already open.')
      });
  }
  closeSession(r: Register): void {
    const session = this.activeSessions()[r.uuid];
    if (!session) return;
    this.selectedRegister.set(r);
    this.closingForm.reset({ actualClosingBalance: Number(session.expectedClosingBalance ?? 0) });
    this.showCloseSession.set(true);
  }
  confirmCloseSession(): void {
    const r = this.selectedRegister();
    const session = r ? this.activeSessions()[r.uuid] : null;
    if (!r || !session || this.closingForm.invalid || this.saving()) { this.closingForm.markAllAsTouched(); return; }
    this.saving.set(true);
    const amount = Number(this.closingForm.getRawValue().actualClosingBalance);
    this.http.post<Session>(`${this.base}/cash-registers/sessions/${session.uuid}/close`, { actualClosingBalance: amount })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: s => { this.activeSessions.update(v => ({ ...v, [r.uuid]: s })); this.showCloseSession.set(false); this.toast.success(`Session closed for ${r.name}.`); },
        error: () => this.toast.error('Cash session could not be closed.')
      });
  }

  loadClosings(): void {
    this.loading.set(true);
    const params = new HttpParams().set('page', String(this.page())).set('size', '20').set('sortBy', 'businessDate').set('sortDir', 'desc');
    this.http.get<Page<Closing>>(`${this.base}/daily-closings/paged`, { params }).pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: r => this.setPage(r), error: () => this.toast.error('Daily closing history could not be loaded.') });
  }
  performClosing(): void {
    if (this.dailyForm.invalid || this.saving()) { this.dailyForm.markAllAsTouched(); return; }
    const v = this.dailyForm.getRawValue();
    if (!confirm(`Perform daily closing for ${v.businessDate}? This operation should be done after all transactions are reconciled.`)) return;
    this.saving.set(true);
    const params = new HttpParams().set('businessDate', v.businessDate!).set('notes', v.notes ?? '');
    this.http.post<Closing>(`${this.base}/daily-closings`, null, { params }).pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: () => { this.toast.success('Daily closing completed.'); this.loadClosings(); },
        error: () => this.toast.error('Daily closing failed. Verify that the date has not already been closed.') });
  }

  hasCashDifference(value: number | null | undefined): boolean { return Number(value ?? 0) !== 0; }
  private setPage<T>(r: Page<T>): void { this.rows.set(r.content ?? []); this.totalPages.set(r.totalPages ?? 0); this.totalElements.set(r.totalElements ?? 0); }
  changePage(delta: number): void {
    const next = this.page() + delta; if (next < 0 || next >= this.totalPages()) return;
    this.page.set(next);
    if (this.type() === 'purchases') this.loadPurchases();
    if (this.type() === 'inventory') this.loadStock();
    if (this.type() === 'daily-closing') this.loadClosings();
  }
  onSearch(value: string): void { this.search.set(value); this.page.set(0); if (this.type() === 'purchases') this.loadPurchases(); if (this.type() === 'inventory') this.loadStock(); }
  title(): string { return ({ purchases: 'Purchases', inventory: 'Inventory', 'cash-register': 'Cash Register', 'daily-closing': 'Daily Closing' } as const)[this.type()]; }
  money(value: number | null | undefined): string { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value ?? 0)); }
  private localDate(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
}
