import { Component, OnInit, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AppTopbarComponent } from './app.topbar.component';
import { AppSidebarComponent } from './app.sidebar.component';
import { LayoutService } from './app.layout.service';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [NgClass, RouterOutlet, AppTopbarComponent, AppSidebarComponent],
  template: `
    <div [ngClass]="{ 'layout-wrapper': true, 'layout-sidebar-open': layoutService.sidebarOpen() }">
      <app-topbar />
      <app-sidebar />
      <div class="layout-main-container">
        <div class="layout-main">
          <router-outlet />
        </div>
      </div>
      @if (layoutService.sidebarOpen() && !layoutService.isDesktop()) {
        <div class="layout-mask" (click)="layoutService.onMenuToggle()"></div>
      }
    </div>
  `,
})
export class AppLayoutComponent implements OnInit {
  layoutService = inject(LayoutService);
  private authService = inject(AuthService);

  ngOnInit(): void {
    this.authService.loadCurrentUser();
  }
}
