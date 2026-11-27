import { CommonModule } from '@angular/common';
import { SalesReturnDetailDialogComponent } from '../../components/sales-return-detail-dialog/sales-return-detail-dialog.component';
import { SalesReturnDialogComponent } from '../../components/sales-return-dialog/sales-return-dialog.component';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../../../core/http/api/api-config';
import { AuthStateService } from '../../../../core/auth/services/auth-state.service';
import { ToastService } from '../../../../core/notifications/toast.service';

type Section = 'sales-returns' | 'purchase-returns' | 'expenses' | 'ledgers';
@Component({
  selector: 'app-finance-operations',
  standalone: true,
  imports: [CommonModule, FormsModule, SalesReturnDetailDialogComponent, SalesReturnDialogComponent],
  templateUrl: './finance-operations.component.html',
  styleUrl: './finance-operations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FinanceOperationsComponent {
  private readonly route=inject(ActivatedRoute); private readonly http=inject(HttpClient); private readonly auth=inject(AuthStateService); private readonly toast=inject(ToastService);
  readonly section=signal<Section>('sales-returns'); readonly showSalesReturnModal=signal(false); readonly loading=signal(false); readonly saving=signal(false);
  readonly sales=signal<any[]>([]); readonly purchases=signal<any[]>([]); readonly selectedSale=signal<any>(null); readonly selectedPurchase=signal<any>(null);
  readonly salesReturns=signal<any[]>([]); readonly salesReturnDetail=signal<any>(null); readonly purchaseReturnDetail=signal<any>(null);
  readonly purchaseReturns=signal<any[]>([]); readonly salesReturnHistoryLoading=signal(false); readonly purchaseReturnHistoryLoading=signal(false); readonly previousSalesQty=signal<Record<string,number>>({}); readonly previousPurchaseQty=signal<Record<string,number>>({});
  readonly expenses=signal<any[]>([]); readonly categories=signal<any[]>([]); readonly expenseLedger=signal<any>(null); readonly ledgerData=signal<any>(null);
  readonly page=signal(0); readonly totalPages=signal(0); readonly search=signal(''); readonly fromDate=signal(this.monthStart()); readonly toDate=signal(this.today());
  readonly returnReason=signal(''); readonly returnNotes=signal(''); readonly returnLines=signal<Record<string,number>>({});
  readonly refundForm=signal({paymentMethod:'CASH',amount:0,referenceNumber:'',notes:''});
  readonly expenseForm=signal({categoryUuid:'',expenseDate:this.today(),title:'',description:'',amount:0,paymentMethod:'CASH',referenceNumber:'',notes:''});
  readonly ledgerType=signal<'expense'|'purchase'|'customer'|'supplier'|'sales'>('expense');
  readonly ledgerPartyUuid=signal('');
  readonly customers=signal<any[]>([]); readonly suppliers=signal<any[]>([]);
  readonly paymentMethods=['CASH','UPI','CARD','BANK'];
  readonly canRefundSales=()=>this.auth.hasPermission('SALES_RETURNS.REFUND');
  readonly canCancelExpense=()=>this.auth.hasPermission('EXPENSES.CANCEL');
  readonly canCreateExpense=()=>this.auth.hasPermission('EXPENSES.CREATE');
  readonly canCreateSalesReturn=()=>this.auth.hasPermission('SALES_RETURNS.CREATE');
  readonly canCreatePurchaseReturn=()=>this.auth.hasPermission('PURCHASE_RETURNS.CREATE');

  constructor(){const initial=this.route.snapshot.data['financeSection'] as Section|undefined;if(initial)this.section.set(initial);this.loadSales();this.loadPurchases();this.loadExpenses();this.loadCategories();this.loadLedgerParties();}
  private today():string {const d=new Date();return this.date(d);}
  private monthStart():string {const d=new Date();return this.date(new Date(d.getFullYear(),d.getMonth(),1));}
  private date(d:Date):string{return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  setSection(s:Section):void{this.section.set(s); if(s==='ledgers')this.loadLedger(); if(s==='expenses'){this.loadExpenses();this.loadCategories();}}
  loadSales():void{this.http.get<any>(`${API_BASE_URL}/api/v1/sales/paged`,{params:{page:0,size:100,sortBy:'id',sortDir:'desc'}}).subscribe({next:r=>this.sales.set(r.content??[]),error:()=>this.toast.error('Unable to load sales for returns.')});}
  loadPurchases():void{this.http.get<any>(`${API_BASE_URL}/api/v1/purchases/paged`,{params:{page:0,size:100,sortBy:'id',sortDir:'desc'}}).subscribe({next:r=>this.purchases.set(r.content??[]),error:()=>this.toast.error('Unable to load purchases for returns.')});}
  selectSale(uuid:string, openModal=true):void{if(!uuid){this.selectedSale.set(null);return;}this.loading.set(true);this.http.get<any>(`${API_BASE_URL}/api/v1/sales/${uuid}`).pipe(finalize(()=>this.loading.set(false))).subscribe({next:s=>{this.selectedSale.set(s);this.showSalesReturnModal.set(openModal);this.returnLines.set({});this.returnReason.set('');this.returnNotes.set('');this.loadSalesReturns(uuid);},error:e=>this.toast.error(e?.error?.message||'Unable to load sale details.')});}
  loadSalesReturns(uuid:string):void{
    this.salesReturnHistoryLoading.set(true);
    this.http.get<any[]>(`${API_BASE_URL}/api/v1/sales/${uuid}/returns`).subscribe({
      next: returns => {
        const values = returns ?? [];
        this.salesReturns.set(values);
        const totals: Record<string,number> = {};
        for (const detail of values) for (const line of detail.products ?? []) {
          const key = line.salesProductUuid;
          if (key) totals[key] = (totals[key] ?? 0) + Number(line.quantity ?? 0);
        }
        this.previousSalesQty.set(totals);
        this.salesReturnHistoryLoading.set(false);
      },
      error: () => { this.salesReturns.set([]); this.previousSalesQty.set({}); this.salesReturnHistoryLoading.set(false); }
    });
  }
  remainingSalesQty(line:any):number{return Math.max(0,Number(line.quantity??0)-Number(this.previousSalesQty()[line.uuid]??0));}
  remainingPurchaseQty(line:any):number{return Math.max(0,Number(line.quantity??0)-Number(this.previousPurchaseQty()[line.uuid]??0));}
  loadPurchaseReturns(uuid:string):void{
    this.purchaseReturnHistoryLoading.set(true);
    this.http.get<any[]>(`${API_BASE_URL}/api/v1/purchases/${uuid}/returns`).subscribe({
      next: returns => {
        this.purchaseReturns.set(returns??[]);
        const totals:Record<string,number>={};
        for(const r of returns??[]) for(const line of r.products??[]) {
          const key=line.purchaseProductUuid;
          if(key) totals[key]=(totals[key]??0)+Number(line.quantity??0);
        }
        this.previousPurchaseQty.set(totals); this.purchaseReturnHistoryLoading.set(false);
      },
      error:()=>{this.purchaseReturns.set([]);this.previousPurchaseQty.set({});this.purchaseReturnHistoryLoading.set(false);}
    });
  }
  showPurchaseReturn(uuid:string):void{this.http.get<any>(`${API_BASE_URL}/api/v1/purchase-returns/${uuid}`).subscribe({next:r=>this.purchaseReturnDetail.set(r),error:e=>this.toast.error(e?.error?.message||'Unable to load purchase return.')});}
  setReturnQty(key:string,value:number):void{this.returnLines.update(x=>({...x,[key]:Math.max(0,Number(value)||0)}));}
  createSalesReturn():void{
    const s=this.selectedSale(),products=(s?.products??[]).filter((p:any)=>Number(this.returnLines()[p.uuid]??0)>0).map((p:any)=>({salesProductUuid:p.uuid,quantity:Number(this.returnLines()[p.uuid])}));
    if(!s||!this.returnReason().trim()||!products.length){this.toast.warning('Select a sale, enter a return reason and at least one return quantity.');return;}
    this.saving.set(true);this.http.post<any>(`${API_BASE_URL}/api/v1/sales/${s.uuid}/returns`,{reason:this.returnReason(),notes:this.returnNotes(),products}).pipe(finalize(()=>this.saving.set(false))).subscribe({next:r=>{this.toast.success('Sales return created.');this.salesReturnDetail.set(r);this.loadSalesReturns(s.uuid);this.selectSale(s.uuid,false);},error:e=>this.toast.error(e?.error?.message||'Unable to create sales return.')});
  }
  showSalesReturn(uuid:string):void{this.http.get<any>(`${API_BASE_URL}/api/v1/sales/returns/${uuid}`).subscribe({next:r=>this.salesReturnDetail.set(r),error:e=>this.toast.error(e?.error?.message||'Unable to load return.')});}
  recordSalesRefund(r:any):void{const f=this.refundForm();if(f.amount<=0){this.toast.warning('Enter a valid refund amount.');return;}this.saving.set(true);this.http.post<any>(`${API_BASE_URL}/api/v1/sales/returns/${r.uuid}/refund`,f).pipe(finalize(()=>this.saving.set(false))).subscribe({next:x=>{this.salesReturnDetail.set(x);this.toast.success('Sales refund recorded.');this.loadSalesReturns(r.saleUuid);},error:e=>this.toast.error(e?.error?.message||'Unable to record refund.')});}
  closeSalesReturnModal():void{this.showSalesReturnModal.set(false);}
  closeSalesReturnDetail():void{this.salesReturnDetail.set(null);}
  selectPurchase(uuid:string):void{if(!uuid){this.selectedPurchase.set(null);return;}this.loading.set(true);this.http.get<any>(`${API_BASE_URL}/api/v1/purchases/${uuid}`).pipe(finalize(()=>this.loading.set(false))).subscribe({next:p=>{this.selectedPurchase.set(p);this.returnLines.set({});this.returnReason.set('');this.returnNotes.set('');this.loadPurchaseReturns(uuid);},error:e=>this.toast.error(e?.error?.message||'Unable to load purchase details.')});}
  createPurchaseReturn():void{
    const p=this.selectedPurchase(),products=(p?.products??[]).filter((x:any)=>Number(this.returnLines()[x.uuid]??0)>0).map((x:any)=>({purchaseProductUuid:x.uuid,quantity:Number(this.returnLines()[x.uuid])}));
    if(!p||!this.returnReason().trim()||!products.length){this.toast.warning('Select a purchase, enter a reason and at least one return quantity.');return;}
    this.saving.set(true);this.http.post<any>(`${API_BASE_URL}/api/v1/purchases/${p.uuid}/returns`,{reason:this.returnReason(),notes:this.returnNotes(),products}).pipe(finalize(()=>this.saving.set(false))).subscribe({next:r=>{this.purchaseReturnDetail.set(r);this.toast.success('Purchase return created and supplier credit generated.');this.loadPurchaseReturns(p.uuid);this.selectPurchase(p.uuid);},error:e=>this.toast.error(e?.error?.message||'Unable to create purchase return.')});
  }
  recordSupplierRefund(credit:any):void{const f=this.refundForm();if(f.amount<=0){this.toast.warning('Enter a valid refund amount.');return;}this.saving.set(true);this.http.post<any>(`${API_BASE_URL}/api/v1/supplier-credits/${credit.uuid}/refunds`,f).pipe(finalize(()=>this.saving.set(false))).subscribe({next:r=>{this.purchaseReturnDetail.update(x=>({...x,supplierCredit:r}));this.toast.success('Supplier refund recorded.');},error:e=>this.toast.error(e?.error?.message||'Unable to record supplier refund.')});}
  applySupplierCredit(credit:any):void{const purchaseUuid=prompt('Enter the target purchase UUID');const amount=Number(prompt('Enter credit amount to apply'));if(!purchaseUuid||!Number.isFinite(amount)||amount<=0)return;this.saving.set(true);this.http.post<any>(`${API_BASE_URL}/api/v1/supplier-credits/${credit.uuid}/applications`,{purchaseUuid,amount}).pipe(finalize(()=>this.saving.set(false))).subscribe({next:r=>{this.purchaseReturnDetail.update(x=>({...x,supplierCredit:r}));this.toast.success('Supplier credit applied.');},error:e=>this.toast.error(e?.error?.message||'Unable to apply supplier credit.')});}
  loadCategories():void{this.http.get<any>(`${API_BASE_URL}/api/v1/expense-categories/paged`,{params:{page:0,size:100,sortBy:'name',sortDir:'asc'}}).subscribe({next:r=>this.categories.set((r.content??[]).filter((x:any)=>x.active)),error:()=>this.toast.error('Unable to load expense categories.')});}
  loadExpenses():void{this.loading.set(true);this.http.get<any>(`${API_BASE_URL}/api/v1/expenses/paged`,{params:{page:this.page(),size:20,search:this.search(),sortBy:'id',sortDir:'desc'}}).pipe(finalize(()=>this.loading.set(false))).subscribe({next:r=>{this.expenses.set(r.content??[]);this.totalPages.set(r.totalPages??0);},error:e=>this.toast.error(e?.error?.message||'Unable to load expenses.')});}
  saveExpense():void{const f=this.expenseForm();if(!f.categoryUuid||!f.title.trim()||f.amount<=0){this.toast.warning('Category, title and a positive amount are required.');return;}this.saving.set(true);this.http.post(`${API_BASE_URL}/api/v1/expenses`,f).pipe(finalize(()=>this.saving.set(false))).subscribe({next:()=>{this.toast.success('Expense recorded.');this.expenseForm.set({categoryUuid:'',expenseDate:this.today(),title:'',description:'',amount:0,paymentMethod:'CASH',referenceNumber:'',notes:''});this.loadExpenses();},error:e=>this.toast.error(e?.error?.message||'Unable to create expense.')});}
  cancelExpense(uuid:string):void{if(!confirm('Cancel this expense? This action is audited.'))return;this.http.patch(`${API_BASE_URL}/api/v1/expenses/${uuid}/cancel`,{}).subscribe({next:()=>{this.toast.success('Expense cancelled.');this.loadExpenses();},error:e=>this.toast.error(e?.error?.message||'Unable to cancel expense.')});}
  loadLedgerParties():void {
    this.http.get<any>(`${API_BASE_URL}/api/v1/customers/paged`,{params:{page:0,size:100,sortBy:'customerName',sortDir:'asc'}})
      .subscribe({next:r=>this.customers.set(r.content??[]),error:()=>this.customers.set([])});
    this.http.get<any>(`${API_BASE_URL}/api/v1/suppliers/paged`,{params:{page:0,size:100,sortBy:'supplierName',sortDir:'asc'}})
      .subscribe({next:r=>this.suppliers.set(r.content??[]),error:()=>this.suppliers.set([])});
  }
  setLedgerType(type:'expense'|'purchase'|'customer'|'supplier'|'sales'):void {
    this.ledgerType.set(type); this.ledgerPartyUuid.set(''); this.ledgerData.set(null);
  }
  loadLedger():void {
    const from=this.fromDate(),to=this.toDate(),type=this.ledgerType(),party=this.ledgerPartyUuid();
    if(!from||!to||from>to){this.toast.warning('Select a valid date range.');return;}
    let url=''; let params=new HttpParams().set('fromDate',from).set('toDate',to).set('page','0').set('size','100');
    if(type==='expense') url='/api/v1/expenses/ledger';
    else if(type==='purchase') {url='/api/v1/purchases/ledger'; if(party)params=params.set('supplierUuid',party);}
    else if(type==='customer'&&party) url=`/api/v1/customers/${party}/ledger`;
    else if(type==='supplier'&&party) url=`/api/v1/suppliers/${party}/ledger`;
    else if(type==='sales'&&party) {url='/api/v1/sales-ledger';params=params.set('customerUuid',party);}
    else {this.toast.warning(type==='sales'||type==='customer'?'Select a customer to load this ledger.':'Select a supplier to load this ledger.');return;}
    this.loading.set(true); this.ledgerData.set(null);
    this.http.get<any>(`${API_BASE_URL}${url}`,{params}).pipe(finalize(()=>this.loading.set(false)))
      .subscribe({next:r=>this.ledgerData.set(r),error:e=>this.toast.error(e?.error?.message||'Unable to load ledger. Check your ledger permission and selected party.')});
  }
  ledgerSummaryEntries():any[] {const d=this.ledgerData();return Array.isArray(d?.entries)?d.entries:[];}
  exportLedger():void{const data=this.ledgerData();if(!data){this.toast.warning('Load a ledger first.');return;}const wb=XLSX.utils.book_new();const entries=data.entries??data.transactions??data.items??[];if(Array.isArray(entries)&&entries.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(entries),'Ledger Entries');const summary=data.summary??data;if(summary)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([summary]),'Summary');if(!wb.SheetNames.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([data]),'Ledger');XLSX.writeFile(wb,`${this.ledgerType()}-ledger-${this.fromDate()}-${this.toDate()}.xlsx`,{compression:true});}
  setSearch(v:string):void{this.search.set(v);this.page.set(0);this.loadExpenses();}
  setRefund(key:string,value:any):void{this.refundForm.update(x=>({...x,[key]:value}));}
  setExpense(key:string,value:any):void{this.expenseForm.update(x=>({...x,[key]:value}));}
  setDate(key:'fromDate'|'toDate',v:string):void{key==='fromDate'?this.fromDate.set(v):this.toDate.set(v);}
}
