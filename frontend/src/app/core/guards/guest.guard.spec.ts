import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { of, throwError } from 'rxjs';

import { guestGuard } from './guest.guard';
import { AuthService } from '../services/auth.service';
import { TokenResponse } from '../models/auth.model';

describe('guestGuard', () => {
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

  it('should redirect to /products immediately when user is already logged in', async () => {
    authService.isLoggedIn.and.returnValue(true);

    await TestBed.runInInjectionContext(() => guestGuard(mockRoute, mockState));

    expect(router.createUrlTree).toHaveBeenCalledWith(['/products']);
    expect(authService.tryRestoreSession).not.toHaveBeenCalled();
  });

  it('should redirect to /products when session is restored via refresh cookie', async () => {
    authService.isLoggedIn.and.returnValue(false);
    authService.tryRestoreSession.and.returnValue(of(mockTokenResponse));

    await TestBed.runInInjectionContext(() => guestGuard(mockRoute, mockState));

    expect(router.createUrlTree).toHaveBeenCalledWith(['/products']);
  });

  it('should allow access to login page when no valid session exists', async () => {
    authService.isLoggedIn.and.returnValue(false);
    authService.tryRestoreSession.and.returnValue(
      throwError(() => new Error('No session'))
    );

    const result = await TestBed.runInInjectionContext(() =>
      guestGuard(mockRoute, mockState)
    );

    expect(result).toBeTrue();
  });
});
