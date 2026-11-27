import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api/api-config';
import { MasterType, PageResponse } from '../models/master.model';

@Injectable({ providedIn: 'root' })
export class MastersService {
  private readonly http = inject(HttpClient);

  private readonly endpoints: Record<MasterType, string> = {
    products: '/api/v1/products',
    categories: '/api/v1/product-categories',
    brands: '/api/v1/product-brands',
    customers: '/api/v1/customers',
    suppliers: '/api/v1/suppliers'
  };

  list<T>(type: MasterType, page: number, size: number, search: string): Observable<PageResponse<T>> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size))
      .set('search', search)
      .set('sortBy', type === 'products' || type === 'categories' || type === 'brands' ? 'id' :
        type === 'customers' ? 'customerName' : 'supplierName')
      .set('sortDir', 'desc');
    return this.http.get<PageResponse<T>>(`${API_BASE_URL}${this.endpoints[type]}/paged`, { params });
  }

  inventoryStock(uuid: string): Observable<{ productUuid: string; quantity: number; minimumStock: number; unit: string }> {
    return this.http.get<{ productUuid: string; quantity: number; minimumStock: number; unit: string }>(
      `${API_BASE_URL}/api/v1/inventory/products/${uuid}/stock`
    );
  }

  get<T>(type: MasterType, uuid: string): Observable<T> {
    return this.http.get<T>(`${API_BASE_URL}${this.endpoints[type]}/${uuid}`);
  }

  create<T>(type: MasterType, payload: unknown): Observable<T> {
    return this.http.post<T>(`${API_BASE_URL}${this.endpoints[type]}`, payload);
  }

  update<T>(type: MasterType, uuid: string, payload: unknown): Observable<T> {
    return this.http.put<T>(`${API_BASE_URL}${this.endpoints[type]}/${uuid}`, payload);
  }

  deactivate(type: MasterType, uuid: string): Observable<void> {
    return this.http.patch<void>(`${API_BASE_URL}${this.endpoints[type]}/${uuid}/deactivate`, {});
  }

  getBarcode<T>(uuid: string): Observable<T> {
    return this.http.get<T>(`${API_BASE_URL}${this.endpoints.products}/${uuid}/barcode`);
  }

  getBarcodeImage(uuid: string): Observable<Blob> {
    return this.http.get(`${API_BASE_URL}${this.endpoints.products}/${uuid}/barcode/image`, { responseType: 'blob' });
  }

  downloadBarcode(uuid: string): Observable<Blob> {
    return this.http.get(`${API_BASE_URL}${this.endpoints.products}/${uuid}/barcode/download`, { responseType: 'blob' });
  }

  lookup<T>(type: 'categories' | 'brands'): Observable<PageResponse<T>> {
    const params = new HttpParams().set('page', '0').set('size', '200')
      .set('sortBy', 'id').set('sortDir', 'asc');
    return this.http.get<PageResponse<T>>(`${API_BASE_URL}${this.endpoints[type]}/paged`, { params });
  }
}
