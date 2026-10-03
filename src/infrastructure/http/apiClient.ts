import type {
  Category,
  Product,
  Sale,
  SalesReport,
  Session,
} from '../../domain/types';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/$/, '');

type ApiErrorPayload = {
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly validationErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Cannot reach the API. Check that the backend is running.', 0, 'NETWORK_ERROR');
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
  if (!response.ok) {
    throw new ApiError(
      payload.message || `Request failed with status ${response.status}.`,
      response.status,
      payload.code,
      payload.errors,
    );
  }

  return payload as T;
}

export function login(username: string, password: string): Promise<Session> {
  return request('/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function getCategories(token: string): Promise<Category[]> {
  const response = await request<{ data: Category[] }>('/categories', token);
  return response.data;
}

export function getProducts(
  token: string,
  filters: { search?: string; category?: string },
): Promise<{ data: Product[]; pagination?: { totalItems: number; totalPages: number } }> {
  const query = new URLSearchParams();
  if (filters.search) query.set('search', filters.search);
  if (filters.category) query.set('category', filters.category);
  query.set('perPage', '50');
  return request(`/products?${query.toString()}`, token);
}

export interface ProductInput {
  name: string;
  price: number;
  stock: number;
  category_id: string;
}

export function saveProduct(token: string, input: ProductInput, id?: string): Promise<Product> {
  return request(id ? `/products/${id}` : '/products', token, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteProduct(token: string, id: string): Promise<void> {
  return request(`/products/${id}`, token, { method: 'DELETE' });
}

export function uploadProductImage(token: string, id: string, file: File): Promise<unknown> {
  const body = new FormData();
  body.append('image', file);
  return request(`/products/${id}/image`, token, { method: 'POST', body });
}

export function getSales(token: string): Promise<{ data: Sale[] }> {
  return request('/sales?page=1&perPage=20', token);
}

export function createSale(
  token: string,
  lines: Array<{ product_id: string; quantity: number }>,
): Promise<Sale> {
  return request('/sales', token, {
    method: 'POST',
    body: JSON.stringify({ lines }),
  });
}

export function getSalesReport(token: string, from: string, to: string): Promise<SalesReport> {
  const query = new URLSearchParams({ from, to });
  return request(`/reports/sales?${query.toString()}`, token);
}
