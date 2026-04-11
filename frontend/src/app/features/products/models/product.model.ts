export interface Product {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  quantidade: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  nome: string;
  descricao?: string | null;
  preco: number;
  quantidade: number;
  ativo: boolean;
}

export interface ProductUpdate {
  nome?: string;
  descricao?: string | null;
  preco?: number;
  quantidade?: number;
  ativo?: boolean;
}

export interface ProductFilters {
  nome?: string;
  ativo?: boolean | null;
  preco_min?: number | null;
  preco_max?: number | null;
  order_by?: string;
  order_dir?: string;
}
