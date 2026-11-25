import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthStateService } from '../../auth/services/auth-state.service';
import { ToastService } from '../../notifications/toast.service';

function errorMessage(error: HttpErrorResponse): string {
  if (error.status === 0) return 'Unable to reach the server. Check that the ERP backend is running.';
  const body = error.error as { message?: unknown; detail?: unknown; title?: unknown } | string | null;
  if (typeof body === 'string' && body.trim()) return body;
  if (body && typeof body === 'object') {
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
    if (typeof body.detail === 'string' && body.detail.trim()) return body.detail;
    if (typeof body.title === 'string' && body.title.trim()) return body.title;
  }
  if (error.status === 400) return 'Please check the submitted information and try again.';
  if (error.status === 403) return 'You do not have permission to perform this action.';
  if (error.status === 404) return 'The requested record could not be found.';
  if (error.status >= 500) return 'The server could not complete the request. Please try again.';
  return error.message || 'The request could not be completed.';
}

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const authState = inject(AuthStateService);
  const toast = inject(ToastService);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      const isLoginRequest = request.url.includes('/api/v1/auth/login');
      if (error.status === 401 && !isLoginRequest) {
        authState.clearSession();
        toast.error('Your session has expired. Please sign in again.', 'Session expired');
      } else if (!isLoginRequest) {
        toast.error(errorMessage(error), error.status === 403 ? 'Access denied' : 'Request failed');
      }
      return throwError(() => error);
    })
  );
};
