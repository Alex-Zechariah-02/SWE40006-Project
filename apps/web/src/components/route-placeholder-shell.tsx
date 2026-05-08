import Link from 'next/link';
import { loadAppConfig } from '@balance/config';
import { AppShell, StatusCard } from '@balance/ui';

import { ApiStatusPanel } from './api-status-panel';

interface RoutePlaceholderShellProps {
  routePath: '/' | '/login' | '/app';
  routeTitle: string;
  routeSummary: string;
}

const routeLinks: Array<{ href: '/' | '/login' | '/app'; label: string }> = [
  { href: '/', label: 'Home' },
  { href: '/login', label: 'Login' },
  { href: '/app', label: 'App' }
];

export function RoutePlaceholderShell({ routePath, routeTitle, routeSummary }: RoutePlaceholderShellProps) {
  const config = loadAppConfig();

  return (
    <AppShell
      appName={config.appName}
      subtitle="Document workflow platform"
      environment={config.appEnv}
      description="Balance converts transaction documents into structured records for personal management and enterprise workflow."
    >
      <StatusCard
        title="Release"
        value={config.appVersion}
        detail={`Version ${config.appVersion} | Commit ${config.gitCommit} | Build ${config.buildId}`}
      />
      <StatusCard title="Current Route" value={routePath} detail={`${routeTitle}. ${routeSummary}`} />
      <StatusCard
        title="Runtime"
        value={config.appName}
        detail={`Environment: ${config.appEnv.toUpperCase()}`}
      />
      <StatusCard
        title="API Access"
        value={`${config.apiBasePath}/*`}
        detail="Health and version checks stay available through the Balance web app while API traffic is forwarded internally."
      />
      <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/20 md:col-span-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">Available Routes</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {routeLinks.map((item) => {
            const isActive = item.href === routePath;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:border-sky-400/30 hover:bg-sky-400/10'
                }`}
              >
                {item.label} · {item.href}
              </Link>
            );
          })}
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          The routes for <strong>/</strong>, <strong>/login</strong>, and <strong>/app</strong> are available today so the current
          Balance platform stays easy to navigate while document intake, sign-in, and workspace features continue to expand.
        </p>
      </article>
      <div className="md:col-span-2">
        <ApiStatusPanel healthPath={config.apiHealthPath} versionPath={config.apiVersionPath} />
      </div>
    </AppShell>
  );
}
