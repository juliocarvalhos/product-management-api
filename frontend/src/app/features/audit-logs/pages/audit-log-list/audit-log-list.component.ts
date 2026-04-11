import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { AuditLog } from '../../models/audit-log.model';
import { AuditLogFilters, AuditLogService } from '../../services/audit-log.service';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | undefined;

@Component({
  selector: 'app-audit-log-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    SelectModule,
    ToastModule,
    TooltipModule,
    DialogModule,
    DatePipe,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="grid">
      <div class="col-12">
        <div class="card">

          <div class="flex align-items-center justify-content-between mb-4">
            <div>
              <h4 class="m-0 font-semibold text-900">Logs de Auditoria</h4>
              <p class="text-500 mt-1 mb-0 text-sm">Histórico de alterações nos produtos</p>
            </div>
          </div>

          <!-- Filtros -->
          <div class="flex flex-wrap gap-3 align-items-end mb-4 p-3 border-round surface-ground">
            <div class="flex flex-column gap-1">
              <label class="text-sm font-medium text-600">Ação</label>
              <p-select
                [options]="actionOptions"
                [(ngModel)]="filterAction"
                (ngModelChange)="applyFilters()"
                optionLabel="label"
                optionValue="value"
                placeholder="Todas"
                styleClass="w-full"
              />
            </div>
            <p-button
              label="Limpar filtros"
              icon="pi pi-filter-slash"
              severity="secondary"
              [outlined]="true"
              (onClick)="clearFilters()"
            />
          </div>

          <p-table
            [value]="logs"
            [lazy]="true"
            [lazyLoadOnInit]="false"
            (onLazyLoad)="onLazyLoad($event)"
            [paginator]="true"
            [rows]="pageSize"
            [totalRecords]="totalRecords"
            [rowsPerPageOptions]="[20, 50, 100]"
            [loading]="loading"
            styleClass="p-datatable-gridlines"
            dataKey="id"
            responsiveLayout="scroll"
          >
            <ng-template pTemplate="header">
              <tr>
                <th style="width:10rem">Ação</th>
                <th style="width:8rem">Entidade</th>
                <th>ID do Produto</th>
                <th>Usuário (actor)</th>
                <th style="width:13rem">Data/Hora</th>
                <th style="width:6rem" class="text-center">Detalhes</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-log>
              <tr>
                <td>
                  <p-tag
                    [value]="log.action"
                    [severity]="actionSeverity(log.action)"
                  />
                </td>
                <td class="text-600 text-sm">{{ log.entity_type }}</td>
                <td>
                  <span class="font-mono text-sm text-600" style="font-family: monospace">
                    {{ log.entity_id }}
                  </span>
                </td>
                <td>
                  <span class="text-sm text-600">
                    {{ log.actor_id ?? '—' }}
                  </span>
                </td>
                <td class="text-sm">
                  {{ log.occurred_at | date:'dd/MM/yyyy HH:mm:ss':'America/Sao_Paulo' }}
                </td>
                <td class="text-center">
                  <p-button
                    icon="pi pi-eye"
                    [text]="true"
                    [rounded]="true"
                    severity="info"
                    pTooltip="Ver payload"
                    (onClick)="showPayload(log)"
                    [disabled]="!log.payload"
                  />
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="6" class="text-center py-6">
                  <i class="pi pi-list text-4xl text-300 block mb-3"></i>
                  <span class="text-500">Nenhum log encontrado</span>
                </td>
              </tr>
            </ng-template>
          </p-table>

        </div>
      </div>
    </div>

    <!-- Payload dialog -->
    <p-dialog
      [(visible)]="payloadVisible"
      header="Payload do evento"
      [modal]="true"
      [dismissableMask]="true"
      [style]="{ width: '640px' }"
      [draggable]="false"
    >
      <pre style="background:var(--p-surface-50,#f8fafc); border-radius:8px; padding:1rem; font-size:0.8rem; overflow:auto; max-height:400px">{{ selectedPayload }}</pre>
    </p-dialog>
  `,
  styles: [`
    :host { display: block; }
    .card {
      background: var(--p-surface-0, #ffffff);
      border-radius: var(--border-radius, 8px);
      padding: 1.5rem;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
    }
  `],
})
export class AuditLogListComponent implements OnInit {
  private service = inject(AuditLogService);
  private messageService = inject(MessageService);

  logs: AuditLog[] = [];
  totalRecords = 0;
  loading = false;
  pageSize = 20;
  currentPage = 1;

  filterAction: string | null = null;

  payloadVisible = false;
  selectedPayload = '';

  actionOptions = [
    { label: 'Todas', value: null },
    { label: 'CREATE', value: 'CREATE' },
    { label: 'UPDATE', value: 'UPDATE' },
    { label: 'DELETE', value: 'DELETE' },
  ];

  ngOnInit(): void {
    this.loadLogs();
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.currentPage = event.first != null ? Math.floor(event.first / (event.rows ?? 20)) + 1 : 1;
    this.pageSize = event.rows ?? 20;
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading = true;
    const filters: AuditLogFilters = {
      action: this.filterAction ?? undefined,
    };
    this.service.list(this.currentPage, this.pageSize, filters).subscribe({
      next: (res) => {
        this.logs = res.items;
        this.totalRecords = res.total;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar logs' });
      },
    });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadLogs();
  }

  clearFilters(): void {
    this.filterAction = null;
    this.applyFilters();
  }

  actionSeverity(action: string): TagSeverity {
    const map: Record<string, TagSeverity> = {
      CREATE: 'success',
      UPDATE: 'info',
      DELETE: 'danger',
    };
    return map[action] ?? 'secondary';
  }

  showPayload(log: AuditLog): void {
    this.selectedPayload = JSON.stringify(log.payload, null, 2);
    this.payloadVisible = true;
  }
}
