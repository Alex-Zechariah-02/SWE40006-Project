'use client';

import { RouteGuard } from '../../../../components/route-guard';
import { EnterpriseLayout } from '../../../../components/enterprise-layout';
import { DocumentWorkspaceDetail } from '../../../../components/document/document-workspace-detail';

export default function EnterpriseDocumentDetailPage() {
  return (
    <RouteGuard allowedRoles={['staff', 'admin']}>
      <EnterpriseLayout>
        <DocumentWorkspaceDetail backHref="/enterprise/documents" documentsHref="/enterprise/documents" />
      </EnterpriseLayout>
    </RouteGuard>
  );
}

