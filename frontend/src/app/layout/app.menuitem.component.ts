import { NgClass } from '@angular/common';
import {
  Component,
  Input,
  OnInit,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { animate, state, style, transition, trigger } from '@angular/animations';

export interface MenuItem {
  label?: string;
  icon?: string;
  routerLink?: string[];
  items?: MenuItem[];
  separator?: boolean;
}

@Component({
  selector: 'app-menuitem',
  standalone: true,
  imports: [NgClass, RouterLink, RouterLinkActive],
  animations: [
    trigger('children', [
      state('collapsed', style({ height: '0' })),
      state('expanded', style({ height: '*' })),
      transition('collapsed <=> expanded', animate('400ms cubic-bezier(0.86, 0, 0.07, 1)')),
    ]),
  ],
  template: `
    @if (item.separator) {
      <li class="menu-separator"></li>
    } @else {
      <li [ngClass]="{ 'active-menuitem': isActiveRoute }">
        @if (item.routerLink) {
          <a
            [routerLink]="item.routerLink"
            routerLinkActive="active-link"
            [routerLinkActiveOptions]="{ exact: false }"
            class="p-ripple"
            (click)="onItemClick()"
          >
            <i [class]="'layout-menuitem-icon ' + item.icon"></i>
            <span class="layout-menuitem-text">{{ item.label }}</span>
          </a>
        } @else {
          <a (click)="onItemClick()" class="p-ripple" style="cursor:pointer">
            <i [class]="'layout-menuitem-icon ' + item.icon"></i>
            <span class="layout-menuitem-text">{{ item.label }}</span>
            @if (item.items) {
              <i class="pi pi-fw pi-angle-down layout-submenu-toggler"></i>
            }
          </a>
        }
        @if (item.items) {
          <ul [@children]="active ? 'expanded' : 'collapsed'">
            @for (child of item.items; track child.label) {
              <app-menuitem [item]="child" [depth]="depth + 1" />
            }
          </ul>
        }
      </li>
    }
  `,
})
export class AppMenuItemComponent implements OnInit {
  @Input() item: MenuItem = {};
  @Input() depth: number = 0;

  active = false;

  get isActiveRoute(): boolean {
    return this.active;
  }

  ngOnInit(): void {
    if (this.item.items) {
      this.active = false;
    }
  }

  onItemClick(): void {
    if (this.item.items) {
      this.active = !this.active;
    }
  }
}
