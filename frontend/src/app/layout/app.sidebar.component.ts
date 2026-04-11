import { Component, ElementRef } from '@angular/core';
import { AppMenuComponent } from './app.menu.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [AppMenuComponent],
  template: `
    <div #sidebarContainer class="layout-sidebar">
      <a class="layout-topbar-logo" href="#">
        <i class="pi pi-box" style="font-size: 1.8rem; color: var(--primary-color)"></i>
        <span>Gerenciador</span>
      </a>
      <app-menu />
    </div>
  `,
})
export class AppSidebarComponent {
  constructor(public el: ElementRef) {}
}
