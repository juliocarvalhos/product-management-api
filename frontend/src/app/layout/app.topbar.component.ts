import { DatePipe, NgClass } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterModule } from '@angular/router';
import { interval, startWith, switchMap } from 'rxjs';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';

import { Notification } from '../features/notifications/models/notification.model';
import { NotificationService } from '../features/notifications/services/notification.service';
import { AuthService } from '../core/services/auth.service';
import { LayoutService } from './app.layout.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [ButtonModule, BadgeModule, RouterModule, DialogModule, TagModule, DatePipe, NgClass],
  template: `
    <div class="layout-topbar" style="background-color: var(--p-surface-0, #ffffff);">
      <div class="layout-topbar-logo-container">
        <button
          class="layout-menu-button layout-topbar-action"
          (click)="layoutService.onMenuToggle()"
        >
          <i class="pi pi-bars"></i>
        </button>
        <a class="layout-topbar-logo" routerLink="/">
          <i class="pi pi-box"></i>
          <span>Gerenciador</span>
        </a>
      </div>

      <div class="layout-topbar-actions">
        <div class="layout-topbar-menu">

          @if (canSeeNotifications) {
            <button
              type="button"
              class="layout-topbar-action flex-shrink-0"
              (click)="openNotifications()"
              title="Notificações"
            >
              @if (unreadCount > 0) {
                <i class="pi pi-bell" pBadge [value]="unreadCount.toString()" severity="success"></i>
              } @else {
                <i class="pi pi-bell"></i>
              }
            </button>
          }

          <button
            type="button"
            class="layout-topbar-action flex-shrink-0"
            (click)="logout()"
            title="Sair"
          >
            <i class="pi pi-sign-out"></i>
            <span>Sair</span>
          </button>
        </div>
      </div>
    </div>

    <p-dialog
      header="Notificações"
      [(visible)]="dialogVisible"
      [modal]="true"
      [dismissableMask]="true"
      [style]="{ width: '480px' }"
      [draggable]="false"
    >
      @if (loading) {
        <div class="flex justify-content-center py-4">
          <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem;"></i>
        </div>
      } @else if (notifications.length === 0) {
        <div class="flex flex-column align-items-center py-4 gap-2" style="color: var(--p-text-muted-color);">
          <i class="pi pi-check-circle" style="font-size: 2rem;"></i>
          <span>Nenhuma notificação</span>
        </div>
      } @else {
        <ul class="list-none p-0 m-0 flex flex-column gap-2">
          @for (n of notifications; track n.id) {
            <li
              class="flex align-items-start gap-3 p-3 border-round"
              [ngClass]="n.read ? 'surface-ground' : 'surface-100'"
              style="border: 1px solid var(--p-surface-200);"
            >
              <i
                class="pi pi-exclamation-triangle mt-1"
                style="color: var(--p-orange-500); flex-shrink: 0;"
              ></i>
              <div class="flex flex-column gap-1 flex-1">
                <span class="font-medium">Estoque zerado</span>
                <span style="font-size: 0.875rem;">
                  O produto <strong>{{ n.product_name }}</strong> chegou a 0 unidades.
                </span>
                <span style="font-size: 0.75rem; color: var(--p-text-muted-color);">
                  {{ n.occurred_at | date:'dd/MM/yyyy HH:mm' }}
                </span>
              </div>
              @if (!n.read) {
                <p-tag value="Novo" severity="warn" />
              }
              @if (!n.read) {
                <button
                  pButton
                  icon="pi pi-check"
                  class="p-button-text p-button-sm"
                  title="Marcar como lida"
                  (click)="markAsRead(n)"
                ></button>
              }
            </li>
          }
        </ul>
      }
    </p-dialog>
  `,
})
export class AppTopbarComponent implements OnInit {
  layoutService = inject(LayoutService);
  protected authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  notifications: Notification[] = [];
  dialogVisible = false;
  loading = false;

  get canSeeNotifications(): boolean {
    const role = this.authService.currentUser()?.role;
    return role === 'editor' || role === 'admin';
  }

  get unreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  ngOnInit(): void {
    interval(10_000)
      .pipe(
        startWith(0),
        switchMap(() => this.notificationService.list()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: data => { this.notifications = data; },
      });
  }

  openNotifications(): void {
    this.dialogVisible = true;
    this.loading = true;
    this.notificationService.list().subscribe({
      next: data => {
        this.notifications = data;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  markAsRead(notification: Notification): void {
    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => { notification.read = true; },
    });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/auth/login']),
      error: () => this.router.navigate(['/auth/login']),
    });
  }
}
