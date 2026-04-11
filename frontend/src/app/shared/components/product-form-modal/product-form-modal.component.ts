import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';

import { Product, ProductCreate, ProductUpdate } from '../../../features/products/models/product.model';
import { ProductService } from '../../../features/products/services/product.service';

@Component({
  selector: 'app-product-form-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    InputNumberModule,
    CheckboxModule,
    ButtonModule,
  ],
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="onHide()"
      [header]="product ? 'Editar Produto' : 'Novo Produto'"
      [modal]="true"
      [dismissableMask]="true"
      [style]="{ width: '520px' }"
      [closable]="true"
      [draggable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-column gap-4 p-fluid">

        <div class="flex flex-column gap-2">
          <label for="nome" class="font-medium">Nome <span class="text-red-500">*</span></label>
          <input pInputText id="nome" formControlName="nome" placeholder="Nome do produto" />
          @if (isInvalid('nome')) {
            <small class="p-error">Nome é obrigatório</small>
          }
        </div>

        <div class="flex flex-column gap-2">
          <label for="descricao" class="font-medium">Descrição</label>
          <textarea pTextarea id="descricao" formControlName="descricao" rows="3" placeholder="Descrição detalhada"></textarea>
        </div>

        <div class="flex flex-column gap-2">
          <label for="preco" class="font-medium">Preço <span class="text-red-500">*</span></label>
          <p-inputNumber
            inputId="preco"
            formControlName="preco"
            mode="currency"
            currency="BRL"
            locale="pt-BR"
            [minFractionDigits]="2"
            [min]="0.01"
          />
          @if (isInvalid('preco')) {
            <small class="p-error">Preço inválido (mín. R$ 0,01)</small>
          }
        </div>

        <div class="flex flex-column gap-2">
          <label for="quantidade" class="font-medium">Quantidade <span class="text-red-500">*</span></label>
          <p-inputNumber
            inputId="quantidade"
            formControlName="quantidade"
            [min]="0"
            [showButtons]="true"
          />
          @if (isInvalid('quantidade')) {
            <small class="p-error">Quantidade inválida</small>
          }
        </div>

        <div class="flex align-items-center gap-2">
          <p-checkbox inputId="ativo" formControlName="ativo" [binary]="true" />
          <label for="ativo" class="font-medium">Produto ativo</label>
        </div>

      </form>

      <ng-template pTemplate="footer">
        <p-button
          label="Cancelar"
          severity="secondary"
          [text]="true"
          (onClick)="onHide()"
          [disabled]="loading"
        />
        <p-button
          [label]="product ? 'Salvar' : 'Criar'"
          icon="pi pi-check"
          (onClick)="onSubmit()"
          [loading]="loading"
          [disabled]="form.invalid"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class ProductFormModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() product: Product | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<Product>();

  private fb = inject(FormBuilder);
  private productService = inject(ProductService);

  loading = false;

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(255)]],
    descricao: [null as string | null],
    preco: [null as number | null, [Validators.required, Validators.min(0.01)]],
    quantidade: [0, [Validators.required, Validators.min(0)]],
    ativo: [true],
  });

  ngOnChanges(): void {
    if (this.product) {
      this.form.patchValue({
        nome: this.product.nome,
        descricao: this.product.descricao,
        preco: this.product.preco,
        quantidade: this.product.quantidade,
        ativo: this.product.ativo,
      });
    } else {
      this.form.reset({ ativo: true, quantidade: 0 });
    }
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched));
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    const value = this.form.value;

    const request$ = this.product
      ? this.productService.update(this.product.id, value as ProductUpdate)
      : this.productService.create(value as ProductCreate);

    request$.subscribe({
      next: (product) => {
        this.loading = false;
        this.saved.emit(product);
        this.onHide();
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  onHide(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.form.reset({ ativo: true, quantidade: 0 });
  }
}
