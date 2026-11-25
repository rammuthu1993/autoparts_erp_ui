import { inject } from '@angular/core';

import {
  CanActivateFn,
  Router
} from '@angular/router';

import { AuthStateService } from '../services/auth-state.service';

export const roleGuard: CanActivateFn = (route) => {

  const authState = inject(AuthStateService);
  const router = inject(Router);

  const allowedRoles =
    route.data['roles'] as string[] | undefined;

  if (!allowedRoles?.length) {
    return true;
  }

  const hasAccess = allowedRoles.some(
    role => authState.hasRole(role)
  );

  return hasAccess
    ? true
    : router.createUrlTree(['/access-denied']);
};
