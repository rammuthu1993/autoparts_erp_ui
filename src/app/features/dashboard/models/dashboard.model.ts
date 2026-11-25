export interface DashboardSummary {
  fromDate: string;
  toDate: string;
  sales: SalesSummary;
  purchases: PurchaseSummary;
  expenses: ExpenseSummary;
}

export interface SalesSummary {
  invoiceCount: number;
  invoiceTotal: number;
  invoicePaidAmount: number;
  invoiceOutstandingAmount: number;
  collectionTotal: number;
  cashCollections: number;
  upiCollections: number;
  cardCollections: number;
  bankCollections: number;
  creditCollections: number;
}

export interface PurchaseSummary {
  purchaseCount: number;
  purchaseTotal: number;
  paymentTotal: number;
  cashPayments: number;
  upiPayments: number;
  cardPayments: number;
  bankPayments: number;
}

export interface ExpenseSummary {
  expenseCount: number;
  expenseTotal: number;
  cashExpenses: number;
  upiExpenses: number;
  cardExpenses: number;
  bankExpenses: number;
}

export interface InventoryStock {
  productUuid: string;
  productCode: string;
  partNo: string;
  productName: string;
  quantity: number;
  minimumStock: number;
  unit: string;
  lowStock: boolean;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
