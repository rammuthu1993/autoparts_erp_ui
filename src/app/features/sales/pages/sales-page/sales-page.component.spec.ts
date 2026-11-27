import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SalesPageComponent } from './sales-page.component';
import { SalesService } from '../../services/sales.service';
import { AuthStateService } from '../../../../core/auth/services/auth-state.service';
import { ToastService } from '../../../../core/notifications/toast.service';
import { SaleResponse, SalesCancellationPreviewResponse } from '../../models/sales.model';

describe('SalesPageComponent - Full Invoice Cancellation', () => {
  let fixture: ComponentFixture<SalesPageComponent>;
  let component: SalesPageComponent;

  const issuedSale: SaleResponse = {
    uuid: '11111111-1111-1111-1111-111111111111',
    invoiceNumber: 'GAS/2026-27/00010',
    customerName: 'Arun Motors',
    customerPhone: '9876543210',
    saleDate: '2026-11-26',
    subtotal: 1000,
    discountAmount: 0,
    taxableAmount: 847.46,
    cgstAmount: 76.27,
    sgstAmount: 76.27,
    igstAmount: 0,
    totalTaxAmount: 152.54,
    grandTotal: 1000,
    roundOffAmount: 0,
    paidAmount: 400,
    balanceAmount: 600,
    status: 'COMPLETED',
    paymentStatus: 'PARTIALLY_PAID',
    products: [],
    payments: [],
    createdAt: '2026-11-26T10:00:00Z',
    updatedAt: '2026-11-26T10:00:00Z'
  };

  const previewResponse: SalesCancellationPreviewResponse = {
    saleUuid: issuedSale.uuid,
    invoiceNumber: issuedSale.invoiceNumber,
    saleDate: issuedSale.saleDate,
    customerName: issuedSale.customerName,
    customerPhone: issuedSale.customerPhone,
    status: 'COMPLETED',
    eligibleForCancellation: true,
    grandTotal: 1000,
    previouslyPaidAmount: 400,
    previouslyReturnedAmount: 0,
    previouslyRefundedAmount: 0,
    outstandingAmount: 600,
    cancelledInvoiceAmount: 1000,
    refundableAmount: 400,
    receivableAdjustmentAmount: 600,
    gstAdjustmentType: 'INVOICE_CANCELLATION',
    taxableReversed: 847.46,
    cgstReversed: 76.27,
    sgstReversed: 76.27,
    igstReversed: 0,
    totalTaxReversed: 152.54,
    requiresCashSession: true,
    dailyPeriodClosed: false,
    originalPayments: [],
    items: [
      {
        salesProductUuid: '22222222-2222-2222-2222-222222222222',
        productUuid: '33333333-3333-3333-3333-333333333333',
        productCode: 'BRK-01',
        productName: 'Brake Pad',
        unit: 'PCS',
        originalQuantity: 2,
        previouslyReturnedQuantity: 0,
        remainingQuantityToRestore: 2,
        taxableReversed: 847.46,
        totalTaxReversed: 152.54,
        lineTotalReversed: 1000
      }
    ],
    warnings: []
  };

  const mockSalesService = {
    list: vi.fn().mockReturnValue(of({ content: [issuedSale], page: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true })),
    statusOptions: vi.fn().mockReturnValue(of([{ code: 'COMPLETED', label: 'Issued', sortOrder: 20 }, { code: 'CANCELLED', label: 'Cancelled', sortOrder: 30 }])),
    paymentStatusOptions: vi.fn().mockReturnValue(of([{ code: 'PARTIALLY_PAID', label: 'Partially Paid', sortOrder: 20 }])),
    products: vi.fn().mockReturnValue(of({ content: [], page: 0, size: 200, totalElements: 0, totalPages: 0, first: true, last: true })),
    customers: vi.fn().mockReturnValue(of({ content: [], page: 0, size: 200, totalElements: 0, totalPages: 0, first: true, last: true })),
    stock: vi.fn().mockReturnValue(of({ content: [], page: 0, size: 200, totalElements: 0, totalPages: 0, first: true, last: true })),
    returns: vi.fn().mockReturnValue(of([])),
    get: vi.fn().mockReturnValue(of(issuedSale)),
    cancellationPreview: vi.fn().mockReturnValue(of(previewResponse)),
    cancel: vi.fn().mockReturnValue(of({ ...issuedSale, status: 'CANCELLED', balanceAmount: 0, paymentStatus: null, cancellationReason: 'Wrong part' })),
    getCancellation: vi.fn().mockReturnValue(of(null))
  };

  const mockAuth = {
    hasPermission: vi.fn((perm: string) => perm === 'SALES.CANCEL_ISSUED' || perm === 'SALES.CANCEL' || perm === 'SALES.VIEW')
  };

  const mockToast = {
    success: vi.fn(),
    error: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [SalesPageComponent],
      providers: [
        { provide: SalesService, useValue: mockSalesService },
        { provide: AuthStateService, useValue: mockAuth },
        { provide: ToastService, useValue: mockToast }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SalesPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens cancellation preview dialog for eligible issued invoice and validates blank reason', () => {
    component.openCancelDialog(issuedSale);
    expect(mockSalesService.cancellationPreview).toHaveBeenCalledWith(issuedSale.uuid);
    expect(component.showCancelDialog()).toBe(true);
    expect(component.cancelPreview()?.refundableAmount).toBe(400);

    component.cancelForm.patchValue({ reason: '   ' });
    component.submitCancelIssued();
    expect(mockToast.error).toHaveBeenCalledWith('Cancellation reason is required.');
    expect(mockSalesService.cancel).not.toHaveBeenCalled();
  });

  it('submits issued invoice cancellation with trimmed reason and prevents duplicate clicks', () => {
    component.openCancelDialog(issuedSale);
    component.cancelForm.patchValue({ reason: '  Wrong part ordered  ', refundMethod: 'CASH' });
    component.submitCancelIssued();

    expect(mockSalesService.cancel).toHaveBeenCalledWith(
      issuedSale.uuid,
      expect.objectContaining({ reason: 'Wrong part ordered', refundMethod: 'CASH' })
    );
    expect(component.showCancelDialog()).toBe(false);
    expect(mockToast.success).toHaveBeenCalled();
  });
});
