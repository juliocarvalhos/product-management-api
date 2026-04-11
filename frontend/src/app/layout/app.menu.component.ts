import { Component, effect, inject } from '@angular/core';
import { AppMenuItemComponent, MenuItem } from './app.menuitem.component';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [AppMenuItemComponent],
  template: `
    <ul class="layout-menu">
      @for (item of model; track item.label; let i = $index) {
        @if (item.separator) {
          <li class="menu-separator"></li>
        } @else {
          <app-menuitem [item]="item" [depth]="0" />
        }
      }
    </ul>
  `,
})
export class AppMenuComponent {
  private authService = inject(AuthService);
  model: MenuItem[] = [];

  constructor() {
    effect(() => {
      const role = this.authService.currentUser()?.role;

      this.model = [
        {
          label: 'Produtos',
          icon: 'pi pi-fw pi-box',
          routerLink: ['/products'],
        },
        ...(role === 'admin' ? [{
          label: 'Auditoria',
          icon: 'pi pi-fw pi-list',
          routerLink: ['/audit-logs'],
        }] : []),
      ];
    });
  }
}
