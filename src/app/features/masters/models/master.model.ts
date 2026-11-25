export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface MasterOption { id: number; name: string; }
export type MasterType = 'products' | 'categories' | 'brands' | 'customers' | 'suppliers';

export interface MasterField {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select';
  required?: boolean;
  options?: MasterOption[];
  placeholder?: string;
  min?: number;
  step?: string;
  maxLength?: number;
  pattern?: string;
}
export interface MasterColumn { key: string; label: string; }
