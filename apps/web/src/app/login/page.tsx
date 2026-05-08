import { RoutePlaceholderShell } from '../../components/route-placeholder-shell';

export const dynamic = 'force-dynamic';

export default function LoginPlaceholderPage() {
  return (
    <RoutePlaceholderShell
      routePath="/login"
      routeTitle="Login page"
      routeSummary="A secure entry route for Balance users."
    />
  );
}
