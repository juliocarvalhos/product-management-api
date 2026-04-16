import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, EMPTY } from 'rxjs';
import { MessageService } from 'primeng/api';

import { LoginComponent } from './login.component';
import { AuthService } from '../../../../core/services/auth.service';
import { TokenResponse } from '../../../../core/models/auth.model';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;
  let messageService: MessageService;

  const mockTokenResponse: TokenResponse = {
    access_token: 'token-abc',
    token_type: 'bearer',
  };

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', ['login']);
    // Default: return EMPTY so tests that don't configure login won't throw
    authSpy.login.and.returnValue(EMPTY);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        // Provide the real Router (empty routes) so inject(Router) inside the
        // component resolves correctly; we spy on navigate after creation.
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;

    // Spy on the real Router instance that Angular resolved for this TestBed.
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.stub();

    // MessageService is in the component's own providers — get it from there and spy.
    messageService = fixture.debugElement.injector.get(MessageService);
    spyOn(messageService, 'add');

    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Form validation
  // ---------------------------------------------------------------------------

  describe('form validation', () => {
    it('should be invalid when email is empty', () => {
      component.form.setValue({ email: '', password: 'password123' });
      expect(component.form.invalid).toBeTrue();
    });

    it('should be invalid when email is malformed', () => {
      component.form.setValue({ email: 'not-an-email', password: 'password123' });
      expect(component.form.invalid).toBeTrue();
    });

    it('should be invalid when password has fewer than 6 characters', () => {
      component.form.setValue({ email: 'test@example.com', password: '123' });
      expect(component.form.invalid).toBeTrue();
    });

    it('should be invalid when password is empty', () => {
      component.form.setValue({ email: 'test@example.com', password: '' });
      expect(component.form.invalid).toBeTrue();
    });

    it('should be valid with a correct email and password of at least 6 characters', () => {
      component.form.setValue({ email: 'test@example.com', password: '123456' });
      expect(component.form.valid).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------------
  // isInvalid()
  // ---------------------------------------------------------------------------

  describe('isInvalid()', () => {
    it('should return false for a pristine untouched field', () => {
      expect(component.isInvalid('email')).toBeFalse();
    });

    it('should return true when an invalid field is touched', () => {
      component.form.get('email')!.markAsTouched();
      expect(component.isInvalid('email')).toBeTrue();
    });

    it('should return true when an invalid field is dirty', () => {
      component.form.get('email')!.markAsDirty();
      expect(component.isInvalid('email')).toBeTrue();
    });

    it('should return false when a field is valid and touched', () => {
      component.form.setValue({ email: 'valid@example.com', password: 'pass123' });
      component.form.get('email')!.markAsTouched();
      expect(component.isInvalid('email')).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------------
  // onSubmit()
  // ---------------------------------------------------------------------------

  describe('onSubmit()', () => {
    it('should not call authService.login when the form is invalid', () => {
      component.form.setValue({ email: '', password: '' });
      component.onSubmit();
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should not navigate and not show toast when form is invalid', () => {
      component.form.setValue({ email: '', password: '' });
      component.onSubmit();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(messageService.add).not.toHaveBeenCalled();
    });

    it('should call authService.login with the form values on a valid submit', () => {
      authService.login.and.returnValue(of(mockTokenResponse));
      component.form.setValue({ email: 'test@example.com', password: 'password123' });
      component.onSubmit();

      expect(authService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should navigate to /products after a successful login', () => {
      authService.login.and.returnValue(of(mockTokenResponse));
      component.form.setValue({ email: 'test@example.com', password: 'password123' });
      component.onSubmit();

      expect(router.navigate).toHaveBeenCalledWith(['/products']);
    });

    it('should show "E-mail ou senha inválidos" toast on a 401 response', () => {
      authService.login.and.returnValue(throwError(() => ({ status: 401 })));
      component.form.setValue({ email: 'test@example.com', password: 'wrong-password' });
      component.onSubmit();

      expect(messageService.add).toHaveBeenCalledWith(
        jasmine.objectContaining({
          severity: 'error',
          detail: 'E-mail ou senha inválidos',
        })
      );
    });

    it('should show a generic error toast on a non-401 error', () => {
      authService.login.and.returnValue(throwError(() => ({ status: 500 })));
      component.form.setValue({ email: 'test@example.com', password: 'password123' });
      component.onSubmit();

      expect(messageService.add).toHaveBeenCalledWith(
        jasmine.objectContaining({
          severity: 'error',
          detail: 'Erro ao fazer login. Tente novamente.',
        })
      );
    });

    it('should reset loading to false after a login error', () => {
      authService.login.and.returnValue(throwError(() => ({ status: 500 })));
      component.form.setValue({ email: 'test@example.com', password: 'password123' });
      component.onSubmit();

      expect(component.loading).toBeFalse();
    });
  });
});
