import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/services/auth.service';
import { AuthStateService } from '../../core/auth/services/auth-state.service';
import { AppIconComponent } from '../../shared/components/app-icon/app-icon.component';

interface NavigationItem {
  label: string;
  icon: string;
  route?: string;
  implemented: boolean;
  permission?: string;
  badge?: string;
}
interface NavigationGroup { label: string; items: NavigationItem[]; }

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AppIconComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);

  readonly mobileExpanded = signal(false);
  readonly isLoggingOut = signal(false);
  readonly navigating = signal(false);
  readonly currentUrl = signal(this.router.url);

  readonly navigation: NavigationGroup[] = [
    { label: 'WORKSPACE', items: [
      { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', implemented: true, permission: 'DASHBOARD.VIEW' }
    ]},
    { label: 'OPERATIONS', items: [
      { label: 'Sales', icon: 'receipt', route: '/operations/sales', implemented: true, permission: 'SALES.VIEW' },
      { label: 'Purchases', icon: 'shopping-cart', route: '/operations/purchases', implemented: true, permission: 'PURCHASES.VIEW' },
      { label: 'Inventory', icon: 'warehouse', route: '/operations/inventory', implemented: true, permission: 'INVENTORY.VIEW' },
      { label: 'Cash Register', icon: 'wallet', route: '/operations/cash-register', implemented: true, permission: 'CASH_REGISTER.VIEW' },
      { label: 'Daily Closing', icon: 'calendar', route: '/operations/daily-closing', implemented: true, permission: 'DAILY_CLOSING.VIEW' },
      { label: 'Sales Returns', icon: 'receipt', route: '/finance/sales-returns', implemented: true, permission: 'SALES_RETURNS.VIEW' },
      { label: 'Purchase Returns', icon: 'truck', route: '/finance/purchase-returns', implemented: true, permission: 'PURCHASE_RETURNS.VIEW' }
    ]},
    { label: 'MASTERS', items: [
      { label: 'Products', icon: 'package', route: '/masters/products', implemented: true, permission: 'PRODUCTS.VIEW' },
      { label: 'Categories', icon: 'tag', route: '/masters/categories', implemented: true, permission: 'CATEGORIES.VIEW' },
      { label: 'Brands', icon: 'tag', route: '/masters/brands', implemented: true, permission: 'BRANDS.VIEW' },
      { label: 'Customers', icon: 'users', route: '/masters/customers', implemented: true, permission: 'CUSTOMERS.VIEW' },
      { label: 'Suppliers', icon: 'truck', route: '/masters/suppliers', implemented: true, permission: 'SUPPLIERS.VIEW' },
      { label: 'Tax Setup', icon: 'receipt', route: '/masters/tax-setup', implemented: true, permission: 'TAX_RATES.VIEW' }
    ]},
    { label: 'FINANCE', items: [
      { label: 'Ledgers', icon: 'file-chart', route: '/finance/ledgers', implemented: true, permission: 'EXPENSES.LEDGER_VIEW' },
      { label: 'Expenses', icon: 'wallet', route: '/finance/expenses', implemented: true, permission: 'EXPENSES.VIEW' }
    ]},
    { label: 'INSIGHTS', items: [
      { label: 'Reports & Analytics', icon: 'chart', route: '/reports', implemented: true, permission: 'REPORTS.VIEW' }
    ]},
    { label: 'ADMINISTRATION', items: [
      { label: 'Users', icon: 'users', route: '/admin/users', implemented: true, permission: 'USERS.VIEW' },
      { label: 'Roles & Permissions', icon: 'shield', route: '/admin/roles', implemented: true, permission: 'ROLES.VIEW' },
      { label: 'Audit Logs', icon: 'file-chart', route: '/admin/audit-logs', implemented: true, permission: 'AUDIT_LOGS.VIEW' },
      { label: 'Settings', icon: 'settings', route: '/admin/settings', implemented: true, permission: 'USERS.VIEW' }
    ]},
    { label: 'INTELLIGENCE', items: [
      { label: 'AI Assistant', icon: 'brain', route: '/ai-assistant', implemented: true, permission: 'AI_ASSISTANT.USE', badge: 'AI' }
    ]}
  ];

  readonly visibleNavigation = computed(() => this.navigation
    .map(group => ({
      ...group,
      items: group.items.filter(item => !item.permission || this.authState.hasPermission(item.permission))
    }))
    .filter(group => group.items.length > 0));

  readonly username = this.authState.currentUser;
  readonly roles = this.authState.roles;

  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) this.navigating.set(true);
      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects);
        this.navigating.set(false);
        this.mobileExpanded.set(false);
      }
      if (event instanceof NavigationCancel || event instanceof NavigationError) this.navigating.set(false);
    });
  }

  get pageTitle(): string {
    const url = this.currentUrl();
    const match = this.navigation.flatMap(group => group.items)
      .find(item => item.route === url || (item.route && url.startsWith(item.route + '/')));
    return match?.label ?? 'Workspace';
  }

  get displayName(): string { return this.username()?.username ?? 'ERP User'; }
  get initials(): string { return this.displayName.slice(0, 2).toUpperCase(); }

  toggleMobileSidebar(): void { this.mobileExpanded.update(value => !value); }
  closeMobileSidebar(): void { this.mobileExpanded.set(false); }

  logout(): void {
    if (this.isLoggingOut()) return;
    this.isLoggingOut.set(true);
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/auth/login']),
      error: () => this.router.navigate(['/auth/login']),
      complete: () => this.isLoggingOut.set(false)
    });
  }
}
