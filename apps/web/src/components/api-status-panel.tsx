'use client';

import { useEffect, useState } from 'react';

type EndpointState = {
  label: string;
  path: string;
  status: string;
  detail: string;
};

function buildInitialState(healthPath: string, versionPath: string): EndpointState[] {
  return [
    {
      label: 'API Health',
      path: healthPath,
      status: 'Checking',
      detail: 'Trying the proxy-friendly health route.'
    },
    {
      label: 'API Version',
      path: versionPath,
      status: 'Checking',
      detail: 'Trying the proxy-friendly version route.'
    }
  ];
}

interface ApiStatusPanelProps {
  healthPath: string;
  versionPath: string;
}

export function ApiStatusPanel({ healthPath, versionPath }: ApiStatusPanelProps) {
  const [endpoints, setEndpoints] = useState<EndpointState[]>(() => buildInitialState(healthPath, versionPath));

  useEffect(() => {
    let cancelled = false;
    const initialState = buildInitialState(healthPath, versionPath);

    setEndpoints(initialState);

    async function loadStatuses() {
      const nextState = await Promise.all(
        initialState.map(async (item) => {
          try {
            const response = await fetch(item.path, { cache: 'no-store' });
            const payload = (await response.json()) as Record<string, unknown>;

            if (!response.ok) {
              return {
                ...item,
                status: `HTTP ${response.status}`,
                detail: JSON.stringify(payload, null, 2)
              };
            }

            return {
              ...item,
              status: 'Reachable',
              detail: JSON.stringify(payload, null, 2)
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';

            return {
              ...item,
              status: 'Unavailable',
              detail: message
            };
          }
        })
      );

      if (!cancelled) {
        setEndpoints(nextState);
      }
    }

    void loadStatuses();

    return () => {
      cancelled = true;
    };
  }, [healthPath, versionPath]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {endpoints.map((item) => (
        <article key={item.path} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">{item.label}</h2>
            <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
              {item.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-400">{item.path}</p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950/70 p-4 text-xs leading-6 text-slate-300 whitespace-pre-wrap">
            {item.detail}
          </pre>
        </article>
      ))}
    </div>
  );
}
