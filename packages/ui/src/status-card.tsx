interface StatusCardProps {
  title: string;
  value: string;
  detail: string;
}

export function StatusCard({ title, value, detail }: StatusCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/20">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </article>
  );
}
