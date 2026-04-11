import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PaginatedResponse } from '../../../core/models/api-response.model';
import { AuditLog } from '../models/audit-log.model';

export interface AuditLogFilters {
  entity_id?: string;
  action?: string;
  actor_id?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/audit-logs`;

  list(page = 1, size = 20, filters: AuditLogFilters = {}): Observable<PaginatedResponse<AuditLog>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filters.entity_id) params = params.set('entity_id', filters.entity_id);
    if (filters.action)    params = params.set('action', filters.action);
    if (filters.actor_id)  params = params.set('actor_id', filters.actor_id);
    return this.http.get<PaginatedResponse<AuditLog>>(this.apiUrl, { params });
  }
}
