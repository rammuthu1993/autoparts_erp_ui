import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthStateService } from '../../../../core/auth/services/auth-state.service';
import { ToastService } from '../../../../core/notifications/toast.service';
import { MastersService } from '../../services/masters.service';
import { MasterColumn, MasterField, MasterOption, MasterType, PageResponse } from '../../models/master.model';

interface MasterRecord {
  uuid: string;
  active?: boolean;
  [key: string]: unknown;
}

interface MasterConfig {
  title: string;
  singular: string;
  type: MasterType;
  view: string;
  create: string;
  update: string;
  deactivate: string;
  columns: MasterColumn[];
  fields: MasterField[];
}

@Component({
  selector: 'app-master-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './master-page.component.html',
  styleUrl: './master-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MasterPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(MastersService);
  private readonly authState = inject(AuthStateService);
  private readonly toast = inject(ToastService);

  readonly config = signal<MasterConfig>(this.buildConfig('products'));
  readonly rows = signal<MasterRecord[]>([]);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly page = signal(0);
  readonly pageSize = 10;
  readonly search = signal('');
  readonly showForm = signal(false);
  readonly editingUuid = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly categoryOptions = signal<MasterOption[]>([]);
  readonly brandOptions = signal<MasterOption[]>([]);
  readonly fields = computed(() => this.config().fields.map(field => {
    if (field.key === 'categoryId') return { ...field, options: this.categoryOptions() };
    if (field.key === 'brandId') return { ...field, options: this.brandOptions() };
    return field;
  }));
  readonly canCreate = computed(() => this.authState.hasPermission(this.config().create));
  readonly canUpdate = computed(() => this.authState.hasPermission(this.config().update));
  readonly canDeactivate = computed(() => {
    const permissionGranted = this.authState.hasPermission(this.config().deactivate);
    // The current backend brand deactivate service is additionally protected by @AdminOnly.
    return this.config().type === 'brands'
      ? permissionGranted && this.authState.hasRole('ADMIN')
      : permissionGranted;
  });
  readonly form = new FormGroup<Record<string, FormControl<any>>>({});

  ngOnInit(): void {
    const type = (this.route.snapshot.data['masterType'] ?? 'products') as MasterType;
    this.config.set(this.buildConfig(type));
    this.buildForm();
    if (type === 'products') this.loadProductLookups();
    this.load();
  }

  private buildConfig(type: MasterType): MasterConfig {
    const commonText = (key: string, label: string, required = false): MasterField =>
      ({ key, label, type: 'text', required, placeholder: `Enter ${label.toLowerCase()}` });
    const commonAddress: MasterField[] = [
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'pincode', label: 'PIN code', pattern: '^[0-9]{6}$' }
    ];
    const configs: Record<MasterType, MasterConfig> = {
      products: {
        type, title: 'Products', singular: 'Product',
        view: 'PRODUCTS.VIEW', create: 'PRODUCTS.CREATE', update: 'PRODUCTS.UPDATE', deactivate: 'PRODUCTS.DEACTIVATE',
        columns: [
          { key: 'productCode', label: 'Code' }, { key: 'partNo', label: 'Part number' },
          { key: 'name', label: 'Product' }, { key: 'categoryName', label: 'Category' },
          { key: 'brandName', label: 'Brand' }, { key: 'sellingPrice', label: 'Selling price' },
          { key: 'minimumStock', label: 'Min. stock' }, { key: 'active', label: 'Status' }
        ],
        fields: [
          {
            ...commonText('partNo', 'Part number', true), maxLength: 100
          },
          {
            ...commonText('name', 'Product name', true), maxLength: 200,
            pattern: '^[a-zA-Z0-9 .,\\*#@&()]+$'
          },
          { key: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
          { key: 'categoryId', label: 'Category', type: 'select', required: true, options: [] },
          { key: 'brandId', label: 'Brand', type: 'select', required: true, options: [] },
          { key: 'purchasePrice', label: 'Purchase price', type: 'number', required: true, min: 0, step: '0.01' },
          { key: 'sellingPrice', label: 'Selling price', type: 'number', required: true, min: 0, step: '0.01' },
          { key: 'minimumStock', label: 'Minimum stock', type: 'number', required: true, min: 0, step: '0.001' },
          { ...commonText('unit', 'Unit', true), maxLength: 20 }
        ]
      },
      categories: {
        type, title: 'Product categories', singular: 'Category',
        view: 'CATEGORIES.VIEW', create: 'CATEGORIES.CREATE', update: 'CATEGORIES.UPDATE', deactivate: 'CATEGORIES.DEACTIVATE',
        columns: [{ key: 'name', label: 'Category' }, { key: 'description', label: 'Description' }, { key: 'active', label: 'Status' }],
        fields: [{ ...commonText('name', 'Category name', true), maxLength: 100 }, { key: 'description', label: 'Description', type: 'textarea', maxLength: 500 }]
      },
      brands: {
        type, title: 'Product brands', singular: 'Brand',
        view: 'BRANDS.VIEW', create: 'BRANDS.CREATE', update: 'BRANDS.UPDATE', deactivate: 'BRANDS.DEACTIVATE',
        columns: [{ key: 'name', label: 'Brand' }, { key: 'description', label: 'Description' }, { key: 'active', label: 'Status' }],
        fields: [{ ...commonText('name', 'Brand name', true), maxLength: 100 }, { key: 'description', label: 'Description', type: 'textarea', maxLength: 500 }]
      },
      customers: {
        type, title: 'Customers', singular: 'Customer',
        view: 'CUSTOMERS.VIEW', create: 'CUSTOMERS.CREATE', update: 'CUSTOMERS.UPDATE', deactivate: 'CUSTOMERS.DEACTIVATE',
        columns: [{ key: 'customerCode', label: 'Code' }, { key: 'customerName', label: 'Customer' }, { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email' }, { key: 'city', label: 'City' }, { key: 'active', label: 'Status' }],
        fields: [
          { ...commonText('customerName', 'Customer name', true), maxLength: 200, pattern: '^[a-zA-Z0-9 .,*#@&()\\-]+$' },
          { key: 'phone', label: 'Phone', type: 'tel', pattern: '^[0-9+\\- ]{7,20}$' },
          { key: 'email', label: 'Email', type: 'email' },
          ...commonAddress,
          { ...commonText('gstin', 'GSTIN'), pattern: '^[0-9A-Za-z]{15}$' }
        ]
      },
      suppliers: {
        type, title: 'Suppliers', singular: 'Supplier',
        view: 'SUPPLIERS.VIEW', create: 'SUPPLIERS.CREATE', update: 'SUPPLIERS.UPDATE', deactivate: 'SUPPLIERS.DEACTIVATE',
        columns: [{ key: 'supplierName', label: 'Supplier' }, { key: 'contactPerson', label: 'Contact person' },
          { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'city', label: 'City' }, { key: 'active', label: 'Status' }],
        fields: [
          { ...commonText('supplierName', 'Supplier name', true), maxLength: 200 },
          commonText('contactPerson', 'Contact person'),
          { key: 'phone', label: 'Phone', type: 'tel', required: true, pattern: '^[+0-9() -]+$', maxLength: 20 },
          { key: 'email', label: 'Email', type: 'email' },
          ...commonAddress,
          { ...commonText('gstin', 'GSTIN'), pattern: '^[0-9A-Za-z]{15}$' },
          { key: 'paymentTermsDays', label: 'Payment terms (days)', type: 'number', min: 0, step: '1' }
        ]
      }
    };
    return configs[type];
  }

  private buildForm(): void {
    for (const field of this.config().fields) {
      const validators = [];
      if (field.required) validators.push(Validators.required);
      if (field.type === 'email') validators.push(Validators.email);
      if (field.min !== undefined) validators.push(Validators.min(field.min));
      if (field.maxLength !== undefined) validators.push(Validators.maxLength(field.maxLength));
      if (field.pattern) validators.push(Validators.pattern(field.pattern));
      this.form.addControl(field.key, new FormControl(null, validators));
    }
  }

  private loadProductLookups(): void {
    this.service.lookup<{ id: number; name: string }>('categories').subscribe({
      next: response => this.categoryOptions.set((response.content ?? []).map(item => ({ id: item.id, name: item.name }))),
      error: () => this.categoryOptions.set([])
    });
    this.service.lookup<{ id: number; name: string }>('brands').subscribe({
      next: response => this.brandOptions.set((response.content ?? []).map(item => ({ id: item.id, name: item.name }))),
      error: () => this.brandOptions.set([])
    });
  }

  load(): void {
    this.service.list<MasterRecord>(this.config().type, this.page(), this.pageSize, this.search().trim()).subscribe({
      next: response => this.applyPage(response)
    });
  }

  private applyPage(response: PageResponse<MasterRecord>): void {
    this.rows.set(response.content ?? []);
    this.totalElements.set(response.totalElements ?? 0);
    this.totalPages.set(response.totalPages ?? 0);
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(0);
    this.load();
  }

  changePage(delta: number): void {
    const next = this.page() + delta;
    if (next < 0 || next >= this.totalPages()) return;
    this.page.set(next);
    this.load();
  }

  openCreate(): void {
    if (!this.canCreate()) return;
    this.editingUuid.set(null);
    this.form.reset();
    this.showForm.set(true);
  }

  openEdit(row: MasterRecord): void {
    if (!this.canUpdate() || !row.uuid) {
      this.toast.error('This record does not contain a valid identifier. Refresh the list and try again.', 'Cannot edit record');
      return;
    }
    this.editingUuid.set(row.uuid);
    this.form.reset();
    const values: Record<string, unknown> = {};
    for (const field of this.config().fields) values[field.key] = row[field.key] ?? null;
    this.form.patchValue(values);
    this.showForm.set(true);
  }

  closeForm(): void {
    if (this.submitting()) return;
    this.showForm.set(false);
    this.form.reset();
  }

  save(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.form.getRawValue();
    this.submitting.set(true);
    const uuid = this.editingUuid();
    const request = uuid
      ? this.service.update<MasterRecord>(this.config().type, uuid, payload)
      : this.service.create<MasterRecord>(this.config().type, payload);

    request.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: () => {
        this.showForm.set(false);
        this.toast.success(`${this.config().singular} ${uuid ? 'updated' : 'created'} successfully.`, `${this.config().singular} saved`);
        this.load();
      }
    });
  }

  deactivate(row: MasterRecord): void {
    if (!this.canDeactivate()) return;
    if (!row.uuid) {
      this.toast.error('This record does not contain a valid identifier. Refresh the list and try again.', 'Cannot deactivate record');
      return;
    }
    if (!confirm(`Deactivate this ${this.config().singular.toLowerCase()}?`)) return;
    this.service.deactivate(this.config().type, row.uuid).subscribe({
      next: () => {
        this.toast.success(`${this.config().singular} deactivated successfully.`, `${this.config().singular} deactivated`);
        this.load();
      }
    });
  }

  display(row: MasterRecord, key: string): string {
    const value = row[key];
    if (key === 'active') return value === true ? 'Active' : 'Inactive';
    if (value === null || value === undefined || value === '') return '—';
    if (['purchasePrice', 'sellingPrice'].includes(key)) {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value));
    }
    return String(value);
  }

  trackByUuid(index: number, row: MasterRecord): string { return row.uuid || String(row['id'] ?? index); }
}
