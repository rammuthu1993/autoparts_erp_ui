import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CashRegisterDialogComponent } from '../../components/cash-register-dialog/cash-register-dialog.component';
import { CloseSessionDialogComponent } from '../../components/close-session-dialog/close-session-dialog.component';
import { OpenSessionDialogComponent } from '../../components/open-session-dialog/open-session-dialog.component';
import { PurchaseDetailsDialogComponent } from '../../components/purchase-details-dialog/purchase-details-dialog.component';
import { StockAdjustmentDialogComponent } from '../../components/stock-adjustment-dialog/stock-adjustment-dialog.component';
import { StockReconciliationDialogComponent } from '../../components/stock-reconciliation-dialog/stock-reconciliation-dialog.component';
import { PurchaseDraftDialogComponent } from '../../components/purchase-draft-dialog/purchase-draft-dialog.component';
import * as XLSX from 'xlsx';
import { CommonModule, DatePipe } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { API_BASE_URL } from '../../../../core/http/api/api-config';
import { AuthStateService } from '../../../../core/auth/services/auth-state.service';
import { ToastService } from '../../../../core/notifications/toast.service';

type OperationType = 'purchases' | 'inventory' | 'cash-register' | 'daily-closing';
interface Page<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number; }
interface Product { id: number; uuid: string; productCode: string; name: string; partNo: string; purchasePrice: number; sellingPrice: number; minimumStock: number; qty?: number; unit: string; active: boolean; }
interface Supplier { id: number; uuid: string; supplierName: string; active: boolean; }
interface Purchase { id: number; uuid: string; purchaseNumber: string; supplierId: number; supplierName: string; supplierInvoiceNo: string; purchaseDate: string; status: string; grandTotal: number; notes?: string; products: any[]; }
interface Stock { productUuid: string; productCode: string; partNo: string; productName: string; quantity: number; minimumStock: number; unit: string; lowStock: boolean; }
interface Register { uuid: string; registerCode: string; name: string; description?: string; active: boolean; }
interface Session { uuid: string; registerUuid: string; registerName: string; openingBalance: number; totalCashIn?: number; totalCashOut?: number; expectedClosingBalance: number; actualClosingBalance?: number; difference?: number; status: string; openedAt: string; closedAt?: string; }
interface Closing { uuid: string; businessDate: string; closedAt: string; notes?: string; summary: any; }

@Component({
  selector: 'app-operations-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, CashRegisterDialogComponent, CloseSessionDialogComponent, OpenSessionDialogComponent, PurchaseDetailsDialogComponent, StockAdjustmentDialogComponent, StockReconciliationDialogComponent, PurchaseDraftDialogComponent],
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
  readonly stockOptions = signal<Stock[]>([]);
  readonly stockOptionsLoading = signal(false);
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
  readonly showReconcile = signal(false);
  readonly selectedRegister = signal<Register | null>(null);
  readonly today = this.localDate();

  // Purchase filters & state
  readonly purchaseStatusFilter = signal('');
  readonly purchasePaymentFilter = signal('');
  readonly purchaseFromDate = signal('');
  readonly purchaseToDate = signal('');
  readonly editingPurchaseUuid = signal<string | null>(null);
  readonly purchasePaymentSummary = signal<any | null>(null);

  // Inventory summary, movements & reconciliation
  readonly inventorySummary = signal<{ totalActiveProducts: number; inStockProducts: number; lowStockProducts: number; outOfStockProducts: number } | null>(null);
  readonly stockStatusFilter = signal('ALL');
  readonly inventoryTab = signal<'stock' | 'movements'>('stock');
  readonly movements = signal<any[]>([]);
  readonly movementTypeFilter = signal('');
  readonly movementFromDate = signal('');
  readonly movementToDate = signal('');
  readonly movementPage = signal(0);
  readonly movementTotalPages = signal(0);

  // Cash register active session, history & movements
  readonly cashTab = signal<'registers' | 'sessions' | 'movements'>('registers');
  readonly myActiveCashSession = signal<Session | null>(null);
  readonly sessionHistory = signal<Session[]>([]);
  readonly sessionHistoryPage = signal(0);
  readonly sessionHistoryTotalPages = signal(0);
  readonly activeMovementSessionUuid = signal<string>('');
  readonly sessionMovements = signal<any[]>([]);

  // Daily closing preview & filters
  readonly dailyPreview = signal<any | null>(null);
  readonly openDailySessions = signal<Session[]>([]);
  readonly openDailySessionsLoading = signal(false);
  readonly openDailySessionsLoadError = signal(false);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);
  readonly closingFromDate = signal('');
  readonly closingToDate = signal('');
  readonly selectedClosing = signal<Closing | null>(null);

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
  readonly openingForm = this.fb.group({
    openingBalance: [0, [Validators.required, Validators.min(0)]],
    openingNotes: ['', Validators.maxLength(500)]
  });
  readonly closingForm = this.fb.group({
    actualClosingBalance: [0, [Validators.required, Validators.min(0)]],
    useDenominations: [false],
    denomination500: [0, [Validators.min(0)]],
    denomination200: [0, [Validators.min(0)]],
    denomination100: [0, [Validators.min(0)]],
    denomination50: [0, [Validators.min(0)]],
    denomination20: [0, [Validators.min(0)]],
    denomination10: [0, [Validators.min(0)]],
    coinsAmount: [0, [Validators.min(0)]],
    differenceReason: ['', Validators.maxLength(500)]
  });
  readonly reconcileForm = this.fb.group({
    physicalQuantity: [0, [Validators.required, Validators.min(0)]],
    reason: ['', [Validators.required, Validators.maxLength(250)]],
    notes: ['', Validators.maxLength(500)]
  });
  readonly manualMovementForm = this.fb.group({
    movementType: ['IN', Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    description: ['', [Validators.required, Validators.maxLength(300)]]
  });
  readonly dailyForm = this.fb.group({ businessDate: [this.today, Validators.required], notes: ['', Validators.maxLength(1000)] });

  get purchaseLines(): FormArray { return this.purchaseForm.controls.products as FormArray; }
  get canCreatePurchase(): boolean { return this.auth.hasPermission('PURCHASES.CREATE'); }
  get canCancelPurchase(): boolean { return this.auth.hasPermission('PURCHASES.CANCEL'); }
  get canReceivePurchase(): boolean { return this.auth.hasPermission('PURCHASES.RECEIVE'); }
  get canRecordPurchasePayment(): boolean { return this.auth.hasPermission('PURCHASES.PAYMENT_RECORD'); }
  get canAdjustStock(): boolean { return this.auth.hasPermission('INVENTORY.ADJUST'); }
  get canReconcileStock(): boolean { return this.auth.hasPermission('INVENTORY.RECONCILE'); }
  get canCreateRegister(): boolean { return this.auth.hasPermission('CASH_REGISTER.CREATE') && !this.registers().some(r => r.active); }
  get canOpenRegister(): boolean { return this.auth.hasPermission('CASH_REGISTER.OPEN'); }
  get canCloseRegister(): boolean { return this.auth.hasPermission('CASH_REGISTER.CLOSE'); }
  get canPerformClosing(): boolean { return this.auth.hasPermission('DAILY_CLOSING.PERFORM'); }

  ngOnInit(): void {
    this.type.set(this.route.snapshot.data['operationType'] as OperationType);
    this.loadMyActiveCashSession();
    if (this.type() === 'purchases') { this.loadPurchases(); this.loadPurchaseLookups(); }
    if (this.type() === 'inventory') { this.loadInventorySummary(); this.loadStock(); this.loadStockOptions(); }
    if (this.type() === 'cash-register') { this.loadRegisters(); this.loadSessionHistory(); }
    if (this.type() === 'daily-closing') { this.loadClosings(); this.loadOpenSessionsForDailyClosing(); this.previewDailyClosing(); }
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
    if (this.purchaseStatusFilter()) params = params.set('status', this.purchaseStatusFilter());
    if (this.purchasePaymentFilter()) params = params.set('paymentStatus', this.purchasePaymentFilter());
    if (this.purchaseFromDate()) params = params.set('fromDate', this.purchaseFromDate());
    if (this.purchaseToDate()) params = params.set('toDate', this.purchaseToDate());
    this.http.get<Page<Purchase>>(`${this.base}/purchases/paged`, { params }).pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: r => this.setPage(r), error: () => this.toast.error('Purchases could not be loaded.') });
  }
  openPurchaseForm(): void {
    this.editingPurchaseUuid.set(null);
    this.purchaseForm.reset({ supplierId: null, supplierInvoiceNo: '', purchaseDate: this.today, notes: '' });
    this.purchaseLines.clear(); this.purchaseLines.push(this.purchaseLine()); this.showForm.set(true);
  }
  closePurchaseForm(): void {
    this.showForm.set(false);
    this.editingPurchaseUuid.set(null);
  }
  editPurchaseDraft(p: Purchase): void {
    if (p.status !== 'DRAFT') return;
    this.selected.set(null);
    this.editingPurchaseUuid.set(p.uuid);
    this.purchaseForm.reset({
      supplierId: p.supplierId,
      supplierInvoiceNo: p.supplierInvoiceNo,
      purchaseDate: p.purchaseDate,
      notes: p.notes ?? ''
    });
    this.purchaseLines.clear();
    for (const line of p.products ?? []) {
      const grp = this.purchaseLine();
      grp.patchValue({
        productId: line.productId,
        quantity: Number(line.quantity),
        purchasePrice: Number(line.purchasePrice),
        discountAmount: Number(line.discountAmount ?? 0),
        taxPercent: Number(line.taxPercent ?? 0)
      });
      this.purchaseLines.push(grp);
    }
    if (this.purchaseLines.length === 0) this.purchaseLines.push(this.purchaseLine());
    this.showForm.set(true);
  }
  purchaseTotals() {
    let subtotal = 0, discount = 0, taxable = 0, tax = 0;
    for (const line of this.purchaseLines.getRawValue()) {
      const gross = Math.round(((Number(line.quantity) || 0) * (Number(line.purchasePrice) || 0) + Number.EPSILON) * 100) / 100;
      const disc = Math.round(((Number(line.discountAmount) || 0) + Number.EPSILON) * 100) / 100;
      const txbl = Math.max(0, gross - disc);
      const tx = Math.round((txbl * (Number(line.taxPercent) || 0) / 100 + Number.EPSILON) * 100) / 100;
      subtotal += gross; discount += disc; taxable += txbl; tax += tx;
    }
    return { subtotal, discount, taxable, tax, grandTotal: taxable + tax };
  }
  createPurchase(): void {
    if (this.purchaseForm.invalid || this.saving()) { this.purchaseForm.markAllAsTouched(); return; }
    const v = this.purchaseForm.getRawValue();
    const productIds = (v.products ?? []).map(p => Number(p.productId));
    if (new Set(productIds).size !== productIds.length) {
      this.toast.error('Duplicate products are not allowed in a single purchase.');
      return;
    }
    this.saving.set(true);
    const payload = { supplierId: Number(v.supplierId), supplierInvoiceNo: v.supplierInvoiceNo, purchaseDate: v.purchaseDate,
      notes: v.notes || undefined, products: (v.products ?? []).map(p => ({ productId: Number(p.productId), quantity: Number(p.quantity),
        purchasePrice: Number(p.purchasePrice), discountAmount: Number(p.discountAmount), taxPercent: Number(p.taxPercent) })) };
    const editUuid = this.editingPurchaseUuid();
    const req$ = editUuid
      ? this.http.put<Purchase>(`${this.base}/purchases/${editUuid}`, payload)
      : this.http.post<Purchase>(`${this.base}/purchases`, payload);
    req$.pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: () => {
          this.closePurchaseForm();
          this.toast.success(editUuid ? 'Purchase draft updated.' : 'Purchase draft created. Receive it after checking the supplier invoice.');
          this.loadPurchases();
        },
        error: e => this.toast.error(e?.error?.message || 'Purchase could not be saved.') });
  }
  cancelPurchaseDraft(p: Purchase): void {
    if (!this.canCancelPurchase || p.status !== 'DRAFT' || this.saving()) return;
    this.saving.set(true);
    this.http.post<Purchase>(`${this.base}/purchases/${p.uuid}/cancel`, { reason: 'Draft cancelled by user' })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => { this.selected.set(null); this.toast.success(`Purchase ${p.purchaseNumber} cancelled.`); this.loadPurchases(); },
        error: e => this.toast.error(e?.error?.message || 'Could not cancel purchase draft.')
      });
  }
  receivePurchase(p: Purchase): void {
    if (!this.canReceivePurchase || p.status !== 'DRAFT' || this.saving()) return;
    this.saving.set(true);
    this.http.post<Purchase>(`${this.base}/purchases/${p.uuid}/receive`, {}).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: updated => {
        this.selected.set(updated);
        this.loadPurchasePaymentSummary(updated.uuid);
        this.toast.success(`Purchase ${p.purchaseNumber} received and stock updated.`);
        this.loadPurchases();
      },
      error: e => this.toast.error(e?.error?.message || 'Purchase receiving failed.')
    });
  }
  openPurchaseDetails(p: Purchase): void {
    this.purchasePaymentSummary.set(null);
    this.http.get<Purchase>(`${this.base}/purchases/${p.uuid}`).subscribe({
      next: r => {
        this.selected.set(r);
        if (r.status === 'RECEIVED') this.loadPurchasePaymentSummary(r.uuid);
      },
      error: () => this.toast.error('Purchase details could not be loaded.')
    });
  }
  private loadPurchasePaymentSummary(purchaseUuid: string): void {
    this.http.get<any>(`${this.base}/purchases/${purchaseUuid}/payments`)
      .pipe(catchError(() => of(null)))
      .subscribe(summary => this.purchasePaymentSummary.set(summary));
  }
  openPurchasePayment(p: Purchase): void {
    this.openPurchaseDetails(p);
    this.paymentForm.reset({ paymentMethod: 'CASH', amount: null, referenceNumber: '', notes: '' });
  }
  recordPurchasePayment(): void {
    const p = this.selected() as Purchase | null;
    if (!p || this.paymentForm.invalid || this.saving()) { this.paymentForm.markAllAsTouched(); return; }
    this.saving.set(true); const v = this.paymentForm.getRawValue();
    this.http.post(`${this.base}/purchases/${p.uuid}/payments`, { paymentMethod: v.paymentMethod, amount: Number(v.amount),
      referenceNumber: v.referenceNumber || undefined, notes: v.notes || undefined }).pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: () => {
          this.paymentForm.reset({ paymentMethod: 'CASH', amount: null, referenceNumber: '', notes: '' });
          this.toast.success('Supplier payment recorded.');
          this.loadPurchasePaymentSummary(p.uuid);
          this.loadPurchases();
        },
        error: e => this.toast.error(e?.error?.message || 'Supplier payment could not be recorded.') });
  }

  loadInventorySummary(): void {
    this.http.get<any>(`${this.base}/inventory/summary`)
      .pipe(catchError(() => of(null)))
      .subscribe(s => this.inventorySummary.set(s));
  }

  loadStock(): void {
    this.loading.set(true);
    let params = new HttpParams().set('page', String(this.page())).set('size', '20').set('sortBy', 'productName').set('sortDir', 'asc');
    if (this.search().trim()) params = params.set('search', this.search().trim());
    if (this.stockStatusFilter() && this.stockStatusFilter() !== 'ALL') params = params.set('stockStatus', this.stockStatusFilter());
    this.http.get<Page<Stock>>(`${this.base}/inventory/stock/paged`, { params }).pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: r => this.setPage(r), error: () => this.toast.error('Inventory stock could not be loaded.') });
  }

  loadMovements(): void {
    this.loading.set(true);
    let params = new HttpParams().set('page', String(this.movementPage())).set('size', '20');
    if (this.search().trim()) params = params.set('search', this.search().trim());
    if (this.movementTypeFilter()) params = params.set('movementType', this.movementTypeFilter());
    if (this.movementFromDate()) params = params.set('fromDate', this.movementFromDate());
    if (this.movementToDate()) params = params.set('toDate', this.movementToDate());
    this.http.get<any>(`${this.base}/inventory/movements`, { params }).pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: r => {
          this.movements.set(r.content ?? []);
          this.movementTotalPages.set(r.totalPages ?? 0);
        },
        error: () => this.toast.error('Inventory movements could not be loaded.')
      });
  }

  adjustmentPreviewQty(): number {
    const stock = this.selected() as Stock | null;
    if (!stock) return 0;
    return Math.round(((Number(stock.quantity) + (Number(this.adjustmentForm.controls.quantityChange.value) || 0)) + Number.EPSILON) * 1000) / 1000;
  }

  openReconcile(row: Stock): void {
    this.selected.set(row);
    this.reconcileForm.reset({ physicalQuantity: Number(row.quantity), reason: '', notes: '' });
    this.showReconcile.set(true);
  }

  reconcileDifference(): number {
    const stock = this.selected() as Stock | null;
    if (!stock) return 0;
    const counted = Number(this.reconcileForm.controls.physicalQuantity.value ?? 0);
    return Math.round(((counted - Number(stock.quantity)) + Number.EPSILON) * 1000) / 1000;
  }

  submitReconcile(): void {
    const stock = this.selected() as Stock | null;
    if (!stock || this.reconcileForm.invalid || this.saving()) { this.reconcileForm.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.reconcileForm.getRawValue();
    this.http.post(`${this.base}/inventory/products/${stock.productUuid}/reconcile`, {
      physicalQuantity: Number(v.physicalQuantity),
      reason: v.reason,
      notes: v.notes || undefined
    }).pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.showReconcile.set(false);
          this.selected.set(null);
          this.toast.success('Physical stock reconciliation recorded.');
          this.loadInventorySummary();
          this.loadStock();
          this.loadStockOptions();
        },
        error: e => this.toast.error(e?.error?.message || 'Stock reconciliation failed.')
      });
  }
  /**
   * Load every active product's current stock for the Add stock selector.
   * The API caps page size at 100, so fetch the remaining pages explicitly.
   */
  loadStockOptions(): void {
    this.stockOptionsLoading.set(true);
    const url = `${this.base}/inventory/stock/paged`;
    const params = new HttpParams().set('page', '0').set('size', '100').set('sortBy', 'productName').set('sortDir', 'asc');
    this.http.get<Page<Stock>>(url, { params }).subscribe({
      next: first => {
        const pages = Math.max(1, Number(first.totalPages ?? 1));
        if (pages <= 1) {
          this.stockOptions.set(first.content ?? []);
          this.stockOptionsLoading.set(false);
          return;
        }
        const requests = Array.from({ length: pages - 1 }, (_, index) => {
          const pageParams = new HttpParams().set('page', String(index + 1)).set('size', '100').set('sortBy', 'productName').set('sortDir', 'asc');
          return this.http.get<Page<Stock>>(url, { params: pageParams });
        });
        forkJoin(requests).pipe(finalize(() => this.stockOptionsLoading.set(false))).subscribe({
          next: rest => this.stockOptions.set([...(first.content ?? []), ...rest.flatMap(page => page.content ?? [])]),
          error: () => this.toast.error('Product stock options could not be loaded.')
        });
      },
      error: () => { this.stockOptions.set([]); this.stockOptionsLoading.set(false); this.toast.error('Product stock options could not be loaded.'); }
    });
  }

  openNewStockAdjustment(): void {
    this.selected.set(null);
    this.adjustmentForm.reset({ quantityChange: null, reason: '', notes: '' });
    this.showAdjust.set(true);
  }
  openAdjustment(row: Stock): void {
    this.selected.set(row);
    this.adjustmentForm.reset({ quantityChange: null, reason: '', notes: '' });
    this.showAdjust.set(true);
  }
  selectAdjustmentProduct(productUuid: string): void {
    this.selected.set(this.stockOptions().find(item => item.productUuid === productUuid) ?? null);
  }
  adjustStock(): void {
    const stock = this.selected() as Stock | null;
    if (!stock) { this.toast.error('Select a product before adjusting stock.'); return; }
    if (this.adjustmentForm.invalid || this.saving()) { this.adjustmentForm.markAllAsTouched(); return; }
    const v = this.adjustmentForm.getRawValue(); this.saving.set(true);
    this.http.post(`${this.base}/inventory/products/${stock.productUuid}/adjustments`, v).pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: () => { this.showAdjust.set(false); this.selected.set(null); this.toast.success('Inventory adjustment saved.'); this.loadStock(); this.loadStockOptions(); },
        error: () => this.toast.error('Stock adjustment failed. Verify the quantity and reason.') });
  }

  loadRegisters(): void {
    this.loading.set(true);
    this.http.get<Register[]>(`${this.base}/cash-registers`).pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: rows => { this.rows.set(rows ?? []); this.registers.set(rows ?? []); for (const r of rows ?? []) this.loadLatestSession(r); },
        error: () => this.toast.error('Cash registers could not be loaded.') });
  }
  private loadLatestSession(r: Register): void {
    this.http.get<Session>(`${this.base}/cash-registers/${r.uuid}/sessions/latest`).pipe(
      catchError(() => of(null))
    ).subscribe(s => this.activeSessions.update(current => ({ ...current, [r.uuid]: s })));
  }
  createRegister(): void {
    if (this.registers().some(r => r.active)) { this.toast.error('This shop already has an active cash register. Reuse it for every shift.'); this.showRegisterForm.set(false); return; }
    if (this.registerForm.invalid || this.saving()) { this.registerForm.markAllAsTouched(); return; }
    this.saving.set(true);
    this.http.post(`${this.base}/cash-registers`, this.registerForm.getRawValue()).pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: () => { this.showRegisterForm.set(false); this.toast.success('Cash register created.'); this.loadRegisters(); },
        error: () => this.toast.error('Cash register could not be created.') });
  }
  loadMyActiveCashSession(): void {
    this.http.get<Session>(`${this.base}/cash-registers/sessions/active/me`, { observe: 'response' })
      .pipe(catchError(() => of(null)))
      .subscribe(res => this.myActiveCashSession.set(res && res.status === 200 ? res.body : null));
  }

  loadSessionHistory(): void {
    let params = new HttpParams().set('page', String(this.sessionHistoryPage())).set('size', '20');
    this.http.get<Page<Session>>(`${this.base}/cash-registers/sessions/paged`, { params })
      .pipe(catchError(() => of({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 })))
      .subscribe(r => {
        this.sessionHistory.set(r.content ?? []);
        this.sessionHistoryTotalPages.set(r.totalPages ?? 0);
      });
  }

  openMovementsTab(sessionUuid: string): void {
    this.activeMovementSessionUuid.set(sessionUuid);
    this.cashTab.set('movements');
    this.loadSessionMovements(sessionUuid);
  }

  loadSessionMovements(sessionUuid: string): void {
    if (!sessionUuid) return;
    this.http.get<Page<any>>(`${this.base}/cash-registers/sessions/${sessionUuid}/movements/paged`, {
      params: new HttpParams().set('page', '0').set('size', '50').set('sortBy', 'createdAt').set('sortDir', 'desc')
    }).subscribe({
      next: r => this.sessionMovements.set(r.content ?? []),
      error: () => this.toast.error('Cash movements could not be loaded.')
    });
  }

  createManualMovement(): void {
    const sessionUuid = this.activeMovementSessionUuid();
    if (!sessionUuid || this.manualMovementForm.invalid || this.saving()) {
      this.manualMovementForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.manualMovementForm.getRawValue();
    this.http.post(`${this.base}/cash-registers/sessions/${sessionUuid}/movements`, {
      movementType: v.movementType,
      amount: Number(v.amount),
      description: v.description?.trim()
    }).pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.manualMovementForm.reset({ movementType: 'IN', amount: null, description: '' });
          this.toast.success('Manual cash movement recorded.');
          this.loadSessionMovements(sessionUuid);
          this.loadRegisters();
        },
        error: e => this.toast.error(e?.error?.message || 'Unable to record manual movement.')
      });
  }

  openSession(r: Register): void {
    this.selectedRegister.set(r);
    this.openingForm.reset({ openingBalance: 0, openingNotes: '' });
    this.showOpenSession.set(true);
  }
  confirmOpenSession(): void {
    const r = this.selectedRegister();
    if (!r || this.openingForm.invalid || this.saving()) { this.openingForm.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.openingForm.getRawValue();
    this.http.post<Session>(`${this.base}/cash-registers/${r.uuid}/sessions`, {
      openingBalance: Number(v.openingBalance),
      openingNotes: v.openingNotes?.trim() || undefined
    })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: s => {
          this.activeSessions.update(curr => ({ ...curr, [r.uuid]: s }));
          this.showOpenSession.set(false);
          this.loadMyActiveCashSession();
          this.loadSessionHistory();
          this.toast.success(`Session opened for ${r.name}.`);
        },
        error: e => this.toast.error(e?.error?.message || 'Could not open cash session.')
      });
  }
  closeSession(r: Register): void {
    const session = this.activeSessions()[r.uuid];
    if (!session) return;
    this.selectedRegister.set(r);
    this.closingForm.reset({
      actualClosingBalance: Number(session.expectedClosingBalance ?? 0),
      useDenominations: false,
      denomination500: 0,
      denomination200: 0,
      denomination100: 0,
      denomination50: 0,
      denomination20: 0,
      denomination10: 0,
      coinsAmount: 0,
      differenceReason: ''
    });
    this.showCloseSession.set(true);
  }
  closingDenominationTotal(): number {
    const v = this.closingForm.getRawValue();
    const notes =
      (Number(v.denomination500) || 0) * 500 +
      (Number(v.denomination200) || 0) * 200 +
      (Number(v.denomination100) || 0) * 100 +
      (Number(v.denomination50) || 0) * 50 +
      (Number(v.denomination20) || 0) * 20 +
      (Number(v.denomination10) || 0) * 10;
    return Math.round((notes + (Number(v.coinsAmount) || 0) + Number.EPSILON) * 100) / 100;
  }
  closingDifference(): number {
    const r = this.selectedRegister();
    const session = r ? this.activeSessions()[r.uuid] : null;
    if (!session) return 0;
    const actual = this.closingForm.controls.useDenominations.value
      ? this.closingDenominationTotal()
      : Number(this.closingForm.controls.actualClosingBalance.value ?? 0);
    return Math.round((actual - Number(session.expectedClosingBalance ?? 0) + Number.EPSILON) * 100) / 100;
  }
  confirmCloseSession(): void {
    const r = this.selectedRegister();
    const session = r ? this.activeSessions()[r.uuid] : null;
    if (!r || !session || this.closingForm.invalid || this.saving()) { this.closingForm.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.closingForm.getRawValue();
    const payload = {
      actualClosingBalance: v.useDenominations ? this.closingDenominationTotal() : Number(v.actualClosingBalance),
      useDenominations: Boolean(v.useDenominations),
      denomination500: Number(v.denomination500 || 0),
      denomination200: Number(v.denomination200 || 0),
      denomination100: Number(v.denomination100 || 0),
      denomination50: Number(v.denomination50 || 0),
      denomination20: Number(v.denomination20 || 0),
      denomination10: Number(v.denomination10 || 0),
      coinsAmount: Number(v.coinsAmount || 0),
      differenceReason: v.differenceReason?.trim() || undefined
    };
    this.http.post<Session>(`${this.base}/cash-registers/sessions/${session.uuid}/close`, payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: s => {
          this.activeSessions.update(curr => ({ ...curr, [r.uuid]: s }));
          this.showCloseSession.set(false);
          this.loadMyActiveCashSession();
          this.loadSessionHistory();
          if (this.type() === 'daily-closing') {
            this.loadOpenSessionsForDailyClosing();
            this.previewDailyClosing();
          }
          this.toast.success(`Session closed for ${r.name}.`);
        },
        error: e => this.toast.error(e?.error?.message || 'Cash session could not be closed.')
      });
  }

  loadOpenSessionsForDailyClosing(): void {
    this.openDailySessionsLoading.set(true);
    this.openDailySessionsLoadError.set(false);
    let loadFailed = false;
    forkJoin({
      registers: this.http.get<Register[]>(`${this.base}/cash-registers`).pipe(
        catchError(() => { loadFailed = true; return of([] as Register[]); })
      ),
      sessions: this.http.get<Page<Session>>(`${this.base}/cash-registers/sessions/paged`, {
        params: new HttpParams().set('status', 'OPEN').set('page', '0').set('size', '100')
      }).pipe(catchError(() => {
        loadFailed = true;
        return of({ content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 } as Page<Session>);
      }))
    }).pipe(finalize(() => this.openDailySessionsLoading.set(false))).subscribe(({ registers, sessions }) => {
      this.registers.set(registers ?? []);
      const open = sessions.content ?? [];
      const byRegister: Record<string, Session | null> = {};
      for (const session of open) byRegister[session.registerUuid] = session;
      this.activeSessions.update(current => ({ ...current, ...byRegister }));
      this.openDailySessions.set(open);
      this.openDailySessionsLoadError.set(loadFailed);
    });
  }

  closeDailySession(session: Session): void {
    if (!session?.uuid || !session.registerUuid) {
      this.toast.error('The open-session record is missing its session or register identifier. Refresh and try again.');
      this.loadOpenSessionsForDailyClosing();
      return;
    }

    // The paged session response already contains registerUuid/registerName.
    // Do not depend on a second register-list request being available on this page.
    const register = this.registers().find(r => r.uuid === session.registerUuid) ?? ({
      uuid: session.registerUuid,
      registerCode: '',
      name: session.registerName || 'Cash register',
      active: true
    } as Register);

    this.activeSessions.update(current => ({ ...current, [register.uuid]: session }));
    this.closeSession(register);
  }

  loadClosings(): void {
    this.loading.set(true);
    let params = new HttpParams().set('page', String(this.page())).set('size', '20').set('sortBy', 'businessDate').set('sortDir', 'desc');
    if (this.closingFromDate()) params = params.set('fromDate', this.closingFromDate());
    if (this.closingToDate()) params = params.set('toDate', this.closingToDate());
    this.http.get<Page<Closing>>(`${this.base}/daily-closings/paged`, { params }).pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: r => this.setPage(r), error: () => this.toast.error('Daily closing history could not be loaded.') });
  }
  previewDailyClosing(): void {
    const date = this.dailyForm.controls.businessDate.value;
    if (!date) {
      this.dailyPreview.set(null);
      this.previewError.set('Select a business date before generating the preview.');
      return;
    }

    this.previewLoading.set(true);
    this.previewError.set(null);
    this.dailyPreview.set(null);

    this.http.get<any>(`${this.base}/daily-closings/preview`, {
      params: new HttpParams().set('businessDate', date)
    }).pipe(finalize(() => this.previewLoading.set(false)))
      .subscribe({
        next: preview => {
          if (!preview || !preview.businessDate || !preview.summary) {
            this.previewError.set('The server returned an incomplete daily-closing preview. Please refresh and try again.');
            return;
          }
          // API LocalDate values are ISO yyyy-MM-dd; normalize defensively.
          const responseDate = String(preview.businessDate).slice(0, 10);
          if (responseDate !== date) {
            this.previewError.set(`Preview date mismatch. Requested ${date}, received ${responseDate}.`);
            return;
          }
          this.dailyPreview.set({ ...preview, businessDate: responseDate });
        },
        error: error => {
          this.dailyPreview.set(null);
          this.previewError.set(error?.error?.message || error?.error?.detail ||
            `Could not generate the preview for ${date}. Check DAILY_CLOSING.VIEW permission and backend logs.`);
          this.toast.error(this.previewError() || 'Daily-closing preview failed.');
        }
      });
  }
  performClosing(): void {
    if (this.dailyForm.invalid || this.saving()) { this.dailyForm.markAllAsTouched(); return; }
    const v = this.dailyForm.getRawValue();
    const preview = this.dailyPreview();
    if (!preview || preview.businessDate !== v.businessDate || preview.canClose !== true) {
      this.toast.error('Load a valid closing preview and resolve all blocking issues before finalizing.');
      this.previewDailyClosing();
      return;
    }
    this.saving.set(true);
    const params = new HttpParams().set('businessDate', v.businessDate!).set('notes', v.notes ?? '');
    this.http.post<Closing>(`${this.base}/daily-closings`, null, { params }).pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: closing => {
          this.toast.success('Daily closing completed.');
          this.selectedClosing.set(closing);
          this.loadClosings();
          this.previewDailyClosing();
        },
        error: e => this.toast.error(e?.error?.message || 'Daily closing failed.') });
  }
  exportClosingExcel(c: Closing): void {
    const s = c.summary ?? {};
    const rows = [
      { Metric: 'Business Date', Value: c.businessDate },
      { Metric: 'Sales Count', Value: s.salesCount ?? 0 },
      { Metric: 'Sales Total', Value: s.salesTotal ?? 0 },
      { Metric: 'Sales Paid', Value: s.salesPaidTotal ?? 0 },
      { Metric: 'Sales Balance', Value: s.salesBalanceTotal ?? 0 },
      { Metric: 'Sales Cash', Value: s.salesCashTotal ?? 0 },
      { Metric: 'Sales UPI', Value: s.salesUpiTotal ?? 0 },
      { Metric: 'Sales Card', Value: s.salesCardTotal ?? 0 },
      { Metric: 'Sales Bank', Value: s.salesBankTotal ?? 0 },
      { Metric: 'Sales Returns', Value: s.salesReturnTotal ?? 0 },
      { Metric: 'Sales Refunds', Value: s.salesRefundTotal ?? 0 },
      { Metric: 'Purchases Total', Value: s.purchaseTotal ?? 0 },
      { Metric: 'Expenses Total', Value: s.expenseTotal ?? 0 },
      { Metric: 'Cash Expected', Value: s.cashExpectedTotal ?? 0 },
      { Metric: 'Cash Actual', Value: s.cashActualTotal ?? 0 },
      { Metric: 'Cash Difference', Value: s.cashDifferenceTotal ?? 0 }
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DailyClosing');
    XLSX.writeFile(wb, `daily-closing-${c.businessDate}.xlsx`);
  }

  hasCashDifference(value: number | null | undefined): boolean { return Number(value ?? 0) !== 0; }
  private setPage<T>(r: Page<T>): void { this.rows.set(r.content ?? []); this.totalPages.set(r.totalPages ?? 0); this.totalElements.set(r.totalElements ?? 0); }
  changePage(delta: number): void {
    const next = this.page() + delta; if (next < 0 || next >= this.totalPages()) return;
    this.page.set(next);
    if (this.type() === 'purchases') this.loadPurchases();
    if (this.type() === 'inventory') { this.loadStock(); this.loadStockOptions(); }
    if (this.type() === 'daily-closing') this.loadClosings();
  }
  onSearch(value: string): void { this.search.set(value); this.page.set(0); if (this.type() === 'purchases') this.loadPurchases(); if (this.type() === 'inventory') this.loadStock(); }
  title(): string { return ({ purchases: 'Purchases', inventory: 'Inventory', 'cash-register': 'Cash Register', 'daily-closing': 'Daily Closing' } as const)[this.type()]; }
  money(value: number | null | undefined): string { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value ?? 0)); }
  private localDate(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
}
