import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { of, throwError } from 'rxjs';

import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { TokenResponse } from '../models/auth.model';

describe('authGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  const mockTokenResponse: TokenResponse = {
    access_token: 'restored-token',
    token_type: 'bearer',
  };

  beforeEach(() => {
    const authSpy = jasmine.createSpyObj('AuthService', [
      'isLoggedIn',
      'tryRestoreSession',
    ]);
    const routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.callFake((commands: string[]) => commands);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should allow navigation and skip session restore when already logged in', async () => {
    authService.isLoggedIn.and.returnValue(true);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, mockState)
    );

    expect(result).toBeTrue();
    expect(authService.tryRestoreSession).not.toHaveBeenCalled();
  });

  it('should allow navigation when session is restored via refresh cookie', async () => {
    authService.isLoggedIn.and.returnValue(false);
    authService.tryRestoreSession.and.returnValue(of(mockTokenResponse));

    const result = await TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, mockState)
    );

    expect(result).toBeTrue();
  });

  it('should redirect to /auth/login when not logged in and refresh fails', async () => {
    authService.isLoggedIn.and.returnValue(false);
    authService.tryRestoreSession.and.returnValue(
      throwError(() => new Error('No valid session'))
    );

    const result = await TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, mockState)
    );

    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth/login']);
  });
});
