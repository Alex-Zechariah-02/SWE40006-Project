import type { UserRole } from '@balance/types';

export function homeForRole(role: UserRole): string {
  if (role === 'consumer') return '/app';
  if (role === 'system_admin') return '/app/admin';
  if (role === 'reviewer') return '/enterprise/reviews';
  return '/enterprise/documents';
}
