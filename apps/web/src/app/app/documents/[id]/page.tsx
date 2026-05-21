'use client';

import { RouteGuard } from '../../../../components/route-guard';
import { ConsumerLayout } from '../../../../components/consumer-layout';
import { DocumentWorkspaceDetail } from '../../../../components/document/document-workspace-detail';

export default function DocumentDetailPage() {
  return (
    <RouteGuard allowedRoles={['consumer', 'staff', 'admin']}>
      <ConsumerLayout>
        <DocumentWorkspaceDetail backHref="/app/documents" documentsHref="/app/documents" />
      </ConsumerLayout>
    </RouteGuard>
  );
}
