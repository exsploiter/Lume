export function RiskTimeline({ points }: { points: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 h-24">
        {points.map((point) => (
          <div key={point.label} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full rounded-t-xl bg-gradient-to-t from-cyan-500/60 to-cyan-200/80" style={{ height: `${Math.max(8, (point.value / max) * 100)}%` }} />
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
