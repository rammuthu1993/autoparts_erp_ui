import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { AuthStateService } from './auth-state.service';
import { API_BASE_URL } from '../../http/api/api-config';

export interface EffectivePermissionsResponse {
  userUuid: string;
  username: string;
  roles: string[];
  permissions: string[];
}

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly authState = inject(AuthStateService);
  private readonly http = inject(HttpClient);

  loadCurrentPermissions(force = false): Observable<string[]> {
    if (this.authState.permissionsLoaded() && !force) {
      return new Observable(subscriber => {
        subscriber.next(this.authState.permissions());
        subscriber.complete();
      });
    }
    return this.http.get<EffectivePermissionsResponse>(
      `${API_BASE_URL}/api/v1/admin/users/me/permissions`
    ).pipe(
      map(response => response.permissions ?? []),
      tap(permissions => this.authState.setPermissions(permissions))
    );
  }

  hasRole(role: string): boolean { return this.authState.hasRole(role); }
  hasAnyRole(roles: string[]): boolean { return roles.some(role => this.hasRole(role)); }
  hasAllRoles(roles: string[]): boolean { return roles.every(role => this.hasRole(role)); }
  hasPermission(permission: string): boolean { return this.authState.hasPermission(permission); }
  hasAnyPermission(permissions: string[]): boolean { return permissions.some(p => this.hasPermission(p)); }
  hasAllPermissions(permissions: string[]): boolean { return permissions.every(p => this.hasPermission(p)); }
}
