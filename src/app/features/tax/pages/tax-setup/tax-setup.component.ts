import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { API_BASE_URL } from '../../../../core/http/api/api-config';
import { AuthStateService } from '../../../../core/auth/services/auth-state.service';
import { ToastService } from '../../../../core/notifications/toast.service';

type TaxTab = 'rates' | 'products';
interface TaxRate {
  uuid: string; taxName: string; gstRate: number; cgstRate: number; sgstRate: number;
  igstRate: number; effectiveFrom: string; effectiveTo: string | null; active: boolean;
  createdAt?: string; updatedAt?: string;
}
interface ProductOption { uuid: string; productCode: string; partNo?: string; name: string; active: boolean; }
interface ProductTaxMapping {
  uuid: string; productUuid: string; productCode: string; productName: string; taxRateUuid: string;
  taxName: string; hsnCode: string; effectiveFrom: string; effectiveTo: string | null;
}
@Component({
  selector: 'app-tax-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tax-setup.component.html',
  styleUrl: './tax-setup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaxSetupComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStateService);
  private readonly toast = inject(ToastService);

  readonly activeTab = signal<TaxTab>('rates');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly search = signal('');
  readonly page = signal(0);
  readonly size = 100;
  readonly totalPages = signal(0);
  readonly taxRates = signal<TaxRate[]>([]);
  readonly currentRates = signal<TaxRate[]>([]);
  readonly products = signal<ProductOption[]>([]);
  readonly selectedProductUuid = signal('');
  readonly mappings = signal<ProductTaxMapping[]>([]);
  readonly showRateForm = signal(false);
  readonly showMappingForm = signal(false);
  readonly editingRate = signal<TaxRate | null>(null);

  readonly isAdmin = computed(() => this.auth.hasRole('ADMIN'));
  readonly canCreateRate = computed(() => this.isAdmin() && this.auth.hasPermission('TAX_RATES.CREATE'));
  readonly canUpdateRate = computed(() => this.isAdmin() && this.auth.hasPermission('TAX_RATES.UPDATE'));
  readonly canManageMapping = computed(() => this.auth.hasRole('ADMIN') || this.auth.hasRole('MANAGER'));

  readonly rateForm = signal({
    taxName: '', gstRate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18,
    effectiveFrom: this.today(), effectiveTo: ''
  });
  readonly mappingForm = signal({
    taxRateUuid: '', hsnCode: '', effectiveFrom: this.today(), effectiveTo: ''
  });
  readonly statusForm = signal({ taxName: '', active: true });

  constructor() {
    this.loadRates();
    this.loadCurrentRates();
    this.loadProducts();
  }

  private today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  setTab(tab: TaxTab): void {
    this.activeTab.set(tab);
    if (tab === 'rates') this.loadRates();
    if (tab === 'products') this.loadProducts();
  }

  loadRates(): void {
    this.loading.set(true);
    const params = new HttpParams()
      .set('page', String(this.page()))
      .set('size', String(this.size))
      .set('sortBy', 'effectiveFrom')
      .set('sortDir', 'desc')
      .set('search', this.search());
    this.http.get<any>(`${API_BASE_URL}/api/v1/tax-rates/paged`, { params })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: r => { this.taxRates.set(r.content ?? []); this.totalPages.set(r.totalPages ?? 0); },
        error: e => this.toast.error(e?.error?.message || 'Unable to load tax rates.')
      });
  }

  loadCurrentRates(): void {
    this.http.get<TaxRate[]>(`${API_BASE_URL}/api/v1/tax-rates/current`)
      .subscribe({ next: r => this.currentRates.set(r ?? []), error: () => this.currentRates.set([]) });
  }

  loadProducts(): void {
    const params = new HttpParams().set('page', '0').set('size', '100')
      .set('sortBy', 'id').set('sortDir', 'desc');
    this.http.get<any>(`${API_BASE_URL}/api/v1/products/paged`, { params })
      .subscribe({
        next: r => {
          const list = (r.content ?? []).filter((p: ProductOption) => p.active);
          this.products.set(list);
          if (this.selectedProductUuid() && !list.some((p: ProductOption) => p.uuid === this.selectedProductUuid())) {
            this.selectedProductUuid.set('');
            this.mappings.set([]);
          }
        },
        error: e => this.toast.error(e?.error?.message || 'Unable to load products for tax mapping.')
      });
  }

  selectProduct(uuid: string): void {
    this.selectedProductUuid.set(uuid);
    this.mappings.set([]);
    if (!uuid) return;
    this.loading.set(true);
    this.http.get<ProductTaxMapping[]>(`${API_BASE_URL}/api/v1/products/${uuid}/tax-mappings`)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: r => this.mappings.set(r ?? []),
        error: e => this.toast.error(e?.error?.message || 'Unable to load product tax history.')
      });
  }

  updateRateForm(
    key: 'taxName' | 'gstRate' | 'cgstRate' | 'sgstRate' | 'igstRate' | 'effectiveFrom' | 'effectiveTo',
    value: string | number
  ): void {
    this.rateForm.update(f => ({ ...f, [key]: value } as typeof f));
    if (key === 'gstRate') {
      const rate = Number(value);
      this.rateForm.update(f => ({ ...f, cgstRate: rate / 2, sgstRate: rate / 2, igstRate: rate }));
    } else if (key === 'cgstRate' || key === 'sgstRate') {
      this.rateForm.update(f => {
        const total = Number(f.cgstRate) + Number(f.sgstRate);
        return { ...f, gstRate: total, igstRate: total };
      });
    }
  }

  openCreateRate(): void {
    this.editingRate.set(null);
    this.rateForm.set({ taxName: '', gstRate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18, effectiveFrom: this.today(), effectiveTo: '' });
    this.showRateForm.set(true);
  }

  openEditRate(rate: TaxRate): void {
    this.editingRate.set(rate);
    this.statusForm.set({ taxName: rate.taxName, active: rate.active });
    this.showRateForm.set(true);
  }

  closeRateForm(): void { this.showRateForm.set(false); this.editingRate.set(null); }

  saveRate(): void {
    const f = this.rateForm();
    if (!f.taxName.trim() || !f.effectiveFrom || (f.effectiveTo && f.effectiveTo <= f.effectiveFrom)) {
      this.toast.warning('Enter a tax name and valid effective dates.');
      return;
    }
    if (Number(f.gstRate) !== Number(f.cgstRate) + Number(f.sgstRate) || Number(f.gstRate) !== Number(f.igstRate)) {
      this.toast.warning('GST must equal CGST + SGST and must also equal IGST.');
      return;
    }
    const body = {
      taxName: f.taxName.trim(), gstRate: Number(f.gstRate), cgstRate: Number(f.cgstRate),
      sgstRate: Number(f.sgstRate), igstRate: Number(f.igstRate),
      effectiveFrom: f.effectiveFrom, effectiveTo: f.effectiveTo || null
    };
    this.saving.set(true);
    this.http.post<TaxRate>(`${API_BASE_URL}/api/v1/tax-rates`, body)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => { this.toast.success('GST rate created.'); this.closeRateForm(); this.loadRates(); this.loadCurrentRates(); },
        error: e => this.toast.error(e?.error?.message || 'Unable to create GST rate.')
      });
  }

  saveRateStatus(): void {
    const rate = this.editingRate();
    if (!rate) return;
    const f = this.statusForm();
    if (!f.taxName.trim()) { this.toast.warning('Tax name is required.'); return; }
    this.saving.set(true);
    this.http.put<TaxRate>(`${API_BASE_URL}/api/v1/tax-rates/${rate.uuid}`, f)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => { this.toast.success('Tax rate administration updated.'); this.closeRateForm(); this.loadRates(); this.loadCurrentRates(); },
        error: e => this.toast.error(e?.error?.message || 'Unable to update tax rate.')
      });
  }

  updateStatusForm(key: 'taxName' | 'active', value: string | boolean): void {
    this.statusForm.update(f => ({ ...f, [key]: value } as typeof f));
  }

  rateFor(uuid: string): TaxRate | undefined { return this.taxRates().find(r => r.uuid === uuid) ?? this.currentRates().find(r => r.uuid === uuid); }

  updateMappingForm(key: string, value: string): void { this.mappingForm.update(f => ({ ...f, [key]: value })); }

  openMappingForm(): void {
    this.mappingForm.set({ taxRateUuid: this.currentRates()[0]?.uuid ?? '', hsnCode: '', effectiveFrom: this.today(), effectiveTo: '' });
    this.showMappingForm.set(true);
  }

  saveMapping(): void {
    const productUuid = this.selectedProductUuid();
    const f = this.mappingForm();
    if (!productUuid || !f.taxRateUuid || !f.hsnCode.trim() || !/^[0-9A-Za-z]+$/.test(f.hsnCode) || f.hsnCode.length > 20) {
      this.toast.warning('Select a product and GST rate, and enter a valid alphanumeric HSN code (maximum 20 characters).');
      return;
    }
    if (!f.effectiveFrom || (f.effectiveTo && f.effectiveTo <= f.effectiveFrom)) {
      this.toast.warning('Enter valid mapping effective dates.');
      return;
    }
    this.saving.set(true);
    this.http.post<ProductTaxMapping>(`${API_BASE_URL}/api/v1/products/${productUuid}/tax-mappings`, {
      taxRateUuid: f.taxRateUuid, hsnCode: f.hsnCode.trim(),
      effectiveFrom: f.effectiveFrom, effectiveTo: f.effectiveTo || null
    }).pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => { this.toast.success('Product GST mapping created.'); this.showMappingForm.set(false); this.selectProduct(productUuid); },
        error: e => this.toast.error(e?.error?.message || 'Unable to create product tax mapping. Check overlapping dates and GST validity.')
      });
  }

  setSearch(value: string): void { this.search.set(value); this.page.set(0); this.loadRates(); }
  changePage(delta: number): void { const next = this.page() + delta; if (next >= 0 && next < this.totalPages()) { this.page.set(next); this.loadRates(); } }
}
