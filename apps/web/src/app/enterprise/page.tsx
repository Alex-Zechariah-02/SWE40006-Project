'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { RouteGuard } from '../../components/route-guard';

export default function EnterprisePage() {
  return (
    <RouteGuard allowedRoles={['reviewer', 'admin']}>
      <Redirect />
    </RouteGuard>
  );
}

function Redirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/enterprise/reviews'); }, [router]);
  return <p className="text-sm text-slate-400 p-8">Redirecting…</p>;
}
