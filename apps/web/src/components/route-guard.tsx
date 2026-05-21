'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { UserRole } from '@balance/types';
import { useAuth } from '../context/auth-context';
import { homeForRole } from '../lib/auth-routing';

interface RouteGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

export function RouteGuard({ children, allowedRoles }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!allowedRoles.includes(user.role)) {
      router.replace(homeForRole(user.role));
    }
  }, [user, loading, router, allowedRoles]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Access denied.</p>
      </main>
    );
  }

  return <>{children}</>;
}
