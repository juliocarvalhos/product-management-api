import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  sidebarOpen = signal(true);

  onMenuToggle(): void {
    this.sidebarOpen.update(v => !v);
  }

  isDesktop(): boolean {
    return window.innerWidth > 991;
  }
}
