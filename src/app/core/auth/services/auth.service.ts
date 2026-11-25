import { inject, Injectable } from '@angular/core';

import {
  HttpClient
} from '@angular/common/http';

import {
  Observable,
  finalize,
  tap
} from 'rxjs';

import { LoginRequest, RefreshTokenRequest } from '../models/auth-request.model';
import { LoginResponse } from '../models/auth-response.model';

import { AuthStateService } from './auth-state.service';

import { AUTH_API } from '../../http/api/api-config';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly http = inject(HttpClient);

  private readonly authState = inject(AuthStateService);

  login(request: LoginRequest): Observable<LoginResponse> {

    return this.http
      .post<LoginResponse>(
        AUTH_API.login,
        request
      )
      .pipe(
        tap(response => this.authState.setSession(response))
      );
  }

  refresh(): Observable<LoginResponse> {
    const refreshToken = this.authState.getRefreshToken();

    if (!refreshToken) {
      throw new Error('Refresh token is unavailable.');
    }

    const request: RefreshTokenRequest = { refreshToken };

    return this.http
      .post<LoginResponse>(AUTH_API.refresh, request)
      .pipe(
        tap(response => this.authState.setSession(response))
      );
  }

  logout(): Observable<void> {
    const refreshToken = this.authState.getRefreshToken();

    if (!refreshToken) {
      this.authState.clearSession();
      return new Observable<void>(subscriber => {
        subscriber.next();
        subscriber.complete();
      });
    }

    return this.http
      .post<void>(AUTH_API.logout, { refreshToken })
      .pipe(
        finalize(() => this.authState.clearSession())
      );
  }

  clearLocalSession(): void {
    this.authState.clearSession();
  }
}
