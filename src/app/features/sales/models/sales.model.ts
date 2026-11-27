export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export type SupplyType = 'INTRA_STATE' | 'INTER_STATE';
export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'BANK' | 'CREDIT';
export type SalesStatus = string;
export type SalesPaymentStatus = string;

export interface SalesStatusOption { code: string; label: string; sortOrder: number; }

export interface SaleProductRequest {
  productUuid: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
}
export interface SalePaymentRequest {
  paymentMethod: PaymentMethod;
  amount: number;
  referenceNumber?: string;
  notes?: string;
}
export interface SaleCreateRequest {
  customerName?: string;
  customerPhone?: string;
  customerUuid?: string;
  saleDate: string;
  supplyType: SupplyType;
  products: SaleProductRequest[];
  payments?: SalePaymentRequest[];
  notes?: string;
}
export interface SaleProductResponse {
  uuid: string;
  productUuid: string;
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountAmount: number;
  taxableAmount: number;
  hsnCode: string;
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  lineTotal: number;
}
export interface SalePaymentResponse {
  uuid: string;
  paymentMethod: PaymentMethod;
  amount: number;
  referenceNumber?: string;
  paymentDate: string;
  notes?: string;
}
export interface SaleResponse {
  uuid: string;
  invoiceNumber: string;
  customerName?: string;
  customerPhone?: string;
  saleDate: string;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  grandTotal: number;
  roundOffAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: SalesStatus;
  paymentStatus: SalesPaymentStatus | null;
  notes?: string;
  cancellationReason?: string | null;
  products: SaleProductResponse[];
  payments: SalePaymentResponse[];
  createdAt: string;
  updatedAt: string;
}
export interface ProductLookup {
  uuid: string;
  productCode: string;
  partNo: string;
  name: string;
  sellingPrice: number;
  unit: string;
  active: boolean;
  taxRateUuid?: string | null;
  taxName?: string | null;
  hsnCode?: string | null;
  gstRate?: number | null;
  cgstRate?: number | null;
  sgstRate?: number | null;
  igstRate?: number | null;
  taxEffectiveFrom?: string | null;
  taxEffectiveTo?: string | null;
}
export interface CustomerLookup {
  uuid: string;
  customerCode: string;
  customerName: string;
  phone?: string;
  active: boolean;
}

export type CancellationRefundStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESSFUL'
  | 'FAILED'
  | 'REVERSED';

export type GstAdjustmentType =
  | 'INVOICE_CANCELLATION'
  | 'CREDIT_NOTE_REQUIRED'
  | 'NO_TAX_ADJUSTMENT'
  | 'PERIOD_LOCKED';

export interface SalesCancellationRefundAllocation {
  paymentMethod: Exclude<PaymentMethod, 'CREDIT'>;
  amount: number;
  referenceNumber?: string;
  originalPaymentUuid?: string;
}

export interface SalesCancelRequest {
  reason: string;
  refundMethod?: Exclude<PaymentMethod, 'CREDIT'>;
  refundReference?: string;
  refundAllocations?: SalesCancellationRefundAllocation[];
  confirmExternalRefund?: boolean;
  gstAdjustmentReference?: string;
  idempotencyKey?: string;
  notes?: string;
}

export interface SalesCancellationPreviewItem {
  salesProductUuid: string;
  productUuid: string;
  productCode: string;
  productName: string;
  unit: string;
  originalQuantity: number;
  previouslyReturnedQuantity: number;
  remainingQuantityToRestore: number;
  taxableReversed: number;
  totalTaxReversed: number;
  lineTotalReversed: number;
}

export interface SalesCancellationPreviewResponse {
  saleUuid: string;
  invoiceNumber: string;
  saleDate: string;
  customerName?: string;
  customerPhone?: string;
  status: SalesStatus;
  eligibleForCancellation: boolean;
  ineligibilityReason?: string | null;
  grandTotal: number;
  previouslyPaidAmount: number;
  previouslyReturnedAmount: number;
  previouslyRefundedAmount: number;
  outstandingAmount: number;
  cancelledInvoiceAmount: number;
  refundableAmount: number;
  receivableAdjustmentAmount: number;
  gstAdjustmentType: GstAdjustmentType;
  taxableReversed: number;
  cgstReversed: number;
  sgstReversed: number;
  igstReversed: number;
  totalTaxReversed: number;
  requiresCashSession: boolean;
  dailyPeriodClosed: boolean;
  originalPayments: SalePaymentResponse[];
  items: SalesCancellationPreviewItem[];
  warnings: string[];
}

export interface SalesCancellationItemResponse {
  uuid: string;
  productUuid: string;
  productCode: string;
  productName: string;
  originalQuantity: number;
  previouslyReturnedQuantity: number;
  restoredQuantity: number;
  unit: string;
  taxableReversed: number;
  cgstReversed: number;
  sgstReversed: number;
  igstReversed: number;
  totalTaxReversed: number;
  lineTotalReversed: number;
}

export interface SalesCancellationRefundResponse {
  uuid: string;
  originalPaymentUuid?: string | null;
  paymentMethod: PaymentMethod;
  amount: number;
  status: CancellationRefundStatus;
  referenceNumber?: string | null;
  refundDate: string;
  confirmedAt?: string | null;
  notes?: string | null;
}

export interface SalesCancellationResponse {
  uuid: string;
  saleUuid: string;
  invoiceNumber: string;
  cancellationReason: string;
  cancelledBy: number;
  cancelledByUsername: string;
  cancelledAt: string;
  originalGrandTotal: number;
  originalTaxableAmount: number;
  originalCgstAmount: number;
  originalSgstAmount: number;
  originalIgstAmount: number;
  originalTotalTaxAmount: number;
  previouslyPaidAmount: number;
  previouslyReturnedAmount: number;
  previouslyRefundedAmount: number;
  cancelledInvoiceAmount: number;
  refundAmount: number;
  refundMethod?: PaymentMethod | null;
  refundStatus: CancellationRefundStatus;
  refundReference?: string | null;
  refundConfirmedAt?: string | null;
  receivableAdjustmentAmount: number;
  gstAdjustmentType: GstAdjustmentType;
  gstAdjustmentReference?: string | null;
  creditNoteNumber?: string | null;
  irn?: string | null;
  irnStatus: string;
  ewayBillNumber?: string | null;
  ewayBillStatus: string;
  notes?: string | null;
  items: SalesCancellationItemResponse[];
  refunds: SalesCancellationRefundResponse[];
}

export interface SalesCancellationRefundConfirmRequest {
  status: CancellationRefundStatus;
  referenceNumber?: string;
  notes?: string;
}
