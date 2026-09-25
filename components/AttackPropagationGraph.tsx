import type { AttackGraphResult } from '@/types';
import { AttackPathCard } from '@/components/AttackPathCard';
import { Route } from 'lucide-react';

export function AttackPropagationGraph({ graph }: { graph: AttackGraphResult | null }) {
  if (!graph) return null;
  const topPaths = graph.criticalPaths.slice(0, 3);
  return (
    <section className="glass-panel rounded-[24px] p-6 border border-[rgba(176,122,77,0.14)] bg-[#f5efe7]/45 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
            <Route className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">Attack Propagation Paths</h3>
            <p className="text-xs text-slate-500 font-bold mt-0.5">Top multi-hop paths and privileged architectural choke points.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#fffdf9] border border-[rgba(176,122,77,0.1)] rounded-2xl px-4 py-2.5 shadow-sm shrink-0">
          <div className="text-right">
            <div className="text-2xl font-black text-amber-600 font-mono leading-none">{Math.round(graph.propagationRisk)}</div>
            <div className="text-[8px] font-black uppercase tracking-wider text-[#9a6a43] mt-1.5">Propagation Risk</div>
          </div>
        </div>
      </div>

      {/* Grid of paths */}
      <div className="grid gap-4 md:grid-cols-3">
        {topPaths.length > 0 ? (
          topPaths.map((path) => (
            <AttackPathCard key={`${path.sourceNode}-${path.targetNode}`} path={path} />
          ))
        ) : (
          <div className="text-sm font-semibold text-slate-400 py-6 text-center col-span-3 bg-[#fffdf9]/70 rounded-2xl border border-[rgba(176,122,77,0.1)]">
            No propagated attack chains identified.
          </div>
        )}
      </div>
    </section>
  );
}
