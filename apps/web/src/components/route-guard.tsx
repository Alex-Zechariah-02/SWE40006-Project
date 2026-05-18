'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { UserRole } from '@balance/types';
import { useAuth } from '../context/auth-context';

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
      if (user.role === 'consumer') router.replace('/app');
      else router.replace('/enterprise');
    }
  }, [user, loading, router, allowedRoles]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading…</p>
      </main>
    );
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Access denied.</p>
      </main>
    );
  }

  return <>{children}</>;
}
