import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/role.guard';

export const auditLogsRoutes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/audit-log-list/audit-log-list.component').then(
        (m) => m.AuditLogListComponent
      ),
  },
];
