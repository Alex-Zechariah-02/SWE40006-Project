import { RoutePlaceholderShell } from '../../components/route-placeholder-shell';

export const dynamic = 'force-dynamic';

export default function AppPlaceholderPage() {
  return (
    <RoutePlaceholderShell
      routePath="/app"
      routeTitle="Application workspace"
      routeSummary="A workspace route for document review and record management."
    />
  );
}
