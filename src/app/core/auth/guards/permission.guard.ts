import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthStateService } from '../services/auth-state.service';
import { PermissionService } from '../services/permission.service';

export const permissionGuard: CanActivateFn = route => {
  const authState = inject(AuthStateService);
  const permissionService = inject(PermissionService);
  const router = inject(Router);
  const required = route.data['permissions'] as string[] | undefined;
  const requireAll = route.data['requireAllPermissions'] === true;

  if (!required?.length) return true;

  const authorize = () => {
    const checks = required.map(permission => authState.hasPermission(permission));
    return (requireAll ? checks.every(Boolean) : checks.some(Boolean))
      ? true : router.createUrlTree(['/access-denied']);
  };

  if (authState.permissionsLoaded()) return authorize();

  return permissionService.loadCurrentPermissions().pipe(
    map(() => authorize()),
    catchError(() => of(router.createUrlTree(['/access-denied'])))
  );
};
