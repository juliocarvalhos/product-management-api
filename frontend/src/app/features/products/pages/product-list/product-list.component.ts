import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { CardModule } from 'primeng/card';
import { ConfirmationService, MessageService } from 'primeng/api';

import { ProductFormModalComponent } from '../../../../shared/components/product-form-modal/product-form-modal.component';
import { ProductService } from '../../services/product.service';
import { Product, ProductFilters } from '../../models/product.model';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ToolbarModule,
    ButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    TagModule,
    SelectModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    CardModule,
    InputNumberModule,
    ProductFormModalComponent,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <div class="grid">
      <div class="col-12">
        <div class="card">

          <!-- Page header -->
          <div class="flex align-items-center justify-content-between mb-4">
            <div>
              <h4 class="m-0 font-semibold text-900">Produtos</h4>
              <p class="text-500 mt-1 mb-0 text-sm">Gerencie o catálogo de produtos</p>
            </div>
            @if (canCreate) {
              <p-button
                label="Novo Produto"
                icon="pi pi-plus"
                (onClick)="openCreate()"
              />
            }
          </div>

          <!-- Filter bar -->
          <div class="flex flex-wrap gap-3 align-items-end mb-4 p-3 border-round surface-ground">
            <div class="flex flex-column gap-1">
              <label class="text-sm font-medium text-600">Buscar por nome</label>
              <p-iconfield>
                <p-inputicon styleClass="pi pi-search" />
                <input
                  pInputText
                  [(ngModel)]="searchNome"
                  (ngModelChange)="onSearchChange($event)"
                  placeholder="Filtrar produtos..."
                  style="width: 240px"
                />
              </p-iconfield>
            </div>

            <div class="flex flex-column gap-1">
              <label class="text-sm font-medium text-600">Status</label>
              <p-select
                [options]="statusOptions"
                [(ngModel)]="filterAtivo"
                (ngModelChange)="applyFilters()"
                optionLabel="label"
                optionValue="value"
                placeholder="Todos"
                styleClass="w-full"
              />
            </div>

            <div class="flex flex-column gap-1">
              <label class="text-sm font-medium text-600">Preço mínimo</label>
              <p-inputNumber
                [(ngModel)]="filterPrecoMin"
                (ngModelChange)="applyFilters()"
                mode="currency"
                currency="BRL"
                locale="pt-BR"
                placeholder="R$ 0,00"
                [min]="0"
                styleClass="w-full"
                inputStyleClass="w-9rem"
              />
            </div>

            <div class="flex flex-column gap-1">
              <label class="text-sm font-medium text-600">Preço máximo</label>
              <p-inputNumber
                [(ngModel)]="filterPrecoMax"
                (ngModelChange)="applyFilters()"
                mode="currency"
                currency="BRL"
                locale="pt-BR"
                placeholder="R$ 0,00"
                [min]="0"
                styleClass="w-full"
                inputStyleClass="w-9rem"
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

          <!-- Skeleton: carregamento inicial -->
          @if (isInitialLoad && loading) {
            <table class="w-full" style="border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid var(--surface-border)">
                  <th class="text-left p-3 text-sm font-semibold text-600" style="min-width:14rem">Nome</th>
                  <th class="text-left p-3 text-sm font-semibold text-600" style="min-width:16rem">Descrição</th>
                  <th class="text-left p-3 text-sm font-semibold text-600" style="width:8rem">Preço</th>
                  <th class="text-left p-3 text-sm font-semibold text-600" style="width:7rem">Qtd</th>
                  <th class="text-left p-3 text-sm font-semibold text-600" style="width:7rem">Status</th>
                  <th class="p-3" style="width:8rem"></th>
                </tr>
              </thead>
              <tbody>
                @for (row of skeletonRows; track $index) {
                  <tr style="border-bottom: 1px solid var(--surface-border)">
                    <td class="p-3"><p-skeleton height="1rem" width="80%" /></td>
                    <td class="p-3"><p-skeleton height="1rem" width="90%" /></td>
                    <td class="p-3"><p-skeleton height="1rem" width="60%" /></td>
                    <td class="p-3"><p-skeleton height="1rem" width="40%" /></td>
                    <td class="p-3"><p-skeleton height="1.5rem" width="3.5rem" borderRadius="12px" /></td>
                    <td class="p-3 text-center">
                      <p-skeleton shape="circle" size="2rem" styleClass="inline-block mr-1" />
                      <p-skeleton shape="circle" size="2rem" styleClass="inline-block" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }

          <!-- Erro inline -->
          @else if (hasError) {
            <div class="text-center py-6">
              <i class="pi pi-exclamation-circle text-4xl text-red-300 block mb-3"></i>
              <p class="text-500 m-0 mb-3">Falha ao carregar produtos. Verifique sua conexão.</p>
              <p-button
                label="Tentar novamente"
                icon="pi pi-refresh"
                severity="secondary"
                [outlined]="true"
                size="small"
                (onClick)="retryLoad()"
              />
            </div>
          }

          <!-- Tabela (carregamentos subsequentes usam o loading overlay do PrimeNG) -->
          @else {
            <p-table
              [value]="products"
              [lazy]="true"
              [lazyLoadOnInit]="false"
              (onLazyLoad)="loadProducts($event)"
              [paginator]="true"
              [rows]="pageSize"
              [totalRecords]="totalRecords"
              [rowsPerPageOptions]="[10, 20, 50]"
              [loading]="loading"
              styleClass="p-datatable-gridlines"
              dataKey="id"
              responsiveLayout="scroll"
            >
              <ng-template pTemplate="header">
                <tr>
                  <th pSortableColumn="nome" style="min-width: 14rem">
                    Nome <p-sortIcon field="nome" />
                  </th>
                  <th style="min-width: 16rem">Descrição</th>
                  <th pSortableColumn="preco" style="width: 8rem">
                    Preço <p-sortIcon field="preco" />
                  </th>
                  <th pSortableColumn="quantidade" style="width: 7rem">
                    Qtd <p-sortIcon field="quantidade" />
                  </th>
                  <th style="width: 7rem">Status</th>
                  <th style="width: 8rem" class="text-center">Ações</th>
                </tr>
              </ng-template>

              <ng-template pTemplate="body" let-product>
                <tr>
                  <td>
                    <span class="font-medium text-900">{{ product.nome }}</span>
                  </td>
                  <td>
                    <span class="text-600 text-sm">
                      {{ product.descricao ? (product.descricao | slice:0:80) + (product.descricao.length > 80 ? '…' : '') : '—' }}
                    </span>
                  </td>
                  <td class="font-medium">
                    {{ product.preco | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}
                  </td>
                  <td>
                    <span>{{ product.quantidade }}</span>
                  </td>
                  <td>
                    <p-tag
                      [value]="product.ativo ? 'Ativo' : 'Inativo'"
                      [severity]="product.ativo ? 'success' : 'secondary'"
                    />
                  </td>
                  <td class="text-center">
                    @if (canEdit) {
                      <p-button
                        icon="pi pi-pencil"
                        [text]="true"
                        [rounded]="true"
                        severity="info"
                        pTooltip="Editar"
                        (onClick)="openEdit(product)"
                      />
                    }
                    @if (canDelete) {
                      <p-button
                        icon="pi pi-trash"
                        [text]="true"
                        [rounded]="true"
                        severity="danger"
                        pTooltip="Remover"
                        (onClick)="confirmDelete(product)"
                      />
                    }
                  </td>
                </tr>
              </ng-template>

              <ng-template pTemplate="emptymessage">
                <tr>
                  <td colspan="6" class="text-center py-6">
                    @if (hasActiveFilters) {
                      <i class="pi pi-filter-slash text-4xl text-300 block mb-3"></i>
                      <p class="text-500 m-0 mb-3">Nenhum produto encontrado para os filtros aplicados.</p>
                      <p-button
                        label="Limpar filtros"
                        icon="pi pi-filter-slash"
                        severity="secondary"
                        [outlined]="true"
                        size="small"
                        (onClick)="clearFilters()"
                      />
                    } @else {
                      <i class="pi pi-inbox text-4xl text-300 block mb-3"></i>
                      <p class="text-500 m-0 mb-3">Nenhum produto cadastrado ainda.</p>
                      <p-button
                        label="Criar primeiro produto"
                        icon="pi pi-plus"
                        size="small"
                        (onClick)="openCreate()"
                      />
                    }
                  </td>
                </tr>
              </ng-template>
            </p-table>
          }

        </div>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <app-product-form-modal
      [(visible)]="showModal"
      [product]="selectedProduct"
      (saved)="onProductSaved($event)"
    />
  `,
  styles: [`
    :host { display: block; }
    .card {
      background: var(--surface-card);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      box-shadow: var(--card-shadow, 0 1px 4px rgba(0,0,0,.06));
    }
  `],
})
export class ProductListComponent implements OnInit {
  private productService = inject(ProductService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private authService = inject(AuthService);

  get canCreate(): boolean { return ['editor', 'admin'].includes(this.authService.currentUser()?.role ?? ''); }
  get canEdit(): boolean   { return ['editor', 'admin'].includes(this.authService.currentUser()?.role ?? ''); }
  get canDelete(): boolean { return this.authService.currentUser()?.role === 'admin'; }

  products: Product[] = [];
  totalRecords = 0;
  loading = false;
  isInitialLoad = true;
  hasError = false;
  pageSize = 10;
  currentPage = 1;

  showModal = false;
  selectedProduct: Product | null = null;

  searchNome = '';
  filterAtivo: boolean | null = null;
  filterPrecoMin: number | null = null;
  filterPrecoMax: number | null = null;
  private searchSubject = new Subject<string>();

  readonly skeletonRows = Array(8);

  statusOptions = [
    { label: 'Todos', value: null },
    { label: 'Ativos', value: true },
    { label: 'Inativos', value: false },
  ];

  private lastSortField = 'created_at';
  private lastSortOrder = 'desc';

  get hasActiveFilters(): boolean {
    return !!(this.searchNome || this.filterAtivo !== null || this.filterPrecoMin !== null || this.filterPrecoMax !== null);
  }

  ngOnInit(): void {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.applyFilters());

    this.loadProducts();
  }

  loadProducts(event?: TableLazyLoadEvent): void {
    if (event) {
      this.currentPage = event.first != null ? Math.floor(event.first / (event.rows ?? 10)) + 1 : 1;
      this.pageSize = event.rows ?? 10;
      if (event.sortField) {
        this.lastSortField = Array.isArray(event.sortField) ? event.sortField[0] : event.sortField;
        this.lastSortOrder = event.sortOrder === 1 ? 'asc' : 'desc';
      }
    }

    this.loading = true;
    this.hasError = false;
    const filters: ProductFilters = {
      nome: this.searchNome || undefined,
      ativo: this.filterAtivo,
      preco_min: this.filterPrecoMin,
      preco_max: this.filterPrecoMax,
      order_by: this.lastSortField,
      order_dir: this.lastSortOrder,
    };

    this.productService.list(this.currentPage, this.pageSize, filters).subscribe({
      next: (res) => {
        this.products = res.items;
        this.totalRecords = res.total;
        this.loading = false;
        this.isInitialLoad = false;
      },
      error: () => {
        this.loading = false;
        this.isInitialLoad = false;
        this.hasError = true;
      },
    });
  }

  retryLoad(): void {
    this.isInitialLoad = true;
    this.loadProducts();
  }

  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadProducts();
  }

  clearFilters(): void {
    this.searchNome = '';
    this.filterAtivo = null;
    this.filterPrecoMin = null;
    this.filterPrecoMax = null;
    this.applyFilters();
  }

  openCreate(): void {
    this.selectedProduct = null;
    this.showModal = true;
  }

  openEdit(product: Product): void {
    this.selectedProduct = product;
    this.showModal = true;
  }

  onProductSaved(product: Product): void {
    const isEdit = !!this.selectedProduct;
    this.messageService.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: isEdit ? 'Produto atualizado' : 'Produto criado',
    });
    this.loadProducts();
  }

  confirmDelete(product: Product): void {
    this.confirmationService.confirm({
      message: `Deseja remover o produto <strong>${product.nome}</strong>?`,
      header: 'Confirmar remoção',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Remover',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteProduct(product),
    });
  }

  private deleteProduct(product: Product): void {
    this.productService.delete(product.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Removido', detail: 'Produto removido com sucesso' });
        this.loadProducts();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao remover produto' });
      },
    });
  }
}
