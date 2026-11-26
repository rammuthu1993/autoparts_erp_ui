import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api/api-config';
import {
  CustomerLookup, PageResponse, ProductLookup, SaleCreateRequest, SalePaymentRequest, SaleResponse
} from '../models/sales.model';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/api/v1`;

  list(page: number, size: number, search: string, status: string, paymentStatus: string): Observable<PageResponse<SaleResponse>> {
    let params = new HttpParams()
      .set('page', String(page)).set('size', String(size))
      .set('sortBy', 'id').set('sortDir', 'desc');
    if (search.trim()) params = params.set('search', search.trim());
    if (status) params = params.set('status', status);
    if (paymentStatus) params = params.set('paymentStatus', paymentStatus);
    return this.http.get<PageResponse<SaleResponse>>(`${this.base}/sales/paged`, { params });
  }

  get(uuid: string): Observable<SaleResponse> {
    return this.http.get<SaleResponse>(`${this.base}/sales/${uuid}`);
  }

  create(request: SaleCreateRequest): Observable<SaleResponse> {
    return this.http.post<SaleResponse>(`${this.base}/sales`, request);
  }

  complete(uuid: string): Observable<SaleResponse> {
    return this.http.post<SaleResponse>(`${this.base}/sales/${uuid}/complete`, {});
  }

  cancel(uuid: string): Observable<SaleResponse> {
    return this.http.post<SaleResponse>(`${this.base}/sales/${uuid}/cancel`, {});
  }

  recordPayment(uuid: string, request: SalePaymentRequest): Observable<SaleResponse> {
    return this.http.post<SaleResponse>(`${this.base}/sales/${uuid}/payments`, request);
  }

  products(search = ''): Observable<PageResponse<ProductLookup>> {
    let params = new HttpParams().set('page', '0').set('size', '200').set('sortBy', 'name').set('sortDir', 'asc');
    if (search) params = params.set('search', search);
    return this.http.get<PageResponse<ProductLookup>>(`${this.base}/products/paged`, { params });
  }

  customers(search = ''): Observable<PageResponse<CustomerLookup>> {
    let params = new HttpParams().set('page', '0').set('size', '200').set('sortBy', 'customerName').set('sortDir', 'asc');
    if (search) params = params.set('search', search);
    return this.http.get<PageResponse<CustomerLookup>>(`${this.base}/customers/paged`, { params });
  }
}
