import { AlertTriangle, Clock3, Flame, ShieldAlert, Sparkles } from 'lucide-react';
import type { CollapsePredictionResult } from '@/types';
import { RiskTimeline } from '@/components/RiskTimeline';

export function CollapsePredictionPanel({ prediction }: { prediction: CollapsePredictionResult | null }) {
  if (!prediction) return null;

  const severity = prediction.collapseProbability >= 75 ? 'critical' : prediction.collapseProbability >= 45 ? 'high' : 'moderate';

  return (
    <section className="glass-panel rounded-[24px] p-6 border border-[rgba(176,122,77,0.14)] bg-[#f5efe7]/45 shadow-sm space-y-5">
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shrink-0">
            <Sparkles className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">Architectural Collapse Forecast</h3>
            <p className="text-xs text-slate-500 font-bold mt-0.5">Probability and trend for architectural collapse, distilled into a board risk signal.</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-[#fffdf9] border border-[rgba(176,122,77,0.1)] rounded-2xl px-4 py-2.5 shadow-sm">
          <div className="text-right">
            <div className="text-2xl font-black text-rose-600 font-mono leading-none">{Math.round(prediction.collapseProbability)}%</div>
            <div className="text-[8px] font-black uppercase tracking-wider text-rose-500 mt-1">Probability</div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="text-right">
            <div className="text-xs font-black text-slate-800 uppercase leading-none flex items-center gap-1.5 justify-end">
              <Clock3 className="w-3.5 h-3.5 text-[#9a6a43]" />
              <span>{prediction.predictedTimeline}</span>
            </div>
            <div className={`text-[8px] font-black uppercase tracking-wider mt-1.5 px-2 py-0.5 rounded-full inline-block ${
              severity === 'critical' ? 'bg-rose-500/10 text-rose-600' : severity === 'high' ? 'bg-amber-500/10 text-amber-600' : 'bg-cyan-500/10 text-cyan-600'
            }`}>
              {severity} risk
            </div>
          </div>
        </div>
      </div>

      {/* Risk Trend Timeline Container */}
      <div className="rounded-[24px] border border-[rgba(176,122,77,0.1)] bg-[#fffdf9]/70 p-4 shadow-inner">
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#9a6a43] block">COLLAPSE RISK PROGRESSION</span>
            <p className="text-xs text-slate-600 font-bold mt-0.5">Baseline to now progression of collapse pressure.</p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50/50 px-3 py-1 text-xs font-bold text-rose-700 shadow-sm shrink-0">
            <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            <span>Rising Pressure</span>
          </div>
        </div>
        <RiskTimeline points={prediction.riskTrend} />
      </div>

      {/* Grid of Modules and Drivers */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Critical Modules */}
        <div className="flex flex-col rounded-2xl border border-cyan-150 bg-cyan-50/10 p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-cyan-800">
            <ShieldAlert className="w-4 h-4 text-cyan-600" />
            <span>Critical Modules</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {prediction.criticalModules.map((item) => (
              <span key={item} className="rounded-full border border-cyan-200 bg-white/80 px-3 py-1 text-xs font-bold text-cyan-900 shadow-sm hover:scale-102 transition-all">
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Primary Drivers */}
        <div className="flex flex-col rounded-2xl border border-rose-200 bg-rose-50/10 p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Primary Drivers</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {prediction.instabilityDrivers.map((item) => (
              <span key={item} className="rounded-full border border-rose-200 bg-white/80 px-3 py-1 text-xs font-bold text-rose-900 shadow-sm hover:scale-102 transition-all">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
