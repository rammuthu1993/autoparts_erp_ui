import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './layout/auth-layout/auth-layout.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { authGuard } from './core/auth/guards/auth.guard';
import { guestGuard } from './core/auth/guards/guest.guard';
import { permissionGuard } from './core/auth/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'auth',
    component: AuthLayoutComponent,
    canActivate: [guestGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      {
        path: 'login',
        loadComponent: () => import('./features/auth/pages/login/login.component').then(module => module.LoginComponent)
      }
    ]
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        canActivate: [permissionGuard],
        data: { permissions: ['DASHBOARD.VIEW'] },
        loadComponent: () => import('./features/dashboard/pages/dashboard/dashboard.component').then(module => module.DashboardComponent)
      },
      {
        path: 'masters/products',
        canActivate: [permissionGuard],
        data: { masterType: 'products', permissions: ['PRODUCTS.VIEW'] },
        loadComponent: () => import('./features/masters/pages/master-page/master-page.component').then(module => module.MasterPageComponent)
      },
      {
        path: 'masters/categories',
        canActivate: [permissionGuard],
        data: { masterType: 'categories', permissions: ['CATEGORIES.VIEW'] },
        loadComponent: () => import('./features/masters/pages/master-page/master-page.component').then(module => module.MasterPageComponent)
      },
      {
        path: 'masters/brands',
        canActivate: [permissionGuard],
        data: { masterType: 'brands', permissions: ['BRANDS.VIEW'] },
        loadComponent: () => import('./features/masters/pages/master-page/master-page.component').then(module => module.MasterPageComponent)
      },
      {
        path: 'masters/customers',
        canActivate: [permissionGuard],
        data: { masterType: 'customers', permissions: ['CUSTOMERS.VIEW'] },
        loadComponent: () => import('./features/masters/pages/master-page/master-page.component').then(module => module.MasterPageComponent)
      },
      {
        path: 'masters/suppliers',
        canActivate: [permissionGuard],
        data: { masterType: 'suppliers', permissions: ['SUPPLIERS.VIEW'] },
        loadComponent: () => import('./features/masters/pages/master-page/master-page.component').then(module => module.MasterPageComponent)
      },
      {
        path: 'access-denied',
        loadComponent: () => import('./shared/pages/access-denied/access-denied.component').then(module => module.AccessDeniedComponent)
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
