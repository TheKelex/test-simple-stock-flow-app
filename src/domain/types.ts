export type Role = 'admin' | 'seller';

export interface User {
  id: string;
  username: string;
  role: Role;
}

export interface Session {
  token: string;
  expires_at: string;
  user: User;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: Category;
  category_id?: string;
  image_url: string | null;
}

export interface SaleLine {
  product_id: string;
  product_name: string;
  category_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  sold_by: string;
  created_at: string;
  total: number;
  lines: SaleLine[];
}

export interface SalesReportRow {
  product_id: string;
  product_name: string;
  category_name: string;
  units_sold: number;
  amount: number;
  sales_count: number;
}

export interface SalesReport {
  from: string;
  to: string;
  totalSales: number;
  totalAmount: number;
  rows: SalesReportRow[];
}
