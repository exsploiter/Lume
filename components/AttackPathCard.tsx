import type { AttackPath } from '@/types';

export function AttackPathCard({ path }: { path: AttackPath }) {
  // Extract brief label for source node
  const sourceLabel = path.sourceNode.includes('/') 
    ? path.sourceNode.split('/').pop() || path.sourceNode 
    : path.sourceNode;

  return (
    <div className="rounded-2xl border border-[rgba(176,122,77,0.14)] bg-[#fffdf9]/80 p-4 space-y-3.5 shadow-sm hover:-translate-y-0.5 hover:shadow transition-all flex flex-col justify-between min-h-[220px]">
      <div className="space-y-3">
        {/* Card Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-extrabold text-slate-800 truncate" title={path.sourceNode}>
            {sourceLabel}
          </div>
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
            path.propagationRisk >= 75 ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'
          }`}>
            Risk {Math.round(path.propagationRisk)}
          </span>
        </div>

        {/* Dynamic Route Flow Visualizer */}
        <div className="flex flex-col gap-1.5 bg-[#f5efe7]/30 border border-[rgba(176,122,77,0.06)] rounded-xl p-2.5 font-mono text-[9.5px]">
          {path.path.map((step, idx) => {
            // Trim step to only show function or filename
            const stepDisplay = step.includes('::') ? step.split('::')[1] || step : step;
            return (
              <div key={idx} className="flex items-center gap-1.5 text-slate-700 leading-tight">
                {idx > 0 && <span className="text-[#9a6a43]/50 shrink-0">↳</span>}
                <span className={`truncate ${idx === path.path.length - 1 ? 'text-[#9a6a43] font-bold' : 'text-slate-500'}`} title={step}>
                  {stepDisplay}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Technical Metric Chips */}
      <div className="flex flex-wrap gap-1.5 text-[9px] font-bold mt-auto pt-2">
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
          Cpx: {path.attackComplexity}
        </span>
        <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-purple-700">
          Priv: {Math.round(path.privilegeEscalationPotential)}
        </span>
        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
          Expl: {Math.round(path.exploitabilityScore)}
        </span>
      </div>
    </div>
  );
}
