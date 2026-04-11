import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';
import { TokenResponse, UserResponse } from '../models/auth.model';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let tokenStorage: TokenStorageService;
  let router: Router;

  const BASE = 'http://localhost:8000/api/v1/auth';

  const mockTokenResponse: TokenResponse = {
    access_token: 'mock-access-token',
    token_type: 'bearer',
  };

  const mockUser: UserResponse = {
    id: 'uuid-1',
    email: 'test@example.com',
    username: 'testuser',
    role: 'leitor',
    is_active: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // Explicit providers (not relying on providedIn: 'root') ensure each test
        // gets fresh instances that share the same injector scope.
        AuthService,
        TokenStorageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    tokenStorage = TestBed.inject(TokenStorageService);
    router = TestBed.inject(Router);
    tokenStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    tokenStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // login()
  // ---------------------------------------------------------------------------

  describe('login()', () => {
    it('should POST to /auth/login with withCredentials', () => {
      service.login({ email: 'test@example.com', password: 'password123' }).subscribe();

      const req = httpMock.expectOne(`${BASE}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      req.flush(mockTokenResponse);

      // loadCurrentUser triggers /me
      httpMock.expectOne(`${BASE}/me`).flush(mockUser);
    });

    it('should store the access token after a successful login', () => {
      service.login({ email: 'test@example.com', password: 'password123' }).subscribe();
      httpMock.expectOne(`${BASE}/login`).flush(mockTokenResponse);
      httpMock.expectOne(`${BASE}/me`).flush(mockUser);

      expect(tokenStorage.getAccessToken()).toBe('mock-access-token');
      expect(tokenStorage.isLoggedIn()).toBeTrue();
    });

    it('should propagate the error and not store a token on login failure', () => {
      let errorCaught = false;
      service.login({ email: 'wrong@example.com', password: 'wrong' }).subscribe({
        error: () => (errorCaught = true),
      });

      httpMock.expectOne(`${BASE}/login`).flush(
        { detail: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' }
      );

      expect(errorCaught).toBeTrue();
      expect(tokenStorage.isLoggedIn()).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------------
  // logout()
  // ---------------------------------------------------------------------------

  describe('logout()', () => {
    it('should POST to /auth/logout with withCredentials', () => {
      tokenStorage.setAccessToken('some-token');
      service.logout().subscribe();

      const req = httpMock.expectOne(`${BASE}/logout`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      req.flush({});
    });

    it('should clear the token and currentUser signal after logout', () => {
      tokenStorage.setAccessToken('some-token');
      service.logout().subscribe();
      httpMock.expectOne(`${BASE}/logout`).flush({});

      expect(tokenStorage.isLoggedIn()).toBeFalse();
      expect(service.currentUser()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // refreshToken()
  // ---------------------------------------------------------------------------

  describe('refreshToken()', () => {
    it('should POST to /auth/refresh with withCredentials and store the new token', () => {
      service.refreshToken().subscribe();

      const req = httpMock.expectOne(`${BASE}/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      req.flush(mockTokenResponse);

      expect(tokenStorage.getAccessToken()).toBe('mock-access-token');
    });

    it('should emit true during refresh and false after completion', () => {
      const states: boolean[] = [];
      service.isRefreshing$.subscribe(v => states.push(v));

      service.refreshToken().subscribe();
      httpMock.expectOne(`${BASE}/refresh`).flush(mockTokenResponse);

      expect(states).toEqual([false, true, false]);
    });
  });

  // ---------------------------------------------------------------------------
  // isLoggedIn()
  // ---------------------------------------------------------------------------

  describe('isLoggedIn()', () => {
    it('should return false when no token is stored', () => {
      expect(service.isLoggedIn()).toBeFalse();
    });

    it('should return true when a token is present', () => {
      tokenStorage.setAccessToken('any-token');
      expect(service.isLoggedIn()).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------------
  // clearSessionAndRedirect()
  // ---------------------------------------------------------------------------

  describe('clearSessionAndRedirect()', () => {
    it('should clear the token and navigate to /auth/login', () => {
      const navigateSpy = spyOn(router, 'navigate');
      tokenStorage.setAccessToken('some-token');

      service.clearSessionAndRedirect();

      expect(tokenStorage.isLoggedIn()).toBeFalse();
      expect(service.currentUser()).toBeNull();
      expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
    });
  });

  // ---------------------------------------------------------------------------
  // currentUser signal
  // ---------------------------------------------------------------------------

  describe('currentUser signal', () => {
    it('should be null before any login', () => {
      expect(service.currentUser()).toBeNull();
    });

    it('should be populated after a successful login', () => {
      service.login({ email: 'test@example.com', password: 'password123' }).subscribe();
      httpMock.expectOne(`${BASE}/login`).flush(mockTokenResponse);
      httpMock.expectOne(`${BASE}/me`).flush(mockUser);

      expect(service.currentUser()).toEqual(mockUser);
    });

    it('should be cleared after logout', () => {
      // Simulate a logged-in state
      service.login({ email: 'test@example.com', password: 'password123' }).subscribe();
      httpMock.expectOne(`${BASE}/login`).flush(mockTokenResponse);
      httpMock.expectOne(`${BASE}/me`).flush(mockUser);

      service.logout().subscribe();
      httpMock.expectOne(`${BASE}/logout`).flush({});

      expect(service.currentUser()).toBeNull();
    });
  });
});
