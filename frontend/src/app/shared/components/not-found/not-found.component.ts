import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    <div class="flex flex-column align-items-center justify-content-center" style="min-height: 100vh; gap: 1rem;">
      <i class="pi pi-exclamation-circle text-6xl text-300"></i>
      <h2 class="m-0 text-900">Página não encontrada</h2>
      <p class="text-500 m-0">A rota que você tentou acessar não existe ou não está disponível.</p>
      <p-button label="Voltar para Produtos" icon="pi pi-arrow-left" routerLink="/products" />
    </div>
  `,
})
export class NotFoundComponent {}
