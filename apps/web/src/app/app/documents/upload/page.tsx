'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { RouteGuard } from '../../../../components/route-guard';
import { ConsumerLayout } from '../../../../components/consumer-layout';
import { uploadDocument } from '../../../../lib/api/documents';
import { BalanceApiError } from '../../../../lib/api/client';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB

export default function UploadPage() {
  return (
    <RouteGuard allowedRoles={['consumer']}>
      <ConsumerLayout>
        <UploadContent />
      </ConsumerLayout>
    </RouteGuard>
  );
}

function UploadContent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setError(null);
    if (!selected) { setFile(null); return; }

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError(`Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`);
      setFile(null);
      return;
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setError('File is too large. Maximum size is 10 MiB.');
      setFile(null);
      return;
    }
    setFile(selected);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) { setError('Please select a file.'); return; }

    setUploading(true);
    try {
      const res = await uploadDocument(file, label || undefined, notes || undefined);
      router.replace(`/app/documents/${res.document.id}`);
    } catch (err) {
      if (err instanceof BalanceApiError) {
        if (err.status === 413) setError('File is too large. Maximum size is 10 MiB.');
        else if (err.status === 415) setError('Unsupported file type.');
        else if (err.status === 503) setError('Storage service unavailable. Please try again.');
        else setError(err.error.message);
      } else {
        setError('Upload failed. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload document</h1>
        <p className="mt-1 text-sm text-slate-400">Upload a receipt, invoice, or transaction document.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            File <span className="text-slate-500">(PDF, JPEG, PNG · max 10 MiB)</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border file:border-white/10 file:bg-white/5 file:px-3 file:py-2 file:text-sm file:text-slate-300 hover:file:bg-white/10 disabled:opacity-50"
          />
          {file && (
            <p className="mt-1 text-xs text-slate-500">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>
          )}
        </div>

        <div>
          <label htmlFor="label" className="block text-sm font-medium text-slate-300 mb-1">
            Label <span className="text-slate-500">(optional)</span>
          </label>
          <input
            id="label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={uploading}
            placeholder="e.g. Client meeting receipt"
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/50 focus:outline-none disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-slate-300 mb-1">
            Notes <span className="text-slate-500">(optional)</span>
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={uploading}
            rows={3}
            placeholder="Any notes about this document…"
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/50 focus:outline-none disabled:opacity-50 resize-none"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={uploading || !file}
          className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading…' : 'Upload document'}
        </button>
      </form>
    </div>
  );
}
