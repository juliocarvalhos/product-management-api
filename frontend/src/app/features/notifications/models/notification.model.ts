export interface Notification {
  id: string;
  product_id: string;
  product_name: string;
  actor_id: string | null;
  occurred_at: string;
  read: boolean;
}
