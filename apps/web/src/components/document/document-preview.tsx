'use client';

import { useEffect, useState } from 'react';
import { FileText, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { getToken } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function DocumentPreview({ documentId, contentType, filename }: { documentId: string; contentType?: string | null; filename: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    async function load() {
      try {
        const token = getToken();
        const res = await fetch(`/api/documents/${documentId}/preview`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error(`Preview unavailable (${res.status})`);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Preview unavailable');
      }
    }

    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId]);

  return (
    <div className="grid min-h-[520px] grid-rows-[auto_1fr] overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{filename}</p>
          <p className="text-xs text-muted-foreground">{contentType ?? 'Stored document'}</p>
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}><ZoomOut /></Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))}><ZoomIn /></Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Rotate preview" onClick={() => setRotation((value) => value + 90)}><RotateCw /></Button>
        </div>
      </div>
      <div className="grid place-items-center overflow-auto bg-muted/45 p-4">
        {!url && !error && <Skeleton className="h-full min-h-96 w-full" />}
        {error && (
          <div className="grid place-items-center gap-2 text-center text-muted-foreground">
            <FileText className="size-10" />
            <p className="text-sm">{error}</p>
          </div>
        )}
        {url && (contentType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) && (
          <iframe title={filename} src={url} className="h-[680px] w-full rounded-md border border-border bg-background" />
        )}
        {url && contentType !== 'application/pdf' && !filename.toLowerCase().endsWith('.pdf') && (
          <img
            src={url}
            alt={`Preview of ${filename}`}
            className="max-h-[720px] max-w-full rounded-md border border-border bg-background object-contain shadow-sm"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: 'center' }}
          />
        )}
      </div>
    </div>
  );
}
