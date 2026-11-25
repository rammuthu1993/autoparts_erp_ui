import { inject } from '@angular/core';

import {
  HttpInterceptorFn
} from '@angular/common/http';

import { AuthStateService } from '../../auth/services/auth-state.service';
import { API_BASE_URL } from '../api/api-config';

export const authInterceptor: HttpInterceptorFn = (
  request,
  next
) => {

  const authState = inject(AuthStateService);

  const token = authState.getAccessToken();

  if (!token) {
    return next(request);
  }

  const apiOrigin = new URL(API_BASE_URL).origin;
  const requestOrigin = new URL(request.url, API_BASE_URL).origin;

  if (requestOrigin !== apiOrigin) {
    return next(request);
  }

  const authenticatedRequest = request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authenticatedRequest);
};
