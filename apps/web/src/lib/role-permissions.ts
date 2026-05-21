import type { ReviewStatus, UserRole } from '@balance/types';
import type { AuthUser } from './api/auth';

export function canDecideReview(role: UserRole | null | undefined, status: ReviewStatus): boolean {
  return status === 'in_review' && (role === 'admin' || role === 'system_admin');
}

export function canDeleteEnterpriseMember(currentUser: AuthUser | null | undefined, member: AuthUser): boolean {
  return (member.role === 'staff' || member.role === 'reviewer') && member.id !== currentUser?.id;
}

export function validatePasswordComplexity(value: string): string | null {
  if (!value) return 'Password is required.';
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (value.length > 128) return 'Password must not exceed 128 characters.';
  if (!/[A-Z]/.test(value)) return 'Password must contain an uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Password must contain a lowercase letter.';
  if (!/[0-9]/.test(value)) return 'Password must contain a digit.';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Password must contain a special character.';
  return null;
}
