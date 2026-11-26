import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './layout/auth-layout/auth-layout.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { authGuard } from './core/auth/guards/auth.guard';
import { guestGuard } from './core/auth/guards/guest.guard';
import { permissionGuard } from './core/auth/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'auth', component: AuthLayoutComponent, canActivate: [guestGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      { path: 'login', loadComponent: () => import('./features/auth/pages/login/login.component').then(m => m.LoginComponent) }
    ]
  },
  {
    path: '', component: MainLayoutComponent, canActivate: [authGuard],
    children: [
      { path: 'dashboard', canActivate: [permissionGuard], data: { permissions: ['DASHBOARD.VIEW'] },
        loadComponent: () => import('./features/dashboard/pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },

      { path: 'masters/products', canActivate: [permissionGuard], data: { masterType: 'products', permissions: ['PRODUCTS.VIEW'] },
        loadComponent: () => import('./features/masters/pages/master-page/master-page.component').then(m => m.MasterPageComponent) },
      { path: 'masters/categories', canActivate: [permissionGuard], data: { masterType: 'categories', permissions: ['CATEGORIES.VIEW'] },
        loadComponent: () => import('./features/masters/pages/master-page/master-page.component').then(m => m.MasterPageComponent) },
      { path: 'masters/brands', canActivate: [permissionGuard], data: { masterType: 'brands', permissions: ['BRANDS.VIEW'] },
        loadComponent: () => import('./features/masters/pages/master-page/master-page.component').then(m => m.MasterPageComponent) },
      { path: 'masters/customers', canActivate: [permissionGuard], data: { masterType: 'customers', permissions: ['CUSTOMERS.VIEW'] },
        loadComponent: () => import('./features/masters/pages/master-page/master-page.component').then(m => m.MasterPageComponent) },
      { path: 'masters/suppliers', canActivate: [permissionGuard], data: { masterType: 'suppliers', permissions: ['SUPPLIERS.VIEW'] },
        loadComponent: () => import('./features/masters/pages/master-page/master-page.component').then(m => m.MasterPageComponent) },

      { path: 'operations/sales', canActivate: [permissionGuard], data: { permissions: ['SALES.VIEW'] },
        loadComponent: () => import('./features/sales/pages/sales-page/sales-page.component').then(m => m.SalesPageComponent) },
      { path: 'operations/purchases', canActivate: [permissionGuard], data: { operationType: 'purchases', permissions: ['PURCHASES.VIEW'] },
        loadComponent: () => import('./features/operations/pages/operations-page/operations-page.component').then(m => m.OperationsPageComponent) },
      { path: 'operations/inventory', canActivate: [permissionGuard], data: { operationType: 'inventory', permissions: ['INVENTORY.VIEW'] },
        loadComponent: () => import('./features/operations/pages/operations-page/operations-page.component').then(m => m.OperationsPageComponent) },
      { path: 'operations/cash-register', canActivate: [permissionGuard], data: { operationType: 'cash-register', permissions: ['CASH_REGISTER.VIEW'] },
        loadComponent: () => import('./features/operations/pages/operations-page/operations-page.component').then(m => m.OperationsPageComponent) },
      { path: 'operations/daily-closing', canActivate: [permissionGuard], data: { operationType: 'daily-closing', permissions: ['DAILY_CLOSING.VIEW'] },
        loadComponent: () => import('./features/operations/pages/operations-page/operations-page.component').then(m => m.OperationsPageComponent) },

      { path: 'finance/sales-returns', canActivate: [permissionGuard], data: { permissions: ['SALES_RETURNS.VIEW'], financeSection: 'sales-returns' },
        loadComponent: () => import('./features/finance/pages/finance-operations/finance-operations.component').then(m => m.FinanceOperationsComponent) },
      { path: 'finance/purchase-returns', canActivate: [permissionGuard], data: { permissions: ['PURCHASE_RETURNS.VIEW'], financeSection: 'purchase-returns' },
        loadComponent: () => import('./features/finance/pages/finance-operations/finance-operations.component').then(m => m.FinanceOperationsComponent) },
      { path: 'finance/expenses', canActivate: [permissionGuard], data: { permissions: ['EXPENSES.VIEW'], financeSection: 'expenses' },
        loadComponent: () => import('./features/finance/pages/finance-operations/finance-operations.component').then(m => m.FinanceOperationsComponent) },
      { path: 'finance/ledgers', canActivate: [permissionGuard], data: { permissions: ['EXPENSES.LEDGER_VIEW'], financeSection: 'ledgers' },
        loadComponent: () => import('./features/finance/pages/finance-operations/finance-operations.component').then(m => m.FinanceOperationsComponent) },

      { path: 'masters/tax-setup', canActivate: [permissionGuard], data: { permissions: ['TAX_RATES.VIEW'] },
        loadComponent: () => import('./features/tax/pages/tax-setup/tax-setup.component').then(m => m.TaxSetupComponent) },

      { path: 'admin/users', canActivate: [permissionGuard], data: { adminTab: 'users', permissions: ['USERS.VIEW'] },
        loadComponent: () => import('./features/administration/pages/administration/administration.component').then(m => m.AdministrationComponent) },
      { path: 'admin/roles', canActivate: [permissionGuard], data: { adminTab: 'roles', permissions: ['ROLES.VIEW'] },
        loadComponent: () => import('./features/administration/pages/administration/administration.component').then(m => m.AdministrationComponent) },
      { path: 'admin/audit-logs', canActivate: [permissionGuard], data: { adminTab: 'audit', permissions: ['AUDIT_LOGS.VIEW'] },
        loadComponent: () => import('./features/administration/pages/administration/administration.component').then(m => m.AdministrationComponent) },
      { path: 'admin/settings', canActivate: [permissionGuard], data: { adminTab: 'settings', permissions: ['USERS.VIEW'] },
        loadComponent: () => import('./features/administration/pages/administration/administration.component').then(m => m.AdministrationComponent) },

      { path: 'reports', canActivate: [permissionGuard], data: { permissions: ['REPORTS.VIEW'] },
        loadComponent: () => import('./features/reports/pages/reports-page/reports-page.component').then(m => m.ReportsPageComponent) },

      { path: 'ai-assistant', canActivate: [permissionGuard], data: { permissions: ['AI_ASSISTANT.USE'] },
        loadComponent: () => import('./features/ai-assistant/pages/ai-assistant/ai-assistant.component').then(m => m.AiAssistantComponent) },

      { path: 'access-denied', loadComponent: () => import('./shared/pages/access-denied/access-denied.component').then(m => m.AccessDeniedComponent) },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
