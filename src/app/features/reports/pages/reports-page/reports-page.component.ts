import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../../../core/http/api/api-config';
import { AuthStateService } from '../../../../core/auth/services/auth-state.service';
import { ToastService } from '../../../../core/notifications/toast.service';

type ReportTab = 'overview' | 'inventory' | 'customers' | 'suppliers' | 'targets' | 'quality' | 'reconciliation' | 'scenario';
@Component({ selector: 'app-reports-page', standalone: true, imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, DecimalPipe], templateUrl: './reports-page.component.html', styleUrl: './reports-page.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ReportsPageComponent {
  private readonly http = inject(HttpClient); private readonly auth = inject(AuthStateService); private readonly toast = inject(ToastService);
  readonly canAdvanced = computed(() => this.auth.hasPermission('REPORTS.ADVANCED_VIEW'));
  readonly isAdmin = computed(() => this.auth.hasRole('ADMIN') || this.auth.hasRole('SUPER_ADMIN'));
  readonly tabs: {key: ReportTab; label: string; advanced?: boolean}[] = [
    {key:'overview',label:'Business overview'}, {key:'inventory',label:'Inventory analytics',advanced:true}, {key:'customers',label:'Customer analytics',advanced:true}, {key:'suppliers',label:'Supplier analytics',advanced:true}, {key:'targets',label:'Targets & forecast',advanced:true}, {key:'quality',label:'Data quality',advanced:true}, {key:'reconciliation',label:'Reconciliation',advanced:true}, {key:'scenario',label:'What-if scenario',advanced:true}
  ];
  readonly visibleTabs = computed(() => this.tabs.filter(t => !t.advanced || this.canAdvanced()));
  readonly activeTab = signal<ReportTab>('overview'); readonly loading = signal(false); readonly saving = signal(false);
  readonly fromDate = signal(this.monthStart()); readonly toDate = signal(this.today());
  readonly overview = signal<any>(null); readonly inventory = signal<any>(null); readonly customers = signal<any>(null); readonly suppliers = signal<any>(null);
  readonly targets = signal<any>(null); readonly quality = signal<any>(null); readonly reconciliation = signal<any>(null); readonly scenario = signal<any>(null);
  readonly issueStatus = signal<Record<string,string>>({}); readonly issueNotes = signal<Record<string,string>>({});
  readonly targetForm = signal({metricKey:'MONTHLY_SALES',periodStart:this.monthStart(),periodEnd:this.today(),targetValue:0,productId:null as number|null,categoryId:null as number|null});
  readonly scenarioForm = signal({sellingPriceChangePercent:0,salesVolumeChangePercent:0,expenseChangePercent:0});
  readonly targetMetrics = ['MONTHLY_SALES','PRODUCT_SALES','CATEGORY_REVENUE','EXPENSE_BUDGET'];
  constructor(){ this.load(); }
  private today(): string { const d=new Date(); return this.localDate(d); }
  private monthStart(): string { const d=new Date(); return this.localDate(new Date(d.getFullYear(),d.getMonth(),1)); }
  private localDate(d:Date):string { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  setTab(tab:ReportTab):void { this.activeTab.set(tab); this.load(); }
  setFrom(v:string):void { this.fromDate.set(v); }
  setTo(v:string):void { this.toDate.set(v); }
  applyDates():void { if(this.fromDate()>this.toDate()){this.toast.warning('From date must be before or equal to To date.');return;} this.load(); }
  private params():HttpParams { return new HttpParams().set('fromDate',this.fromDate()).set('toDate',this.toDate()); }
  load():void {
    const tab=this.activeTab(); this.loading.set(true); let request;
    switch(tab){
      case 'overview': request=this.http.get<any>(`${API_BASE_URL}/api/v1/reports/dashboard`,{params:this.params()}); break;
      case 'inventory': request=this.http.get<any>(`${API_BASE_URL}/api/v1/reports/inventory/advanced`,{params:this.params()}); break;
      case 'customers': request=this.http.get<any>(`${API_BASE_URL}/api/v1/reports/customers/advanced`,{params:this.params()}); break;
      case 'suppliers': request=this.http.get<any>(`${API_BASE_URL}/api/v1/reports/suppliers/advanced`,{params:this.params()}); break;
      case 'targets': request=this.http.get<any>(`${API_BASE_URL}/api/v1/reports/targets`,{params:this.params()}); break;
      case 'quality': request=this.http.get<any>(`${API_BASE_URL}/api/v1/reports/data-quality`,{params:this.params()}); break;
      case 'reconciliation': request=this.http.get<any>(`${API_BASE_URL}/api/v1/reports/reconciliation`,{params:this.params()}); break;
      case 'scenario': request=this.http.post<any>(`${API_BASE_URL}/api/v1/reports/scenarios`,{fromDate:this.fromDate(),toDate:this.toDate(),...this.scenarioForm()}); break;
    }
    request.pipe(finalize(()=>this.loading.set(false))).subscribe({next:data=>{switch(tab){case'overview':this.overview.set(data);break;case'inventory':this.inventory.set(data);break;case'customers':this.customers.set(data);break;case'suppliers':this.suppliers.set(data);break;case'targets':this.targets.set(data);break;case'quality':this.quality.set(data);break;case'reconciliation':this.reconciliation.set(data);break;case'scenario':this.scenario.set(data);break;}},error:e=>this.toast.error(e?.error?.message||`Unable to load ${tab} report. Check your report permissions and API response.`)});
  }
  updateIssue(issue:any):void { const status=this.issueStatus()[issue.issueKey]||issue.resolutionStatus||'OPEN'; const notes=this.issueNotes()[issue.issueKey]??issue.resolutionNotes??''; this.saving.set(true); this.http.patch(`${API_BASE_URL}/api/v1/reports/data-quality/issues/${encodeURIComponent(issue.issueKey)}`,{status,notes}).pipe(finalize(()=>this.saving.set(false))).subscribe({next:()=>{this.toast.success('Issue resolution updated.');this.load();},error:e=>this.toast.error(e?.error?.message||'Unable to update issue resolution.')}); }
  saveTarget():void { const f=this.targetForm(); if(f.periodStart>f.periodEnd||f.targetValue<0){this.toast.warning('Enter a valid target period and non-negative target.');return;} this.saving.set(true); this.http.post(`${API_BASE_URL}/api/v1/reports/targets`,f).pipe(finalize(()=>this.saving.set(false))).subscribe({next:()=>{this.toast.success('Target created.');this.load();},error:e=>this.toast.error(e?.error?.message||'Unable to create target. Admin permission is required.')}); }
  runScenario():void { this.load(); }

  exportExcel(): void {
    const tab = this.activeTab();
    const book = XLSX.utils.book_new();
    const add = (name: string, rows: any[]) => {
      if (rows?.length) XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));
    };
    const flatten = (value: any): any[] => Array.isArray(value) ? value : [];
    const data: any = ({ overview:this.overview(), inventory:this.inventory(), customers:this.customers(), suppliers:this.suppliers(), targets:this.targets(), quality:this.quality(), reconciliation:this.reconciliation(), scenario:this.scenario() } as any)[tab];
    if (!data) { this.toast.warning('Load a report before exporting.'); return; }
    if (tab === 'overview') {
      const r=data;
      add('Sales', [r.sales ?? {}]); add('Purchases', [r.purchases ?? {}]); add('Expenses', [r.expenses ?? {}]);
    } else {
      const rows = data.products ?? data.customers ?? data.suppliers ?? data.targets ?? data.issues ?? data.discrepancies;
      if (Array.isArray(rows)) add(tab, rows);
      else add(tab, [data]);
    }
    if (!book.SheetNames.length) add('Report', [data]);
    XLSX.writeFile(book, `autoparts-${tab}-${this.fromDate()}-to-${this.toDate()}.xlsx`, { compression: true });
  }

  exportCsv(): void {
    const tab=this.activeTab();
    const data:any=({overview:this.overview(),inventory:this.inventory(),customers:this.customers(),suppliers:this.suppliers(),targets:this.targets(),quality:this.quality(),reconciliation:this.reconciliation(),scenario:this.scenario()} as any)[tab];
    if(!data){this.toast.warning('Load a report before exporting.');return;}
    let rows:any[]=[];
    if(tab==='overview') rows=[{section:'Sales',...(data.sales??{})},{section:'Purchases',...(data.purchases??{})},{section:'Expenses',...(data.expenses??{})}];
    else rows=data.products??data.customers??data.suppliers??data.targets??data.issues??data.discrepancies??[data];
    const csv=XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows));
    const blob=new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`autoparts-${tab}-${this.fromDate()}-to-${this.toDate()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  setIssueStatus(key:string,value:string):void { this.issueStatus.update(x=>({...x,[key]:value})); }
  setIssueNotes(key:string,value:string):void { this.issueNotes.update(x=>({...x,[key]:value})); }
  updateTarget(key:string,value:any):void { this.targetForm.update(f=>({...f,[key]:value})); }
  updateScenario(key:string,value:any):void { this.scenarioForm.update(f=>({...f,[key]:value})); }
  money(v:any):number { return Number(v??0); }
  barWidth(v:any,max:any):number { const n=Number(v??0),m=Number(max??0); return m>0?Math.max(0,Math.min(100,n/m*100)):0; }
  trackByKey(_:number,item:any):any { return item.issueKey??item.productId??item.customerId??item.supplierId??item.reference??_; }
}
