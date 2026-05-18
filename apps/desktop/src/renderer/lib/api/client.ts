// Desktop API client — uses configurable API base URL from preload bridge.
// Never calls :3001 directly. Always goes through the public web origin + /api.

export interface ApiError {
  code: string;
  message: string;
  details: Array<{ path: string; message: string }>;
}

export class DesktopApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly error: ApiError,
  ) {
    super(error.message);
    this.name = 'DesktopApiError';
  }
}

const TOKEN_KEY = 'balance.accessToken';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function getBaseUrl(): Promise<string> {
  return window.balanceDesktop.getApiBaseUrl();
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    if (body?.error?.code) return body.error as ApiError;
  } catch { /* fall through */ }
  return { code: 'INTERNAL_ERROR', message: `HTTP ${res.status}`, details: [] };
}

export async function desktopRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = await getBaseUrl();
  const url = `${base}${path}`;
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });

  if (!res.ok) {
    const error = await parseError(res);
    throw new DesktopApiError(res.status, error);
  }

  return res.json() as Promise<T>;
}
