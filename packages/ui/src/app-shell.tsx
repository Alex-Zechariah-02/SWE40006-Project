import type { PropsWithChildren } from 'react';

interface AppShellProps extends PropsWithChildren {
  appName: string;
  subtitle?: string;
  environment: string;
  description: string;
}

export function AppShell({
  appName,
  subtitle,
  environment,
  description,
  children
}: AppShellProps) {
  const environmentLabel = environment.toUpperCase();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/40">
          <div className="mb-4 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
            {environmentLabel}
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">{appName}</h1>
          {subtitle ? <p className="mt-2 text-lg text-slate-300">{subtitle}</p> : null}
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        </header>
        <section className="grid gap-4 md:grid-cols-2">{children}</section>
      </div>
    </main>
  );
}
