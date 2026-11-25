import { Injectable, computed, signal } from '@angular/core';

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  username: string;
  roles: string[];
  permissions: string[];
  permissionsLoaded: boolean;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly sessionState = signal<AuthSession | null>(null);

  readonly currentUser = computed(() => {
    const session = this.sessionState();
    return session ? { username: session.username } : null;
  });
  readonly isAuthenticated = computed(() => this.sessionState() !== null);
  readonly roles = computed(() => this.sessionState()?.roles ?? []);
  readonly permissions = computed(() => this.sessionState()?.permissions ?? []);
  readonly permissionsLoaded = computed(() => this.sessionState()?.permissionsLoaded ?? false);

  setSession(response: {
    accessToken: string;
    refreshToken: string;
    username: string;
    expiresInSeconds: number;
  }): void {
    this.sessionState.set({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      username: response.username,
      roles: this.extractRoles(response.accessToken),
      permissions: [],
      permissionsLoaded: false,
      expiresAt: Date.now() + response.expiresInSeconds * 1000
    });
  }

  setPermissions(permissions: string[]): void {
    this.sessionState.update(session => session
      ? { ...session, permissions: [...new Set(permissions)], permissionsLoaded: true }
      : null);
  }

  getAccessToken(): string | null { return this.sessionState()?.accessToken ?? null; }
  getRefreshToken(): string | null { return this.sessionState()?.refreshToken ?? null; }

  hasRole(role: string): boolean {
    const normalized = role.startsWith('ROLE_') ? role : `ROLE_${role}`;
    return this.roles().includes(normalized);
  }

  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  clearSession(): void { this.sessionState.set(null); }

  private extractRoles(token: string): string[] {
    try {
      const payload = token.split('.')[1];
      if (!payload) return [];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { roles?: string[] };
      return (decoded.roles ?? []).map(role => role.startsWith('ROLE_') ? role : `ROLE_${role}`);
    } catch {
      return [];
    }
  }
}
