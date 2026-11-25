import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
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
  readonly currentUrl = signal(this.router.url);

  readonly navigation: NavigationGroup[] = [
    { label: 'WORKSPACE', items: [
      { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', implemented: true, permission: 'DASHBOARD.VIEW' }
    ]},
    { label: 'OPERATIONS', items: [
      { label: 'Sales', icon: 'receipt', implemented: false },
      { label: 'Sales Returns', icon: 'receipt', implemented: false },
      { label: 'Purchases', icon: 'shopping-cart', implemented: false },
      { label: 'Purchase Returns', icon: 'truck', implemented: false },
      { label: 'Inventory', icon: 'warehouse', implemented: false },
      { label: 'Cash Register', icon: 'wallet', implemented: false },
      { label: 'Daily Closing', icon: 'calendar', implemented: false }
    ]},
    { label: 'MASTERS', items: [
      { label: 'Products', icon: 'package', route: '/masters/products', implemented: true, permission: 'PRODUCTS.VIEW' },
      { label: 'Categories', icon: 'tag', route: '/masters/categories', implemented: true, permission: 'CATEGORIES.VIEW' },
      { label: 'Brands', icon: 'tag', route: '/masters/brands', implemented: true, permission: 'BRANDS.VIEW' },
      { label: 'Customers', icon: 'users', route: '/masters/customers', implemented: true, permission: 'CUSTOMERS.VIEW' },
      { label: 'Suppliers', icon: 'truck', route: '/masters/suppliers', implemented: true, permission: 'SUPPLIERS.VIEW' },
      { label: 'Tax Setup', icon: 'receipt', implemented: false }
    ]},
    { label: 'FINANCE', items: [
      { label: 'Ledgers', icon: 'file-chart', implemented: false },
      { label: 'Expenses', icon: 'wallet', implemented: false }
    ]},
    { label: 'INSIGHTS', items: [
      { label: 'Reports & Analytics', icon: 'chart', implemented: false },
      { label: 'Data Quality', icon: 'check-circle', implemented: false },
      { label: 'Reconciliation', icon: 'receipt', implemented: false }
    ]},
    { label: 'ADMINISTRATION', items: [
      { label: 'Users & Roles', icon: 'users', implemented: false },
      { label: 'Audit Logs', icon: 'file-chart', implemented: false },
      { label: 'Settings', icon: 'settings', implemented: false }
    ]},
    { label: 'INTELLIGENCE', items: [
      { label: 'AI Assistant', icon: 'brain', implemented: false, badge: 'AI' }
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
    this.router.events.pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(event => this.currentUrl.set((event as NavigationEnd).urlAfterRedirects));
  }

  get pageTitle(): string {
    const url = this.currentUrl();
    const match = this.navigation.flatMap(group => group.items)
      .find(item => item.route === url);
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
