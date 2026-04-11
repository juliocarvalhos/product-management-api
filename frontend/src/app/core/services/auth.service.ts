import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LoginRequest, TokenResponse, UserResponse } from '../models/auth.model';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private tokenStorage = inject(TokenStorageService);

  private readonly apiUrl = `${environment.apiUrl}/auth`;

  private _refreshing$ = new BehaviorSubject<boolean>(false);
  readonly isRefreshing$ = this._refreshing$.asObservable();

  readonly currentUser = signal<UserResponse | null>(null);

  login(body: LoginRequest): Observable<TokenResponse> {
    // Fix 3: withCredentials so the browser accepts the HttpOnly refresh cookie
    return this.http.post<TokenResponse>(`${this.apiUrl}/login`, body, { withCredentials: true }).pipe(
      tap((res) => {
        this.tokenStorage.setAccessToken(res.access_token);
        this.loadCurrentUser();
      })
    );
  }

  // Called on app init to restore the session after a page reload.
  // The HttpOnly cookie is sent automatically; if valid, a new access token is returned.
  tryRestoreSession(): Observable<TokenResponse> {
    return this.refreshToken();
  }

  loadCurrentUser(): void {
    if (!this.tokenStorage.isLoggedIn()) return;
    this.me().subscribe({ next: (user) => this.currentUser.set(user) });
  }

  logout(): Observable<unknown> {
    // Fix 3: no refresh_token body — the cookie is sent automatically via withCredentials
    return this.http
      .post(`${this.apiUrl}/logout`, {}, { withCredentials: true })
      .pipe(tap(() => this._clearSession()));
  }

  refreshToken(): Observable<TokenResponse> {
    this._refreshing$.next(true);
    // Fix 3: no refresh_token body — cookie is sent automatically via withCredentials
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((res) => {
          this.tokenStorage.setAccessToken(res.access_token);
          this._refreshing$.next(false);
        })
      );
  }

  me(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.apiUrl}/me`);
  }

  isLoggedIn(): boolean {
    return this.tokenStorage.isLoggedIn();
  }

  clearSessionAndRedirect(): void {
    this._clearSession();
    this.router.navigate(['/auth/login']);
  }

  private _clearSession(): void {
    this.tokenStorage.clear();
    this.currentUser.set(null);
    this._refreshing$.next(false);
  }
}
