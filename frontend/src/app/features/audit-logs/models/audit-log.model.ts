export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  actor_id: string | null;
  payload: Record<string, any> | null;
  occurred_at: string;
}
