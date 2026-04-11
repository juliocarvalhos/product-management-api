import { Injectable } from '@angular/core';

// Fix 3: access token stored in memory (not localStorage) — inaccessible to XSS.
// The refresh token lives exclusively in an HttpOnly cookie set by the backend;
// JavaScript never touches it. On page reload, AuthService calls /auth/refresh
// to restore the access token using the cookie.

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private _accessToken: string | null = null;

  getAccessToken(): string | null {
    return this._accessToken;
  }

  setAccessToken(access: string): void {
    this._accessToken = access;
  }

  clear(): void {
    this._accessToken = null;
  }

  isLoggedIn(): boolean {
    return !!this._accessToken;
  }
}
