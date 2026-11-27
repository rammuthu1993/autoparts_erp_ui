import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { AuthStateService } from '../../../../core/auth/services/auth-state.service';
import { ToastService } from '../../../../core/notifications/toast.service';
import {
  CustomerLookup, PaymentMethod, ProductLookup, SaleResponse,
  SalesCancellationPreviewResponse, SalesCancellationRefundResponse,
  SalesCancellationResponse, SalesCancelRequest, SupplyType, SalesStatusOption
} from '../../models/sales.model';

interface SalesTaxPreview {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  roundOffAmount: number;
  grandTotal: number;
  missingTaxProducts: string[];
}
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
  readonly statusOptions = signal<SalesStatusOption[]>([]);
  readonly paymentStatusOptions = signal<SalesStatusOption[]>([]);
  readonly returnStatusBySale = signal<Record<string, string>>({});
  readonly saleReturns = signal<any[]>([]);
  readonly selectedSale = signal<SaleResponse | null>(null);
  readonly taxPreview = signal<SalesTaxPreview>({
    subtotal: 0, discount: 0, taxableAmount: 0,
    cgstAmount: 0, sgstAmount: 0, igstAmount: 0,
    roundOffAmount: 0, grandTotal: 0, missingTaxProducts: []
  });
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
  readonly showCancelDialog = signal(false);
  readonly cancelPreview = signal<SalesCancellationPreviewResponse | null>(null);
  readonly cancelPreviewLoading = signal(false);
  readonly cancelling = signal(false);
  readonly cancellationDetails = signal<SalesCancellationResponse | null>(null);
  readonly confirmingRefundUuid = signal<string | null>(null);
  readonly canCreate = computed(() => this.auth.hasPermission('SALES.CREATE'));
  readonly canComplete = computed(() => this.auth.hasPermission('SALES.COMPLETE'));
  readonly canCancel = computed(() => this.auth.hasPermission('SALES.CANCEL'));
  readonly canCancelIssued = computed(() => this.auth.hasPermission('SALES.CANCEL_ISSUED'));
  readonly canPay = computed(() => this.auth.hasPermission('SALES.PAYMENT_RECORD'));
  readonly paymentMethods: PaymentMethod[] = ['CASH', 'UPI', 'CARD', 'BANK', 'CREDIT'];
  readonly refundMethods: Exclude<PaymentMethod, 'CREDIT'>[] = ['CASH', 'UPI', 'CARD', 'BANK'];
  readonly paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
    { value: 'CASH', label: 'Cash' },
    { value: 'UPI', label: 'UPI' },
    { value: 'CARD', label: 'Card' },
    { value: 'BANK', label: 'Bank transfer' },
    { value: 'CREDIT', label: 'Credit / Pay later' }
  ];

  readonly form = this.fb.group({
    customerUuid: [''],
    saleDate: [this.todayLocal(), Validators.required],
    supplyType: ['INTRA_STATE' as SupplyType, Validators.required],
    notes: [''],
    paymentMethod: ['CREDIT' as PaymentMethod, Validators.required],
    amountReceived: [0 as number, [Validators.min(0)]],
    products: this.fb.array([this.createLine()])
  });

  readonly paymentForm = this.fb.group({
    paymentMethod: ['CASH' as PaymentMethod, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    referenceNumber: [''],
    notes: ['']
  });

  readonly cancelForm = this.fb.group({
    reason: ['', [Validators.required, Validators.maxLength(500)]],
    refundMethod: ['CASH' as Exclude<PaymentMethod, 'CREDIT'>, Validators.required],
    refundReference: ['', [Validators.maxLength(100)]],
    confirmExternalRefund: [false],
    notes: ['', [Validators.maxLength(1000)]]
  });

  get productLines(): FormArray { return this.form.controls.products as FormArray; }

  ngOnInit(): void {
    this.load();
    this.loadLookups();
    this.form.valueChanges.subscribe(() => this.refreshTaxPreview());
    this.refreshTaxPreview();
  }

  private createLine() {
    return this.fb.group({
      productUuid: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.001)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      discountAmount: [0, [Validators.min(0)]]
    });
  }

  addLine(): void { this.productLines.push(this.createLine()); this.refreshTaxPreview(); }
  removeLine(index: number): void {
    if (this.productLines.length > 1) this.productLines.removeAt(index);
    this.refreshTaxPreview();
  }

  onProductSelected(index: number): void {
    const line = this.productLines.at(index);
    const product = this.products().find(item => item.uuid === line.get('productUuid')?.value);
    if (product) line.patchValue({ unitPrice: product.sellingPrice, discountAmount: 0 });
    this.refreshTaxPreview();
  }

  private roundMoney(value: number): number {
    // Matches BigDecimal.setScale(2, HALF_UP) for non-negative invoice amounts.
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private calculateTaxAmount(taxableAmount: number, rate: number): number {
    // Backend: percentage division at scale 6 HALF_UP, then money scale 2 HALF_UP.
    const scaleSix = Math.round((taxableAmount * rate / 100 + Number.EPSILON) * 1_000_000) / 1_000_000;
    return this.roundMoney(scaleSix);
  }

  private refreshTaxPreview(): void {
    const raw = this.form.getRawValue();
    let subtotal = 0;
    let discountTotal = 0;
    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    const missingTaxProducts: string[] = [];

    for (const line of raw.products ?? []) {
      if (!line.productUuid) continue;
      const product = this.products().find(item => item.uuid === line.productUuid);
      if (!product) continue;

      const quantity = Number(line.quantity ?? 0);
      const unitPrice = this.roundMoney(Number(line.unitPrice ?? 0));
      const gross = this.roundMoney(quantity * unitPrice);
      const discount = this.roundMoney(Number(line.discountAmount ?? 0));
      const taxable = this.roundMoney(Math.max(0, gross - discount));

      subtotal = this.roundMoney(subtotal + gross);
      discountTotal = this.roundMoney(discountTotal + discount);
      taxableTotal = this.roundMoney(taxableTotal + taxable);

      const saleDate = raw.saleDate || this.todayLocal();
      const mappingStartsAfterSale = !!product.taxEffectiveFrom && saleDate < product.taxEffectiveFrom;
      const mappingEndedBeforeSale = !!product.taxEffectiveTo && saleDate >= product.taxEffectiveTo;
      if (product.gstRate === null || product.gstRate === undefined
          || product.cgstRate === null || product.cgstRate === undefined
          || product.sgstRate === null || product.sgstRate === undefined
          || product.igstRate === null || product.igstRate === undefined
          || mappingStartsAfterSale || mappingEndedBeforeSale) {
        missingTaxProducts.push(`${product.productCode} · ${product.name}`);
        continue;
      }

      if (raw.supplyType === 'INTRA_STATE') {
        cgstTotal = this.roundMoney(cgstTotal + this.calculateTaxAmount(taxable, Number(product.cgstRate)));
        sgstTotal = this.roundMoney(sgstTotal + this.calculateTaxAmount(taxable, Number(product.sgstRate)));
      } else {
        igstTotal = this.roundMoney(igstTotal + this.calculateTaxAmount(taxable, Number(product.igstRate)));
      }
    }

    const unroundedTotal = this.roundMoney(taxableTotal + cgstTotal + sgstTotal + igstTotal);
    const grandTotal = Math.round(unroundedTotal);
    const roundOffAmount = this.roundMoney(grandTotal - unroundedTotal);
    const previousGrandTotal = this.taxPreview().grandTotal;
    this.taxPreview.set({
      subtotal, discount: discountTotal, taxableAmount: taxableTotal,
      cgstAmount: cgstTotal, sgstAmount: sgstTotal, igstAmount: igstTotal,
      roundOffAmount, grandTotal, missingTaxProducts
    });
    const selectedMethod = this.form.controls.paymentMethod.value;
    const currentReceived = Number(this.form.controls.amountReceived.value ?? 0);
    if (selectedMethod && selectedMethod !== 'CREDIT' && currentReceived === previousGrandTotal) {
      this.form.controls.amountReceived.setValue(grandTotal, { emitEvent: false });
    }
  }

  private loadLookups(): void {
    this.service.statusOptions().subscribe({ next: options => this.statusOptions.set(options ?? []) });
    this.service.paymentStatusOptions().subscribe({ next: options => this.paymentStatusOptions.set(options ?? []) });
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
          const pageRows = response.content ?? [];
          this.rows.set(pageRows);
          this.totalPages.set(response.totalPages ?? 0);
          this.totalElements.set(response.totalElements ?? 0);
          this.loadReturnStatuses(pageRows);
        }
      });
  }

  private loadReturnStatuses(sales: SaleResponse[]): void {
    if (!sales.length) { this.returnStatusBySale.set({}); return; }
    forkJoin(sales.map(sale => forkJoin({
      invoice: this.service.get(sale.uuid),
      returns: this.service.returns(sale.uuid)
    }))).subscribe({
      next: results => {
        const statuses: Record<string,string> = {};
        results.forEach((result, index) => {
          const invoice = result.invoice;
          const returned: Record<string,number> = {};
          for (const ret of result.returns ?? []) {
            for (const line of ret.products ?? []) {
              const key = line.salesProductUuid;
              if (key) returned[key] = (returned[key] ?? 0) + Number(line.quantity ?? 0);
            }
          }
          const lines = invoice.products ?? [];
          const returnedCount = lines.filter((line:any) => Number(returned[line.uuid] ?? 0) > 0).length;
          const allReturned = lines.length > 0 && lines.every((line:any) =>
            Number(returned[line.uuid] ?? 0) >= Number(line.quantity ?? 0)
          );
          statuses[sales[index].uuid] = returnedCount === 0 ? 'NO_RETURNS' : allReturned ? 'FULLY_RETURNED' : 'PARTIALLY_RETURNED';
        });
        this.returnStatusBySale.set(statuses);
      },
      error: () => this.returnStatusBySale.set({})
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
      supplyType: 'INTRA_STATE', notes: '',
      paymentMethod: 'CREDIT', amountReceived: 0
    });
    this.productLines.clear();
    this.productLines.push(this.createLine());
    this.showCreate.set(true);
    this.refreshTaxPreview();
  }

  closeCreate(): void { if (!this.saving()) this.showCreate.set(false); }

  createSale(completeAfterCreate = false): void {
    this.refreshTaxPreview();
    if (this.taxPreview().missingTaxProducts.length) {
      this.toast.error('A selected product has no tax mapping effective on the sale date. Refresh products or correct its tax mapping.');
      return;
    }
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const customer = this.customers().find(item => item.uuid === raw.customerUuid);
    const amountReceived = completeAfterCreate
      ? Number(raw.amountReceived ?? 0)
      : 0;
    const paymentMethod = raw.paymentMethod as PaymentMethod;
    if (completeAfterCreate && paymentMethod !== 'CREDIT' && amountReceived <= 0) {
      this.toast.error('Enter the amount received, or choose Credit / Pay later.');
      return;
    }
    if (completeAfterCreate && amountReceived > this.taxPreview().grandTotal) {
      this.toast.error('Amount received cannot exceed the invoice total.');
      return;
    }
    if (completeAfterCreate && paymentMethod === 'CREDIT' && amountReceived > 0) {
      this.toast.error('Choose a payment method when recording an amount received.');
      return;
    }
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
      payments: completeAfterCreate && amountReceived > 0
        ? [{
            paymentMethod,
            amount: amountReceived
          }]
        : []
    };
    this.saving.set(true);
    this.service.create(request).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: sale => {
        this.showCreate.set(false);
        this.load();
        if (!completeAfterCreate) {
          this.toast.success(`Draft ${sale.invoiceNumber} created.`, 'Sales draft created');
          this.openDetails(sale.uuid);
          return;
        }
        this.service.complete(sale.uuid).subscribe({
          next: completed => {
            this.toast.success(`Invoice ${completed.invoiceNumber} completed and inventory updated.`, 'Invoice completed');
            this.load();
            this.openDetails(completed.uuid);
          },
          error: error => {
            this.toast.error(error?.error?.message || 'Draft was created, but invoice completion failed. Open the draft and complete it after resolving the issue.');
            this.openDetails(sale.uuid);
          }
        });
      }
    });
  }

  onCreatePaymentMethodChange(): void {
    const method = this.form.controls.paymentMethod.value;
    if (method && method !== 'CREDIT') {
      this.form.controls.amountReceived.setValue(this.taxPreview().grandTotal);
    } else {
      this.form.controls.amountReceived.setValue(0);
    }
  }

  createBalancePreview(): number {
    const received = Number(this.form.controls.amountReceived.value ?? 0);
    return Math.max(0, this.taxPreview().grandTotal - received);
  }

  paymentMethodLabel(value: PaymentMethod | string): string {
    return this.paymentMethodOptions.find(option => option.value === value)?.label ?? value;
  }

  openDetails(uuid: string): void {
    this.cancellationDetails.set(null);
    this.saleReturns.set([]);
    this.service.get(uuid).subscribe({
      next: sale => {
        this.selectedSale.set(sale);
        if (sale.status === 'CANCELLED') {
          this.loadCancellationDetails(sale.uuid);
        } else {
          this.service.returns(sale.uuid).subscribe({
            next: returns => this.saleReturns.set(returns ?? []),
            error: () => this.saleReturns.set([])
          });
        }
      }
    });
  }

  private loadCancellationDetails(uuid: string): void {
    this.service.getCancellation(uuid).subscribe({
      next: details => this.cancellationDetails.set(details),
      error: () => this.cancellationDetails.set(null)
    });
  }

  closeDetails(): void {
    this.selectedSale.set(null);
    this.cancellationDetails.set(null);
    this.saleReturns.set([]);
  }

  returnedQuantity(salesProductUuid: string): number {
    return this.saleReturns().reduce((total, ret) => total + (ret.products ?? [])
      .filter((line: any) => line.salesProductUuid === salesProductUuid)
      .reduce((lineTotal: number, line: any) => lineTotal + Number(line.quantity ?? 0), 0), 0);
  }

  netQuantity(item: { uuid: string; quantity: number }): number {
    return Math.max(0, Number(item.quantity ?? 0) - this.returnedQuantity(item.uuid));
  }

  totalReturnCredit(): number {
    return this.saleReturns().reduce((total, ret) => total + Number(ret.totalReturnAmount ?? 0), 0);
  }

  netInvoiceValue(grandTotal: number): number {
    return Math.max(0, Number(grandTotal ?? 0) - this.totalReturnCredit());
  }

  negativeAmount(value: number): number {
    return -Math.abs(Number(value ?? 0));
  }

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
    if (sale.status === 'COMPLETED') {
      this.openCancelDialog(sale);
      return;
    }
    if (!this.canCancel() || sale.status !== 'DRAFT') return;
    const reason = window.prompt(`Enter cancellation reason for ${sale.invoiceNumber}:`);
    if (reason === null) return;
    if (!reason.trim()) {
      this.toast.error('Cancellation reason is required.');
      return;
    }
    this.service.cancel(sale.uuid, reason.trim()).subscribe({
      next: updated => {
        this.selectedSale.set(updated);
        this.toast.success(`Draft ${updated.invoiceNumber} cancelled.`, 'Draft cancelled');
        this.load();
      }
    });
  }

  openCancelDialog(sale: SaleResponse): void {
    if (!this.canCancelIssued() || sale.status !== 'COMPLETED' || this.cancelling()) return;
    this.cancelPreview.set(null);
    this.cancelPreviewLoading.set(true);
    this.showCancelDialog.set(true);
    this.cancelForm.reset({
      reason: '',
      refundMethod: 'CASH',
      refundReference: '',
      confirmExternalRefund: false,
      notes: ''
    });
    this.service.cancellationPreview(sale.uuid)
      .pipe(finalize(() => this.cancelPreviewLoading.set(false)))
      .subscribe({
        next: preview => {
          this.cancelPreview.set(preview);
          const firstNonCredit = preview.originalPayments.find(p => p.paymentMethod !== 'CREDIT');
          if (firstNonCredit && firstNonCredit.paymentMethod !== 'CREDIT') {
            this.cancelForm.patchValue({
              refundMethod: firstNonCredit.paymentMethod
            });
          }
        },
        error: () => {
          this.showCancelDialog.set(false);
        }
      });
  }

  closeCancelDialog(): void {
    if (!this.cancelling()) {
      this.showCancelDialog.set(false);
      this.cancelPreview.set(null);
    }
  }

  submitCancelIssued(): void {
    const preview = this.cancelPreview();
    if (!preview || !preview.eligibleForCancellation || this.cancelling()) return;

    const raw = this.cancelForm.getRawValue();
    const trimmedReason = (raw.reason ?? '').trim();
    if (!trimmedReason) {
      this.cancelForm.controls.reason.setValue('');
      this.cancelForm.controls.reason.markAsTouched();
      this.toast.error('Cancellation reason is required.');
      return;
    }
    if (trimmedReason.length > 500) {
      this.toast.error('Cancellation reason must not exceed 500 characters.');
      return;
    }

    const request: SalesCancelRequest = {
      reason: trimmedReason,
      idempotencyKey: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${preview.saleUuid}-${Date.now()}`,
      notes: raw.notes?.trim() || undefined
    };

    if (preview.refundableAmount > 0) {
      request.refundMethod = raw.refundMethod ?? 'CASH';
      if (raw.refundReference?.trim()) {
        request.refundReference = raw.refundReference.trim();
      }
      if (request.refundMethod !== 'CASH' && raw.confirmExternalRefund) {
        if (!request.refundReference) {
          this.toast.error('Enter a refund reference number to confirm an external refund.');
          return;
        }
        request.confirmExternalRefund = true;
      }
    }

    this.cancelling.set(true);
    this.service.cancel(preview.saleUuid, request)
      .pipe(finalize(() => this.cancelling.set(false)))
      .subscribe({
        next: updated => {
          this.showCancelDialog.set(false);
          this.cancelPreview.set(null);
          if (this.selectedSale()?.uuid === updated.uuid) {
            this.selectedSale.set(updated);
            this.loadCancellationDetails(updated.uuid);
          }
          this.toast.success(`Invoice ${updated.invoiceNumber} cancelled.`, 'Invoice cancelled');
          this.load();
        }
      });
  }

  confirmExternalRefund(saleUuid: string, refund: SalesCancellationRefundResponse): void {
    if (!this.canCancelIssued() || this.confirmingRefundUuid()) return;
    const reference = window.prompt(
      `Enter provider refund reference for ${this.paymentMethodLabel(refund.paymentMethod)} (${this.money(refund.amount)}):`,
      refund.referenceNumber ?? ''
    );
    if (reference === null) return;
    if (!reference.trim()) {
      this.toast.error('Provider reference number is required to confirm refund.');
      return;
    }
    this.confirmingRefundUuid.set(refund.uuid);
    this.service.confirmCancellationRefund(saleUuid, refund.uuid, {
      status: 'SUCCESSFUL',
      referenceNumber: reference.trim()
    }).pipe(finalize(() => this.confirmingRefundUuid.set(null)))
      .subscribe({
        next: updated => {
          this.cancellationDetails.set(updated);
          this.toast.success('Refund confirmed.', 'Refund updated');
        }
      });
  }

  statusLabel(value: string | null | undefined): string {
    if (!value) return '—';
    return this.statusOptions().find(option => option.code === value)?.label ?? value;
  }

  paymentStatusLabel(value: string | null | undefined): string {
    if (!value) return '—';
    return this.paymentStatusOptions().find(option => option.code === value)?.label ?? value;
  }

  printInvoiceByUuid(uuid: string): void {
    this.service.get(uuid).subscribe({ next: sale => this.printInvoice(sale) });
  }

  printInvoice(sale: SaleResponse): void {
    const escapeHtml = (value: unknown) => String(value ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
    const money = (value: number) => new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR'
    }).format(Number(value ?? 0));
    const rows = sale.products.map(item => `
      <tr><td>${escapeHtml(item.productName)}<small>${escapeHtml(item.productCode)}${item.hsnCode ? ' · HSN ' + escapeHtml(item.hsnCode) : ''}</small></td>
      <td class="right">${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</td>
      <td class="right">${money(item.unitPrice)}</td>
      <td class="right">${escapeHtml(item.gstRate)}%</td>
      <td class="right">${money(item.totalTaxAmount)}</td>
      <td class="right">${money(item.lineTotal)}</td></tr>`).join('');
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(sale.invoiceNumber)}</title>
      <style>
      *{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#202a36;margin:28px}
      .copy{border:1px solid #333;padding:22px;margin-bottom:24px;page-break-after:always}
      .copy:last-child{page-break-after:auto}.center{text-align:center}.muted{color:#657386}
      h1{font-size:22px;margin:0 0 5px}.gst{font-size:11px;margin:4px 0}
      .meta{display:flex;justify-content:space-between;margin:20px 0;padding:12px 0;border-top:1px solid #aaa;border-bottom:1px solid #aaa}
      table{width:100%;border-collapse:collapse;margin:14px 0}th,td{border:1px solid #c7cdd4;padding:8px;text-align:left}
      th{background:#f1f3f5}.right{text-align:right}small{display:block;color:#657386;margin-top:3px}
      .totals{width:310px;margin-left:auto}.totals div{display:flex;justify-content:space-between;padding:5px}
      .grand{border-top:2px solid #333;font-weight:bold;font-size:15px;margin-top:5px}
      .terms{margin-top:24px;border-top:1px solid #bbb;padding-top:10px;font-size:10px;line-height:1.6}
      .sign{display:flex;justify-content:space-between;margin-top:40px}.sign span{border-top:1px solid #555;padding-top:6px;width:180px;text-align:center}
      @media print{body{margin:10mm}.copy{margin:0 0 8mm}}
      </style></head><body>
      ${['ORIGINAL FOR RECIPIENT','DUPLICATE FOR TRANSPORTER'].map(copy => `
      <section class="copy"><header class="center"><h1>Guhan Auto Spares</h1>
      <div class="gst">GSTIN: TO BE CONFIGURED · Tamil Nadu, India</div>
      <div class="muted">${sale.status === 'CANCELLED' ? 'CANCELLED TAX INVOICE' : 'TAX INVOICE'}</div><strong>${copy}</strong></header>
      <div class="meta"><div><b>Invoice No:</b> ${escapeHtml(sale.invoiceNumber)}<br><b>Date:</b> ${escapeHtml(sale.saleDate)}</div>
      <div><b>Bill To:</b> ${escapeHtml(sale.customerName || 'Walk-in customer')}<br><b>Customer GSTIN:</b> __________________</div></div>
      <table><thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">GST</th><th class="right">Tax</th><th class="right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals"><div><span>Subtotal</span><b>${money(sale.subtotal)}</b></div>
      <div><span>Discount</span><b>${money(sale.discountAmount)}</b></div>
      <div><span>Taxable value</span><b>${money(sale.taxableAmount)}</b></div>
      <div><span>CGST</span><b>${money(sale.cgstAmount)}</b></div><div><span>SGST</span><b>${money(sale.sgstAmount)}</b></div>
      <div><span>IGST</span><b>${money(sale.igstAmount)}</b></div>
      <div><span>Round off</span><b>${money(sale.roundOffAmount)}</b></div>
      <div class="grand"><span>Invoice total</span><b>${money(sale.grandTotal)}</b></div></div>
      <div class="terms"><b>Terms & Conditions</b><br>1. Goods once sold are subject to the applicable return policy.<br>
      2. Please retain this invoice for warranty and service claims.<br>
      3. Any discrepancy in this invoice should be reported promptly.<br>
      4. This is a computer-generated invoice. Verify GST particulars before issuing.</div>
      <div class="sign"><span>Customer signature</span><span>For Guhan Auto Spares</span></div></section>`).join('')}
      <script>window.onload=()=>window.print();</script></body></html>`;
    const popup = window.open('', '_blank', 'width=1000,height=800');
    if (!popup) {
      this.toast.error('Allow pop-ups to print the invoice.');
      return;
    }
    popup.document.open();
    popup.document.write(doc);
    popup.document.close();
  }

  openPayment(sale: SaleResponse): void {
    if (!this.canPay() || !['DRAFT', 'COMPLETED'].includes(sale.status) || sale.balanceAmount <= 0) return;
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
  trackSale(_: number, sale: SaleResponse): string { return sale.uuid; }
}
