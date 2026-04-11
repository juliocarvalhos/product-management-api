import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PaginatedResponse } from '../../../core/models/api-response.model';
import { Product, ProductCreate, ProductFilters, ProductUpdate } from '../models/product.model';

interface CacheEntry {
  data: PaginatedResponse<Product>;
  timestamp: number;
}

const CACHE_TTL_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/products`;
  private cache = new Map<string, CacheEntry>();

  list(
    page = 1,
    size = 10,
    filters: ProductFilters = {}
  ): Observable<PaginatedResponse<Product>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size);

    if (filters.nome) params = params.set('nome', filters.nome);
    if (filters.ativo !== undefined && filters.ativo !== null)
      params = params.set('ativo', String(filters.ativo));
    if (filters.preco_min != null) params = params.set('preco_min', filters.preco_min);
    if (filters.preco_max != null) params = params.set('preco_max', filters.preco_max);
    if (filters.order_by) params = params.set('order_by', filters.order_by);
    if (filters.order_dir) params = params.set('order_dir', filters.order_dir);

    const cacheKey = params.toString();
    const entry = this.cache.get(cacheKey);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return of(entry.data);
    }

    return this.http.get<PaginatedResponse<Product>>(this.apiUrl, { params }).pipe(
      tap(data => this.cache.set(cacheKey, { data, timestamp: Date.now() }))
    );
  }

  getById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

  create(data: ProductCreate): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, data).pipe(
      tap(() => this.invalidateCache())
    );
  }

  update(id: string, data: ProductUpdate): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/${id}`, data).pipe(
      tap(() => this.invalidateCache())
    );
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.invalidateCache())
    );
  }

  private invalidateCache(): void {
    this.cache.clear();
  }
}
