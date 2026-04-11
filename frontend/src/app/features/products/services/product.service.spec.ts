import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ProductService } from './product.service';
import { Product, ProductCreate, ProductUpdate } from '../models/product.model';
import { PaginatedResponse } from '../../../core/models/api-response.model';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;

  const BASE = 'http://localhost:8000/api/v1/products';

  const mockProduct: Product = {
    id: 'uuid-1',
    nome: 'Mala Premium',
    descricao: 'Mala de viagem resistente',
    preco: 499.9,
    quantidade: 10,
    ativo: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockPage: PaginatedResponse<Product> = {
    items: [mockProduct],
    total: 1,
    page: 1,
    size: 10,
    pages: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // list() — query params
  // ---------------------------------------------------------------------------

  describe('list() — query params', () => {
    it('should include page and size params', () => {
      service.list(2, 20).subscribe();

      const req = httpMock.expectOne(r => r.url === BASE);
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('size')).toBe('20');
      req.flush(mockPage);
    });

    it('should add nome filter when provided', () => {
      service.list(1, 10, { nome: 'Mala' }).subscribe();

      const req = httpMock.expectOne(r => r.url === BASE);
      expect(req.request.params.get('nome')).toBe('Mala');
      req.flush(mockPage);
    });

    it('should add ativo=false filter when explicitly set to false', () => {
      service.list(1, 10, { ativo: false }).subscribe();

      const req = httpMock.expectOne(r => r.url === BASE);
      expect(req.request.params.get('ativo')).toBe('false');
      req.flush(mockPage);
    });

    it('should add preco_min and preco_max when provided', () => {
      service.list(1, 10, { preco_min: 100, preco_max: 500 }).subscribe();

      const req = httpMock.expectOne(r => r.url === BASE);
      expect(req.request.params.get('preco_min')).toBe('100');
      expect(req.request.params.get('preco_max')).toBe('500');
      req.flush(mockPage);
    });

    it('should add order_by and order_dir when provided', () => {
      service.list(1, 10, { order_by: 'preco', order_dir: 'desc' }).subscribe();

      const req = httpMock.expectOne(r => r.url === BASE);
      expect(req.request.params.get('order_by')).toBe('preco');
      expect(req.request.params.get('order_dir')).toBe('desc');
      req.flush(mockPage);
    });

    it('should NOT include optional params when filters are absent', () => {
      service.list(1, 10).subscribe();

      const req = httpMock.expectOne(r => r.url === BASE);
      expect(req.request.params.has('nome')).toBeFalse();
      expect(req.request.params.has('ativo')).toBeFalse();
      expect(req.request.params.has('preco_min')).toBeFalse();
      expect(req.request.params.has('preco_max')).toBeFalse();
      req.flush(mockPage);
    });
  });

  // ---------------------------------------------------------------------------
  // list() — cache
  // ---------------------------------------------------------------------------

  describe('list() — cache', () => {
    it('should return cached response without making a second HTTP request', () => {
      let first: PaginatedResponse<Product> | undefined;
      let second: PaginatedResponse<Product> | undefined;

      service.list(1, 10).subscribe(r => (first = r));
      httpMock.expectOne(r => r.url === BASE).flush(mockPage);

      service.list(1, 10).subscribe(r => (second = r));
      httpMock.expectNone(r => r.url === BASE);

      expect(first).toEqual(mockPage);
      expect(second).toEqual(mockPage);
    });

    it('should treat different params as different cache keys', () => {
      service.list(1, 10).subscribe();
      httpMock.expectOne(r => r.url === BASE).flush(mockPage);

      service.list(1, 10, { nome: 'Mala' }).subscribe();
      httpMock.expectOne(r => r.url === BASE).flush(mockPage);
    });
  });

  // ---------------------------------------------------------------------------
  // create()
  // ---------------------------------------------------------------------------

  describe('create()', () => {
    const payload: ProductCreate = {
      nome: 'Nova Mala',
      descricao: 'Descrição',
      preco: 299.9,
      quantidade: 5,
      ativo: true,
    };

    it('should POST to /products with the provided payload', () => {
      service.create(payload).subscribe();

      const req = httpMock.expectOne(BASE);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(mockProduct);
    });

    it('should invalidate cache so the next list() hits the network', () => {
      // Populate cache
      service.list(1, 10).subscribe();
      httpMock.expectOne(r => r.url === BASE && r.method === 'GET').flush(mockPage);

      // Mutation invalidates cache
      service.create(payload).subscribe();
      httpMock.expectOne(r => r.url === BASE && r.method === 'POST').flush(mockProduct);

      // Next list() must go to network
      service.list(1, 10).subscribe();
      httpMock.expectOne(r => r.url === BASE && r.method === 'GET').flush(mockPage);
    });
  });

  // ---------------------------------------------------------------------------
  // update()
  // ---------------------------------------------------------------------------

  describe('update()', () => {
    const update: ProductUpdate = { nome: 'Mala Atualizada', preco: 399.9 };

    it('should PUT to /products/:id with the provided payload', () => {
      service.update('uuid-1', update).subscribe();

      const req = httpMock.expectOne(`${BASE}/uuid-1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(update);
      req.flush({ ...mockProduct, ...update });
    });

    it('should invalidate cache after update', () => {
      service.list(1, 10).subscribe();
      httpMock.expectOne(r => r.url === BASE && r.method === 'GET').flush(mockPage);

      service.update('uuid-1', update).subscribe();
      httpMock.expectOne(r => r.method === 'PUT').flush(mockProduct);

      service.list(1, 10).subscribe();
      httpMock.expectOne(r => r.url === BASE && r.method === 'GET').flush(mockPage);
    });
  });

  // ---------------------------------------------------------------------------
  // delete()
  // ---------------------------------------------------------------------------

  describe('delete()', () => {
    it('should DELETE to /products/:id', () => {
      service.delete('uuid-1').subscribe();

      const req = httpMock.expectOne(`${BASE}/uuid-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'Product deleted' });
    });

    it('should invalidate cache after delete', () => {
      service.list(1, 10).subscribe();
      httpMock.expectOne(r => r.url === BASE && r.method === 'GET').flush(mockPage);

      service.delete('uuid-1').subscribe();
      httpMock.expectOne(r => r.method === 'DELETE').flush({ message: 'deleted' });

      service.list(1, 10).subscribe();
      httpMock.expectOne(r => r.url === BASE && r.method === 'GET').flush(mockPage);
    });
  });
});
