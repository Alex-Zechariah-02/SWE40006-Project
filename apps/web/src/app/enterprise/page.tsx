'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { RouteGuard } from '../../components/route-guard';

export default function EnterprisePage() {
  return (
    <RouteGuard allowedRoles={['staff', 'admin', 'system_admin']}>
      <Redirect />
    </RouteGuard>
  );
}

function Redirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/enterprise/documents'); }, [router]);
  return <p className="p-8 text-sm text-muted-foreground">Redirecting…</p>;
}
