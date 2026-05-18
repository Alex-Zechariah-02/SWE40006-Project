// Centralized API client for the Balance web frontend.
// All API calls go through /api (same-origin proxy). Never call :3001 directly.

const API_BASE = '/api';
const TOKEN_KEY = 'balance.accessToken';

export interface ApiError {
  code: string;
  message: string;
  details: Array<{ path: string; message: string }>;
  requestId?: string;
}

export class BalanceApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly error: ApiError,
  ) {
    super(error.message);
    this.name = 'BalanceApiError';
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function buildHeaders(includeAuth: boolean, isMultipart = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  if (includeAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

async function parseErrorResponse(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    if (body?.error?.code) return body.error as ApiError;
  } catch {
    // fall through
  }
  return {
    code: 'INTERNAL_ERROR',
    message: `Unexpected error (HTTP ${res.status})`,
    details: [],
  };
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, ...fetchOptions } = options;
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...fetchOptions,
    headers: {
      ...buildHeaders(auth),
      ...(fetchOptions.headers ?? {}),
    },
  });

  if (!res.ok) {
    const error = await parseErrorResponse(res);
    throw new BalanceApiError(res.status, error);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const error = await parseErrorResponse(res);
    throw new BalanceApiError(res.status, error);
  }

  return res.json() as Promise<T>;
}
