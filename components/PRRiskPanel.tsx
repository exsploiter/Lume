import type { PRRiskResult } from '@/types';

export function PRRiskPanel({ result }: { result: PRRiskResult | null }) {
  if (!result) return null;
  return (
    <section className="glass-panel rounded-[24px] p-6 border border-white/10 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">PR risk analysis</h3>
          <p className="text-sm text-slate-400">Merge safety, security regression, and architecture impact.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-100">{result.mergeRisk}</div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{Math.round(result.riskScore)} / 100</div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-300">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Touched critical files</div>
          <div className="flex flex-wrap gap-2">{result.criticalFilesTouched.map((item) => <span key={item} className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-200">{item}</span>)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Recommendations</div>
          <div className="space-y-1 text-xs text-slate-400">{result.recommendations.map((item) => <div key={item}>{item}</div>)}</div>
        </div>
      </div>
    </section>
  );
}
