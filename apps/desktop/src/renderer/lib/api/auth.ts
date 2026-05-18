import { clearToken, desktopRequest, setToken } from './client';

export interface DesktopUser {
  id: string;
  email: string;
  role: string;
  displayName: string;
}

export async function desktopLogin(email: string, password: string): Promise<DesktopUser> {
  const data = await desktopRequest<{ user: DesktopUser; accessToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.accessToken);
  return data.user;
}

export async function desktopGetCurrentUser(): Promise<DesktopUser> {
  const data = await desktopRequest<{ user: DesktopUser }>('/auth/me');
  return data.user;
}

export async function desktopLogout(): Promise<void> {
  try {
    await desktopRequest('/auth/logout', { method: 'POST' });
  } finally {
    clearToken();
  }
}
