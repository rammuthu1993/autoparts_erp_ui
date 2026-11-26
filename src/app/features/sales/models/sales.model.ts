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
