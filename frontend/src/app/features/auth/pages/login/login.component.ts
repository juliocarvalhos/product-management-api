import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="login-wrapper">
      <div class="login-gradient-border">
        <div class="login-card">

          <div class="login-header">
            <i class="pi pi-box login-icon"></i>
            <h1>Bem-vindo ao Gerenciador!</h1>
            <p>Faça login para continuar</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()">

            <label for="email" class="login-label">E-mail</label>
            <input
              pInputText
              id="email"
              formControlName="email"
              type="email"
              placeholder="Endereço de e-mail"
              class="login-input"
              [class.ng-invalid]="isInvalid('email')"
              [class.ng-dirty]="isInvalid('email')"
            />
            @if (isInvalid('email')) {
              <small class="login-error">E-mail inválido</small>
            }

            <label for="password" class="login-label">Senha</label>
            <p-password
              inputId="password"
              formControlName="password"
              placeholder="Senha"
              [toggleMask]="true"
              [feedback]="false"
              [fluid]="true"
              [class.ng-invalid]="isInvalid('password')"
              [class.ng-dirty]="isInvalid('password')"
            />
            @if (isInvalid('password')) {
              <small class="login-error">Senha obrigatória (mín. 6 caracteres)</small>
            }

            <p-button
              type="submit"
              label="Entrar"
              styleClass="w-full"
              [loading]="loading"
              [disabled]="form.invalid"
            />

          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .login-wrapper {
      min-height: 100vh;
      background-color: var(--p-surface-50, #f8fafc);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 1rem;
    }

    .login-gradient-border {
      border-radius: 56px;
      padding: 0.3rem;
      background: linear-gradient(180deg, var(--p-primary-color, #10b981) 10%, rgba(16, 185, 129, 0) 30%);
    }

    .login-card {
      background: var(--p-surface-0, #ffffff);
      border-radius: 53px;
      padding: 4rem 3rem;
      width: 100%;
      max-width: 450px;
    }

    .login-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .login-icon {
      display: block;
      font-size: 3rem;
      color: var(--p-primary-color, #10b981);
      margin-bottom: 1rem;
    }

    h1 {
      margin: 0 0 0.5rem 0;
      font-size: 1.75rem;
      font-weight: 600;
      color: var(--p-surface-900, #0f172a);
    }

    p {
      margin: 0;
      color: var(--p-surface-500, #64748b);
      font-weight: 500;
    }

    .login-label {
      display: block;
      font-size: 1.1rem;
      font-weight: 500;
      color: var(--p-surface-900, #0f172a);
      margin-bottom: 0.5rem;
      margin-top: 1.5rem;
    }

    .login-input {
      width: 100%;
    }

    .login-error {
      display: block;
      color: #ef4444;
      font-size: 0.8rem;
      margin-top: 0.25rem;
    }

    :host ::ng-deep {
      p-password {
        width: 100%;
      }
      .p-button {
        width: 100%;
        margin-top: 2rem;
      }
    }
  `],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);

  loading = false;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched));
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading = true;

    this.authService.login(this.form.value as any).subscribe({
      next: () => this.router.navigate(['/products']),
      error: (err) => {
        this.loading = false;
        const detail =
          err.status === 401
            ? 'E-mail ou senha inválidos'
            : 'Erro ao fazer login. Tente novamente.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail });
      },
    });
  }
}
