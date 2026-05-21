'use client';

import { useEffect, useState } from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

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
        <Card key={item.path}>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle>{item.label}</CardTitle>
            <Badge variant={item.status === 'Reachable' ? 'success' : item.status === 'Checking' ? 'info' : 'warning'}>
              {item.status}
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{item.path}</p>
            <pre className="mt-4 max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-4 font-mono text-xs leading-6 text-muted-foreground whitespace-pre-wrap">
              {item.detail}
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
