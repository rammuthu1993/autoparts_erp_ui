import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api/api-config';
import { DashboardSummary, InventoryStock, PageResponse } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getSummary(fromDate: string, toDate: string): Observable<DashboardSummary> {
    const params = new HttpParams()
      .set('fromDate', fromDate)
      .set('toDate', toDate);

    return this.http.get<DashboardSummary>(
      `${API_BASE_URL}/api/v1/reports/dashboard`,
      { params }
    );
  }

  getLowStock(): Observable<PageResponse<InventoryStock>> {
    const params = new HttpParams()
      .set('page', '0')
      .set('size', '6')
      .set('sortBy', 'quantity')
      .set('sortDir', 'asc');

    return this.http.get<PageResponse<InventoryStock>>(
      `${API_BASE_URL}/api/v1/inventory/low-stock/paged`,
      { params }
    );
  }
}
