'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { CheckCircle2, FileImage, FileText, FileUp, Loader2, UploadCloud } from 'lucide-react';

import { RouteGuard } from '../../../../components/route-guard';
import { EnterpriseLayout } from '../../../../components/enterprise-layout';
import { uploadDocument } from '../../../../lib/api/documents';
import { BalanceApiError } from '../../../../lib/api/client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { PageTransition } from '@/components/workspace/page-transition';
import { titleCase } from '@/lib/format';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB

export default function EnterpriseUploadPage() {
  return (
    <RouteGuard allowedRoles={['staff', 'admin']}>
      <EnterpriseLayout>
        <UploadContent />
      </EnterpriseLayout>
    </RouteGuard>
  );
}

function UploadContent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('other');
  const [tags, setTags] = useState('');
  const [claimIntent, setClaimIntent] = useState('none');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setError(null);
    if (selected.length === 0) { setFiles([]); return; }

    const accepted: File[] = [];
    for (const file of selected) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`Unsupported file type for ${file.name}. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(`${file.name} is too large. Maximum size is 10 MiB.`);
        continue;
      }
      accepted.push(file);
    }
    setFiles(accepted);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (files.length === 0) { setError('Please select at least one file.'); return; }

    setUploading(true);
    setProgress(0);
    try {
      let firstDocumentId: string | null = null;
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (!file) continue;

        const res = await uploadDocument(
          file,
          label || undefined,
          notes || undefined,
          category === 'other' ? undefined : category,
          tags || undefined,
          claimIntent === 'none' ? undefined : claimIntent
        );
        firstDocumentId ??= res.document.id;
        setProgress(Math.round(((index + 1) / files.length) * 100));
      }
      router.replace(firstDocumentId && files.length === 1 ? `/enterprise/documents/${firstDocumentId}` : '/enterprise/documents');
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
    <PageTransition>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.45fr]">
        <div className="grid gap-5">
          <div>
            <p className="text-sm text-muted-foreground">Document intake</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Upload workspace</h1>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <Card variant="panel">
              <CardContent className="p-5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background/60 px-6 py-12 text-center transition hover:border-primary/60 hover:bg-muted/50 group cursor-pointer"
                  disabled={uploading}
                >
                  <UploadCloud className="mb-3 size-10 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                  <span className="font-medium text-foreground">Drop receipts, invoices, or PDFs here</span>
                  <span className="mt-1 text-sm text-muted-foreground">PDF, JPEG, PNG, max 10 MiB each</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_EXTENSIONS.join(',')}
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="sr-only"
                />

                {files.length > 0 && (
                  <div className="mt-4 grid gap-2">
                    {files.map((file) => (
                      <div key={`${file.name}-${file.size}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
                        {file.type === 'application/pdf' ? <FileText className="size-4 text-info" /> : <FileImage className="size-4 text-success" />}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <Badge variant="neutral">{file.type.split('/').pop()}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Label htmlFor="label">Label</Label>
                <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} disabled={uploading} placeholder="Client meeting receipt" />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory} disabled={uploading}>
                  <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['restaurant', 'grocery', 'travel', 'software', 'hardware', 'utilities', 'transport', 'medical', 'education', 'other'].map((value) => (
                      <SelectItem key={value} value={value}>{titleCase(value)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tags">Tags</Label>
                <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} disabled={uploading} placeholder="tax, warranty, client-a" />
              </div>
              <div>
                <Label htmlFor="claimIntent">Claim intent</Label>
                <Select value={claimIntent} onValueChange={setClaimIntent} disabled={uploading}>
                  <SelectTrigger id="claimIntent"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not decided</SelectItem>
                    <SelectItem value="reimbursement">Reimbursement</SelectItem>
                    <SelectItem value="warranty">Warranty proof</SelectItem>
                    <SelectItem value="tax">Tax record</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={uploading} rows={3} placeholder="Purpose, payer, context, return window, or reimbursement details" />
            </div>

            {error && <Alert role="alert" variant="destructive">{error}</Alert>}
            {uploading && <Progress value={progress} />}

            <Button type="submit" disabled={uploading || files.length === 0} className="w-fit">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
              {uploading ? 'Uploading…' : `Upload ${files.length || ''} document${files.length === 1 ? '' : 's'}`}
            </Button>
          </form>
        </div>

        <Card variant="surface">
          <CardHeader>
            <CardTitle>Capture checklist</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            {[
              'Keep the receipt flat with all four edges visible.',
              'Avoid harsh shadows and glare on thermal paper.',
              'Use the original PDF for invoices when available.',
              'Confirm merchant, date, total, tax, and line items after Textract finishes.'
            ].map((item) => (
              <div key={item} className="grid grid-cols-[auto_1fr] gap-2">
                <CheckCircle2 className="mt-0.5 size-4 text-success" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
