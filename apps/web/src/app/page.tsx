import { RoutePlaceholderShell } from '../components/route-placeholder-shell';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <RoutePlaceholderShell
      routePath="/"
      routeTitle="Landing page"
      routeSummary="A public overview of the document workflow platform."
    />
  );
}
