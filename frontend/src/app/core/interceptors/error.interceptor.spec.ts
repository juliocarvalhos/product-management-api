import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { errorInterceptor } from './error.interceptor';
import { AuthService } from '../services/auth.service';
import { TokenResponse } from '../models/auth.model';

/**
 * NOTE: errorInterceptor holds two module-level variables (isRefreshing, refreshTokenSubject).
 * Tests are ordered so each one fully completes its HTTP cycle, resetting isRefreshing to false
 * before the next test starts. Do not reorder tests in a way that leaves isRefreshing = true.
 */
describe('errorInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;

  const mockTokenResponse: TokenResponse = {
    access_token: 'new-access-token',
    token_type: 'bearer',
  };

  beforeEach(() => {
    const authSpy = jasmine.createSpyObj('AuthService', [
      'refreshToken',
      'clearSessionAndRedirect',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ---------------------------------------------------------------------------
  // Pass-through cases (no refresh attempt)
  // ---------------------------------------------------------------------------

  it('should pass through non-401 errors without attempting a refresh', () => {
    let capturedStatus = 0;
    httpClient.get('/api/products').subscribe({
      error: (e) => (capturedStatus = e.status),
    });

    httpMock.expectOne('/api/products').flush(
      { detail: 'Server Error' },
      { status: 500, statusText: 'Internal Server Error' }
    );

    expect(capturedStatus).toBe(500);
    expect(authService.refreshToken).not.toHaveBeenCalled();
  });

  it('should pass through 401 on /auth/login without attempting a refresh', () => {
    let capturedStatus = 0;
    httpClient.post('/api/v1/auth/login', {}).subscribe({
      error: (e) => (capturedStatus = e.status),
    });

    httpMock.expectOne('/api/v1/auth/login').flush(
      { detail: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(capturedStatus).toBe(401);
    expect(authService.refreshToken).not.toHaveBeenCalled();
  });

  it('should pass through 401 on /auth/refresh without triggering another refresh', () => {
    let capturedStatus = 0;
    httpClient.post('/api/v1/auth/refresh', {}).subscribe({
      error: (e) => (capturedStatus = e.status),
    });

    httpMock.expectOne('/api/v1/auth/refresh').flush(
      { detail: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(capturedStatus).toBe(401);
    expect(authService.refreshToken).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Refresh + retry
  // ---------------------------------------------------------------------------

  it('should retry the request with the new token after a successful refresh', () => {
    authService.refreshToken.and.returnValue(of(mockTokenResponse));

    let response: unknown;
    httpClient.get('/api/products').subscribe({ next: (r) => (response = r) });

    // First attempt — gets 401
    httpMock.expectOne('/api/products').flush(
      { detail: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );

    // Interceptor retries with Authorization header set to the new token
    const retryReq = httpMock.expectOne('/api/products');
    expect(retryReq.request.headers.get('Authorization')).toBe(
      'Bearer new-access-token'
    );
    retryReq.flush({ items: [] });

    expect(response).toEqual({ items: [] });
  });

  // ---------------------------------------------------------------------------
  // Refresh failure
  // ---------------------------------------------------------------------------

  it('should call clearSessionAndRedirect when the refresh attempt fails', () => {
    authService.refreshToken.and.returnValue(
      throwError(() => ({ status: 401, statusText: 'Unauthorized' }))
    );

    httpClient.get('/api/products').subscribe({ error: () => {} });

    httpMock.expectOne('/api/products').flush(
      { detail: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(authService.clearSessionAndRedirect).toHaveBeenCalled();
  });
});
